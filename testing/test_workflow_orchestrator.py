"""Workflow orchestrator tests against the current report models (ResearchReport.ticker, RiskReport, `generation`).

Research is stubbed (no market data / network); Strategy, Risk and Decision are either stubs or the real
rule-based agents with Gemini switched off. All figures are synthetic fixtures.

Run with: python -m unittest testing.test_workflow_orchestrator
"""
import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from agents.gemini_client import GenerationInfo
from backend.agents.decision_agent import DecisionAgent
from backend.agents.research_agent import ResearchReport
from backend.agents.risk_agent import RiskAgent, RiskReport
from backend.agents.strategy_agent import StrategyAgent, StrategyReport
from backend.query_understanding import ParsedQuery
from backend.workflow_orchestrator import DefaultWorkflowOrchestrator
from backend.workflow_state import WorkflowState, WorkflowStep
from orchestrator import orchestrator as orchestrator_module


class RuleBasedLanguageAgent:
    """Gemini switched off, as when GEMINI_API_KEY is missing."""

    use_gemini = False
    gemini_model = None
    unavailable_reason = "no_api_key"


def make_research_report(ticker: str, **overrides) -> ResearchReport:
    fields = dict(
        company="Test Company",
        ticker=ticker,
        current_price=100.0,
        market_cap=5e10,
        pe_ratio=22.0,
        sector="Tech",
        high_52_week=130.0,
        low_52_week=90.0,
        moving_averages={"20d": 98.0, "50d": 95.0},
        rsi=55.0,
        latest_news=[{"title": "Test Company posts record profit"}],
        fundamental_summary="Research summary",
        currency="USD",
        generation=GenerationInfo.llm("stub-model"),
    )
    fields.update(overrides)
    return ResearchReport(**fields)


class StubResearchAgent:
    def __init__(self, calls=None, **report_overrides):
        self.calls = calls if calls is not None else []
        self.report_overrides = report_overrides

    def research(self, stock_symbol: str, workflow_state=None) -> ResearchReport:
        self.calls.append("research")
        report = make_research_report(stock_symbol, **self.report_overrides)
        if workflow_state is not None:
            workflow_state.research_report = report
            workflow_state.complete_step(WorkflowStep.RESEARCH)
        return report


class StubStrategyAgent:
    def __init__(self, calls=None):
        self.calls = calls if calls is not None else []

    def strategy(self, research_report=None, workflow_state=None) -> StrategyReport:
        self.calls.append("strategy")
        report = StrategyReport(
            bull_thesis="Bull thesis",
            bear_thesis="Bear thesis",
            suggested_strategy="Hold",
            entry_zone="$95 - $98",
            exit_zone="$105 - $110",
            target="$115.00",
            time_horizon="3-6 months",
            confidence=0.72,
            reasoning="Strategy reasoning",
            currency="USD",
        )
        if workflow_state is not None:
            workflow_state.strategy_report = report
            workflow_state.complete_step(WorkflowStep.STRATEGY)
        return report


class StubRiskAgent:
    def __init__(self, calls=None):
        self.calls = calls if calls is not None else []

    def assess_risk(self, research_report=None, workflow_state=None) -> RiskReport:
        self.calls.append("risk")
        report = RiskReport(
            volatility="Moderate",
            liquidity="High",
            valuation="Fair",
            financial_risk="Low",
            news_risk="Low",
            macro_risk="Moderate",
            overall_risk="Moderate",
            overall_risk_rating="Medium",
            risk_score=51.0,
            weaknesses=["Watch valuation"],
            recommendations=["Use staged entries"],
            reasons=[f"Risk reasoning for {research_report.ticker}"],
        )
        if workflow_state is not None:
            workflow_state.risk_report = report
            workflow_state.complete_step(WorkflowStep.RISK)
        return report


class FailingAgent:
    def __init__(self, method, message="agent failed"):
        setattr(self, method, self._fail)
        self.message = message

    def _fail(self, *args, **kwargs):
        raise RuntimeError(self.message)


class WorkflowOrchestratorTests(unittest.TestCase):
    def test_execute_populates_shared_state(self):
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(),
            strategy_agent=StubStrategyAgent(),
            risk_agent=StubRiskAgent(),
        )

        state = orchestrator.execute("RELIANCE.BO")

        self.assertIsNotNone(state.research_report)
        self.assertIsNotNone(state.strategy_report)
        self.assertIsNotNone(state.risk_report)
        self.assertEqual(state.research_report.ticker, "RELIANCE.BO")
        self.assertEqual(state.strategy_report.suggested_strategy, "Hold")
        self.assertEqual(state.risk_report.overall_risk_rating, "Medium")
        self.assertIn(WorkflowStep.RESEARCH, state.metadata.completed_steps)
        self.assertIn(WorkflowStep.STRATEGY, state.metadata.completed_steps)
        self.assertIn(WorkflowStep.RISK, state.metadata.completed_steps)
        self.assertEqual(state.metadata.current_step, WorkflowStep.COMPLETE)
        self.assertIsNotNone(state.metadata.execution_time_seconds)
        self.assertEqual(state.metadata.errors, [])

    def test_decision_step_is_optional(self):
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(), strategy_agent=StubStrategyAgent(), risk_agent=StubRiskAgent()
        )
        state = orchestrator.execute("X")
        self.assertIsNone(state.decision_report)
        self.assertNotIn(WorkflowStep.DECISION, state.metadata.completed_steps)

    def test_agents_run_in_the_documented_order(self):
        calls = []
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(calls), strategy_agent=StubStrategyAgent(calls), risk_agent=StubRiskAgent(calls)
        )
        orchestrator.execute("X")
        self.assertEqual(calls, ["research", "strategy", "risk"])

    def test_parsed_query_is_stored_and_its_time_horizon_reaches_the_strategy(self):
        parsed = ParsedQuery(original_query="long term view", companies=["Test"], time_horizon="long_term")
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(),
            strategy_agent=StrategyAgent(language_agent=RuleBasedLanguageAgent()),
            risk_agent=StubRiskAgent(),
        )
        state = orchestrator.execute("TEST", parsed_query=parsed)
        self.assertIs(state.parsed_query, parsed)
        self.assertEqual(state.strategy_report.time_horizon, "long_term")


class RealAgentWorkflowTests(unittest.TestCase):
    """The real rule-based Strategy, Risk and Decision agents through the orchestrator."""

    def run_workflow(self, **research_overrides):
        language = RuleBasedLanguageAgent()
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(**research_overrides),
            strategy_agent=StrategyAgent(language_agent=language),
            risk_agent=RiskAgent(language_agent=language),
            decision_agent=DecisionAgent(language_agent=language),
        )
        return orchestrator.execute("FIX")

    def test_all_four_steps_complete_in_order(self):
        state = self.run_workflow()
        self.assertEqual(
            state.metadata.completed_steps,
            [WorkflowStep.RESEARCH, WorkflowStep.STRATEGY, WorkflowStep.RISK, WorkflowStep.DECISION, WorkflowStep.COMPLETE],
        )
        self.assertEqual(state.metadata.current_step, WorkflowStep.COMPLETE)
        self.assertEqual(state.metadata.errors, [])
        self.assertIn(state.decision_report.recommendation, ("BUY", "HOLD", "SELL"))
        self.assertTrue(state.strategy_report.entry_zone)
        self.assertTrue(state.risk_report.overall_risk_rating)

    def test_generation_metadata_is_per_report_and_research_is_untouched(self):
        state = self.run_workflow()
        self.assertEqual(state.research_report.generation.model_dump(), {"source": "llm", "model": "stub-model", "reason": None})
        for report in (state.strategy_report, state.risk_report, state.decision_report):
            self.assertEqual(report.generation.model_dump(), {"source": "fallback", "model": None, "reason": "no_api_key"})

    def test_currency_is_preserved_through_to_the_decision(self):
        for currency, symbol in (("USD", "$"), ("INR", "₹")):
            state = self.run_workflow(currency=currency)
            self.assertEqual(
                [state.research_report.currency, state.strategy_report.currency, state.decision_report.currency],
                [currency] * 3,
            )
            self.assertTrue(state.strategy_report.entry_zone.startswith(symbol))
            self.assertIn(f"Current price: {symbol}100.00", state.decision_report.overall_summary)

    def test_final_state_serialises_with_generation_for_the_api_response(self):
        payload = json.loads(json.dumps(self.run_workflow().model_dump(mode="json")))
        for name in ("research_report", "strategy_report", "risk_report", "decision_report"):
            self.assertIn(payload[name]["generation"]["source"], ("llm", "fallback"), name)
        self.assertEqual(payload["metadata"]["current_step"], "complete")


class FailureHandlingTests(unittest.TestCase):
    def test_research_failure_is_recorded_and_reraised(self):
        calls = []
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=FailingAgent("research", "no market data"),
            strategy_agent=StubStrategyAgent(calls),
            risk_agent=StubRiskAgent(calls),
        )
        state = WorkflowState()
        with self.assertRaisesRegex(RuntimeError, "no market data"):
            orchestrator.execute("X", state=state)
        self.assertEqual(state.metadata.current_step, WorkflowStep.FAILED)
        self.assertEqual(state.metadata.errors, ["no market data"])
        self.assertIsNotNone(state.metadata.execution_time_seconds)  # finalize() ran
        self.assertEqual(calls, [])  # strategy and risk were not attempted

    def test_strategy_failure_stops_the_workflow_before_risk(self):
        calls = []
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(calls),
            strategy_agent=FailingAgent("strategy", "strategy broke"),
            risk_agent=StubRiskAgent(calls),
        )
        state = WorkflowState()
        with self.assertRaisesRegex(RuntimeError, "strategy broke"):
            orchestrator.execute("X", state=state)
        self.assertEqual(calls, ["research"])
        self.assertEqual(state.metadata.current_step, WorkflowStep.FAILED)
        self.assertIsNotNone(state.research_report)
        self.assertIsNone(state.risk_report)


class WorkflowEndpointTests(unittest.TestCase):
    def post(self, body):
        return TestClient(orchestrator_module.app).post("/workflow/execute", json=body)

    def test_endpoint_returns_the_full_state_including_generation(self):
        language = RuleBasedLanguageAgent()
        orchestrator = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(),
            strategy_agent=StrategyAgent(language_agent=language),
            risk_agent=RiskAgent(language_agent=language),
            decision_agent=DecisionAgent(language_agent=language),
        )

        class StubParser:
            def parse(self, query):
                return ParsedQuery(original_query=query, companies=["Test"])

        with mock.patch.object(orchestrator_module, "workflow_orchestrator", orchestrator), \
                mock.patch.object(orchestrator_module, "query_parser", StubParser()), \
                mock.patch.object(orchestrator_module.ticker_resolver, "resolve", lambda target: "TEST"):
            response = self.post({"symbol": "Analyze Test"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("error", payload)
        self.assertEqual(payload["research_report"]["ticker"], "TEST")
        self.assertEqual(payload["decision_report"]["generation"]["reason"], "no_api_key")
        self.assertEqual(payload["metadata"]["completed_steps"][-1], "complete")

    def test_unresolvable_ticker_returns_a_failed_state_not_an_exception(self):
        class StubParser:
            def parse(self, query):
                return ParsedQuery(original_query=query, companies=["nothing"])

        with mock.patch.object(orchestrator_module, "query_parser", StubParser()), \
                mock.patch.object(orchestrator_module.ticker_resolver, "resolve", lambda target: None):
            payload = self.post({"symbol": "nonsense"}).json()
        self.assertEqual(payload["metadata"]["current_step"], "failed")
        self.assertIn("Ticker not found", payload["metadata"]["errors"][0])


class DecisionEndpointTests(unittest.TestCase):
    """POST /decision/decision takes plain JSON, which must be validated into typed reports before the decision
    agent sees it. LLM paths use a mocked model: they say nothing about whether real Gemini works."""

    def request_body(self, currency="INR", with_strategy=True, with_risk=True):
        language = RuleBasedLanguageAgent()
        research = make_research_report("FIX", currency=currency)
        state = WorkflowState(research_report=research)
        body = {"research_report": research.model_dump(mode="json")}
        if with_strategy:
            body["strategy_report"] = StrategyAgent(language_agent=language).strategy(workflow_state=state).model_dump(mode="json")
        if with_risk:
            body["risk_report"] = RiskAgent(language_agent=language).assess_risk(workflow_state=state).model_dump(mode="json")
        return body

    def post(self, body, language_agent=None):
        client = TestClient(orchestrator_module.app)
        agent = orchestrator_module.workflow_orchestrator.decision_agent
        with mock.patch.object(agent, "language_agent", language_agent or RuleBasedLanguageAgent()):
            return client.post("/decision/decision", json=body)

    # ---- Gemini disabled
    def test_rule_based_decision_keeps_currency_price_company_and_generation(self):
        response = self.post(self.request_body("INR"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("error", payload)
        self.assertEqual(payload["currency"], "INR")
        self.assertIn("Test Company (FIX)", payload["overall_summary"])
        self.assertIn("Current price: ₹100.00", payload["overall_summary"])
        self.assertIn(payload["recommendation"], ("BUY", "HOLD", "SELL"))
        self.assertEqual(payload["generation"], {"source": "fallback", "model": None, "reason": "no_api_key"})
        evidence = " ".join(payload["supporting_evidence"])
        self.assertIn("₹", evidence)
        self.assertNotIn("$", evidence + payload["overall_summary"])

    def test_the_typed_strategy_and_risk_reports_are_used(self):
        summary = self.post(self.request_body()).json()["overall_summary"]
        self.assertIn("Suggested approach:", summary)  # from the strategy report
        self.assertIn("Risk profile:", summary)  # from the risk report
        research_only = self.post(self.request_body(with_strategy=False, with_risk=False))
        self.assertEqual(research_only.status_code, 200)
        self.assertNotIn("Suggested approach:", research_only.json()["overall_summary"])

    def test_us_currency_is_preserved_too(self):
        payload = self.post(self.request_body("USD")).json()
        self.assertEqual(payload["currency"], "USD")
        self.assertIn("Current price: $100.00", payload["overall_summary"])

    def test_unverified_currency_stays_unverified(self):
        payload = self.post(self.request_body(None)).json()
        self.assertIsNone(payload["currency"])
        self.assertIn("Current price: ¤100.00", payload["overall_summary"])

    def test_workflow_output_can_be_posted_back_unchanged(self):
        language = RuleBasedLanguageAgent()
        state = DefaultWorkflowOrchestrator(
            research_agent=StubResearchAgent(currency="INR"),
            strategy_agent=StrategyAgent(language_agent=language),
            risk_agent=RiskAgent(language_agent=language),
        ).execute("FIX")
        dumped = state.model_dump(mode="json")
        body = {k: dumped[k] for k in ("research_report", "strategy_report", "risk_report")}
        # the dump carries derived / metadata fields (market_cap_tier, generation) the models must accept back
        self.assertIn("market_cap_tier", body["research_report"])
        response = self.post(body)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("error", response.json())
        self.assertEqual(response.json()["currency"], "INR")

    # ---- mocked LLM
    def test_llm_path_works_with_typed_reports(self):
        from testing.test_gemini_reliability import DECISION_JSON, FakeModel, make_language

        model = FakeModel(DECISION_JSON)
        response = self.post(self.request_body("INR"), make_language(model))
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("error", payload)  # used to be: 'dict' object has no attribute 'model_dump_json'
        self.assertEqual(payload["recommendation"], "HOLD")
        self.assertEqual(payload["currency"], "INR")
        self.assertEqual(payload["generation"], {"source": "llm", "model": "test-model", "reason": None})
        prompt = model.calls[0][0]
        for expected in ("ResearchReport:", "StrategyReport:", "RiskReport:", '"ticker": "FIX"', '"company": "Test Company"',
                         '"current_price": 100.0', '"currency": "INR"', "All monetary values are in INR"):
            self.assertIn(expected, prompt)

    def test_unusable_llm_output_falls_back_with_the_report_data_intact(self):
        from testing.test_gemini_reliability import FakeModel, make_language

        payload = self.post(self.request_body("INR"), make_language(FakeModel('{"recommendation": "Strong Buy"}'))).json()
        self.assertNotIn("error", payload)
        self.assertEqual(payload["generation"], {"source": "fallback", "model": None, "reason": "invalid_response"})
        self.assertEqual(payload["currency"], "INR")
        self.assertIn("Current price: ₹100.00", payload["overall_summary"])

    # ---- invalid input is a client error, not a swallowed one
    def test_missing_research_report_is_422(self):
        for body in ({}, {"strategy_report": self.request_body()["strategy_report"]}, {"research_report": None}):
            response = self.post(body)
            self.assertEqual(response.status_code, 422, body)
            self.assertEqual(response.json()["detail"][0]["loc"], ["body", "research_report"])

    def test_malformed_reports_are_422_with_field_details(self):
        base = self.request_body()
        cases = {
            "research_report": ({**base, "research_report": {"ticker": "FIX", "current_price": "not a number"}}, ["body", "research_report", "current_price"]),
            "strategy_report": ({**base, "strategy_report": {**base["strategy_report"], "confidence": 7}}, ["body", "strategy_report", "confidence"]),
            "risk_report": ({**base, "risk_report": {**base["risk_report"], "risk_score": "high"}}, ["body", "risk_report", "risk_score"]),
            "not an object": ({**base, "research_report": "FIX"}, None),
        }
        for name, (body, loc) in cases.items():
            response = self.post(body)
            self.assertEqual(response.status_code, 422, name)
            detail = response.json()["detail"]
            self.assertTrue(detail, name)
            if loc:
                self.assertIn(loc, [item["loc"] for item in detail], name)
            self.assertNotIn("not a number", response.text)  # the offending input is not echoed back

    def test_strategy_and_risk_reports_remain_optional(self):
        body = self.request_body(with_strategy=False, with_risk=False)
        for variant in (body, {**body, "strategy_report": None, "risk_report": None}):
            self.assertEqual(self.post(variant).status_code, 200)


if __name__ == "__main__":
    unittest.main()
