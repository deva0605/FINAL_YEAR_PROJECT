"""
backend/scoring_engine.py
Deterministic scoring engine for rule-based investment analysis.
Used as a fallback when the LLM (Gemini) is unavailable.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional, List

from backend.currency import format_large_amount, format_money
from backend.market_cap import classify_market_cap, unclassified_reason

logger = logging.getLogger(__name__)

BULLISH_KEYWORDS = [
    "beat", "surge", "jump", "strong", "record", "profit", "growth", "rally",
    "upgrade", "outperform", "buy", "bullish", "positive", "rise", "gain",
    "exceed", "revenue", "milestone", "breakthrough", "acquisition", "dividend"
]

BEARISH_KEYWORDS = [
    "miss", "fall", "drop", "decline", "loss", "weak", "concern", "risk",
    "downgrade", "underperform", "sell", "bearish", "negative", "cut", "layoff",
    "lawsuit", "investigation", "recall", "debt", "bankruptcy", "warning", "guidance"
]


@dataclass
class ScoringResult:
    fundamentals_score: float = 50.0
    technical_score: float = 50.0
    news_sentiment_score: float = 50.0
    risk_score: float = 50.0
    overall_score: float = 50.0
    data_completeness: float = 0.0  # 0.0 to 1.0

    # Human-readable explanations
    fundamentals_reasons: List[str] = field(default_factory=list)
    technical_reasons: List[str] = field(default_factory=list)
    news_reasons: List[str] = field(default_factory=list)
    risk_reasons: List[str] = field(default_factory=list)

    @property
    def recommendation(self) -> str:
        s = self.overall_score
        if s >= 80:
            return "Strong Buy"
        elif s >= 65:
            return "Buy"
        elif s >= 45:
            return "Hold"
        elif s >= 25:
            return "Sell"
        else:
            return "Strong Sell"

    @property
    def simple_recommendation(self) -> str:
        s = self.overall_score
        if s >= 65:
            return "BUY"
        elif s >= 45:
            return "HOLD"
        else:
            return "SELL"

    @property
    def confidence(self) -> float:
        """Confidence scales with data completeness and score extremity."""
        base = self.data_completeness
        extremity = abs(self.overall_score - 50) / 50  # 0.0 at 50, 1.0 at 0 or 100
        return round(min(base * 0.6 + extremity * 0.4, 0.85), 2)


class ScoringEngine:
    """
    Deterministic scoring engine that produces a ScoringResult
    from structured ResearchReport data without requiring an LLM.
    """

    def compute_scores(self, report) -> ScoringResult:
        """
        Compute all sub-scores and the weighted overall score.
        `report` can be a ResearchReport Pydantic model or a dict.
        """
        if hasattr(report, "model_dump"):
            data = report.model_dump()
        elif isinstance(report, dict):
            data = report
        else:
            data = {}

        fundamentals_score, fundamentals_reasons = self._score_fundamentals(data)
        technical_score, technical_reasons = self._score_technicals(data)
        news_score, news_reasons = self._score_news_sentiment(data)
        risk_score, risk_reasons = self._score_risk(data)

        completeness = self._calculate_completeness(data)

        # Weighted combination: Fundamentals 35%, Technical 30%, News 20%, Risk 15%
        overall = (
            fundamentals_score * 0.35
            + technical_score * 0.30
            + news_score * 0.20
            + risk_score * 0.15
        )

        logger.info(
            "ScoringEngine: F=%.1f T=%.1f N=%.1f R=%.1f Overall=%.1f completeness=%.0f%%",
            fundamentals_score, technical_score, news_score, risk_score,
            overall, completeness * 100
        )

        return ScoringResult(
            fundamentals_score=round(fundamentals_score, 1),
            technical_score=round(technical_score, 1),
            news_sentiment_score=round(news_score, 1),
            risk_score=round(risk_score, 1),
            overall_score=round(overall, 1),
            data_completeness=completeness,
            fundamentals_reasons=fundamentals_reasons,
            technical_reasons=technical_reasons,
            news_reasons=news_reasons,
            risk_reasons=risk_reasons,
        )

    # ------------------------------------------------------------------
    # Sub-scorers
    # ------------------------------------------------------------------

    def _score_fundamentals(self, data: dict) -> tuple[float, List[str]]:
        score = 50.0
        reasons: List[str] = []

        pe_ratio = data.get("pe_ratio")
        market_cap = data.get("market_cap")
        eps = data.get("eps")
        revenue = data.get("revenue")
        currency = data.get("currency")

        if pe_ratio is not None:
            if pe_ratio < 0:
                score -= 20
                reasons.append(f"Negative P/E ratio ({pe_ratio:.1f}) indicates losses.")
            elif pe_ratio < 15:
                score += 20
                reasons.append(f"Attractive P/E ratio of {pe_ratio:.1f} (below 15 — undervalued range).")
            elif pe_ratio < 25:
                score += 10
                reasons.append(f"P/E ratio of {pe_ratio:.1f} is fair-valued.")
            elif pe_ratio < 40:
                score -= 5
                reasons.append(f"P/E ratio of {pe_ratio:.1f} is on the higher side.")
            else:
                score -= 15
                reasons.append(f"Elevated P/E ratio of {pe_ratio:.1f} implies stretched valuation.")
        else:
            reasons.append("P/E ratio unavailable.")

        if market_cap is not None:
            tier = classify_market_cap(market_cap, currency)
            if tier == "mega":
                score += 10
                reasons.append(f"Mega-cap company ({format_large_amount(market_cap, currency)} market cap). High financial stability.")
            elif tier == "large":
                score += 5
                reasons.append(f"Large-cap company ({format_large_amount(market_cap, currency)} market cap).")
            elif tier == "mid":
                reasons.append(f"Mid-cap company ({format_large_amount(market_cap, currency)} market cap).")
            elif tier == "small":
                score -= 5
                reasons.append(f"Small-cap company ({format_large_amount(market_cap, currency)} market cap). Higher risk profile.")
            else:  # unclassified: no score adjustment rather than a guessed tier
                reasons.append(
                    f"Market cap of {format_large_amount(market_cap, currency)}; size tier not assessed ({unclassified_reason(currency)})."
                )
        else:
            reasons.append("Market cap unavailable.")

        if eps is not None:
            if eps > 0:
                score += 5
                reasons.append(f"Positive EPS of {format_money(eps, currency)} confirms profitability.")
            else:
                score -= 10
                reasons.append(f"Negative EPS of {format_money(eps, currency)} indicates the company is not yet profitable.")
        
        if revenue is not None:
            reasons.append(f"Annual revenue: {format_large_amount(revenue, currency)}.")

        return max(0.0, min(100.0, score)), reasons

    def _score_technicals(self, data: dict) -> tuple[float, List[str]]:
        score = 50.0
        reasons: List[str] = []

        current_price = data.get("current_price")
        currency = data.get("currency")

        def money(value: float) -> str:
            return format_money(value, currency)

        rsi = data.get("rsi")
        moving_averages = data.get("moving_averages") or {}
        high_52 = data.get("high_52_week")
        low_52 = data.get("low_52_week")

        ma_20 = moving_averages.get("20d")
        ma_50 = moving_averages.get("50d")

        # RSI analysis
        if rsi is not None:
            if rsi < 30:
                score += 20
                reasons.append(f"RSI of {rsi:.1f} is in oversold territory — potential reversal signal.")
            elif rsi < 45:
                score += 10
                reasons.append(f"RSI of {rsi:.1f} suggests mildly oversold conditions.")
            elif rsi <= 65:
                score += 5
                reasons.append(f"RSI of {rsi:.1f} is in a neutral, healthy range.")
            elif rsi <= 80:
                score -= 10
                reasons.append(f"RSI of {rsi:.1f} is in overbought territory — caution advised.")
            else:
                score -= 20
                reasons.append(f"RSI of {rsi:.1f} is severely overbought.")
        else:
            reasons.append("RSI data unavailable.")

        # Moving average analysis
        if current_price and ma_20 and ma_50:
            if current_price > ma_20 > ma_50:
                score += 20
                reasons.append(f"Bullish trend: price ({money(current_price)}) above 20d MA ({money(ma_20)}) above 50d MA ({money(ma_50)}).")
            elif current_price > ma_50:
                score += 10
                reasons.append(f"Price ({money(current_price)}) above key 50d MA ({money(ma_50)}) — positive trend.")
            elif current_price < ma_20 < ma_50:
                score -= 20
                reasons.append(f"Bearish trend: price ({money(current_price)}) below 20d MA ({money(ma_20)}) below 50d MA ({money(ma_50)}).")
            elif current_price < ma_50:
                score -= 10
                reasons.append(f"Price ({money(current_price)}) below 50d MA ({money(ma_50)}) — negative trend.")
        elif current_price and ma_50:
            if current_price > ma_50:
                score += 10
                reasons.append(f"Price ({money(current_price)}) above 50d MA ({money(ma_50)}).")
            else:
                score -= 10
                reasons.append(f"Price ({money(current_price)}) below 50d MA ({money(ma_50)}).")
        elif current_price:
            reasons.append("50d moving average unavailable (insufficient price history); trend not assessed.")

        # 52-week position
        if current_price and high_52 and low_52 and high_52 > low_52:
            position = (current_price - low_52) / (high_52 - low_52)
            reasons.append(
                f"Trading at {position*100:.0f}% of its 52-week range "
                f"(Low: {money(low_52)} / High: {money(high_52)})."
            )
            if position < 0.25:
                score += 10
                reasons.append("Near 52-week low — potential value opportunity.")
            elif position > 0.85:
                score -= 5
                reasons.append("Near 52-week high — limited upside in short term.")

        return max(0.0, min(100.0, score)), reasons

    def _score_news_sentiment(self, data: dict) -> tuple[float, List[str]]:
        score = 50.0
        reasons: List[str] = []

        news_list = data.get("latest_news") or []
        if not news_list:
            reasons.append("No news articles available for sentiment analysis.")
            return score, reasons

        bullish_count = 0
        bearish_count = 0

        for article in news_list[:10]:  # analyse up to 10 most recent
            title = (article.get("title") or "").lower()
            for kw in BULLISH_KEYWORDS:
                if kw in title:
                    bullish_count += 1
                    break
            for kw in BEARISH_KEYWORDS:
                if kw in title:
                    bearish_count += 1
                    break

        total = bullish_count + bearish_count
        if total > 0:
            ratio = bullish_count / total
            if ratio >= 0.7:
                score += 25
                reasons.append(f"News sentiment is strongly Bullish ({bullish_count} positive vs {bearish_count} negative headlines).")
            elif ratio >= 0.55:
                score += 10
                reasons.append(f"News sentiment is mildly Bullish ({bullish_count} positive vs {bearish_count} negative headlines).")
            elif ratio <= 0.3:
                score -= 25
                reasons.append(f"News sentiment is strongly Bearish ({bearish_count} negative vs {bullish_count} positive headlines).")
            elif ratio <= 0.45:
                score -= 10
                reasons.append(f"News sentiment is mildly Bearish ({bearish_count} negative vs {bullish_count} positive headlines).")
            else:
                reasons.append(f"News sentiment is Neutral ({bullish_count} positive, {bearish_count} negative headlines).")
        else:
            reasons.append(f"Analysed {len(news_list)} headlines; no clear sentiment signal detected.")

        return max(0.0, min(100.0, score)), reasons

    def _score_risk(self, data: dict) -> tuple[float, List[str]]:
        """
        Higher risk_score = lower risk = more favorable for investment.
        """
        score = 50.0
        reasons: List[str] = []

        high_52 = data.get("high_52_week")
        low_52 = data.get("low_52_week")
        current_price = data.get("current_price")
        market_cap = data.get("market_cap")
        currency = data.get("currency")
        pe_ratio = data.get("pe_ratio")

        # Volatility based on 52-week range
        if high_52 and low_52 and low_52 > 0:
            volatility_pct = ((high_52 - low_52) / low_52) * 100
            if volatility_pct < 20:
                score += 20
                reasons.append(f"Low volatility: 52-week range is {volatility_pct:.0f}% — stable stock.")
            elif volatility_pct < 50:
                reasons.append(f"Moderate volatility: 52-week range is {volatility_pct:.0f}%.")
            else:
                score -= 20
                reasons.append(f"High volatility: 52-week range is {volatility_pct:.0f}% — significant price swings.")
        else:
            reasons.append("Volatility data unavailable.")

        # Liquidity proxy based on market cap
        if market_cap is not None:
            tier = classify_market_cap(market_cap, currency)
            if tier in ("mega", "large"):
                score += 15
                reasons.append("High liquidity: Large-cap stock with deep trading markets.")
            elif tier == "mid":
                score += 5
                reasons.append("Moderate liquidity: Mid-cap stock.")
            elif tier == "small":
                score -= 15
                reasons.append("Lower liquidity: Small-cap stock may have wider bid-ask spreads.")
            else:
                reasons.append(f"Liquidity not inferred from market cap ({unclassified_reason(currency)}).")
        else:
            reasons.append("Market cap unavailable for liquidity assessment.")

        # Valuation risk
        if pe_ratio is not None:
            if pe_ratio > 50:
                score -= 15
                reasons.append(f"High valuation risk: P/E of {pe_ratio:.1f} leaves little margin of safety.")
            elif pe_ratio < 0:
                score -= 10
                reasons.append("Company is currently unprofitable — elevated financial risk.")

        return max(0.0, min(100.0, score)), reasons

    def _calculate_completeness(self, data: dict) -> float:
        key_fields = [
            "current_price", "market_cap", "pe_ratio", "rsi",
            "high_52_week", "low_52_week", "moving_averages", "latest_news",
            "sector", "fundamental_summary"
        ]
        def present(key: str) -> bool:
            value = data.get(key)
            if key == "moving_averages":  # a dict of all-None averages is not data
                return any(v is not None for v in (value or {}).values())
            return bool(value)

        available = sum(1 for k in key_fields if present(k))
        return available / len(key_fields)
