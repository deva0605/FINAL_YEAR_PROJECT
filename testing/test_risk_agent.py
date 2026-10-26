"""RiskAgent tests against the current report models (ResearchReport / RiskReport), including `generation`.

All figures are synthetic fixtures. No LLM is used: the agent's language agent is a stub with Gemini switched off.

Run with: python -m unittest testing.test_risk_agent
"""
import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from agents.gemini_client import GenerationInfo
from backend.agents.research_agent import ResearchReport
from backend.agents.risk_agent import RiskAgent, RiskReport
from backend.workflow_state import WorkflowState, WorkflowStep
from orchestrator import orchestrator as orchestrator_module


class FakeLanguageAgent:
    """Gemini switched off, as when GEMINI_API_KEY is missing."""

    use_gemini = False
    gemini_model = None
    unavailable_reason = "no_api_key"


def build_sample_report(**overrides) -> ResearchReport:
    fields = dict(
        company="Reliance Industries Limited",
        ticker="RELIANCE.NS",
        current_price=1326.5,
        market_cap=17278437425152,
        sector="Energy",
        industry="Oil & Gas Refining & Marketing",
        pe_ratio=20.75,
        high_52_week=1400.0,
        low_52_week=1100.0,
        moving_averages={"20d": 1310.0, "50d": 1295.0},
        rsi=54.3,
        latest_news=[{"title": "Reliance update", "url": "https://example.com", "publish_date": None}],
        fundamental_summary="Diversified Indian conglomerate with energy, retail, and digital services.",
        technical_summary="Trading above both moving averages.",
        sentiment="Neutral",
        currency="INR",
        generation=GenerationInfo.llm("research-model"),
    )
    fields.update(overrides)
    return ResearchReport(**fields)


class RiskAgentTests(unittest.TestCase):
    def setUp(self):
        self.agent = RiskAgent(language_agent=FakeLanguageAgent())

    def test_fallback_risk_returns_structured_report(self):
        result = self.agent.assess_risk(build_sample_report())

        self.assertIsInstance(result, RiskReport)
        # 52-week range (1400-1100)/1100 = 27%: moderate; P/E 20.75 is below 30: fair
        self.assertEqual(result.volatility, "Moderate")
        self.assertEqual(result.valuation, "Fair")
        # INR has no verified market-cap thresholds, so liquidity is explicitly unknown (not guessed)
        self.assertEqual(result.liquidity, "Unknown")
        self.assertIn(result.news_risk, {"Low", "Moderate", "High"})
        self.assertIn(result.financial_risk, {"Low", "Moderate", "High"})
        self.assertEqual(result.macro_risk, "Moderate")
        self.assertIn(result.overall_risk, {"Low", "Moderate", "High", "Very High"})
        self.assertIn(result.overall_risk_rating, {"Low Risk", "Moderate Risk", "High Risk", "Very High Risk"})
        self.assertIsNotNone(result.risk_score)
        self.assertGreaterEqual(result.risk_score, 0)
        self.assertLessEqual(result.risk_score, 100)
        self.assertIsInstance(result.weaknesses, list)
        self.assertTrue(result.recommendations)
        self.assertTrue(result.reasons)
        self.assertIn("Rule-Based Analysis (LLM unavailable)", result.reasons)

    def test_liquidity_follows_the_verified_currency(self):
        usd = self.agent.assess_risk(build_sample_report(currency="USD"))
        self.assertEqual(usd.liquidity, "High")  # a verified-USD market cap above 10B
        unknown = self.agent.assess_risk(build_sample_report(currency=None))
        self.assertEqual(unknown.liquidity, "Unknown")

    def test_fallback_is_marked_in_generation_metadata(self):
        result = self.agent.assess_risk(build_sample_report())
        self.assertEqual(result.generation.model_dump(), {"source": "fallback", "model": None, "reason": "no_api_key"})

    def test_missing_values_do_not_break_the_assessment(self):
        sparse = ResearchReport(company="Sparse Co", ticker="SPARSE")
        result = self.agent.assess_risk(sparse)
        self.assertEqual((result.volatility, result.valuation, result.liquidity), ("Unknown", "Unknown", "Unknown"))
        self.assertTrue(result.overall_risk_rating)
        self.assertTrue(result.recommendations)

    def test_accepts_a_plain_dict_and_a_workflow_state(self):
        report = build_sample_report()
        from_dict = self.agent.assess_risk(research_report=report.model_dump(mode="json"))
        self.assertEqual(from_dict.overall_risk_rating, self.agent.assess_risk(report).overall_risk_rating)

        state = WorkflowState(research_report=report)
        result = self.agent.assess_risk(workflow_state=state)
        self.assertIs(state.risk_report, result)
        self.assertIn(WorkflowStep.RISK, state.metadata.completed_steps)

    def test_requires_a_research_report(self):
        with self.assertRaises(ValueError):
            self.agent.assess_risk()

    def test_report_serialises_with_generation(self):
        payload = json.loads(self.agent.assess_risk(build_sample_report()).model_dump_json())
        self.assertEqual(payload["generation"]["source"], "fallback")
        for field in ("volatility", "liquidity", "valuation", "financial_risk", "news_risk", "macro_risk",
                      "overall_risk", "overall_risk_rating", "risk_score", "weaknesses", "recommendations", "reasons"):
            self.assertIn(field, payload)


class RiskEndpointTests(unittest.TestCase):
    def post(self, body):
        return TestClient(orchestrator_module.app).post("/risk/risk", json=body)

    def test_endpoint_returns_the_agents_report(self):
        class StubRiskAgent:
            def assess_risk(self, research_report: ResearchReport) -> RiskReport:
                return RiskReport(
                    volatility="Moderate", liquidity="Unknown", valuation="Fair", financial_risk="Low",
                    news_risk="Low", macro_risk="Moderate", overall_risk="Moderate",
                    overall_risk_rating="Medium Risk", risk_score=52.0,
                    weaknesses=["Watch valuation"], recommendations=["Use staged entries"],
                    reasons=[f"stub for {research_report.ticker}"],
                )

        with mock.patch.object(orchestrator_module, "risk_agent", StubRiskAgent()):
            response = self.post({"research_report": build_sample_report().model_dump(mode="json")})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["overall_risk_rating"], "Medium Risk")
        self.assertEqual(payload["risk_score"], 52.0)
        self.assertEqual(payload["recommendations"], ["Use staged entries"])
        self.assertEqual(payload["reasons"], ["stub for RELIANCE.NS"])

    def test_endpoint_with_the_real_agent_includes_generation(self):
        with mock.patch.object(orchestrator_module, "risk_agent", RiskAgent(language_agent=FakeLanguageAgent())):
            response = self.post({"research_report": build_sample_report().model_dump(mode="json")})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("error", payload)
        self.assertEqual(payload["generation"], {"source": "fallback", "model": None, "reason": "no_api_key"})
        self.assertEqual(payload["volatility"], "Moderate")
        self.assertEqual(payload["liquidity"], "Unknown")

    def test_endpoint_rejects_a_request_without_a_report(self):
        self.assertEqual(self.post({}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
