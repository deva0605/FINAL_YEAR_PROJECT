import unittest

from fastapi.testclient import TestClient

from backend.agents.research_agent import (
    EarningsRecord,
    Fundamentals,
    NewsArticle,
    ResearchReport,
    TechnicalIndicators,
)
from backend.agents.strategy_agent import StrategyAgent, StrategyReport
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
    )


class StrategyAgentTests(unittest.TestCase):
    def test_fallback_strategy_returns_structured_report(self):
        agent = StrategyAgent(language_agent=FakeLanguageAgent())
        report = build_sample_report()

        result = agent.strategy(report)

        self.assertIsInstance(result, StrategyReport)
        self.assertTrue(result.bull_thesis)
        self.assertTrue(result.bear_thesis)
        self.assertTrue(result.suggested_strategy)
        self.assertTrue(result.entry_zone)
        self.assertTrue(result.exit_zone)
        self.assertTrue(result.target)
        self.assertTrue(result.time_horizon)
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)

    def test_strategy_endpoint_returns_report(self):
        from orchestrator import orchestrator as orchestrator_module

        original_agent = orchestrator_module.strategy_agent
        try:
            class EndpointStubStrategyAgent:
                def strategy(self, research_report: ResearchReport) -> StrategyReport:
                    return StrategyReport(
                        bull_thesis="Bull thesis",
                        bear_thesis="Bear thesis",
                        suggested_strategy="Hold",
                        entry_zone="$100 - $105",
                        exit_zone="$110 - $115",
                        target="$120.00",
                        time_horizon="3-6 months",
                        confidence=0.7,
                        reasoning="Stubbed strategy",
                    )

            orchestrator_module.strategy_agent = EndpointStubStrategyAgent()

            client = TestClient(app)
            response = client.post(
                "/strategy/strategy",
                json={"research_report": build_sample_report().model_dump(mode="json")},
            )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["suggested_strategy"], "Hold")
            self.assertEqual(payload["confidence"], 0.7)
            self.assertEqual(payload["target"], "$120.00")
        finally:
            orchestrator_module.strategy_agent = original_agent


if __name__ == "__main__":
    unittest.main()
