import logging
import requests
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOCAL_MAPPINGS = {
    'reliance': 'RELIANCE.NS',
    'tcs': 'TCS.NS',
    'tata consultancy': 'TCS.NS',
    'infosys': 'INFY.NS',
    'infy': 'INFY.NS',
    'hdfc': 'HDFCBANK.NS',
    'hdfc bank': 'HDFCBANK.NS',
    'icici': 'ICICIBANK.NS',
    'sbi': 'SBIN.NS',
    'state bank': 'SBIN.NS',
    'bharti': 'BHARTIARTL.NS',
    'airtel': 'BHARTIARTL.NS',
    'microsoft': 'MSFT',
    'apple': 'AAPL',
    'alphabet': 'GOOGL',
    'google': 'GOOGL',
    'tesla': 'TSLA',
    'nvidia': 'NVDA',
    'meta': 'META',
    'amazon': 'AMZN',
}

class TickerResolver:
    def __init__(self):
        pass

    def resolve(self, company_or_ticker: str) -> Optional[str]:
        query = company_or_ticker.strip()
        if not query:
            return None
            
        lower_query = query.lower()
        if lower_query in LOCAL_MAPPINGS:
            return LOCAL_MAPPINGS[lower_query]
            
        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=1&newsCount=0"
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                quotes = data.get("quotes", [])
                if quotes:
                    symbol = quotes[0].get("symbol")
                    if symbol:
                        logger.info(f"Resolved '{query}' to '{symbol}' via Yahoo Finance")
                        return symbol
        except Exception as e:
            logger.warning(f"Yahoo Finance search failed for '{query}': {str(e)}")
            
        if " " not in query and len(query) <= 10:
            return query.upper()
            
        return None
