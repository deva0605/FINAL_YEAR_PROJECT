import os
import json
import re
import logging
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
                self.gemini_model = genai.GenerativeModel('gemini-2.5-flash')
                self.use_gemini = True
        except ImportError:
            logger.warning("google.generativeai not installed. Query parsing will fallback.")

    def parse(self, query: str) -> ParsedQuery:
        parsed = ParsedQuery(original_query=query)
        if not self.use_gemini or not self.gemini_model:
            parsed.companies.append(query)
            return parsed
            
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
        try:
            response = self.gemini_model.generate_content(prompt)
            raw_text = (response.text or "").strip() if response else ""
            
            cleaned = re.sub(r"^```(?:json)?", "", raw_text, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
            
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
                if match:
                    data = json.loads(match.group(0))
                else:
                    data = {}
                    
            if data:
                parsed.companies = data.get("companies", [])
                parsed.tickers = data.get("tickers", [])
                parsed.intent = data.get("intent", "")
                parsed.time_horizon = data.get("time_horizon", "")
                parsed.sector = data.get("sector", "")
        except Exception as e:
            logger.error(f"Error parsing query with LLM: {str(e)}")
            
        if not parsed.companies and not parsed.tickers:
            parsed.companies.append(query)
            
        return parsed
