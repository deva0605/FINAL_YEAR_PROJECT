"""Task 3 follow-ups: hard time budget and semantic validation of LLM output. Mocks and fake clocks only;
nothing here contacts Gemini.

Run with: python -m unittest testing.test_gemini_hardening
"""
import json
import logging
import math
import os
import threading
import time
import unittest
from unittest import mock

from agents import gemini_client
from agents.gemini_client import (
    DEFAULT_MODEL,
    INVALID_RESPONSE,
    MAX_RETRIES_LIMIT,
    TRANSIENT,
    GeminiError,
    GeminiSettings,
    generate_text,
    meaningful_text,
)
from agents.retriever_agent import RetrieverAgent
from backend.agents.research_agent import NewsArticle, ResearchAgent
from backend.agents.decision_agent import DecisionAgent
from backend.agents.risk_agent import RiskAgent
from backend.agents.strategy_agent import StrategyAgent
from backend.workflow_state import WorkflowState
from testing.test_gemini_reliability import (
    DECISION_JSON,
    RISK_JSON,
    STRATEGY_JSON,
    FakeClock,
    FakeModel,
    GeminiTestCase,
    RATE_LIMIT_MSG,
    ResourceExhausted,
    ServiceUnavailable,
    make_language,
    make_report,
    summaries_json,
)


# --- GEMINI_TOTAL_BUDGET_SECONDS is a hard limit ---------------------------------

class TimeoutModel:
    """Every request runs until its own timeout, then fails like a gateway timeout."""

    def __init__(self, clock, duration=None, exc=ServiceUnavailable):
        self.clock, self.duration, self.exc = clock, duration, exc
        self.calls, self.timeouts = 0, []

    def generate_content(self, prompt, **kwargs):
        self.calls += 1
        timeout = kwargs["request_options"]["timeout"]
        self.timeouts.append(timeout)
        self.clock.now += timeout if self.duration is None else self.duration
        raise self.exc("deadline exceeded")


class BudgetTests(GeminiTestCase):
    def call(self, model, settings, clock):
        try:
            return generate_text(model, "p", settings, sleep=clock.sleep, clock=clock)
        except GeminiError as exc:
            return exc

    def test_repeated_request_timeouts_stay_within_the_budget(self):
        settings = GeminiSettings(max_retries=2, base_delay=1.0, max_delay=15.0, timeout=20.0, total_budget=45.0)
        clock = FakeClock()
        start = clock.now
        model = TimeoutModel(clock)
        error = self.call(model, settings, clock)
        self.assertEqual(error.kind, TRANSIENT)
        self.assertEqual(model.calls, 2)  # a third 20s attempt (after a 2s wait) would end at 63s
        self.assertEqual(clock.sleeps, [1.0])
        self.assertLessEqual(clock.now - start, settings.total_budget)
        self.assertIn("time budget", str(error))

    def test_retry_delay_fits_but_next_request_timeout_does_not(self):
        settings = GeminiSettings(max_retries=5, base_delay=1.0, max_delay=15.0, timeout=20.0, total_budget=30.0)
        clock = FakeClock()
        start = clock.now
        model = TimeoutModel(clock, duration=15.0)  # first attempt fails after 15s of the 30s budget
        error = self.call(model, settings, clock)
        # 15s used + 1s wait = 16s fits the budget, but 16s + a full 20s timeout = 36s does not
        self.assertEqual(model.calls, 1)
        self.assertEqual(clock.sleeps, [])
        self.assertEqual(error.kind, TRANSIENT)
        self.assertLessEqual(clock.now - start, settings.total_budget)

    def test_server_provided_delay_counts_against_the_budget_too(self):
        settings = GeminiSettings(max_retries=5, base_delay=1.0, max_delay=15.0, timeout=10.0, total_budget=20.0)
        clock = FakeClock()
        model = TimeoutModel(clock, duration=2.0, exc=lambda msg: ResourceExhausted(RATE_LIMIT_MSG.format(secs="9")))
        error = self.call(model, settings, clock)
        # attempt 1 ends at 2s; wait 9s -> 11s, +10s timeout = 21s > 20s budget -> no retry
        self.assertEqual((model.calls, clock.sleeps), (1, []))
        self.assertEqual(error.kind, gemini_client.RATE_LIMITED)

    def test_first_request_timeout_is_capped_at_the_budget(self):
        settings = GeminiSettings(max_retries=3, base_delay=1.0, max_delay=15.0, timeout=60.0, total_budget=10.0)
        clock = FakeClock()
        model = TimeoutModel(clock)
        self.call(model, settings, clock)
        self.assertEqual(model.timeouts, [10.0])  # not 60s
        self.assertEqual(model.calls, 1)

    def test_total_time_never_exceeds_the_budget_for_any_combination(self):
        for budget in (3.0, 10.0, 30.0, 45.0, 90.0):
            for timeout in (2.0, 7.0, 20.0, 60.0):
                for retries in (0, 2, 10):
                    gemini_client.reset_state()
                    settings = GeminiSettings(max_retries=retries, base_delay=1.0, max_delay=15.0, timeout=timeout, total_budget=budget)
                    clock = FakeClock()
                    start = clock.now
                    self.call(TimeoutModel(clock), settings, clock)
                    self.assertLessEqual(clock.now - start, budget, (budget, timeout, retries))

    def test_a_success_within_budget_is_unaffected(self):
        settings = GeminiSettings(max_retries=2, base_delay=1.0, max_delay=15.0, timeout=20.0, total_budget=45.0)
        clock = FakeClock()
        model = FakeModel(ServiceUnavailable("blip"), "fine")
        self.assertEqual(self.call(model, settings, clock), "fine")
        self.assertEqual(clock.sleeps, [1.0])


# --- semantic validation ---------------------------------------------------------

class MeaningfulTextTests(unittest.TestCase):
    def test_cases(self):
        for good in ("Hold", " a real sentence ", "₹980.00 - ₹1,010.00", "42"):
            self.assertTrue(meaningful_text(good), good)
        for bad in ("", "   ", "\n", "N/A", " n/a ", "None", "null", "Unknown", "-", "...", "!!!", None, 5, [], {}):
            self.assertFalse(meaningful_text(bad), repr(bad))


def without(raw_json: str, *keys, **overrides) -> str:
    data = json.loads(raw_json)
    for key in keys:
        data.pop(key, None)
    data.update(overrides)
    return json.dumps(data)


def run_strategy(payload, **language_kw):
    language = make_language(FakeModel(payload))
    state = WorkflowState(research_report=make_report())
    return StrategyAgent(language).strategy(workflow_state=state)


def run_risk(payload):
    return RiskAgent(make_language(FakeModel(payload))).assess_risk(research_report=make_report())


def run_decision(payload):
    state = WorkflowState(research_report=make_report())
    return DecisionAgent(make_language(FakeModel(payload))).decide(workflow_state=state)


class SemanticValidationTests(GeminiTestCase):
    def assert_fallback(self, report, why=None):
        self.assertEqual(report.generation.source, "fallback")
        self.assertEqual(report.generation.reason, INVALID_RESPONSE)
        self.assertIsNone(report.generation.model)
        self.assertIn("Rule-Based Analysis", report.reasoning if hasattr(report, "reasoning") else " ".join(report.reasons))

    def assert_llm(self, report):
        self.assertEqual(report.generation.source, "llm")
        self.assertEqual(report.generation.model, "test-model")
        self.assertIsNone(report.generation.reason)

    # ---- Strategy
    def test_strategy_valid_response_is_llm(self):
        report = run_strategy(STRATEGY_JSON)
        self.assert_llm(report)
        self.assertEqual(report.entry_zone, "e")

    def test_strategy_unusable_responses_fall_back(self):
        bad = {
            "empty object": "{}",
            "unrelated keys": '{"foo": 1, "bar": "baz"}',
            "only reasoning": '{"reasoning": "only this", "confidence": 0.5}',
            "missing entry_zone": without(STRATEGY_JSON, "entry_zone"),
            "blank entry_zone": without(STRATEGY_JSON, entry_zone="   "),
            "placeholder target": without(STRATEGY_JSON, target="N/A"),
            "empty exit_zone": without(STRATEGY_JSON, exit_zone=""),
            "empty suggested_strategy": without(STRATEGY_JSON, suggested_strategy=""),
            "no thesis at all": without(STRATEGY_JSON, bull_thesis="", bear_thesis=""),
            "missing confidence": without(STRATEGY_JSON, "confidence"),
        }
        for name, payload in bad.items():
            gemini_client.reset_state()
            report = run_strategy(payload)
            self.assert_fallback(report)
            self.assertTrue(report.entry_zone.startswith("₹"), name)  # the deterministic zones were used

    def test_strategy_one_thesis_is_enough(self):
        self.assert_llm(run_strategy(without(STRATEGY_JSON, bear_thesis="")))

    # ---- Risk
    def test_risk_valid_response_is_llm(self):
        report = run_risk(RISK_JSON)
        self.assert_llm(report)
        self.assertEqual(report.overall_risk_rating, "Low Risk")

    def test_risk_unusable_responses_fall_back(self):
        bad = {
            "empty object": "{}",
            "unrelated keys": '{"unrelated": true}',
            "missing rating": without(RISK_JSON, "overall_risk_rating"),
            "blank rating": without(RISK_JSON, overall_risk_rating=" "),
            "missing volatility": without(RISK_JSON, "volatility"),
            "empty macro_risk": without(RISK_JSON, macro_risk=""),
            "missing score": without(RISK_JSON, "risk_score"),
            "score above 100": without(RISK_JSON, risk_score=250),
            "negative score": without(RISK_JSON, risk_score=-1),
            "no explanatory text": without(RISK_JSON, reasons=[], weaknesses=[], recommendations=[]),
            "placeholder-only text": without(RISK_JSON, reasons=["N/A", " "]),
        }
        for name, payload in bad.items():
            gemini_client.reset_state()
            report = run_risk(payload)
            self.assertEqual(report.generation.source, "fallback", name)
            self.assertEqual(report.generation.reason, INVALID_RESPONSE, name)
            self.assertIn("Rule-Based Analysis (LLM unavailable)", report.reasons, name)

    def test_risk_boundary_scores_are_accepted(self):
        for score in (0, 100, 55.5):
            gemini_client.reset_state()
            self.assert_llm(run_risk(without(RISK_JSON, risk_score=score)))

    # ---- Decision
    def test_decision_valid_response_is_llm(self):
        report = run_decision(DECISION_JSON)
        self.assert_llm(report)
        self.assertEqual(report.recommendation, "HOLD")

    def test_decision_accepts_only_buy_hold_sell(self):
        for rec in ("BUY", "HOLD", "SELL"):
            gemini_client.reset_state()
            report = run_decision(without(DECISION_JSON, recommendation=rec))
            self.assert_llm(report)
            self.assertEqual(report.recommendation, rec)
        for rec in ("Strong Buy", "STRONG BUY", "Accumulate", "buy now", "", "N/A", "HOLD/BUY"):
            gemini_client.reset_state()
            self.assert_fallback(run_decision(without(DECISION_JSON, recommendation=rec)))

    def test_decision_recommendation_case_is_normalised(self):
        report = run_decision(without(DECISION_JSON, recommendation=" buy "))
        self.assert_llm(report)
        self.assertEqual(report.recommendation, "BUY")

    def test_decision_unusable_responses_fall_back(self):
        bad = {
            "empty object": "{}",
            "unrelated keys": '{"x": 1}',
            "only reasoning": '{"reasoning": "only this"}',
            "missing recommendation": without(DECISION_JSON, "recommendation"),
            "missing confidence": without(DECISION_JSON, "confidence"),
            "no summary or reasoning": without(DECISION_JSON, reasoning="", overall_summary=""),
        }
        for name, payload in bad.items():
            gemini_client.reset_state()
            report = run_decision(payload)
            self.assert_fallback(report)
            self.assertIn(report.recommendation, ("BUY", "HOLD", "SELL"), name)

    def test_decision_summary_or_reasoning_either_suffices(self):
        self.assert_llm(run_decision(without(DECISION_JSON, reasoning="")))
        gemini_client.reset_state()
        self.assert_llm(run_decision(without(DECISION_JSON, overall_summary="")))

    # ---- Research summaries
    def summaries(self, payload):
        language = make_language(FakeModel(payload))
        return language.generate_research_summaries("F", "F Co", [], {"latest_close": 10.0}, {"sector": "S"}, [])

    def test_research_valid_response_is_llm(self):
        out = self.summaries(summaries_json())
        self.assertEqual(out["generation"]["source"], "llm")
        self.assertEqual(out["technical_summary"], "T from llm")

    def test_research_needs_at_least_one_meaningful_summary(self):
        for name, payload in {
            "empty object": "{}",
            "unrelated keys": '{"unrelated": 1}',
            "blank summaries": '{"fundamental_summary": "  ", "technical_summary": ""}',
            "placeholder summaries": '{"fundamental_summary": "N/A", "technical_summary": "none"}',
            "non-string summaries": '{"fundamental_summary": 5, "technical_summary": ["x"]}',
            "sentiment only": '{"sentiment": "Bullish"}',
        }.items():
            gemini_client.reset_state()
            out = self.summaries(payload)
            self.assertEqual(out["generation"], {"source": "fallback", "model": None, "reason": INVALID_RESPONSE}, name)
            self.assertIn("Rule-Based Analysis", out["technical_summary"], name)

    def test_research_one_summary_is_enough(self):
        out = self.summaries('{"fundamental_summary": "Only fundamentals here.", "technical_summary": "", "sentiment": "Neutral"}')
        self.assertEqual(out["generation"]["source"], "llm")
        self.assertEqual((out["fundamental_summary"], out["technical_summary"]), ("Only fundamentals here.", ""))

    # ---- accounting across a whole workflow
    def test_rejected_output_does_not_mislabel_the_other_reports(self):
        language = make_language(FakeModel(STRATEGY_JSON, without(RISK_JSON, risk_score=999), DECISION_JSON))
        state = WorkflowState(research_report=make_report())
        state.strategy_report = StrategyAgent(language).strategy(workflow_state=state)
        state.risk_report = RiskAgent(language).assess_risk(workflow_state=state)
        state.decision_report = DecisionAgent(language).decide(workflow_state=state)
        self.assertEqual(state.strategy_report.generation.source, "llm")
        self.assertEqual(state.risk_report.generation.model_dump(), {"source": "fallback", "model": None, "reason": INVALID_RESPONSE})
        self.assertEqual(state.decision_report.generation.source, "llm")


# --- strict environment validation ------------------------------------------------

ENV_NAMES = ("GEMINI_MAX_RETRIES", "GEMINI_RETRY_BASE_SECONDS", "GEMINI_RETRY_MAX_SECONDS",
             "GEMINI_REQUEST_TIMEOUT_SECONDS", "GEMINI_TOTAL_BUDGET_SECONDS")


def settings_from(**env):
    with mock.patch.dict(os.environ, {k: v for k, v in env.items()}):
        for name in ENV_NAMES:
            if name not in env:
                os.environ.pop(name, None)
        with self_quiet():
            return GeminiSettings.from_env()


class self_quiet:
    """Silence the expected warnings from invalid values."""

    def __enter__(self):
        logging.disable(logging.WARNING)

    def __exit__(self, *exc):
        logging.disable(logging.NOTSET)


DEFAULTS = GeminiSettings()


class EnvironmentValidationTests(unittest.TestCase):
    def test_non_finite_values_are_rejected_for_every_numeric_setting(self):
        for name, field in (("GEMINI_RETRY_BASE_SECONDS", "base_delay"), ("GEMINI_RETRY_MAX_SECONDS", "max_delay"),
                            ("GEMINI_REQUEST_TIMEOUT_SECONDS", "timeout"), ("GEMINI_TOTAL_BUDGET_SECONDS", "total_budget")):
            for bad in ("inf", "-inf", "nan", "Infinity", "1e999"):
                settings = settings_from(**{name: bad})
                self.assertEqual(getattr(settings, field), getattr(DEFAULTS, field), (name, bad))
                self.assertTrue(math.isfinite(getattr(settings, field)))
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="inf").max_retries, DEFAULTS.max_retries)
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="nan").max_retries, DEFAULTS.max_retries)

    def test_max_retries_is_an_integer_with_a_documented_upper_bound(self):
        self.assertEqual(MAX_RETRIES_LIMIT, 5)
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="0").max_retries, 0)
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="5").max_retries, 5)
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="6").max_retries, 5)
        self.assertEqual(settings_from(GEMINI_MAX_RETRIES="1000").max_retries, 5)
        for bad in ("-1", "2.5", "two", "3.0", "0x2"):
            self.assertEqual(settings_from(GEMINI_MAX_RETRIES=bad).max_retries, DEFAULTS.max_retries, bad)

    def test_timeouts_and_budget_must_be_strictly_positive(self):
        for name, field in (("GEMINI_REQUEST_TIMEOUT_SECONDS", "timeout"), ("GEMINI_TOTAL_BUDGET_SECONDS", "total_budget")):
            for bad in ("0", "0.0", "-5", "-0.1", "abc"):
                self.assertEqual(getattr(settings_from(**{name: bad}), field), getattr(DEFAULTS, field), (name, bad))
            self.assertEqual(getattr(settings_from(**{name: "0.5"}), field), 0.5)

    def test_values_above_a_maximum_are_clamped(self):
        settings = settings_from(GEMINI_REQUEST_TIMEOUT_SECONDS="9999", GEMINI_TOTAL_BUDGET_SECONDS="99999",
                                 GEMINI_RETRY_MAX_SECONDS="9999")
        self.assertEqual((settings.timeout, settings.total_budget, settings.max_delay), (120.0, 600.0, 120.0))
        self.assertEqual(settings_from(GEMINI_RETRY_BASE_SECONDS="500").base_delay, DEFAULTS.max_delay)  # 60 -> then capped at max_delay 15

    def test_negative_delays_are_rejected_and_zero_is_allowed(self):
        self.assertEqual(settings_from(GEMINI_RETRY_BASE_SECONDS="-1").base_delay, DEFAULTS.base_delay)
        zero = settings_from(GEMINI_RETRY_BASE_SECONDS="0", GEMINI_RETRY_MAX_SECONDS="0")
        self.assertEqual((zero.base_delay, zero.max_delay), (0.0, 0.0))

    def test_max_delay_is_never_below_base_delay(self):
        settings = settings_from(GEMINI_RETRY_BASE_SECONDS="30", GEMINI_RETRY_MAX_SECONDS="10")
        self.assertEqual((settings.base_delay, settings.max_delay), (10.0, 10.0))  # the cap wins
        settings = settings_from(GEMINI_RETRY_BASE_SECONDS="5", GEMINI_RETRY_MAX_SECONDS="20")
        self.assertEqual((settings.base_delay, settings.max_delay), (5.0, 20.0))
        for env in ({}, {"GEMINI_RETRY_MAX_SECONDS": "0"}, {"GEMINI_RETRY_BASE_SECONDS": "59"}, {"GEMINI_RETRY_MAX_SECONDS": "x"}):
            s = settings_from(**env)
            self.assertGreaterEqual(s.max_delay, s.base_delay, env)

    def test_blank_values_use_defaults(self):
        for name in ENV_NAMES:
            self.assertEqual(settings_from(**{name: "   "}), DEFAULTS, name)

    def test_warnings_name_the_variable_but_not_the_api_key(self):
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "SECRET-KEY-VALUE", "GEMINI_REQUEST_TIMEOUT_SECONDS": "inf"}):
            with self.assertLogs("agents.gemini_client", level="WARNING") as logs:
                GeminiSettings.from_env()
        text = "\n".join(logs.output)
        self.assertIn("GEMINI_REQUEST_TIMEOUT_SECONDS", text)
        self.assertNotIn("SECRET-KEY-VALUE", text)

    def test_documentation_matches_code(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        readme = open(os.path.join(root, "README.md"), encoding="utf-8").read()
        env_example = open(os.path.join(root, ".env.example"), encoding="utf-8").read()
        for name in ENV_NAMES + ("GEMINI_MODEL",):
            self.assertIn(name, readme, name)
            self.assertIn(name, env_example, name)
        # the defaults shown in .env.example are the real defaults
        for line, value in (("GEMINI_MAX_RETRIES=", DEFAULTS.max_retries), ("GEMINI_RETRY_BASE_SECONDS=", DEFAULTS.base_delay),
                            ("GEMINI_RETRY_MAX_SECONDS=", DEFAULTS.max_delay), ("GEMINI_REQUEST_TIMEOUT_SECONDS=", DEFAULTS.timeout),
                            ("GEMINI_TOTAL_BUDGET_SECONDS=", DEFAULTS.total_budget)):
            documented = [l for l in env_example.splitlines() if l.lstrip("# ").startswith(line)]
            self.assertEqual(len(documented), 1, line)
            self.assertEqual(float(documented[0].split("=", 1)[1].split("#")[0].strip()), float(value), line)
        self.assertIn(f"GEMINI_MODEL={DEFAULT_MODEL}", env_example)
        # the documented limits are the enforced ones
        for text in (readme, env_example):
            self.assertIn("0-5", text)
        self.assertIn("<= 120", env_example)
        self.assertIn("<= 600", env_example)


# --- research partial summaries ---------------------------------------------------

class ResearchPartialSummaryTests(GeminiTestCase):
    def summaries(self, payload):
        return make_language(FakeModel(payload)).generate_research_summaries("F", "F Co", [], {"latest_close": 10.0}, {"sector": "S"}, [])

    def test_one_summary_only_is_llm_output_with_the_other_left_empty(self):
        out = self.summaries('{"technical_summary": "Momentum is improving.", "sentiment": "bullish"}')
        self.assertEqual(out["generation"], {"source": "llm", "model": "test-model", "reason": None})
        self.assertEqual(out["technical_summary"], "Momentum is improving.")
        self.assertEqual(out["fundamental_summary"], "")  # not back-filled from the rule-based text, so nothing is mislabelled
        self.assertNotIn("Rule-Based", out["fundamental_summary"] + out["technical_summary"])

    def test_sentiment_is_always_one_of_three_labels(self):
        cases = {"Bullish": "Bullish", "bearish": "Bearish", " NEUTRAL ": "Neutral",
                 "very positive": "Neutral", "": "Neutral", None: "Neutral", 7: "Neutral"}
        for given, expected in cases.items():
            gemini_client.reset_state()
            payload = json.dumps({"fundamental_summary": "Solid balance sheet.", "sentiment": given})
            self.assertEqual(self.summaries(payload)["sentiment"], expected, repr(given))
        gemini_client.reset_state()
        self.assertEqual(self.summaries('{"fundamental_summary": "Solid balance sheet."}')["sentiment"], "Neutral")

    def test_generation_matches_the_summaries_in_the_final_report(self):
        for payload, source in (
            ('{"fundamental_summary": "Real text."}', "llm"),
            ('{"fundamental_summary": "", "technical_summary": ""}', "fallback"),
        ):
            gemini_client.reset_state()
            out = self.summaries(payload)
            self.assertEqual(out["generation"]["source"], source)
            self.assertEqual("Rule-Based" in out["technical_summary"], source == "fallback")


# --- concurrency: the shared retriever index ----------------------------------------

class SlowRetriever(RetrieverAgent):
    """Retrieval that takes long enough for another request to index in the middle (as any slower retriever would)."""

    def retrieve(self, query, k=3):
        time.sleep(0.05)
        return super().retrieve(query, k)


def articles_for(name):
    return [NewsArticle(title=f"{name} Corp results", text=f"{name} Corp posts strong results", url="u")]


class RetrievalConcurrencyTests(unittest.TestCase):
    def test_concurrent_requests_never_see_each_others_news(self):
        agent = ResearchAgent(api_agent=mock.Mock(), scraping_agent=mock.Mock(), retriever_agent=SlowRetriever(),
                               language_agent=mock.Mock(), nse_service=None)
        names = ("AAA", "BBB", "CCC", "DDD")
        contexts = {}

        def work(name):
            contexts[name] = agent._retrieve_context(name, f"{name} Corp", articles_for(name))

        threads = [threading.Thread(target=work, args=(name,)) for name in names]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        for name in names:
            self.assertTrue(contexts[name], name)
            self.assertTrue(all(name in item for item in contexts[name]), (name, contexts[name]))

    def test_without_the_lock_the_same_scenario_cross_contaminates(self):
        # guards the test above: it must be able to detect the race it claims to prevent
        agent = ResearchAgent(api_agent=mock.Mock(), scraping_agent=mock.Mock(), retriever_agent=SlowRetriever(),
                               language_agent=mock.Mock(), nse_service=None)

        class NoLock:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        agent._retrieval_lock = NoLock()
        contexts = {}
        threads = [threading.Thread(target=lambda n=n: contexts.__setitem__(n, agent._retrieve_context(n, f"{n} Corp", articles_for(n))))
                   for n in ("AAA", "BBB")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        leaked = [n for n, ctx in contexts.items() if not all(n in item for item in ctx)]
        self.assertTrue(leaked, "expected the unlocked retriever to leak one request's news into the other")


if __name__ == "__main__":
    unittest.main()
