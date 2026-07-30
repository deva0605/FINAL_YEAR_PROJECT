from __future__ import annotations

import logging
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from agents.language_agent import LanguageAgent
from backend.agents.research_agent import ResearchReport
from backend.scoring_engine import ScoringEngine, ScoringResult
from backend.workflow_state import WorkflowState, WorkflowStep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_scoring_engine = ScoringEngine()


class StrategyReport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bull_thesis: str = ""
    bear_thesis: str = ""
    suggested_strategy: str = ""
    entry_zone: str = ""
    exit_zone: str = ""
    target: str = ""
    time_horizon: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning: str = ""
    catalysts: list[str] = Field(default_factory=list)


class StrategyRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    research_report: ResearchReport


class StrategyAgent:
    def __init__(self, language_agent: Optional[LanguageAgent] = None) -> None:
        self.language_agent = language_agent or LanguageAgent()

    def strategy(
        self,
        research_report: ResearchReport | None = None,
        workflow_state: WorkflowState | None = None,
    ) -> StrategyReport:
        report = self._resolve_report(research_report, workflow_state)
        if workflow_state is not None:
            workflow_state.mark_step(WorkflowStep.STRATEGY)

        time_horizon = ""
        if workflow_state and workflow_state.parsed_query:
            pq = workflow_state.parsed_query
            time_horizon = pq.time_horizon if hasattr(pq, "time_horizon") else getattr(pq, "time_horizon", "")

        llm_strategy = self._generate_with_llm(report, time_horizon)
        strategy_report = llm_strategy or self._build_rule_based_strategy(report, time_horizon)

        if workflow_state is not None:
            workflow_state.strategy_report = strategy_report
            workflow_state.complete_step(WorkflowStep.STRATEGY)

        return strategy_report

    # ------------------------------------------------------------------
    # LLM path
    # ------------------------------------------------------------------

    def _generate_with_llm(self, report: ResearchReport, time_horizon: str = "") -> Optional[StrategyReport]:
        gemini_model = getattr(self.language_agent, "gemini_model", None)
        if not getattr(self.language_agent, "use_gemini", False) or not gemini_model:
            return None

        prompt = (
            "You are an investment strategist. Use the following ResearchReport to produce "
            "a strict JSON object with these keys only: bull_thesis, bear_thesis, suggested_strategy, "
            "entry_zone, exit_zone, target, time_horizon, confidence (0.0-1.0), reasoning, catalysts (list of strings). "
            "Keep the output concise and valid JSON only.\n\n"
        )
        if time_horizon:
            prompt += f"The user has requested a time horizon of: {time_horizon}. Tailor the strategy accordingly.\n\n"
        prompt += f"ResearchReport:\n{report.model_dump_json(indent=2)}"

        try:
            raw = self.language_agent.call_llm(prompt)
            if not raw:
                return None
            payload = self.language_agent.extract_json(raw)
            if payload is None:
                return None
            return StrategyReport.model_validate(payload)
        except Exception as exc:
            logger.warning("LLM strategy generation failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Rule-based fallback
    # ------------------------------------------------------------------

    def _build_rule_based_strategy(self, report: ResearchReport, time_horizon: str = "") -> StrategyReport:
        scoring = _scoring_engine.compute_scores(report)
        price = report.current_price or 0.0

        # Time horizon
        if not time_horizon:
            time_horizon = self._derive_time_horizon(scoring)

        # Build thesis strings from scorer reasons
        bull_points = (
            scoring.fundamentals_reasons[:2]
            + scoring.technical_reasons[:2]
            + scoring.news_reasons[:1]
        )
        bear_points = scoring.risk_reasons[:3]

        bull_thesis = " ".join(
            p for p in bull_points if any(kw in p.lower() for kw in ["bullish", "positive", "above", "oversold", "growth", "profit", "attractive", "mega-cap", "large-cap", "stable"])
        )
        bear_thesis = " ".join(
            p for p in bear_points if any(kw in p.lower() for kw in ["bearish", "negative", "below", "overbought", "loss", "high volatility", "risk", "elevated"])
        )

        if not bull_thesis:
            bull_thesis = "; ".join(scoring.fundamentals_reasons[:2]) or "No strong positive catalyst identified from available data."
        if not bear_thesis:
            bear_thesis = "; ".join(scoring.risk_reasons[:2]) or "No major bearish catalyst identified from available data."

        # Strategy verb
        rec = scoring.recommendation
        if "Buy" in rec:
            suggested_strategy = "Accumulate on pullbacks; scale into position progressively."
        elif "Sell" in rec:
            suggested_strategy = "Consider reducing exposure; wait for stabilization."
        else:
            suggested_strategy = "Hold existing position; monitor for directional confirmation."

        entry_zone, exit_zone, target = self._price_zones(price, scoring.overall_score)

        catalysts = []
        if scoring.news_sentiment_score >= 60:
            catalysts.append("Positive recent news flow")
        if scoring.technical_score >= 65:
            catalysts.append("Bullish technical momentum (price above MAs)")
        if scoring.fundamentals_score >= 65:
            catalysts.append("Favorable valuation metrics")
        if not catalysts:
            catalysts = ["Monitor for earnings release and macro developments"]

        reasoning = (
            f"Rule-Based Analysis (LLM unavailable). "
            f"Overall Investment Score: {scoring.overall_score:.1f}/100 -> {scoring.recommendation}. "
            f"Fundamentals: {scoring.fundamentals_score:.0f}/100, "
            f"Technicals: {scoring.technical_score:.0f}/100, "
            f"News Sentiment: {scoring.news_sentiment_score:.0f}/100, "
            f"Risk: {scoring.risk_score:.0f}/100."
        )

        return StrategyReport(
            bull_thesis=bull_thesis,
            bear_thesis=bear_thesis,
            suggested_strategy=suggested_strategy,
            entry_zone=entry_zone,
            exit_zone=exit_zone,
            target=target,
            time_horizon=time_horizon,
            confidence=scoring.confidence,
            reasoning=reasoning,
            catalysts=catalysts,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _derive_time_horizon(self, scoring: ScoringResult) -> str:
        if scoring.technical_score >= 70:
            return "3-6 months (strong near-term momentum)"
        if scoring.fundamentals_score >= 70:
            return "12-24 months (long-term value)"
        return "6-12 months"

    def _price_zones(self, price: float, score: float) -> tuple[str, str, str]:
        if price <= 0:
            return "N/A", "N/A", "N/A"
        # Tighter for high-score, wider for low-score
        entry_buf = 0.02 if score >= 65 else 0.03
        target_buf = 0.12 if score >= 65 else 0.07
        stop_buf = 0.07

        entry_low = price * (1 - entry_buf)
        entry_high = price * (1 + entry_buf * 0.5)
        stop = price * (1 - stop_buf)
        tgt = price * (1 + target_buf)

        return (
            f"${entry_low:,.2f} - ${entry_high:,.2f}",
            f"Stop-loss at ${stop:,.2f}",
            f"${tgt:,.2f}",
        )

    def _resolve_report(self, research_report, workflow_state):
        if workflow_state is not None and workflow_state.research_report is not None:
            return self._normalize(workflow_state.research_report)
        if research_report is not None:
            return self._normalize(research_report)
        raise ValueError("StrategyAgent requires a ResearchReport or WorkflowState with research_report")

    def _normalize(self, r):
        if isinstance(r, ResearchReport):
            return r
        return ResearchReport.model_validate(r)
