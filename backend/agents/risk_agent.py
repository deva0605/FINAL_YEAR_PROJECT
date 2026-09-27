from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from agents.language_agent import LanguageAgent
from backend.agents.research_agent import ResearchReport
from backend.scoring_engine import ScoringEngine, ScoringResult
from backend.workflow_state import WorkflowState, WorkflowStep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_scoring_engine = ScoringEngine()


class RiskReport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    volatility: str = ""
    liquidity: str = ""
    valuation: str = ""
    financial_risk: str = ""
    news_risk: str = ""
    macro_risk: str = ""
    overall_risk: str = ""
    overall_risk_rating: str = ""
    risk_score: Optional[float] = None
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class RiskRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    research_report: ResearchReport


class RiskAgent:
    def __init__(self, language_agent: Optional[LanguageAgent] = None) -> None:
        self.language_agent = language_agent or LanguageAgent()

    def assess_risk(
        self,
        research_report: ResearchReport | None = None,
        workflow_state: WorkflowState | None = None,
    ) -> RiskReport:
        report = self._resolve_report(research_report, workflow_state)
        if workflow_state is not None:
            workflow_state.mark_step(WorkflowStep.RISK)

        llm_risk = self._generate_with_llm(report)
        risk_report = llm_risk or self._build_rule_based_risk(report)

        if workflow_state is not None:
            workflow_state.risk_report = risk_report
            workflow_state.complete_step(WorkflowStep.RISK)

        return risk_report

    # ------------------------------------------------------------------
    # LLM path
    # ------------------------------------------------------------------

    def _generate_with_llm(self, report: ResearchReport) -> Optional[RiskReport]:
        gemini_model = getattr(self.language_agent, "gemini_model", None)
        if not getattr(self.language_agent, "use_gemini", False) or not gemini_model:
            return None

        prompt = (
            "You are a Risk Management agent. Based on the following ResearchReport, produce a "
            "comprehensive risk assessment. Return a strict JSON with keys: "
            "volatility, liquidity, valuation, financial_risk, news_risk, macro_risk, "
            "overall_risk, overall_risk_rating, risk_score (0-100), "
            "weaknesses (list of strings), recommendations (list of strings), reasons (list of strings). "
            "Output ONLY valid JSON.\n\n"
            f"ResearchReport:\n{report.model_dump_json(indent=2)}"
        )

        try:
            raw = self.language_agent.call_llm(prompt)
            if not raw:
                return None
            payload = self.language_agent.extract_json(raw)
            if payload is None:
                return None
            return RiskReport.model_validate(payload)
        except Exception as exc:
            logger.warning("LLM risk generation failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Rule-based fallback
    # ------------------------------------------------------------------

    def _build_rule_based_risk(self, report: ResearchReport) -> RiskReport:
        scoring = _scoring_engine.compute_scores(report)

        # Map 52-week range → volatility label
        high_52 = report.high_52_week
        low_52 = report.low_52_week
        volatility_label = "Unknown"
        if high_52 and low_52 and low_52 > 0:
            vol_pct = ((high_52 - low_52) / low_52) * 100
            if vol_pct < 20:
                volatility_label = "Low"
            elif vol_pct < 50:
                volatility_label = "Moderate"
            else:
                volatility_label = "High"

        # Liquidity from market cap
        market_cap = report.market_cap
        if market_cap and market_cap >= 10e9:
            liquidity_label = "High"
        elif market_cap and market_cap >= 2e9:
            liquidity_label = "Moderate"
        elif market_cap:
            liquidity_label = "Low"
        else:
            liquidity_label = "Unknown"

        # Valuation from PE
        pe = report.pe_ratio
        if pe is None:
            valuation_label = "Unknown"
        elif pe < 0:
            valuation_label = "Not Applicable (Loss-Making)"
        elif pe < 15:
            valuation_label = "Undervalued"
        elif pe < 30:
            valuation_label = "Fair"
        elif pe < 50:
            valuation_label = "Stretched"
        else:
            valuation_label = "Overvalued"

        # News risk from sentiment score
        news_score = scoring.news_sentiment_score
        if news_score >= 60:
            news_risk_label = "Low"
        elif news_score >= 40:
            news_risk_label = "Moderate"
        else:
            news_risk_label = "High"

        # Financial risk from fundamentals score
        fund_score = scoring.fundamentals_score
        if fund_score >= 65:
            fin_risk_label = "Low"
        elif fund_score >= 45:
            fin_risk_label = "Moderate"
        else:
            fin_risk_label = "High"

        # Overall risk (invert risk_score — low risk_score = high risk exposure)
        inv_risk = 100 - scoring.risk_score  # 0 = safe, 100 = very risky
        if inv_risk < 30:
            overall_risk_label = "Low"
            overall_risk_rating = "Low Risk"
        elif inv_risk < 55:
            overall_risk_label = "Moderate"
            overall_risk_rating = "Moderate Risk"
        elif inv_risk < 75:
            overall_risk_label = "High"
            overall_risk_rating = "High Risk"
        else:
            overall_risk_label = "Very High"
            overall_risk_rating = "Very High Risk"

        # Weaknesses & recommendations from scoring reasons
        weaknesses = [
            r for r in (scoring.risk_reasons + scoring.fundamentals_reasons + scoring.technical_reasons)
            if any(w in r.lower() for w in ["high", "risk", "loss", "volatile", "stretched", "below", "bearish", "negative", "unprofitable"])
        ][:5]
        if not weaknesses:
            weaknesses = ["No critical weaknesses identified from available data."]

        recommendations = []
        if volatility_label == "High":
            recommendations.append("Use position sizing appropriate for a high-volatility stock. Consider stop-loss orders.")
        if valuation_label in ("Stretched", "Overvalued"):
            recommendations.append("Consider waiting for a pullback to reduce entry-point valuation risk.")
        if news_risk_label == "High":
            recommendations.append("Monitor news flow closely. Negative sentiment may continue to pressure the price.")
        if liquidity_label == "Low":
            recommendations.append("Be mindful of liquidity risk. Limit order sizes to avoid adverse slippage.")
        if not recommendations:
            recommendations = ["Standard risk management practices apply. Diversify across positions."]

        all_reasons = (
            scoring.risk_reasons
            + scoring.fundamentals_reasons[:2]
            + scoring.technical_reasons[:2]
            + scoring.news_reasons[:1]
        )
        all_reasons.append("Rule-Based Analysis (LLM unavailable)")

        return RiskReport(
            volatility=volatility_label,
            liquidity=liquidity_label,
            valuation=valuation_label,
            financial_risk=fin_risk_label,
            news_risk=news_risk_label,
            macro_risk="Moderate",  # Macro requires external data; conservative default
            overall_risk=overall_risk_label,
            overall_risk_rating=overall_risk_rating,
            risk_score=round(inv_risk, 1),
            weaknesses=weaknesses,
            recommendations=recommendations,
            reasons=all_reasons,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_report(self, research_report, workflow_state):
        if workflow_state is not None and workflow_state.research_report is not None:
            return self._normalize(workflow_state.research_report)
        if research_report is not None:
            return self._normalize(research_report)
        raise ValueError("RiskAgent requires a ResearchReport or WorkflowState with research_report")

    def _normalize(self, r):
        if isinstance(r, ResearchReport):
            return r
        return ResearchReport.model_validate(r)
