"""Market-cap tier tests. Figures are synthetic boundary values, not market data.

Run with: python -m unittest testing.test_market_cap
"""
import json
import unittest

from agents.language_agent import LanguageAgent
from backend.agents.research_agent import ResearchReport
from backend.agents.risk_agent import RiskAgent
from backend.agents.decision_agent import DecisionAgent
from backend.agents.strategy_agent import StrategyAgent
from backend.market_cap import USD_TIER_FLOORS, classify_market_cap, tier_prompt_note, unclassified_reason
from backend.workflow_state import WorkflowState
from backend.scoring_engine import ScoringEngine


class NoLLM(LanguageAgent):
    def __init__(self):
        self.use_gemini = False
        self.gemini_model = None


def report(market_cap, currency, **kw) -> ResearchReport:
    return ResearchReport(company="X", ticker="X", current_price=100.0, market_cap=market_cap,
                          pe_ratio=20.0, currency=currency, **kw)


class ClassificationTests(unittest.TestCase):
    def test_usd_boundaries_are_inclusive_at_each_floor(self):
        cases = [
            (200e9, "mega"), (200e9 - 1, "large"),
            (10e9, "large"), (10e9 - 1, "mid"),
            (2e9, "mid"), (2e9 - 1, "small"),
            (0.0, "small"), (5e12, "mega"),
        ]
        for cap, expected in cases:
            self.assertEqual(classify_market_cap(cap, "USD"), expected, cap)

    def test_floors_match_the_project_convention(self):
        self.assertEqual(dict(USD_TIER_FLOORS), {"mega": 200e9, "large": 10e9, "mid": 2e9})

    def test_usd_code_is_case_insensitive(self):
        self.assertEqual(classify_market_cap(3e9, "usd"), "mid")

    def test_inr_is_never_classified_at_any_size(self):
        for cap in (0.0, 1e9, 2e9, 10e9, 200e9, 16.1e12):
            self.assertIsNone(classify_market_cap(cap, "INR"), cap)

    def test_unknown_and_other_currencies_are_unclassified(self):
        for currency in (None, "", "UNKNOWN", "12", "EUR", "GBp"):
            self.assertIsNone(classify_market_cap(50e9, currency), currency)

    def test_missing_market_cap_is_unclassified(self):
        self.assertIsNone(classify_market_cap(None, "USD"))

    def test_reasons(self):
        self.assertEqual(unclassified_reason("INR"), "no verified size thresholds for INR")
        self.assertEqual(unclassified_reason(None), "currency could not be verified")


class ReportFieldTests(unittest.TestCase):
    def test_tier_is_derived_and_serialised(self):
        self.assertEqual(report(250e9, "USD").market_cap_tier, "mega")
        self.assertIsNone(report(250e9, "INR").market_cap_tier)
        self.assertIsNone(report(250e9, None).market_cap_tier)
        payload = json.loads(report(5e9, "USD").model_dump_json())
        self.assertEqual(payload["market_cap_tier"], "mid")
        self.assertIn("market_cap_tier", json.loads(report(5e9, "INR").model_dump_json()))
        self.assertIsNone(json.loads(report(5e9, "INR").model_dump_json())["market_cap_tier"])

    def test_tier_in_input_is_ignored_not_trusted(self):
        rebuilt = ResearchReport.model_validate({**report(5e9, "INR").model_dump(), "market_cap_tier": "mega"})
        self.assertIsNone(rebuilt.market_cap_tier)


class ScoringTests(unittest.TestCase):
    def fundamentals(self, cap, currency):
        result = ScoringEngine().compute_scores(report(cap, currency))
        return result.fundamentals_score, " ".join(result.fundamentals_reasons)

    def test_usd_tiers_keep_their_existing_score_adjustments(self):
        base, _ = self.fundamentals(None, "USD")
        for cap, delta, phrase in ((200e9, 10, "Mega-cap"), (10e9, 5, "Large-cap"),
                                   (2e9, 0, "Mid-cap"), (2e9 - 1, -5, "Small-cap")):
            score, text = self.fundamentals(cap, "USD")
            self.assertEqual(score - base, delta, cap)
            self.assertIn(phrase, text)

    def test_inr_and_unknown_get_no_tier_adjustment_and_say_so(self):
        base, _ = self.fundamentals(None, "INR")
        for currency, why in (("INR", "no verified size thresholds for INR"), (None, "currency could not be verified")):
            for cap in (1e9, 200e9, 16.1e12):
                score, text = self.fundamentals(cap, currency)
                self.assertEqual(score, base)
                self.assertIn("size tier not assessed", text)
                self.assertIn(why, text)
                for tier_word in ("Mega-cap", "Large-cap", "Mid-cap", "Small-cap"):
                    self.assertNotIn(tier_word, text)

    def risk_part(self, cap, currency):
        result = ScoringEngine().compute_scores(report(cap, currency))
        return result.risk_score, " ".join(result.risk_reasons)

    def test_liquidity_proxy_by_currency(self):
        base, _ = self.risk_part(None, "USD")
        for cap, delta, phrase in ((10e9, 15, "High liquidity"), (2e9, 5, "Moderate liquidity"),
                                   (2e9 - 1, -15, "Lower liquidity")):
            score, text = self.risk_part(cap, "USD")
            self.assertEqual(score - base, delta, cap)
            self.assertIn(phrase, text)
        for currency in ("INR", None):
            score, text = self.risk_part(16.1e12, currency)
            self.assertEqual(score, base)
            self.assertIn("Liquidity not inferred from market cap", text)


class RiskAgentTests(unittest.TestCase):
    def liquidity(self, cap, currency):
        return RiskAgent(NoLLM()).assess_risk(research_report=report(cap, currency)).liquidity

    def test_liquidity_label(self):
        self.assertEqual(self.liquidity(200e9, "USD"), "High")
        self.assertEqual(self.liquidity(10e9, "USD"), "High")
        self.assertEqual(self.liquidity(10e9 - 1, "USD"), "Moderate")
        self.assertEqual(self.liquidity(2e9, "USD"), "Moderate")
        self.assertEqual(self.liquidity(2e9 - 1, "USD"), "Low")

    def test_unclassified_is_unknown_not_a_guessed_label(self):
        self.assertEqual(self.liquidity(16.1e12, "INR"), "Unknown")
        self.assertEqual(self.liquidity(16.1e12, None), "Unknown")
        self.assertEqual(self.liquidity(None, "USD"), "Unknown")


class LanguageAgentTests(unittest.TestCase):
    def summary(self, cap, currency):
        return NoLLM().generate_research_summaries(
            "X", "X Co", [], {}, {"market_cap": cap, "sector": "S"}, [], currency=currency
        )["fundamental_summary"]

    def test_usd_tier_wording(self):
        self.assertIn("mega-cap company", self.summary(200e9, "USD"))
        self.assertIn("large-cap company", self.summary(200e9 - 1, "USD"))
        self.assertIn("mid-cap company", self.summary(2e9, "USD"))
        self.assertIn("small-cap company", self.summary(2e9 - 1, "USD"))

    def test_inr_and_unknown_are_not_given_a_tier(self):
        for currency, why in (("INR", "no verified size thresholds for INR"), (None, "currency could not be verified")):
            text = self.summary(16.1e12, currency)
            self.assertIn("size tier not assessed", text)
            self.assertIn(why, text)
            self.assertNotIn("-cap company", text)


class TierPromptNoteTests(unittest.TestCase):
    def test_unclassified_with_a_market_cap_gets_a_clear_instruction(self):
        for currency, why in (("INR", "no verified size thresholds for INR"), (None, "currency could not be verified"),
                              ("EUR", "no verified size thresholds for EUR")):
            note = tier_prompt_note(16.1e12, currency)
            self.assertIn("unclassified", note)
            self.assertIn(why, note)
            for word in ("mega-cap", "large-cap", "mid-cap", "small-cap"):
                self.assertIn(word, note)
            self.assertIn("do not describe", note)
            self.assertTrue(note.endswith("\n"))

    def test_classified_usd_gets_no_note_at_any_tier(self):
        for cap in (1.0, 2e9 - 1, 2e9, 10e9, 200e9, 3.5e12):
            self.assertEqual(tier_prompt_note(cap, "USD"), "", cap)

    def test_missing_market_cap_gets_no_note(self):
        for currency in ("USD", "INR", None):
            self.assertEqual(tier_prompt_note(None, currency), "", currency)


class PromptWiringTests(unittest.TestCase):
    """The note must reach all four LLM prompts, next to the currency guidance."""

    MARKER = "The market-cap size tier is unclassified"

    def capture_prompts(self, rep: ResearchReport) -> dict:
        prompts = {}

        class FakeModel:
            def generate_content(self, prompt, **kwargs):
                prompts["language"] = prompt
                return type("R", (), {"text": '{"fundamental_summary": "a", "technical_summary": "b", "sentiment": "Neutral"}'})()

        language = NoLLM()
        language.use_gemini = True
        language.gemini_model = FakeModel()

        def call_llm(prompt):
            prompts.setdefault("calls", []).append(prompt)
            return None

        language.call_llm = call_llm
        language.generate_research_summaries(
            rep.ticker, rep.company, [], {}, {"market_cap": rep.market_cap}, [], currency=rep.currency
        )
        StrategyAgent(language).strategy(research_report=rep)
        RiskAgent(language).assess_risk(research_report=rep)
        DecisionAgent(language).decide(workflow_state=WorkflowState(research_report=rep))
        prompts["strategy"], prompts["risk"], prompts["decision"] = prompts.pop("calls")
        return prompts

    def test_note_present_in_every_prompt_when_unclassified(self):
        for currency in ("INR", None):
            prompts = self.capture_prompts(report(16.1e12, currency))
            self.assertEqual(set(prompts), {"language", "strategy", "risk", "decision"})
            for name, prompt in prompts.items():
                self.assertIn(self.MARKER, prompt, name)
                currency_line = prompt.index("monetary values")
                self.assertLess(currency_line, prompt.index(self.MARKER), name)  # alongside the currency guidance

    def test_note_absent_when_tier_is_classified(self):
        for prompt in self.capture_prompts(report(250e9, "USD")).values():
            self.assertNotIn(self.MARKER, prompt)

    def test_note_absent_when_market_cap_is_missing(self):
        for currency in ("INR", "USD", None):
            for name, prompt in self.capture_prompts(report(None, currency)).items():
                self.assertNotIn(self.MARKER, prompt, f"{name}/{currency}")


if __name__ == "__main__":
    unittest.main()
