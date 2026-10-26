"""Currency handling tests. All figures are synthetic fixtures, not market data.

Run with: python -m unittest testing.test_currency
"""
import re
import types
import unittest
from unittest import mock

import pandas as pd

from agents.language_agent import LanguageAgent
from backend.agents.decision_agent import DecisionAgent
from backend.agents.research_agent import Fundamentals, ResearchAgent, ResearchReport, YAHOO_SOURCE
from backend.agents.risk_agent import RiskAgent
from backend.agents.strategy_agent import StrategyAgent
from backend.currency import (
    UNKNOWN_SYMBOL,
    format_large_amount,
    format_money,
    normalize_currency,
    resolve_currency,
)
from backend.scoring_engine import ScoringEngine
from backend.workflow_state import WorkflowState


class RuleBasedLanguageAgent(LanguageAgent):
    """Never calls an LLM, regardless of environment configuration."""

    def __init__(self):
        self.use_gemini = False
        self.gemini_model = None


def make_report(currency, **overrides) -> ResearchReport:
    base = dict(
        company="Fixture Co", ticker="FIX", current_price=1000.0, market_cap=16.1e12,
        pe_ratio=22.0, eps=45.5, revenue=2.5e12, sector="Energy", industry="Refining",
        high_52_week=1300.0, low_52_week=900.0, moving_averages={"20d": 980.0, "50d": 950.0},
        rsi=55.0, latest_news=[{"title": "Company posts record profit"}], fundamental_summary="s",
        currency=currency,
    )
    base.update(overrides)
    return ResearchReport(**base)


def run_workflow(report: ResearchReport) -> WorkflowState:
    state = WorkflowState(research_report=report)
    language = RuleBasedLanguageAgent()
    state.strategy_report = StrategyAgent(language).strategy(workflow_state=state)
    state.risk_report = RiskAgent(language).assess_risk(workflow_state=state)
    state.decision_report = DecisionAgent(language).decide(workflow_state=state)
    return state


def all_text(state: WorkflowState) -> str:
    parts = []
    for rep in (state.strategy_report, state.risk_report, state.decision_report):
        parts.append(rep.model_dump_json())
    return " ".join(parts)


class FormatterTests(unittest.TestCase):
    def test_price_symbols(self):
        self.assertEqual(format_money(1190.0, "INR"), "₹1,190.00")
        self.assertEqual(format_money(347.73, "USD"), "$347.73")
        self.assertEqual(format_money(1190.0, "inr"), "₹1,190.00")

    def test_unknown_currency_is_explicit_not_guessed(self):
        for unknown in (None, "", "  ", "UNKNOWN", "12", "US", 5):
            text = format_money(1190.0, unknown)
            self.assertEqual(text, f"{UNKNOWN_SYMBOL}1,190.00", unknown)
            self.assertNotIn("$", text)
            self.assertNotIn("₹", text)

    def test_other_reported_currency_uses_its_code_not_a_borrowed_symbol(self):
        self.assertEqual(format_money(12.5, "EUR"), "EUR 12.50")
        self.assertEqual(format_money(12.5, "GBp"), "GBp 12.50")  # Yahoo pence code kept as reported

    def test_negative_and_missing_values(self):
        self.assertEqual(format_money(-5.0, "INR"), "-₹5.00")
        self.assertEqual(format_money(None, "INR"), "N/A")
        self.assertEqual(format_large_amount(None, "USD"), "N/A")

    def test_market_cap_scaling(self):
        self.assertEqual(format_large_amount(16_103_642_234_880, "INR"), "₹16.1 trillion")
        self.assertEqual(format_large_amount(3.5e12, "USD"), "$3.5 trillion")
        self.assertEqual(format_large_amount(2.54e9, "USD"), "$2.5 billion")
        self.assertEqual(format_large_amount(850e6, "INR"), "₹850.0 million")
        self.assertEqual(format_large_amount(5.0e12, None), f"{UNKNOWN_SYMBOL}5.0 trillion")
        self.assertEqual(format_large_amount(999_999.0, "USD"), "$999,999.00")

    def test_normalize_currency(self):
        self.assertEqual(normalize_currency(" inr "), "INR")
        self.assertIsNone(normalize_currency(None))
        self.assertIsNone(normalize_currency("RUPEES"))


class ResolutionTests(unittest.TestCase):
    def test_single_or_agreeing_sources(self):
        self.assertEqual(resolve_currency([("a", "INR")])[:2], ("INR", "a"))
        code, source, warnings = resolve_currency([("nse", "INR"), ("yahoo", "inr"), ("hist", None)])
        self.assertEqual((code, source, warnings), ("INR", "nse", []))

    def test_no_report_is_unknown_with_warning(self):
        code, source, warnings = resolve_currency([("a", None), ("b", "??")])
        self.assertIsNone(code)
        self.assertIsNone(source)
        self.assertEqual(len(warnings), 1)
        self.assertIn("could not be verified", warnings[0])

    def test_disagreement_is_unknown_not_first_wins(self):
        code, _, warnings = resolve_currency([("nse", "INR"), ("yahoo", "USD")])
        self.assertIsNone(code)
        self.assertIn("disagree", warnings[0])


class ResearchCurrencyTests(unittest.TestCase):
    def resolve(self, market_source, fundamentals_currency=None, history_currency=None):
        frame = pd.DataFrame({"Close": [1.0]})
        if history_currency is not None:
            frame.attrs["currency"] = history_currency
        fundamentals = Fundamentals(currency=fundamentals_currency)
        return ResearchAgent._resolve_currency(market_source, fundamentals, frame)

    def test_indian_equity_reported_by_yahoo(self):
        code, source, warnings = self.resolve(YAHOO_SOURCE, "INR", "INR")
        self.assertEqual((code, warnings), ("INR", []))
        self.assertIn("Yahoo", source)

    def test_us_equity_reported_by_yahoo(self):
        self.assertEqual(self.resolve(YAHOO_SOURCE, "USD", "USD")[0], "USD")

    def test_history_metadata_alone_is_enough(self):
        self.assertEqual(self.resolve(YAHOO_SOURCE, None, "USD")[0], "USD")

    def test_nse_mcp_source_is_inr_even_if_yahoo_info_failed(self):
        code, source, _ = self.resolve("NSE India MCP", None, None)
        self.assertEqual((code, source), ("INR", "NSE India MCP"))

    def test_unknown_when_nothing_reported_even_for_ns_suffix(self):
        # the ticker suffix is never used as evidence
        code, source, warnings = self.resolve(YAHOO_SOURCE, None, None)
        self.assertIsNone(code)
        self.assertTrue(warnings)

    def test_conflicting_reports_are_unknown(self):
        code, _, warnings = self.resolve(YAHOO_SOURCE, "USD", "INR")
        self.assertIsNone(code)
        self.assertIn("disagree", warnings[0])

    def test_research_report_carries_currency_and_warning(self):
        def research(fundamentals_currency, history_currency):
            frame = pd.DataFrame({"Close": [100.0 + i for i in range(60)]})
            if history_currency:
                frame.attrs["currency"] = history_currency
            api = mock.Mock()
            api.get_market_data.return_value = {"TEST": frame}
            api.get_earnings.return_value = None
            language = mock.Mock()
            language.generate_research_summaries.return_value = {"sentiment": "Neutral"}
            agent = ResearchAgent(
                api_agent=api, scraping_agent=mock.Mock(), retriever_agent=mock.Mock(),
                language_agent=language, nse_service=None,
            )
            agent._get_nse_service = lambda: None
            agent._fetch_news = lambda symbol: []
            agent._fetch_fundamentals = lambda symbol: Fundamentals(long_name="T", currency=fundamentals_currency)
            report = agent.research("TEST")
            return report, language.generate_research_summaries.call_args.kwargs

        report, kwargs = research("USD", "USD")
        self.assertEqual((report.currency, kwargs["currency"]), ("USD", "USD"))
        self.assertFalse(any("Currency" in w for w in report.market_data_warnings))

        report, kwargs = research(None, None)
        self.assertIsNone(report.currency)
        self.assertIsNone(kwargs["currency"])
        self.assertTrue(any("Currency could not be verified" in w for w in report.market_data_warnings))


class DownstreamFormattingTests(unittest.TestCase):
    def test_indian_equity_end_to_end(self):
        state = run_workflow(make_report("INR"))
        strategy = state.strategy_report
        self.assertEqual(strategy.entry_zone, "₹980.00 - ₹1,010.00")
        self.assertEqual(strategy.exit_zone, "Stop-loss at ₹930.00")
        self.assertEqual(strategy.target, "₹1,120.00")
        text = all_text(state)
        self.assertIn("Market cap of ₹16.1 trillion; size tier not assessed", text)
        self.assertIn("₹1,000.00", state.decision_report.overall_summary)
        self.assertNotIn("$", text)
        self.assertNotIn(UNKNOWN_SYMBOL, text)

    def test_us_equity_end_to_end(self):
        state = run_workflow(make_report("USD", market_cap=3.5e12))
        strategy = state.strategy_report
        self.assertEqual(strategy.entry_zone, "$980.00 - $1,010.00")
        self.assertEqual(strategy.exit_zone, "Stop-loss at $930.00")
        self.assertEqual(strategy.target, "$1,120.00")
        text = all_text(state)
        self.assertIn("$3.5 trillion market cap", text)
        self.assertIn("$1,000.00", state.decision_report.overall_summary)
        self.assertNotIn("₹", text)

    def test_unknown_currency_end_to_end_has_no_guessed_symbol(self):
        state = run_workflow(make_report(None))
        text = all_text(state)
        self.assertNotIn("$", text)
        self.assertNotIn("₹", text)
        self.assertIn(f"Market cap of {UNKNOWN_SYMBOL}16.1 trillion; size tier not assessed", text)
        self.assertEqual(state.strategy_report.target, f"{UNKNOWN_SYMBOL}1,120.00")
        self.assertIsNone(state.strategy_report.currency)
        self.assertIsNone(state.decision_report.currency)

    def test_same_currency_preserved_from_research_to_decision(self):
        for code in ("INR", "USD", None):
            state = run_workflow(make_report(code))
            self.assertEqual(state.research_report.currency, code)
            self.assertEqual(state.strategy_report.currency, code)
            self.assertEqual(state.decision_report.currency, code)

    def test_currency_changes_symbols_only_not_numbers(self):
        # INR and unknown are both unclassified for market-cap tier, so every number must match;
        # only the symbols differ. (USD is excluded: its tier is classified, which legitimately
        # changes the score - see testing/test_market_cap.py.)
        def strip(text):
            return text.replace("₹", "").replace(UNKNOWN_SYMBOL, "")

        inr = run_workflow(make_report("INR"))
        unknown = run_workflow(make_report(None))
        for field in ("entry_zone", "exit_zone", "target"):
            self.assertEqual(strip(getattr(inr.strategy_report, field)), strip(getattr(unknown.strategy_report, field)))
        self.assertEqual(inr.decision_report.confidence, unknown.decision_report.confidence)
        self.assertEqual(inr.risk_report.risk_score, unknown.risk_report.risk_score)
        self.assertEqual(strip(inr.decision_report.overall_summary), strip(unknown.decision_report.overall_summary))

    def test_scoring_reasons_use_report_currency(self):
        reasons = ScoringEngine().compute_scores(make_report("INR")).fundamentals_reasons
        text = " ".join(reasons)
        self.assertIn("₹45.50", text)       # EPS
        self.assertIn("₹2.5 trillion", text)  # revenue
        technical = " ".join(ScoringEngine().compute_scores(make_report("USD")).technical_reasons)
        self.assertIn("$900.00", technical)  # 52-week low
        self.assertNotIn("₹", technical)

    def test_dict_input_without_currency_is_unknown_not_dollar(self):
        scored = ScoringEngine().compute_scores({"current_price": 10.0, "market_cap": 5e12, "moving_averages": {}})
        text = " ".join(scored.fundamentals_reasons)
        self.assertNotIn("$", text)
        self.assertIn(UNKNOWN_SYMBOL, text)

    def test_llm_output_cannot_override_the_verified_currency(self):
        language = RuleBasedLanguageAgent()
        language.use_gemini = True
        language.gemini_model = object()
        language.call_llm = lambda prompt: "{}"
        language.extract_json = lambda raw: {
            "entry_zone": "$100 - $110", "exit_zone": "Stop at $90", "target": "$130", "currency": "USD",
        }
        report = make_report("INR")
        result = StrategyAgent(language).strategy(research_report=report)
        self.assertEqual(result.currency, "INR")

    def test_llm_prompts_state_the_currency(self):
        prompts = []
        language = RuleBasedLanguageAgent()
        language.use_gemini = True
        language.gemini_model = object()
        language.call_llm = lambda prompt: prompts.append(prompt) or None
        report = make_report("INR")
        StrategyAgent(language).strategy(research_report=report)
        RiskAgent(language).assess_risk(research_report=report)
        state = WorkflowState(research_report=report)
        DecisionAgent(language).decide(workflow_state=state)
        self.assertEqual(len(prompts), 3)
        for prompt in prompts:
            self.assertIn("All monetary values are in INR", prompt)

        prompts.clear()
        StrategyAgent(language).strategy(research_report=make_report(None))
        self.assertIn("currency of the monetary values is unknown", prompts[0])

    def test_language_agent_summaries_use_currency(self):
        language = RuleBasedLanguageAgent()
        indicators = {"latest_close": 1000.0, "moving_average_20": 980.0, "moving_average_50": 950.0,
                      "high_52_week": 1300.0, "low_52_week": 900.0, "rsi_14": 55.0, "change_percent": 1.0}
        fundamentals = {"market_cap": 16.1e12, "sector": "Energy", "financial_currency": "INR"}
        earnings = [{"year": 2025, "earnings": 7.0e11}]
        out = language.generate_research_summaries(
            "FIX", "Fixture Co", [], indicators, fundamentals, earnings, currency="INR"
        )
        self.assertIn("₹16.1 trillion", out["fundamental_summary"])
        self.assertIn("2025: ₹700.0 billion", out["fundamental_summary"])
        self.assertIn("trading at ₹1,000.00", out["technical_summary"])
        self.assertNotIn("$", out["technical_summary"] + out["fundamental_summary"])

    def test_earnings_use_financial_currency_when_it_differs(self):
        language = RuleBasedLanguageAgent()
        out = language.generate_research_summaries(
            "ADR", "Foreign Co", [], {}, {"financial_currency": "TWD", "market_cap": 5e11},
            [{"year": 2025, "earnings": 1.0e12}], currency="USD",
        )
        self.assertIn("$500.0 billion", out["fundamental_summary"])  # trading currency
        self.assertIn("2025: TWD 1.0 trillion", out["fundamental_summary"])


if __name__ == "__main__":
    unittest.main()
