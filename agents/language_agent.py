import os
import json
import re
import logging
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LanguageAgent:
    def __init__(self):
        self.use_gemini = False
        self.gemini_model = None

        try:
            import google.generativeai as genai
            api_key = os.getenv('GEMINI_API_KEY')
            if api_key:
                genai.configure(api_key=api_key)
                self.gemini_model = genai.GenerativeModel('gemini-3.8-flash')
                self.use_gemini = True
                logger.info("Gemini Pro API initialized successfully")
            else:
                logger.info("GEMINI_API_KEY not found — will use rule-based analysis.")
        except ImportError:
            logger.info("google-generativeai not installed — will use rule-based analysis.")
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {str(e)}")

    def generate_research_summaries(self, symbol, company_name, context, technical_indicators, fundamentals, earnings) -> Dict[str, Any]:
        """
        Generate fundamental/technical summaries and sentiment.
        Falls back to deterministic rule-based generation if LLM unavailable.
        """
        if self.use_gemini and self.gemini_model:
            try:
                return self._generate_with_gemini(symbol, company_name, context, technical_indicators, fundamentals, earnings)
            except Exception as e:
                logger.warning(f"Gemini failed ({e}) — switching to rule-based summaries.")

        return self._generate_rule_based_summaries(symbol, company_name, technical_indicators, fundamentals, earnings)

    # ------------------------------------------------------------------
    # LLM path
    # ------------------------------------------------------------------

    def _generate_with_gemini(self, symbol, company_name, context, technical_indicators, fundamentals, earnings) -> Dict[str, Any]:
        prompt = f"""You are an expert financial analyst. Analyze the following data for {company_name} ({symbol}).

CONTEXT AND NEWS:
{context}

TECHNICAL INDICATORS:
{technical_indicators}

FUNDAMENTALS:
{fundamentals}

EARNINGS:
{earnings}

Return a strictly valid JSON object with the following keys:
- "fundamental_summary": A concise paragraph summarizing the company's fundamentals and recent earnings.
- "technical_summary": A concise paragraph summarizing the technical setup (moving averages, RSI, momentum).
- "sentiment": A single word summarizing overall sentiment: "Bullish", "Bearish", or "Neutral".

Output ONLY valid JSON without markdown blocks.
"""
        response = self.gemini_model.generate_content(prompt)
        raw_text = (response.text or "").strip() if response else ""

        cleaned = re.sub(r"^```(?:json)?", "", raw_text, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

        data = None
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            if match:
                data = json.loads(match.group(0))

        if data:
            return {
                "fundamental_summary": data.get("fundamental_summary", ""),
                "technical_summary": data.get("technical_summary", ""),
                "sentiment": data.get("sentiment", "Neutral"),
            }
        return self._generate_rule_based_summaries(symbol, company_name, technical_indicators, fundamentals, earnings)

    # ------------------------------------------------------------------
    # Rule-based path
    # ------------------------------------------------------------------

    def _generate_rule_based_summaries(self, symbol, company_name, technical_indicators, fundamentals, earnings) -> Dict[str, Any]:
        """Generate human-readable summaries using retrieved financial data — no LLM required."""
        logger.info("Generating rule-based summaries for %s", symbol)
        
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
            tier = "mega-cap" if market_cap >= 200e9 else "large-cap" if market_cap >= 10e9 else "mid-cap" if market_cap >= 2e9 else "small-cap"
            fund_parts.append(f"It is a {tier} company with a market capitalization of ${market_cap/1e9:.1f}B.")

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
                yr_str = ", ".join([f"{e['year']}: ${e['earnings']/1e9:.2f}B" for e in recent])
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
            tech_parts.append(f"Currently trading at ${price:.2f}" + (f" ({chg:+.2f}% today)." if chg is not None else "."))

        if rsi is not None:
            if rsi < 30:
                tech_parts.append(f"The RSI of {rsi:.1f} signals an oversold condition — a potential contrarian buy opportunity.")
            elif rsi > 70:
                tech_parts.append(f"The RSI of {rsi:.1f} signals an overbought condition — elevated near-term pullback risk.")
            else:
                tech_parts.append(f"The RSI of {rsi:.1f} is in a neutral range, indicating balanced momentum.")

        if ma20 and ma50 and price:
            if price > ma20 > ma50:
                tech_parts.append(f"A bullish alignment: price (${price:.2f}) > 20d MA (${ma20:.2f}) > 50d MA (${ma50:.2f}).")
            elif price < ma20 < ma50:
                tech_parts.append(f"A bearish alignment: price (${price:.2f}) < 20d MA (${ma20:.2f}) < 50d MA (${ma50:.2f}).")
            else:
                tech_parts.append(f"20d MA: ${ma20:.2f}, 50d MA: ${ma50:.2f}.")

        if high_52 and low_52 and price:
            pos = (price - low_52) / (high_52 - low_52) * 100 if (high_52 - low_52) > 0 else 50
            tech_parts.append(f"The stock is at {pos:.0f}% of its 52-week range (L: ${low_52:.2f} / H: ${high_52:.2f}).")

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
            response = self.gemini_model.generate_content(prompt)
            return (response.text or "").strip() if response else None
        except Exception as e:
            logger.warning("LLM call failed: %s", e)
            return None

    def extract_json(self, raw_text: str) -> Optional[dict]:
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            if not match:
                return None
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None