from __future__ import annotations

import logging
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from agents.language_agent import LanguageAgent
from backend.scoring_engine import ScoringEngine
from backend.workflow_state import WorkflowState, WorkflowStep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_scoring_engine = ScoringEngine()


class DecisionReport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    recommendation: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning: str = ""
    overall_summary: str = ""
    supporting_evidence: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    investment_horizon: str = ""


class DecisionAgent:
    def __init__(self, language_agent: Optional[LanguageAgent] = None) -> None:
        self.language_agent = language_agent or LanguageAgent()

    def decide(
        self,
        research_report: Any = None,
        workflow_state: WorkflowState | None = None,
    ) -> DecisionReport:
        if workflow_state is not None:
            workflow_state.mark_step(WorkflowStep.DECISION)

        if not workflow_state or not workflow_state.research_report:
            raise ValueError("DecisionAgent requires a populated WorkflowState with research_report")

        llm_decision = self._generate_with_llm(workflow_state)
        decision_report = llm_decision or self._build_rule_based_decision(workflow_state)

        if workflow_state is not None:
            workflow_state.decision_report = decision_report
            workflow_state.complete_step(WorkflowStep.DECISION)

        return decision_report

    # ------------------------------------------------------------------
    # LLM path
    # ------------------------------------------------------------------

    def _generate_with_llm(self, state: WorkflowState) -> Optional[DecisionReport]:
        gemini_model = getattr(self.language_agent, "gemini_model", None)
        if not getattr(self.language_agent, "use_gemini", False) or not gemini_model:
            return None

        prompt = (
            "You are the final Decision Agent. Review the Research, Strategy, and Risk reports below. "
            "Make a final investment decision. Return a strict JSON object with keys: "
            "recommendation (must be exactly 'BUY', 'HOLD', or 'SELL'), confidence (0.0-1.0), "
            "reasoning, overall_summary, supporting_evidence (list of strings), "
            "next_steps (list of strings), investment_horizon. Output ONLY valid JSON.\n\n"
        )
        if state.research_report:
            prompt += f"ResearchReport:\n{state.research_report.model_dump_json(indent=2)}\n\n"
        if state.strategy_report:
            prompt += f"StrategyReport:\n{state.strategy_report.model_dump_json(indent=2)}\n\n"
        if state.risk_report:
            prompt += f"RiskReport:\n{state.risk_report.model_dump_json(indent=2)}\n\n"

        try:
            raw = self.language_agent.call_llm(prompt)
            if not raw:
                return None
            payload = self.language_agent.extract_json(raw)
            if payload is None:
                return None
            return DecisionReport.model_validate(payload)
        except Exception as exc:
            logger.warning("LLM decision generation failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Rule-based fallback
    # ------------------------------------------------------------------

    def _build_rule_based_decision(self, state: WorkflowState) -> DecisionReport:
        research = state.research_report
        strategy = state.strategy_report
        risk = state.risk_report

        scoring = _scoring_engine.compute_scores(research)

        overall = scoring.overall_score
        rec_label = scoring.recommendation  # "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"

        # Map to simple BUY / HOLD / SELL
        if "Buy" in rec_label:
            recommendation = "BUY"
        elif "Sell" in rec_label:
            recommendation = "SELL"
        else:
            recommendation = "HOLD"

        # Collect supporting evidence from all reports
        evidence: list[str] = []
        evidence += scoring.fundamentals_reasons[:2]
        evidence += scoring.technical_reasons[:2]
        evidence += scoring.news_reasons[:1]
        evidence = [e for e in evidence if e]

        if not evidence:
            evidence = ["Analysis based on available financial data."]

        # Build detailed summary
        company = getattr(research, "company", "") or getattr(research, "ticker", "")
        price = getattr(research, "current_price", None)
        price_str = f"${price:.2f}" if price else "N/A"

        summary_parts = [
            f"Rule-Based Analysis (LLM unavailable). "
            f"Based on a deterministic evaluation of {company} ({getattr(research, 'ticker', '')}), "
            f"the Overall Investment Score is {overall:.1f}/100 ({rec_label}). "
            f"Current price: {price_str}. "
        ]

        f_score = scoring.fundamentals_score
        t_score = scoring.technical_score
        n_score = scoring.news_sentiment_score
        r_score = scoring.risk_score

        summary_parts.append(
            f"Sub-scores — Fundamentals: {f_score:.0f}/100, Technicals: {t_score:.0f}/100, "
            f"News Sentiment: {n_score:.0f}/100, Risk Profile: {r_score:.0f}/100."
        )

        if strategy:
            horizon = getattr(strategy, "time_horizon", "")
            suggested = getattr(strategy, "suggested_strategy", "")
            if suggested:
                summary_parts.append(f"Suggested approach: {suggested}")
            if horizon:
                summary_parts.append(f"Recommended time horizon: {horizon}.")

        if risk:
            overall_risk = getattr(risk, "overall_risk_rating", "") or getattr(risk, "overall_risk", "")
            if overall_risk:
                summary_parts.append(f"Risk profile: {overall_risk}.")

        overall_summary = " ".join(summary_parts)

        # Next steps
        next_steps: list[str] = []
        if recommendation == "BUY":
            next_steps = [
                f"Initiate a position near the entry zone suggested by the strategy agent.",
                "Set a stop-loss below the 52-week low or recent support level.",
                "Review and rebalance after the next earnings announcement.",
            ]
        elif recommendation == "SELL":
            next_steps = [
                "Evaluate current position size and consider trimming exposure.",
                "Wait for a confirmed technical reversal before re-entry.",
                "Monitor for catalysts that could improve the fundamental outlook.",
            ]
        else:
            next_steps = [
                "Maintain current position without adding significant new exposure.",
                "Set price alerts at key technical levels (52-week high and low).",
                "Revisit the analysis after the next earnings release.",
            ]

        # Investment horizon from strategy
        investment_horizon = ""
        if strategy:
            investment_horizon = getattr(strategy, "time_horizon", "")

        reasoning = (
            f"Rule-Based Analysis (LLM unavailable). "
            f"Overall score {overall:.1f}/100 maps to threshold: {rec_label}. "
            f"Thresholds — Strong Buy ≥80, Buy ≥65, Hold ≥45, Sell ≥25, Strong Sell <25."
        )

        return DecisionReport(
            recommendation=recommendation,
            confidence=scoring.confidence,
            reasoning=reasoning,
            overall_summary=overall_summary,
            supporting_evidence=evidence,
            next_steps=next_steps,
            investment_horizon=investment_horizon,
        )
