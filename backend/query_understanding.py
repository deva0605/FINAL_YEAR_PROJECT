import os
import json
import re
import logging
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Comprehensive company → canonical name mapping used by the rule-based fallback.
# Keys are lowercase aliases, values are the canonical company name (which the
# TickerResolver already knows how to resolve to a Yahoo Finance ticker).
COMPANY_ALIASES: dict[str, str] = {
    # US Tech
    "google": "google", "alphabet": "google",
    "microsoft": "microsoft", "msft": "microsoft",
    "apple": "apple", "aapl": "apple",
    "amazon": "amazon", "amzn": "amazon",
    "meta": "meta", "facebook": "meta",
    "netflix": "netflix", "nflx": "netflix",
    "nvidia": "nvidia", "nvda": "nvidia",
    "tesla": "tesla", "tsla": "tesla",
    "salesforce": "salesforce", "crm": "salesforce",
    "adobe": "adobe", "adbe": "adobe",
    "intel": "intel", "intc": "intel",
    "amd": "amd",
    "oracle": "oracle", "orcl": "oracle",
    "ibm": "ibm",
    "qualcomm": "qualcomm", "qcom": "qualcomm",
    "paypal": "paypal", "pypl": "paypal",
    "shopify": "shopify", "shop": "shopify",
    "uber": "uber",
    "lyft": "lyft",
    "twitter": "twitter", "x corp": "twitter",
    "airbnb": "airbnb", "abnb": "airbnb",
    "zoom": "zoom", "zm": "zoom",
    # US Finance
    "jpmorgan": "jpmorgan", "jp morgan": "jpmorgan", "jpm": "jpmorgan",
    "goldman sachs": "goldman sachs", "gs": "goldman sachs",
    "bank of america": "bank of america", "bac": "bank of america",
    "wells fargo": "wells fargo", "wfc": "wells fargo",
    "citigroup": "citigroup", "citi": "citigroup", "c": "citigroup",
    "morgan stanley": "morgan stanley", "ms": "morgan stanley",
    "american express": "american express", "amex": "american express", "axp": "american express",
    "visa": "visa", "v": "visa",
    "mastercard": "mastercard", "ma": "mastercard",
    # Indian
    "reliance": "reliance",
    "tcs": "tcs", "tata consultancy": "tcs",
    "infosys": "infosys", "infy": "infosys",
    "hdfc": "hdfc", "hdfc bank": "hdfc bank",
    "icici": "icici", "icici bank": "icici bank",
    "sbi": "sbi", "state bank": "sbi",
    "wipro": "wipro",
    "bharti": "airtel", "airtel": "airtel",
    "bajaj": "bajaj finance", "bajaj finance": "bajaj finance",
    "maruti": "maruti",
    "itc": "itc",
    "hul": "hul", "hindustan unilever": "hul",
    "asian paints": "asian paints",
    "axis bank": "axis bank",
    "kotak": "kotak mahindra",
    # Energy/Other
    "exxon": "exxon mobil", "xom": "exxon mobil",
    "chevron": "chevron", "cvx": "chevron",
    "johnson": "johnson & johnson", "jnj": "johnson & johnson",
    "pfizer": "pfizer", "pfe": "pfizer",
    "disney": "disney", "dis": "disney",
    "coca cola": "coca-cola", "coke": "coca-cola", "ko": "coca-cola",
    "pepsi": "pepsico", "pep": "pepsico",
    "walmart": "walmart", "wmt": "walmart",
    "target": "target", "tgt": "target",
}

# Patterns for explicit tickers (e.g. MSFT, RELIANCE.NS)
TICKER_PATTERN = re.compile(r'\b([A-Z]{1,10}(?:\.(?:NS|BO))?)\b')

# Patterns indicating time horizon
LONG_TERM_WORDS = ["long", "long-term", "longterm", "long term"]
SHORT_TERM_WORDS = ["short", "short-term", "shortterm", "short term", "quick", "intraday", "day trade"]


def _rule_based_parse(query: str) -> dict:
    """
    Pure regex + dictionary fallback parser. No LLM required.
    Returns a dict compatible with ParsedQuery fields.
    """
    lower = query.lower()

    # 1. Detect company names from our known dictionary
    companies: List[str] = []
    tickers: List[str] = []

    for alias, canonical in sorted(COMPANY_ALIASES.items(), key=lambda x: -len(x[0])):
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            if canonical not in companies:
                companies.append(canonical)
            break  # take only the first / longest match

    # 2. Detect explicit tickers in the original query (upper-cased words)
    if not companies:
        for m in TICKER_PATTERN.finditer(query):
            tok = m.group(1)
            # Only treat short all-caps tokens as tickers (avoid English words like "FOR", "IN")
            common_words = {"FOR", "IN", "AT", "BY", "THE", "AND", "OR", "OF", "TO", "A", "AN", "ABOUT",
                            "US", "ON", "IS", "IT", "BE", "DO", "IF", "SO", "UP", "MY", "ME", "HE", "SHE",
                            "WE", "WITH", "NEW", "NOW", "ALL", "ANY", "GET", "HAS", "HAD", "HOW", "ITS", "HIM",
                            "OUR", "OUT", "USE", "TWO", "ONE", "NOT", "BUT", "YET", "FROM", "INTO", "OVER",
                            "AFTER", "WILL", "TELL", "LONG", "TERM", "TERM", "INVESTMENT", "INVEST", "ANALYZE",
                            "ANALYSIS", "ABOUT", "GIVE", "WHAT", "WHEN", "WHERE", "WHO", "WHY", "BEST"}
            if tok not in common_words:
                alias_check = tok.lower().rstrip(".bo.ns").rstrip(".ns").rstrip(".bo")
                if alias_check in COMPANY_ALIASES:
                    canonical = COMPANY_ALIASES[alias_check]
                    if canonical not in companies:
                        companies.append(canonical)
                elif len(tok) <= 6:  # likely a ticker like MSFT, NVDA
                    tickers.append(tok)

    # 3. Detect time horizon
    time_horizon = ""
    if any(w in lower for w in LONG_TERM_WORDS):
        time_horizon = "long_term"
    elif any(w in lower for w in SHORT_TERM_WORDS):
        time_horizon = "short_term"

    # 4. Intent
    intent = "investment_analysis"
    if "compare" in lower or "vs" in lower or "versus" in lower:
        intent = "comparison"
    elif "sector" in lower or "industry" in lower:
        intent = "sector_discovery"
    elif "valuation" in lower or "overvalued" in lower or "undervalued" in lower:
        intent = "valuation_analysis"

    logger.info(f"[RuleBasedParser] companies={companies}, tickers={tickers}, intent={intent}, horizon={time_horizon}")

    return {
        "companies": companies,
        "tickers": tickers,
        "intent": intent,
        "time_horizon": time_horizon,
        "sector": "",
    }


class ParsedQuery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    companies: List[str] = []
    tickers: List[str] = []
    intent: str = ""
    time_horizon: str = ""
    sector: str = ""
    original_query: str = ""

class QueryParser:
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
        except ImportError:
            logger.warning("google.generativeai not installed. Query parsing will fallback.")

    def parse(self, query: str) -> ParsedQuery:
        parsed = ParsedQuery(original_query=query)
            
        prompt = f"""You are a query understanding module for an investment analysis platform.
Extract the following information from the user's natural language query.
Query: "{query}"

Return a strict JSON object with these exact keys:
- "companies": list of company names explicitly mentioned
- "tickers": list of stock tickers explicitly mentioned
- "intent": the main intent (e.g. "investment_analysis", "comparison", "sector_discovery", "valuation_analysis")
- "time_horizon": the investment time horizon if mentioned (e.g. "long_term", "short_term", or empty string)
- "sector": the sector if mentioned (e.g. "banking", "technology", or empty string)

Output ONLY valid JSON.
"""
        if self.use_gemini and self.gemini_model:
            try:
                response = self.gemini_model.generate_content(prompt)
                raw_text = (response.text or "").strip() if response else ""
                
                cleaned = re.sub(r"^```(?:json)?", "", raw_text, flags=re.IGNORECASE).strip()
                cleaned = re.sub(r"```$", "", cleaned).strip()
                
                data: dict = {}
                try:
                    data = json.loads(cleaned)
                except json.JSONDecodeError:
                    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
                    if match:
                        try:
                            data = json.loads(match.group(0))
                        except json.JSONDecodeError:
                            pass
                        
                if data:
                    parsed.companies = data.get("companies", [])
                    parsed.tickers = data.get("tickers", [])
                    parsed.intent = data.get("intent", "")
                    parsed.time_horizon = data.get("time_horizon", "")
                    parsed.sector = data.get("sector", "")
                    logger.info(f"[GeminiParser] companies={parsed.companies}, tickers={parsed.tickers}")
            except Exception as e:
                logger.error(f"Gemini query parsing failed ({e}). Falling back to rule-based parser.")

        # If LLM failed or returned nothing, use robust rule-based fallback
        if not parsed.companies and not parsed.tickers:
            fallback = _rule_based_parse(query)
            parsed.companies = fallback["companies"]
            parsed.tickers = fallback["tickers"]
            parsed.intent = fallback.get("intent", "investment_analysis")
            parsed.time_horizon = fallback.get("time_horizon", "")
            parsed.sector = fallback.get("sector", "")

        # Last resort: use the whole query as a company name (will let TickerResolver try Yahoo Finance)
        if not parsed.companies and not parsed.tickers:
            logger.warning(f"All parsers failed for '{query}' — passing raw query to TickerResolver.")
            parsed.companies.append(query)
            
        return parsed
