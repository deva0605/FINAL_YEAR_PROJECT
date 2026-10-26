import os
import json
import re
import logging
import threading
from typing import Dict, Any, Optional

from agents.gemini_client import (
    GeminiError,
    GeminiSettings,
    GenerationInfo,
    INVALID_RESPONSE,
    OK,
    UNKNOWN,
    create_model,
    generate_text,
    meaningful_text,
)

from backend.currency import currency_prompt_note, format_large_amount, format_money
from backend.market_cap import classify_market_cap, tier_prompt_note, unclassified_reason

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LanguageAgent:
    # class-level defaults so subclasses/tests that skip __init__ still behave
    settings: Optional[GeminiSettings] = None
    model_name: Optional[str] = None
    unavailable_reason: Optional[str] = "llm_unavailable"  # why use_gemini is False

    def __init__(self):
        self.use_gemini = False
        self.gemini_model = None
        self.settings = GeminiSettings.from_env()
        self.model_name = self.settings.model

        self.gemini_model, self.unavailable_reason = create_model(self.settings)
        if self.gemini_model is not None:
            self.use_gemini = True
            logger.info("Gemini initialized (model=%s)", self.model_name)
        else:
            logger.info("Gemini unavailable (%s) — will use rule-based analysis.", self.unavailable_reason)

    # ------------------------------------------------------------------
    # LLM status of the most recent call on this thread (read by the agents to explain a fallback)
    # ------------------------------------------------------------------

    def _local(self) -> threading.local:
        local = self.__dict__.get("_status_local")
        if local is None:
            local = self.__dict__.setdefault("_status_local", threading.local())
        return local

    def llm_status(self) -> Optional[str]:
        return getattr(self._local(), "status", None)

    def set_llm_status(self, status: str) -> None:
        self._local().status = status

    def _call_gemini(self, prompt: str) -> str:
        """Bounded Gemini call (see agents/gemini_client.py); records the outcome; raises GeminiError."""
        try:
            text = generate_text(self.gemini_model, prompt, self.settings)
        except GeminiError as exc:
            self.set_llm_status(exc.kind)
            raise
        self.set_llm_status(OK)
        return text

    def generate_research_summaries(self, symbol, company_name, context, technical_indicators, fundamentals, earnings, currency=None) -> Dict[str, Any]:
        """
        Generate fundamental/technical summaries and sentiment.
        Falls back to deterministic rule-based generation if LLM unavailable.
        """
        reason = self.unavailable_reason
        if self.use_gemini and self.gemini_model:
            try:
                return self._generate_with_gemini(symbol, company_name, context, technical_indicators, fundamentals, earnings, currency)
            except GeminiError as e:
                logger.warning("Gemini failed (%s) — switching to rule-based summaries.", e.kind)
                reason = e.kind
            except Exception as e:  # noqa: BLE001 - never let LLM trouble fail the research request
                logger.warning("Gemini failed unexpectedly (%s) — switching to rule-based summaries.", str(e)[:200])
                reason = UNKNOWN

        return self._rule_based_with_generation(
            GenerationInfo.fallback(reason), symbol, company_name, technical_indicators, fundamentals, earnings, currency
        )

    @staticmethod
    def _normalise_sentiment(value) -> str:
        """The LLM's sentiment if it is Bullish / Bearish / Neutral (any case); otherwise the neutral default."""
        label = str(value).strip().capitalize() if isinstance(value, str) else ""
        return label if label in ("Bullish", "Bearish", "Neutral") else "Neutral"

    def _rule_based_with_generation(self, generation, symbol, company_name, technical_indicators, fundamentals, earnings, currency):
        summaries = self._generate_rule_based_summaries(symbol, company_name, technical_indicators, fundamentals, earnings, currency)
        summaries["generation"] = generation.model_dump()
        return summaries

    # ------------------------------------------------------------------
    # LLM path
    # ------------------------------------------------------------------

    def _generate_with_gemini(self, symbol, company_name, context, technical_indicators, fundamentals, earnings, currency=None) -> Dict[str, Any]:
        prompt = f"""You are an expert financial analyst. Analyze the following data for {company_name} ({symbol}).

CONTEXT AND NEWS:
{context}

TECHNICAL INDICATORS:
{technical_indicators}

FUNDAMENTALS:
{fundamentals}

EARNINGS:
{earnings}

{currency_prompt_note(currency)}{tier_prompt_note((fundamentals or {}).get('market_cap'), currency)}
Return a strictly valid JSON object with the following keys:
- "fundamental_summary": A concise paragraph summarizing the company's fundamentals and recent earnings.
- "technical_summary": A concise paragraph summarizing the technical setup (moving averages, RSI, momentum).
- "sentiment": A single word summarizing overall sentiment: "Bullish", "Bearish", or "Neutral".

Output ONLY valid JSON without markdown blocks.
"""
        raw_text = self._call_gemini(prompt)
        data = self.extract_json(raw_text)

        fundamental = data.get("fundamental_summary") if isinstance(data, dict) else None
        technical = data.get("technical_summary") if isinstance(data, dict) else None
        if meaningful_text(fundamental) or meaningful_text(technical):  # at least one real summary
            return {
                "fundamental_summary": fundamental if meaningful_text(fundamental) else "",
                "technical_summary": technical if meaningful_text(technical) else "",
                "sentiment": self._normalise_sentiment(data.get("sentiment")),
                "generation": GenerationInfo.llm(self.model_name).model_dump(),
            }
        logger.warning("Gemini returned no usable summaries — using rule-based summaries.")
        self.set_llm_status(INVALID_RESPONSE)
        return self._rule_based_with_generation(
            GenerationInfo.fallback(INVALID_RESPONSE), symbol, company_name, technical_indicators, fundamentals, earnings, currency
        )

    # ------------------------------------------------------------------
    # Rule-based path
    # ------------------------------------------------------------------

    def _generate_rule_based_summaries(self, symbol, company_name, technical_indicators, fundamentals, earnings, currency=None) -> Dict[str, Any]:
        """Generate human-readable summaries using retrieved financial data — no LLM required."""
        logger.info("Generating rule-based summaries for %s", symbol)
        
        def money(value):
            return format_money(value, currency)

        # ---------- Fundamental Summary ----------
        fund_parts = []
        market_cap = (fundamentals or {}).get("market_cap")
        pe = (fundamentals or {}).get("pe_ratio")
        sector = (fundamentals or {}).get("sector")
        industry = (fundamentals or {}).get("industry")
        summary = (fundamentals or {}).get("long_business_summary")

        if sector:
            fund_parts.append(f"{company_name} ({symbol}) operates in the {sector} sector" + (f", specifically in {industry}" if industry else "") + ".")
        else:
            fund_parts.append(f"{company_name} ({symbol}) is an investable security.")

        if market_cap:
            tier = {"mega": "mega-cap", "large": "large-cap", "mid": "mid-cap", "small": "small-cap"}.get(classify_market_cap(market_cap, currency))
            if tier:
                fund_parts.append(f"It is a {tier} company with a market capitalization of {format_large_amount(market_cap, currency)}.")
            else:
                fund_parts.append(
                    f"Its market capitalization is {format_large_amount(market_cap, currency)} (size tier not assessed: {unclassified_reason(currency)})."
                )

        if pe is not None:
            if pe < 0:
                fund_parts.append("The company is currently reporting a net loss (negative P/E ratio).")
            elif pe < 15:
                fund_parts.append(f"With a P/E ratio of {pe:.1f}, the stock appears attractively valued relative to historical market averages.")
            elif pe < 30:
                fund_parts.append(f"The P/E ratio of {pe:.1f} reflects a fair market valuation.")
            else:
                fund_parts.append(f"A P/E ratio of {pe:.1f} indicates a premium valuation, implying the market expects above-average growth.")

        if earnings:
            recent = [e for e in earnings if e.get("year") and e.get("earnings") is not None]
            if recent:
                recent = sorted(recent, key=lambda x: x["year"], reverse=True)[:2]
                financial_currency = (fundamentals or {}).get("financial_currency") or currency
                yr_str = ", ".join([f"{e['year']}: {format_large_amount(e['earnings'], financial_currency)}" for e in recent])
                fund_parts.append(f"Recent earnings: {yr_str}.")

        if summary:
            fund_parts.append(summary[:300] + ("..." if len(summary) > 300 else ""))

        fund_parts.append("(Rule-Based Analysis — LLM unavailable)")
        fundamental_summary = " ".join(fund_parts)

        # ---------- Technical Summary ----------
        tech_parts = []
        price = (technical_indicators or {}).get("latest_close")
        rsi = (technical_indicators or {}).get("rsi_14")
        ma20 = (technical_indicators or {}).get("moving_average_20")
        ma50 = (technical_indicators or {}).get("moving_average_50")
        high_52 = (technical_indicators or {}).get("high_52_week")
        low_52 = (technical_indicators or {}).get("low_52_week")
        chg = (technical_indicators or {}).get("change_percent")

        if price:
            tech_parts.append(f"Currently trading at {money(price)}" + (f" ({chg:+.2f}% today)." if chg is not None else "."))

        if rsi is not None:
            if rsi < 30:
                tech_parts.append(f"The RSI of {rsi:.1f} signals an oversold condition — a potential contrarian buy opportunity.")
            elif rsi > 70:
                tech_parts.append(f"The RSI of {rsi:.1f} signals an overbought condition — elevated near-term pullback risk.")
            else:
                tech_parts.append(f"The RSI of {rsi:.1f} is in a neutral range, indicating balanced momentum.")

        if ma20 and ma50 and price:
            if price > ma20 > ma50:
                tech_parts.append(f"A bullish alignment: price ({money(price)}) > 20d MA ({money(ma20)}) > 50d MA ({money(ma50)}).")
            elif price < ma20 < ma50:
                tech_parts.append(f"A bearish alignment: price ({money(price)}) < 20d MA ({money(ma20)}) < 50d MA ({money(ma50)}).")
            else:
                tech_parts.append(f"20d MA: {money(ma20)}, 50d MA: {money(ma50)}.")

        if high_52 and low_52 and price:
            pos = (price - low_52) / (high_52 - low_52) * 100 if (high_52 - low_52) > 0 else 50
            tech_parts.append(f"The stock is at {pos:.0f}% of its 52-week range (L: {money(low_52)} / H: {money(high_52)}).")

        tech_parts.append("(Rule-Based Analysis — LLM unavailable)")
        technical_summary = " ".join(tech_parts)

        # ---------- Sentiment ----------
        # derive sentiment from news_sentiment keyword approach
        sentiment = self._derive_sentiment_label(technical_indicators)

        return {
            "fundamental_summary": fundamental_summary,
            "technical_summary": technical_summary,
            "sentiment": sentiment,
        }

    def _derive_sentiment_label(self, technical_indicators: dict) -> str:
        """Quick rule-based sentiment from RSI + MA cross."""
        rsi = (technical_indicators or {}).get("rsi_14")
        price = (technical_indicators or {}).get("latest_close")
        ma50 = (technical_indicators or {}).get("moving_average_50")

        bullish_signals = 0
        bearish_signals = 0

        if rsi is not None:
            if rsi < 45:
                bullish_signals += 1
            elif rsi > 65:
                bearish_signals += 1

        if price and ma50:
            if price > ma50:
                bullish_signals += 1
            else:
                bearish_signals += 1

        if bullish_signals > bearish_signals:
            return "Bullish"
        elif bearish_signals > bullish_signals:
            return "Bearish"
        return "Neutral"

    # ------------------------------------------------------------------
    # Shared utilities
    # ------------------------------------------------------------------

    def call_llm(self, prompt: str) -> Optional[str]:
        """
        General-purpose LLM call.
        Returns None (not raises) if the LLM is unavailable or fails.
        """
        if not self.use_gemini or not self.gemini_model:
            return None
        try:
            return self._call_gemini(prompt)
        except GeminiError as e:
            logger.warning("LLM call failed (%s): %s", e.kind, e)
            return None
        except Exception as e:  # noqa: BLE001
            self.set_llm_status(UNKNOWN)
            logger.warning("LLM call failed unexpectedly: %s", str(e)[:200])
            return None

    def extract_json(self, raw_text: str) -> Optional[dict]:
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            parsed = None
            if match:
                try:
                    parsed = json.loads(match.group(0))
                except json.JSONDecodeError:
                    parsed = None
        if not isinstance(parsed, dict):  # callers expect a JSON object
            self.set_llm_status(INVALID_RESPONSE)
            return None
        return parsed