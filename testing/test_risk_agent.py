import unittest

from fastapi.testclient import TestClient

from backend.agents.research_agent import (
    EarningsRecord,
    Fundamentals,
    NewsArticle,
    ResearchReport,
    TechnicalIndicators,
    MarketDataPoint,
)
from backend.agents.risk_agent import RiskAgent, RiskReport
from orchestrator.orchestrator import app


class FakeLanguageAgent:
    use_gemini = False
    gemini_model = None


def build_sample_report() -> ResearchReport:
    return ResearchReport(
        company="Reliance Industries Limited",
        symbol="RELIANCE.BO",
        price=1326.5,
        technical_indicators=TechnicalIndicators(
            latest_close=1326.5,
            change_percent=2.5,
            moving_average_20=1310.0,
            moving_average_50=1295.0,
            average_volume_20=740988.0,
            high_52_week=1400.0,
            low_52_week=1100.0,
            rsi_14=54.3,
        ),
        fundamentals=Fundamentals(
            long_name="Reliance Industries Limited",
            sector="Energy",
            industry="Oil & Gas Refining & Marketing",
            market_cap=17278437425152,
            pe_ratio=20.75,
            price_to_book=1.96,
            dividend_yield=0.38,
            beta=0.22,
            website="https://www.ril.com",
            long_business_summary="Diversified Indian conglomerate with energy, retail, and digital services.",
        ),
        earnings=[
            EarningsRecord(year=2026, earnings=807750000000),
            EarningsRecord(year=2025, earnings=696480000000),
        ],
        news=[
            NewsArticle(title="Reliance update", text="Strong quarterly performance", url="https://example.com")
        ],
        context=["Positive sentiment from recent earnings update"],
        summary="Research summary",
        market_data=[
            MarketDataPoint(date="2026-07-17", open=1301, high=1329.95, low=1295.6, close=1326.5, volume=848885),
            MarketDataPoint(date="2026-07-28", volume=633091, close=1326.5),
        ],
    )


class RiskAgentTests(unittest.TestCase):
    def test_fallback_risk_returns_structured_report(self):
        agent = RiskAgent(language_agent=FakeLanguageAgent())
        report = build_sample_report()

        result = agent.assess_risk(report)

        self.assertIsInstance(result, RiskReport)
        self.assertIn(result.overall_risk_rating, {"Low", "Medium", "High"})
        self.assertGreaterEqual(result.risk_score, 0)
        self.assertLessEqual(result.risk_score, 100)
        self.assertTrue(result.volatility_analysis.summary)
        self.assertTrue(result.valuation_risk.summary)
        self.assertTrue(result.technical_risk.summary)
        self.assertTrue(result.fundamental_risk.summary)
        self.assertTrue(result.news_risk.summary)
        self.assertTrue(result.strengths)
        self.assertIsInstance(result.weaknesses, list)
        self.assertIsInstance(result.red_flags, list)
        self.assertTrue(result.reasoning)
        self.assertTrue(result.recommendations)

    def test_risk_endpoint_returns_report(self):
        from orchestrator import orchestrator as orchestrator_module

        original_agent = orchestrator_module.risk_agent
        try:
            class EndpointStubRiskAgent:
                def assess_risk(self, research_report: ResearchReport) -> RiskReport:
                    return RiskReport(
                        symbol=research_report.symbol,
                        company=research_report.company,
                        overall_risk_rating="Medium",
                        risk_score=52,
                        volatility_analysis={"score": 45, "level": "Medium", "summary": "Volatility OK", "metrics": {}},
                        valuation_risk={"score": 50, "level": "Medium", "summary": "Valuation OK", "metrics": {}},
                        technical_risk={"score": 55, "level": "Medium", "summary": "Technical OK", "metrics": {}},
                        fundamental_risk={"score": 48, "level": "Medium", "summary": "Fundamental OK", "metrics": {}},
                        news_risk={"score": 40, "level": "Low", "summary": "News OK", "metrics": {}},
                        liquidity_risk=None,
                        strengths=["Stable earnings"],
                        weaknesses=["Watch valuation"],
                        red_flags=[],
                        reasoning="Stubbed risk reasoning",
                        recommendations=["Use staged entries"],
                    )

            orchestrator_module.risk_agent = EndpointStubRiskAgent()

            client = TestClient(app)
            response = client.post(
                "/risk/risk",
                json={"research_report": build_sample_report().model_dump(mode="json")},
            )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["overall_risk_rating"], "Medium")
            self.assertEqual(payload["risk_score"], 52)
            self.assertEqual(payload["recommendations"], ["Use staged entries"])
        finally:
            orchestrator_module.risk_agent = original_agent


if __name__ == "__main__":
    unittest.main()
