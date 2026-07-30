import sys
import os
import logging
import re
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
from backend.agents.research_agent import ResearchAgent, ResearchReport
from backend.agents.strategy_agent import StrategyAgent, StrategyRequest
from backend.agents.risk_agent import RiskAgent, RiskRequest
from backend.agents.decision_agent import DecisionAgent
from backend.workflow_orchestrator import DefaultWorkflowOrchestrator
from backend.workflow_state import WorkflowState
from backend.query_understanding import QueryParser, ParsedQuery
from backend.ticker_resolver import TickerResolver

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

# Initialize the Research Agent
research_agent = ResearchAgent()
strategy_agent = StrategyAgent()
risk_agent = RiskAgent()
decision_agent = DecisionAgent()
workflow_orchestrator = DefaultWorkflowOrchestrator(
    research_agent=research_agent,
    strategy_agent=strategy_agent,
    risk_agent=risk_agent,
    decision_agent=decision_agent,
)

query_parser = QueryParser()
ticker_resolver = TickerResolver()

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
            
        reports = []
        market_data = {}
        context = []

        for symbol in symbol_list:
            workflow_state = WorkflowState()
            report = research_agent.research(symbol, workflow_state=workflow_state)
            report_payload = report.model_dump(mode="json")
            reports.append(report_payload)
            market_data[symbol] = report_payload.get("market_data", [])
            context.extend(report_payload.get("context", []))

        if not reports:
            return {
                "error": f"Could not fetch data for symbols: {', '.join(symbol_list)}. Please check if the symbols are valid.",
                "query": query,
                "attempted_symbols": symbol_list
            }

        summary = "\n\n".join(report.get("summary", "") for report in reports if report.get("summary"))

        return {
            "market_data": market_data,
            "context": context,
            "query": query,
            "symbols": symbol_list,
            "summary": summary,
            "reports": reports,
        }
    except Exception as e:
        logger.error(f"Error retrieving data: {str(e)}")
        return {"error": str(e)}

@app.post("/analyze/analyze")
async def analyze(data: dict):
    try:
        logger.info("Processing analyze request")

        payload = data.get("data", {})
        if payload.get("summary"):
            return {"summary": payload["summary"]}

        reports = payload.get("reports") or []
        if reports:
            return {"summary": reports[0].get("summary", "")}

        symbols = payload.get("symbols", DEFAULT_SYMBOLS)
        target_symbol = symbols[0] if symbols else DEFAULT_SYMBOLS[0]
        workflow_state = WorkflowState()
        report = research_agent.research(target_symbol, workflow_state=workflow_state)
        return {"summary": report.summary, "report": report.model_dump(mode="json")}
    except Exception as e:
        logger.error(f"Error analyzing data: {str(e)}")
        return {"error": str(e)}

@app.post("/strategy/strategy")
async def strategy(request: StrategyRequest):
    try:
        logger.info("Processing strategy request")
        workflow_state = WorkflowState(research_report=request.research_report)
        # use orchestrator helper to invoke agent in a backward-compatible way
        strategy_report = workflow_orchestrator._invoke_agent(
            strategy_agent.strategy, workflow_state.research_report, workflow_state
        )
        return strategy_report.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Error generating strategy: {str(e)}")
        return {"error": str(e)}

@app.post("/risk/risk")
async def risk(request: RiskRequest):
    try:
        logger.info("Processing risk request")
        workflow_state = WorkflowState(research_report=request.research_report)
        # use orchestrator helper to invoke agent in a backward-compatible way
        risk_report = workflow_orchestrator._invoke_agent(
            risk_agent.assess_risk, workflow_state.research_report, workflow_state
        )
        return risk_report.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Error generating risk report: {str(e)}")
        return {"error": str(e)}


@app.post("/decision/decision")
async def decision(data: dict):
    try:
        payload = data or {}
        research = payload.get("research_report")
        strategy = payload.get("strategy_report")
        risk = payload.get("risk_report")

        workflow_state = WorkflowState(
            research_report=research,
            strategy_report=strategy,
            risk_report=risk,
        )

        # Use orchestrator invoker to maintain backward-compatible shapes
        decision_report = workflow_orchestrator._invoke_agent(
            workflow_orchestrator.decision_agent.decide, workflow_state.research_report, workflow_state
        )
        return decision_report.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Error generating decision: {str(e)}")
        return {"error": str(e)}


@app.post("/workflow/execute")
async def execute_workflow(data: dict):
    try:
        query = (data.get("symbol") or data.get("data", {}).get("symbol") or DEFAULT_SYMBOLS[0]).strip()
        logger.info(f"User Query: {query}")
        
        parsed_query = query_parser.parse(query)
        logger.info(f"Parsed Query Intent: {parsed_query.intent}, Time Horizon: {parsed_query.time_horizon}")
        
        target = ""
        if parsed_query.companies:
            target = parsed_query.companies[0]
            logger.info(f"Detected Company: {target}")
        elif parsed_query.tickers:
            target = parsed_query.tickers[0]
            logger.info(f"Detected Ticker: {target}")
        else:
            target = query
            logger.info(f"Detected Target: {target}")
            
        resolved_ticker = ticker_resolver.resolve(target)
        if not resolved_ticker:
            logger.error(f"Could not resolve ticker for: {target}")
            # Instead of throwing 404, we return workflow state with error
            workflow_state = WorkflowState()
            workflow_state.record_error(f"Ticker not found for '{target}'")
            return workflow_state.model_dump(mode="json")
            
        logger.info(f"Resolved Ticker: {resolved_ticker}")
        logger.info(f"Fetching Yahoo Finance: {resolved_ticker}")
        
        workflow_state = workflow_orchestrator.execute(resolved_ticker, parsed_query=parsed_query)
        return workflow_state.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Error executing workflow: {str(e)}")
        return {"error": str(e)}