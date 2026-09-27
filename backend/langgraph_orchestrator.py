from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Generator, Optional

from backend.workflow_orchestrator import WorkflowOrchestrator
from backend.workflow_state import WorkflowState, WorkflowStep

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class LangGraphNotAvailable(Exception):
    pass


class LangGraphWorkflowOrchestrator(WorkflowOrchestrator):
    """Orchestrator that builds a LangGraph-style workflow.

    If `langgraph` is installed, this will use it. If not, a safe local
    parallel executor is used as a fallback. In both cases agents communicate
    via `WorkflowState` (Pydantic) objects.

    Features:
    - Research -> (Strategy || Risk) in parallel -> Decision -> Final state
    - Structured Pydantic objects across agents
    - Streaming support via a generator that yields intermediate WorkflowState
    - Error handling and logging
    """

    def __init__(
        self,
        research_fn: Callable[[str, Optional[WorkflowState]], object],
        strategy_fn: Callable[[Optional[object], Optional[WorkflowState]], object],
        risk_fn: Callable[[Optional[object], Optional[WorkflowState]], object],
        decision_fn: Optional[Callable[[Optional[object], Optional[WorkflowState]], object]] = None,
    ) -> None:
        self.research_fn = research_fn
        self.strategy_fn = strategy_fn
        self.risk_fn = risk_fn
        self.decision_fn = decision_fn

        # Try to import LangGraph; if unavailable, we'll use fallback executor
        try:
            import langgraph as _lg  # type: ignore

            self._langgraph = _lg
            logger.info("LangGraph detected and will be used for orchestration")
        except Exception:
            self._langgraph = None
            logger.info("LangGraph not available; using fallback parallel executor")

    def execute(self, symbol: str, state: Optional[WorkflowState] = None, stream: bool = False):
        """Execute the workflow.

        If `stream` is True, returns a generator yielding WorkflowState snapshots.
        Otherwise returns the final WorkflowState.
        """
        workflow_state = state or WorkflowState()

        if self._langgraph is not None:
            # Prefer real LangGraph if installed
            return self._execute_with_langgraph(symbol, workflow_state, stream=stream)
        else:
            return self._execute_with_fallback(symbol, workflow_state, stream=stream)

    def _execute_with_langgraph(self, symbol: str, workflow_state: WorkflowState, stream: bool):
        # Minimal integration: build nodes that call provided callables and pass WorkflowState
        lg = self._langgraph

        # Define node wrappers
        def research_node(input_symbol, state):
            try:
                state.mark_step(WorkflowStep.RESEARCH)
                res = self.research_fn(input_symbol, workflow_state=state)
                state.research_report = res
                state.complete_step(WorkflowStep.RESEARCH)
                logger.info("Research node completed for %s", input_symbol)
                return state
            except Exception as exc:
                state.record_error(str(exc))
                logger.exception("Research node failed: %s", exc)
                raise

        def strategy_node(_, state):
            try:
                state.mark_step(WorkflowStep.STRATEGY)
                res = self.strategy_fn(research_report=state.research_report, workflow_state=state)
                state.strategy_report = res
                state.complete_step(WorkflowStep.STRATEGY)
                logger.info("Strategy node completed for %s", state.research_report.symbol if state.research_report else "N/A")
                return state
            except Exception as exc:
                state.record_error(str(exc))
                logger.exception("Strategy node failed: %s", exc)
                raise

        def risk_node(_, state):
            try:
                state.mark_step(WorkflowStep.RISK)
                res = self.risk_fn(research_report=state.research_report, workflow_state=state)
                state.risk_report = res
                state.complete_step(WorkflowStep.RISK)
                logger.info("Risk node completed for %s", state.research_report.symbol if state.research_report else "N/A")
                return state
            except Exception as exc:
                state.record_error(str(exc))
                logger.exception("Risk node failed: %s", exc)
                raise

        def decision_node(_, state):
            if self.decision_fn is None:
                return state
            try:
                state.mark_step(WorkflowStep.DECISION)
                res = self.decision_fn(
                    research_report=state.research_report,
                    strategy_report=state.strategy_report,
                    risk_report=state.risk_report,
                    workflow_state=state,
                )
                state.decision_report = res
                state.complete_step(WorkflowStep.DECISION)
                logger.info("Decision node completed for %s", state.research_report.symbol if state.research_report else "N/A")
                return state
            except Exception as exc:
                state.record_error(str(exc))
                logger.exception("Decision node failed: %s", exc)
                raise

        # Build a simple LangGraph graph if API supports it. We keep this generic so
        # callers with different LangGraph versions can still work.
        try:
            Graph = getattr(self._langgraph, "Graph", None) or getattr(self._langgraph, "Flow", None)
            if Graph is None:
                raise RuntimeError("Unsupported LangGraph API")

            graph = Graph()
            # Register nodes
            r_node = graph.add_node(research_node, name="research")
            s_node = graph.add_node(strategy_node, name="strategy")
            k_node = graph.add_node(risk_node, name="risk")
            d_node = graph.add_node(decision_node, name="decision")

            # Connect nodes: research -> strategy, research -> risk; strategy+risk -> decision
            graph.add_edge(r_node, s_node)
            graph.add_edge(r_node, k_node)
            graph.add_edge(s_node, d_node)
            graph.add_edge(k_node, d_node)

            # Execute graph
            result = graph.run(symbol, workflow_state)
            return result
        except Exception as exc:
            logger.warning("LangGraph execution failed, falling back: %s", exc)
            return self._execute_with_fallback(symbol, workflow_state, stream=stream)

    def _execute_with_fallback(self, symbol: str, workflow_state: WorkflowState, stream: bool):
        """Fallback executor that runs research then runs strategy & risk in parallel, then decision."""

        # Research step
        try:
            workflow_state.mark_step(WorkflowStep.RESEARCH)
            research_res = self.research_fn(symbol, workflow_state=workflow_state)
            workflow_state.research_report = research_res
            workflow_state.complete_step(WorkflowStep.RESEARCH)
            if stream:
                yield workflow_state
        except Exception as exc:
            workflow_state.record_error(str(exc))
            logger.exception("Research failed: %s", exc)
            if stream:
                yield workflow_state
            return workflow_state

        # Parallel: strategy and risk
        futures = {}
        with ThreadPoolExecutor(max_workers=2) as ex:
            futures[ex.submit(self._safe_call, self.strategy_fn, workflow_state, "strategy")] = "strategy"
            futures[ex.submit(self._safe_call, self.risk_fn, workflow_state, "risk")] = "risk"

            for fut in as_completed(futures):
                name = futures[fut]
                try:
                    result = fut.result()
                    if name == "strategy":
                        workflow_state.strategy_report = result
                        workflow_state.complete_step(WorkflowStep.STRATEGY)
                    else:
                        workflow_state.risk_report = result
                        workflow_state.complete_step(WorkflowStep.RISK)
                    logger.info("%s completed", name)
                    if stream:
                        yield workflow_state
                except Exception as exc:
                    workflow_state.record_error(f"{name} failed: {exc}")
                    logger.exception("%s failed: %s", name, exc)
                    if stream:
                        yield workflow_state

        # Decision step
        if self.decision_fn is not None:
            try:
                workflow_state.mark_step(WorkflowStep.DECISION)
                decision = self.decision_fn(
                    research_report=workflow_state.research_report,
                    strategy_report=workflow_state.strategy_report,
                    risk_report=workflow_state.risk_report,
                    workflow_state=workflow_state,
                )
                workflow_state.decision_report = decision
                workflow_state.complete_step(WorkflowStep.DECISION)
                if stream:
                    yield workflow_state
            except Exception as exc:
                workflow_state.record_error(str(exc))
                logger.exception("Decision failed: %s", exc)
                if stream:
                    yield workflow_state

        workflow_state.complete_step(WorkflowStep.COMPLETE)
        if stream:
            yield workflow_state
        else:
            return workflow_state

    def _safe_call(self, func, workflow_state: WorkflowState, name: str):
        # Support various signatures for compatibility
        try:
            return func(research_report=workflow_state.research_report, workflow_state=workflow_state)
        except TypeError:
            try:
                return func(workflow_state=workflow_state)
            except TypeError:
                return func(workflow_state.research_report)
