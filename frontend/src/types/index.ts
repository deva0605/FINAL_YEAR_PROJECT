export interface MarketData {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface MovingAverages {
  '20d'?: number | null;
  '50d'?: number | null;
}

export interface TechnicalIndicators {
  latest_close?: number;
  change_percent?: number;
  moving_average_20?: number;
  moving_average_50?: number;
  average_volume_20?: number;
  high_52_week?: number;
  low_52_week?: number;
  rsi_14?: number;
}

export interface Fundamentals {
  long_name?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  pe_ratio?: number;
  price_to_book?: number;
  dividend_yield?: number;
  beta?: number;
  website?: string;
  long_business_summary?: string;
}

export interface NewsArticle {
  title: string;
  url?: string;
  publish_date?: string;
}

export interface ResearchReport {
  company?: string;
  ticker?: string;
  symbol?: string;
  current_price?: number;
  market_cap?: number;
  sector?: string;
  industry?: string;
  pe_ratio?: number;
  eps?: number;
  revenue?: number;
  high_52_week?: number;
  low_52_week?: number;
  moving_averages?: MovingAverages;
  rsi?: number;
  latest_news?: NewsArticle[];
  fundamental_summary?: string;
  technical_summary?: string;
  sentiment?: string;
  sources?: string[];
  summary?: string;
  market_data?: MarketData[];
  context?: string[];
  fundamentals?: Fundamentals;
  technical_indicators?: TechnicalIndicators;
}

export interface StrategyReport {
  bull_thesis?: string;
  bear_thesis?: string;
  suggested_strategy?: string;
  entry_zone?: string;
  exit_zone?: string;
  target?: string;
  time_horizon?: string;
  confidence?: number;
  reasoning?: string;
  catalysts?: string[];
}

export interface RiskReport {
  overall_risk?: string;
  overall_risk_rating?: string;
  risk_score?: number;
  volatility?: string;
  liquidity?: string;
  valuation?: string;
  financial_risk?: string;
  news_risk?: string;
  macro_risk?: string;
  weaknesses?: string[];
  recommendations?: string[];
  reasons?: string[];
}

export interface DecisionReport {
  recommendation?: string;
  confidence?: number;
  reasoning?: string;
  overall_summary?: string;
  supporting_evidence?: string[];
  next_steps?: string[];
  investment_horizon?: string;
}

export interface WorkflowMetadata {
  current_step?: string;
  started_at?: string;
  completed_at?: string;
  execution_time_seconds?: number;
  completed_steps?: string[];
  errors?: string[];
}

export interface WorkflowState {
  research_report?: ResearchReport;
  strategy_report?: StrategyReport;
  risk_report?: RiskReport;
  decision_report?: DecisionReport;
  metadata?: WorkflowMetadata;
}
