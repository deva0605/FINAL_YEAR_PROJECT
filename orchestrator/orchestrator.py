import sys
import os
import logging
import re
import pandas as pd
from typing import Optional, List
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES FIRST! 
# This must happen before importing the agents so they can see the Gemini key.
load_dotenv()

# 2. Ensure parent directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 3. Now import FastAPI and the Agents
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data_ingestion.api_agent import APIAgent
from data_ingestion.scrapping_agent import ScrapingAgent
from agents.retriever_agent import RetrieverAgent
from agents.analysis_agent import AnalysisAgent
from agents.language_agent import LanguageAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI exactly once
app = FastAPI(title="Market Intelligence API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agents
api_agent = APIAgent()
scraping_agent = ScrapingAgent()
retriever_agent = RetrieverAgent()
analysis_agent = AnalysisAgent()
language_agent = LanguageAgent()

# Default Indian Market Symbols
DEFAULT_SYMBOLS = ['RELIANCE.BO', 'TCS.BO', 'INFY.BO']

# Indian Market Mappings
SYMBOL_MAPPINGS = {
    'reliance': 'RELIANCE.BO',
    'tcs': 'TCS.BO',
    'tata consultancy': 'TCS.BO',
    'infosys': 'INFY.BO',
    'infy': 'INFY.BO',
    'hdfc': 'HDFCBANK.BO',
    'icici': 'ICICIBANK.BO',
    'sbi': 'SBIN.BO',
    'state bank': 'SBIN.BO',
    'bharti': 'BHARTIARTL.BO',
    'airtel': 'BHARTIARTL.BO'
}

def extract_symbols_from_query(query: str) -> List[str]:
    """Extract stock symbols from the query and map to actual BSE/NSE ticker symbols"""
    extracted_symbols = []
    
    # 1. Look for exact tickers (e.g. RELIANCE.BO, TCS.NS)
    ticker_pattern = r'\b[A-Z]{1,10}\.(?:BO|NS)\b'
    direct_tickers = re.findall(ticker_pattern, query.upper())
    if direct_tickers:
        extracted_symbols.extend(direct_tickers)
    
    # 2. Look for company names in the query
    if not extracted_symbols:
        for company, symbol in SYMBOL_MAPPINGS.items():
            if company.lower() in query.lower():
                extracted_symbols.append(symbol)
    
    # Remove duplicates while preserving order
    unique_symbols = list(dict.fromkeys(extracted_symbols))
    return unique_symbols if unique_symbols else DEFAULT_SYMBOLS

@app.get("/")
async def health_check():
    return {"status": "healthy", "message": "Market Intelligence API is running"}

@app.get("/retrieve/retrieve")
async def retrieve(query: str, symbols: Optional[str] = None):
    try:
        logger.info(f"Processing retrieve request for query: {query}")
        
        # Step 1: Extract symbols
        if symbols:
            symbol_list = [s.strip() for s in symbols.split(",")]
        else:
            symbol_list = extract_symbols_from_query(query)
            
        logger.info(f"Fetching market data for: {symbol_list}")
        market_data = api_agent.get_market_data(symbol_list)
        
        if not market_data:
            return {
                "error": f"Could not fetch data for symbols: {', '.join(symbol_list)}. Please check if the symbols are valid.",
                "query": query,
                "attempted_symbols": symbol_list
            }
        
        # Step 2: Serialize Market Data
        serialized_market_data = api_agent.serialize_market_data(market_data)
        
        # Step 3: Generate news URLs based on symbols
        news_urls = [f"https://finance.yahoo.com/quote/{symbol}/news/" for symbol in symbol_list[:3]]
        logger.info(f"🔍 Attempting to scrape news from: {news_urls}")
        articles = scraping_agent.scrape_news(news_urls, timeout=15)
        
        if not articles:
            logger.warning("⚠️ News scraping failed - generating fallback articles from market data")
            articles = []
            for symbol in symbol_list:
                company_name = symbol.split('.')[0] # Remove .BO or .NS
                articles.append({
                    "title": f"{company_name} - Market Data Update", 
                    "text": f"Market data retrieved successfully for {company_name} evaluation.",
                    "url": f"https://finance.yahoo.com/quote/{symbol}"
                })
        
        # Step 4: Index and retrieve
        retriever_agent.index_documents(articles)
        context_docs = retriever_agent.retrieve(query, k=3)
        
        context = []
        if context_docs:
            if hasattr(context_docs[0], 'page_content'):
                context = [doc.page_content for doc in context_docs]
            elif isinstance(context_docs[0], dict):
                context = [doc.get('text', str(doc)) for doc in context_docs]
            else:
                context = [str(doc) for doc in context_docs]
                
        if not context:
            context = [f"Market data retrieved for {', '.join(symbol_list)}"]

        return {
            "market_data": serialized_market_data,
            "context": context,
            "query": query,
            "symbols": symbol_list
        }
    except Exception as e:
        logger.error(f"Error retrieving data: {str(e)}")
        return {"error": str(e)}

@app.post("/analyze/analyze")
async def analyze(data: dict):
    try:
        logger.info("Processing analyze request")
        
        symbols = data.get("data", {}).get("symbols", DEFAULT_SYMBOLS)
        serialized_data = data.get("data", {}).get("market_data", {})
        
        # Convert serialized data back to DataFrame
        market_data = {}
        for symbol, records in serialized_data.items():
            if isinstance(records, list):
                market_data[symbol] = pd.DataFrame.from_records(records)
            else:
                market_data[symbol] = records
                
        if not market_data:
             for symbol in symbols:
                market_data[symbol] = pd.DataFrame({'Close': [100.0]})

        context = data.get("data", {}).get("context", [])
        query = data.get("data", {}).get("query", f"Analyze {', '.join(symbols)}")
        
        # Assign dummy portfolio weights
        portfolio_weights = {symbol: max(0.15 - (i * 0.02), 0.05) for i, symbol in enumerate(symbols)}
        analysis_agent.portfolio = portfolio_weights
        
        # Analyze Risk
        exposure = analysis_agent.analyze_risk_exposure(market_data)
        if not exposure:
            exposure = {s: {'weight': w, 'value': w * 1000000, 'price': 100.0} for s, w in portfolio_weights.items()}
            
        # Get Earnings
        earnings = {}
        for symbol in symbols:
            try:
                earn_data = api_agent.get_earnings(symbol)
                earnings[symbol] = earn_data if earn_data is not None else pd.DataFrame({'Year': [2023, 2024], 'Earnings': [10.5, 12.3]})
            except:
                earnings[symbol] = pd.DataFrame({'Year': [2023, 2024], 'Earnings': [10.5, 12.3]})
                
        serialized_earnings = {s: (d.to_dict(orient='records') if isinstance(d, pd.DataFrame) else d) for s, d in earnings.items()}

        # Generate Brief
        try:
            brief = language_agent.generate_brief(str(context), str(exposure), str(serialized_earnings))
            if not brief or brief.isspace():
                raise Exception("Generated brief is empty")
        except Exception as e:
            logger.warning(f"Error generating brief: {str(e)}, using fallback")
            brief = f"### Market Brief: {query}\n\nAnalyzing exposure for {', '.join(symbols)}. Real-time AI generation currently unavailable."

        return {"summary": brief}
    except Exception as e:
        logger.error(f"Error analyzing data: {str(e)}")
        return {"error": str(e)}