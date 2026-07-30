from __future__ import annotations

import logging
from typing import Optional, Protocol, Any
import inspect

from backend.agents.research_agent import ResearchAgent
from backend.agents.risk_agent import RiskAgent
from backend.agents.decision_agent import DecisionAgent
from backend.agents.strategy_agent import StrategyAgent
from backend.workflow_state import WorkflowState, WorkflowStep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WorkflowOrchestrator(Protocol):
    def execute(self, symbol: str, state: Optional[WorkflowState] = None, parsed_query: Optional[Any] = None) -> WorkflowState:
        ...


class DefaultWorkflowOrchestrator:
    def __init__(
        self,
        research_agent: Optional[ResearchAgent] = None,
        strategy_agent: Optional[StrategyAgent] = None,
        risk_agent: Optional[RiskAgent] = None,
        decision_agent: Optional[DecisionAgent] = None,
    ) -> None:
        self.research_agent = research_agent or ResearchAgent()
        self.strategy_agent = strategy_agent or StrategyAgent()
        self.risk_agent = risk_agent or RiskAgent()
        self.decision_agent = decision_agent

    def execute(self, symbol: str, state: Optional[WorkflowState] = None, parsed_query: Optional[Any] = None) -> WorkflowState:
        workflow_state = state or WorkflowState()
        if parsed_query:
            workflow_state.parsed_query = parsed_query

        try:
            workflow_state.mark_step(WorkflowStep.RESEARCH)
            workflow_state.research_report = self.research_agent.research(symbol, workflow_state=workflow_state)

            workflow_state.mark_step(WorkflowStep.STRATEGY)
            # keep backward-compatible surface: invoke the strategy agent flexibly
            workflow_state.strategy_report = self._invoke_agent(
                self.strategy_agent.strategy, workflow_state.research_report, workflow_state
            )

            workflow_state.mark_step(WorkflowStep.RISK)
            # keep backward-compatible surface: invoke the risk agent flexibly
            workflow_state.risk_report = self._invoke_agent(
                self.risk_agent.assess_risk, workflow_state.research_report, workflow_state
            )

            # Optionally run a DecisionAgent if present
            if getattr(self, "decision_agent", None) is not None:
                workflow_state.mark_step(WorkflowStep.DECISION)
                workflow_state.decision_report = self._invoke_agent(
                    self.decision_agent.decide, workflow_state.research_report, workflow_state
                )
                workflow_state.complete_step(WorkflowStep.DECISION)

            workflow_state.complete_step(WorkflowStep.COMPLETE)
            return workflow_state
        except Exception as exc:
            logger.exception("Workflow execution failed for %s", symbol)
            workflow_state.record_error(str(exc))
            raise
        finally:
            workflow_state.finalize()

    def _invoke_agent(self, func: Any, research_report: Any, workflow_state: WorkflowState) -> Any:
        """Invoke an agent callable while being tolerant of older signatures.

        Supports the following shapes:
        - func(research_report)
        - func(research_report=..., workflow_state=...)
        - func(workflow_state=...)
        - func()
        """
        try:
            sig = inspect.signature(func)
            params = sig.parameters
            if "workflow_state" in params and "research_report" in params:
                return func(research_report=research_report, workflow_state=workflow_state)
            if "research_report" in params:
                return func(research_report)
            if "workflow_state" in params:
                return func(workflow_state=workflow_state)
        except (TypeError, ValueError):
            # Fallback when signature introspection isn't possible
            pass
        # Best-effort call: try with both kwargs, then single arg, then no-arg
        try:
            return func(research_report=research_report, workflow_state=workflow_state)
        except TypeError:
            try:
                return func(research_report)
            except TypeError:
                try:
                    return func(workflow_state=workflow_state)
                except TypeError:
                    return func()
