import unittest

from backend.agents.research_agent import Fundamentals, ResearchReport, TechnicalIndicators
from backend.agents.risk_agent import RiskReport
from backend.agents.strategy_agent import StrategyReport
from backend.workflow_orchestrator import DefaultWorkflowOrchestrator
from backend.workflow_state import WorkflowStep


class StubResearchAgent:
    def research(self, stock_symbol: str, workflow_state=None) -> ResearchReport:
        report = ResearchReport(
            company="Test Company",
            symbol=stock_symbol,
            price=100.0,
            technical_indicators=TechnicalIndicators(latest_close=100.0, change_percent=1.2),
            fundamentals=Fundamentals(long_name="Test Company", sector="Tech"),
            summary="Research summary",
        )
        if workflow_state is not None:
            workflow_state.research_report = report
            workflow_state.complete_step(WorkflowStep.RESEARCH)
        return report


class StubStrategyAgent:
    def strategy(self, research_report=None, workflow_state=None) -> StrategyReport:
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
        )
        if workflow_state is not None:
            workflow_state.strategy_report = report
            workflow_state.complete_step(WorkflowStep.STRATEGY)
        return report


class StubRiskAgent:
    def assess_risk(self, research_report=None, workflow_state=None) -> RiskReport:
        report = RiskReport(
            symbol=research_report.symbol,
            company=research_report.company,
            overall_risk_rating="Medium",
            risk_score=51,
            volatility_analysis={"score": 45, "level": "Medium", "summary": "Volatility OK", "metrics": {}},
            valuation_risk={"score": 50, "level": "Medium", "summary": "Valuation OK", "metrics": {}},
            technical_risk={"score": 55, "level": "Medium", "summary": "Technical OK", "metrics": {}},
            fundamental_risk={"score": 48, "level": "Medium", "summary": "Fundamental OK", "metrics": {}},
            news_risk={"score": 40, "level": "Low", "summary": "News OK", "metrics": {}},
            liquidity_risk=None,
            strengths=["Stable earnings"],
            weaknesses=["Watch valuation"],
            red_flags=[],
            reasoning="Risk reasoning",
            recommendations=["Use staged entries"],
        )
        if workflow_state is not None:
            workflow_state.risk_report = report
            workflow_state.complete_step(WorkflowStep.RISK)
        return report


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
        self.assertEqual(state.research_report.symbol, "RELIANCE.BO")
        self.assertEqual(state.strategy_report.suggested_strategy, "Hold")
        self.assertEqual(state.risk_report.overall_risk_rating, "Medium")
        self.assertIn(WorkflowStep.RESEARCH, state.metadata.completed_steps)
        self.assertIn(WorkflowStep.STRATEGY, state.metadata.completed_steps)
        self.assertIn(WorkflowStep.RISK, state.metadata.completed_steps)
        self.assertEqual(state.metadata.current_step, WorkflowStep.COMPLETE)
        self.assertIsNotNone(state.metadata.execution_time_seconds)


if __name__ == "__main__":
    unittest.main()