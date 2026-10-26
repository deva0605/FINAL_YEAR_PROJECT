"""Gemini reliability tests: configuration, bounded retries, error handling, fallback metadata.

Everything here uses mocks. No test calls the real Gemini API, so nothing in this file shows that a
real Gemini request succeeds.

Run with: python -m unittest testing.test_gemini_reliability
"""
import os
import sys
import types
import unittest
from unittest import mock

import pandas as pd

from agents import gemini_client
from agents.gemini_client import (
    AUTH,
    DEFAULT_MODEL,
    INVALID_REQUEST,
    INVALID_RESPONSE,
    MODEL_NOT_FOUND,
    QUOTA_EXHAUSTED,
    RATE_LIMITED,
    TRANSIENT,
    UNKNOWN,
    GeminiError,
    GeminiSettings,
    classify_error,
    create_model,
    generate_text,
    parse_retry_after,
)
from agents.language_agent import LanguageAgent
from backend.agents.decision_agent import DecisionAgent
from backend.agents.research_agent import Fundamentals, ResearchAgent, ResearchReport
from backend.agents.risk_agent import RiskAgent
from backend.agents.strategy_agent import StrategyAgent
from backend.query_understanding import QueryParser
from backend.workflow_state import WorkflowState


# --- fake SDK pieces -------------------------------------------------------

class ResourceExhausted(Exception):
    code = 429


class ServiceUnavailable(Exception):
    code = 503


class PermissionDenied(Exception):
    code = 403


class InvalidArgument(Exception):
    code = 400


class NotFound(Exception):
    code = 404


RATE_LIMIT_MSG = (
    "429 You exceeded your current quota. * Quota exceeded for metric: "
    "generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 5 "
    "quota_id: \"GenerateRequestsPerMinutePerProjectPerModel-FreeTier\" Please retry in {secs}s. "
    "[retry_delay {{ seconds: 7 }}]"
)
DAILY_QUOTA_MSG = (
    "429 You exceeded your current quota. quota_id: \"GenerateRequestsPerDayPerProjectPerModel-FreeTier\" "
    "Please retry in 3000s."
)


class Response:
    def __init__(self, text):
        self._text = text

    @property
    def text(self):
        if isinstance(self._text, Exception):
            raise self._text
        return self._text


class FakeModel:
    """Plays back outcomes in order (exceptions are raised, anything else is returned).
    The last outcome repeats."""

    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.calls = []

    def generate_content(self, prompt, **kwargs):
        self.calls.append((prompt, kwargs))
        outcome = self.outcomes[min(len(self.calls), len(self.outcomes)) - 1]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome if isinstance(outcome, Response) else Response(outcome)


class FakeClock:
    def __init__(self):
        self.now = 1000.0
        self.sleeps = []

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


FAST = GeminiSettings(model="test-model", max_retries=2, base_delay=1.0, max_delay=15.0, timeout=7.0, total_budget=45.0)
NO_WAIT = GeminiSettings(model="test-model", max_retries=2, base_delay=0.0, max_delay=15.0, timeout=7.0, total_budget=45.0)


class GeminiTestCase(unittest.TestCase):
    def setUp(self):
        gemini_client.reset_state()
        self.addCleanup(gemini_client.reset_state)


# --- configuration ---------------------------------------------------------

class SettingsTests(GeminiTestCase):
    def test_defaults(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            for name in ("GEMINI_MODEL", "GEMINI_MAX_RETRIES", "GEMINI_RETRY_BASE_SECONDS", "GEMINI_RETRY_MAX_SECONDS",
                         "GEMINI_REQUEST_TIMEOUT_SECONDS", "GEMINI_TOTAL_BUDGET_SECONDS"):
                os.environ.pop(name, None)
            settings = GeminiSettings.from_env()
        self.assertEqual(settings.model, DEFAULT_MODEL)
        self.assertEqual((settings.max_retries, settings.base_delay, settings.max_delay), (2, 1.0, 15.0))
        self.assertEqual((settings.timeout, settings.total_budget), (20.0, 45.0))

    def test_environment_overrides(self):
        env = {"GEMINI_MODEL": " my-model ", "GEMINI_MAX_RETRIES": "4", "GEMINI_RETRY_BASE_SECONDS": "0.5",
               "GEMINI_RETRY_MAX_SECONDS": "9", "GEMINI_REQUEST_TIMEOUT_SECONDS": "12", "GEMINI_TOTAL_BUDGET_SECONDS": "30"}
        with mock.patch.dict(os.environ, env):
            settings = GeminiSettings.from_env()
        self.assertEqual(settings, GeminiSettings(model="my-model", max_retries=4, base_delay=0.5, max_delay=9.0, timeout=12.0, total_budget=30.0))

    def test_invalid_numbers_fall_back_to_defaults(self):
        with mock.patch.dict(os.environ, {"GEMINI_MAX_RETRIES": "many", "GEMINI_RETRY_MAX_SECONDS": "-5", "GEMINI_MODEL": "  "}):
            settings = GeminiSettings.from_env()
        self.assertEqual(settings.max_retries, 2)
        self.assertEqual(settings.max_delay, 15.0)
        self.assertEqual(settings.model, DEFAULT_MODEL)

    def test_create_model_uses_configured_model_name(self):
        genai = types.SimpleNamespace(configure=mock.Mock(), GenerativeModel=mock.Mock(return_value="MODEL"))
        google_pkg = types.ModuleType("google")
        google_pkg.generativeai = genai
        with mock.patch.dict(sys.modules, {"google": google_pkg, "google.generativeai": genai}), \
                mock.patch.dict(os.environ, {"GEMINI_API_KEY": "k", "GEMINI_MODEL": "custom-model"}):
            model, reason = create_model()
        self.assertEqual((model, reason), ("MODEL", None))
        genai.GenerativeModel.assert_called_once_with("custom-model")
        genai.configure.assert_called_once_with(api_key="k")

    def test_create_model_without_key_reports_why(self):
        with mock.patch.dict(os.environ, {}):
            os.environ.pop("GEMINI_API_KEY", None)
            self.assertEqual(create_model(), (None, "no_api_key"))

    def test_create_model_without_sdk_reports_why(self):
        with mock.patch.dict(sys.modules, {"google.generativeai": None}):
            self.assertEqual(create_model(), (None, "sdk_not_installed"))


# --- error classification --------------------------------------------------

class ClassificationTests(GeminiTestCase):
    def test_kinds(self):
        cases = [
            (ResourceExhausted(RATE_LIMIT_MSG.format(secs="7.5")), RATE_LIMITED),
            (ResourceExhausted(DAILY_QUOTA_MSG), QUOTA_EXHAUSTED),
            (ServiceUnavailable("overloaded"), TRANSIENT),
            (TimeoutError("timed out"), TRANSIENT),
            (ConnectionError("reset"), TRANSIENT),
            (PermissionDenied("denied"), AUTH),
            (InvalidArgument("API key not valid. Please pass a valid API key."), AUTH),
            (NotFound("models/x is not found"), MODEL_NOT_FOUND),
            (InvalidArgument("bad request"), INVALID_REQUEST),
            (RuntimeError("boom"), UNKNOWN),
        ]
        for exc, expected in cases:
            self.assertEqual(classify_error(exc)[0], expected, repr(exc))

    def test_retry_after_parsing(self):
        self.assertAlmostEqual(parse_retry_after(ResourceExhausted(RATE_LIMIT_MSG.format(secs="7.552100068"))), 7.552100068)
        self.assertEqual(parse_retry_after(ResourceExhausted("retry_delay {\n  seconds: 9\n}")), 9.0)
        self.assertIsNone(parse_retry_after(ResourceExhausted("no hint")))
        exc = ResourceExhausted("x")
        exc.retry_delay = types.SimpleNamespace(seconds=4)
        self.assertEqual(parse_retry_after(exc), 4.0)


# --- generate_text ---------------------------------------------------------

class GenerateTextTests(GeminiTestCase):
    def run_call(self, model, settings=FAST, clock=None):
        clock = clock or FakeClock()
        try:
            return generate_text(model, "prompt", settings, sleep=clock.sleep, clock=clock), clock
        except GeminiError as exc:
            return exc, clock

    def test_success_passes_bounded_request_options(self):
        model = FakeModel("  hello  ")
        result, clock = self.run_call(model)
        self.assertEqual(result, "hello")
        self.assertEqual(len(model.calls), 1)
        self.assertEqual(model.calls[0][1]["request_options"], {"timeout": 7.0, "retry": None})
        self.assertEqual(clock.sleeps, [])

    def test_rate_limit_waits_for_server_delay_then_succeeds(self):
        model = FakeModel(ResourceExhausted(RATE_LIMIT_MSG.format(secs="2.5")), "ok")
        result, clock = self.run_call(model)
        self.assertEqual(result, "ok")
        self.assertEqual(clock.sleeps, [2.5])
        self.assertEqual(len(model.calls), 2)

    def test_transient_errors_use_exponential_backoff(self):
        model = FakeModel(ServiceUnavailable("a"), ServiceUnavailable("b"), "ok")
        result, clock = self.run_call(model)
        self.assertEqual(result, "ok")
        self.assertEqual(clock.sleeps, [1.0, 2.0])

    def test_backoff_is_capped_at_max_delay(self):
        settings = GeminiSettings(max_retries=5, base_delay=4.0, max_delay=6.0, total_budget=999.0)
        model = FakeModel(ServiceUnavailable("x"))
        _, clock = self.run_call(model, settings)
        self.assertEqual(clock.sleeps, [4.0, 6.0, 6.0, 6.0, 6.0])

    def test_retry_exhaustion_is_bounded_and_raises(self):
        model = FakeModel(ResourceExhausted("429 rate limited"))
        result, clock = self.run_call(model)
        self.assertIsInstance(result, GeminiError)
        self.assertEqual(result.kind, RATE_LIMITED)
        self.assertEqual(len(model.calls), FAST.max_retries + 1)
        self.assertEqual(clock.sleeps, [1.0, 2.0])

    def test_exhaustion_opens_a_shared_cooldown_so_later_calls_do_not_hit_the_api(self):
        model = FakeModel(ServiceUnavailable("down"))
        first, clock = self.run_call(model)
        self.assertEqual(first.kind, TRANSIENT)
        calls_after_first = len(model.calls)
        second, _ = self.run_call(model, clock=clock)
        self.assertIsInstance(second, GeminiError)
        self.assertEqual(second.kind, TRANSIENT)
        self.assertEqual(len(model.calls), calls_after_first)  # no new API call
        clock.now += 31  # cooldown elapsed
        working = FakeModel("back")
        result, _ = self.run_call(working, clock=clock)
        self.assertEqual(result, "back")

    def test_server_delay_above_limit_is_not_waited_for(self):
        model = FakeModel(ResourceExhausted(RATE_LIMIT_MSG.format(secs="60")))
        result, clock = self.run_call(model)
        self.assertEqual(result.kind, RATE_LIMITED)
        self.assertEqual(len(model.calls), 1)
        self.assertEqual(clock.sleeps, [])

    def test_daily_quota_exhaustion_is_not_retried(self):
        model = FakeModel(ResourceExhausted(DAILY_QUOTA_MSG))
        result, clock = self.run_call(model)
        self.assertEqual(result.kind, QUOTA_EXHAUSTED)
        self.assertEqual((len(model.calls), clock.sleeps), (1, []))

    def test_auth_failures_are_not_retried_and_pause_further_calls(self):
        for exc in (PermissionDenied("denied"), InvalidArgument("API key not valid. Please pass a valid API key.")):
            gemini_client.reset_state()
            model = FakeModel(exc)
            result, clock = self.run_call(model)
            self.assertEqual(result.kind, AUTH)
            self.assertEqual((len(model.calls), clock.sleeps), (1, []))
            again, _ = self.run_call(model, clock=clock)
            self.assertEqual(again.kind, AUTH)
            self.assertEqual(len(model.calls), 1)

    def test_unknown_model_and_bad_request_and_unknown_errors_are_not_retried(self):
        for exc, kind in ((NotFound("no such model"), MODEL_NOT_FOUND), (InvalidArgument("bad"), INVALID_REQUEST), (RuntimeError("?"), UNKNOWN)):
            gemini_client.reset_state()
            model = FakeModel(exc)
            result, clock = self.run_call(model)
            self.assertEqual(result.kind, kind)
            self.assertEqual((len(model.calls), clock.sleeps), (1, []))

    def test_malformed_responses_raise_invalid_response_without_retrying(self):
        for outcome in ("", "   ", Response(ValueError("response blocked: no candidates")), None):
            gemini_client.reset_state()
            model = FakeModel(outcome)
            result, clock = self.run_call(model)
            self.assertIsInstance(result, GeminiError)
            self.assertEqual(result.kind, INVALID_RESPONSE, outcome)
            self.assertEqual((len(model.calls), clock.sleeps), (1, []))

    def test_total_budget_stops_retries_early(self):
        settings = GeminiSettings(max_retries=10, base_delay=2.0, max_delay=15.0, timeout=1.0, total_budget=5.0)
        model = FakeModel(ServiceUnavailable("x"))
        result, clock = self.run_call(model, settings)
        self.assertEqual(result.kind, TRANSIENT)
        self.assertEqual(clock.sleeps, [2.0])  # next wait (4s) would exceed the 5s budget
        self.assertEqual(len(model.calls), 2)


# --- LanguageAgent / research summaries ------------------------------------

def make_language(model, settings=NO_WAIT):
    class Agent(LanguageAgent):
        def __init__(self):  # skip real SDK initialisation
            self.use_gemini = True
            self.gemini_model = model
            self.settings = settings
            self.model_name = settings.model
            self.unavailable_reason = None

    return Agent()


def summaries_json():
    return '{"fundamental_summary": "F from llm", "technical_summary": "T from llm", "sentiment": "Bullish"}'


def research_args():
    return ("FIX", "Fixture Co", [], {"latest_close": 100.0, "rsi_14": 55.0}, {"sector": "S"}, [])


class LanguageAgentTests(GeminiTestCase):
    def test_success_uses_llm_and_records_model(self):
        agent = make_language(FakeModel(summaries_json()))
        out = agent.generate_research_summaries(*research_args(), currency="USD")
        self.assertEqual(out["fundamental_summary"], "F from llm")
        self.assertEqual(out["sentiment"], "Bullish")
        self.assertEqual(out["generation"], {"source": "llm", "model": "test-model", "reason": None})

    def test_json_inside_markdown_fence_is_accepted(self):
        agent = make_language(FakeModel("```json\n" + summaries_json() + "\n```"))
        self.assertEqual(agent.generate_research_summaries(*research_args())["generation"]["source"], "llm")

    def test_rate_limit_exhaustion_falls_back_without_raising(self):
        model = FakeModel(ResourceExhausted(RATE_LIMIT_MSG.format(secs="0")))
        out = make_language(model).generate_research_summaries(*research_args())
        self.assertEqual(out["generation"], {"source": "fallback", "model": None, "reason": RATE_LIMITED})
        self.assertIn("Rule-Based Analysis", out["technical_summary"])
        self.assertIn(out["sentiment"], ("Bullish", "Bearish", "Neutral"))
        self.assertEqual(len(model.calls), NO_WAIT.max_retries + 1)

    def test_malformed_output_falls_back_with_reason(self):
        for text in ("this is not json", '["a", "list"]', "{}"):
            gemini_client.reset_state()
            out = make_language(FakeModel(text)).generate_research_summaries(*research_args())
            self.assertEqual(out["generation"]["reason"], INVALID_RESPONSE, text)
            self.assertIn("Rule-Based Analysis", out["technical_summary"])

    def test_auth_and_unexpected_errors_fall_back(self):
        for exc, reason in ((PermissionDenied("no"), AUTH), (RuntimeError("weird"), UNKNOWN)):
            gemini_client.reset_state()
            out = make_language(FakeModel(exc)).generate_research_summaries(*research_args())
            self.assertEqual(out["generation"], {"source": "fallback", "model": None, "reason": reason})

    def test_unconfigured_agent_reports_why(self):
        with mock.patch.dict(os.environ, {}):
            os.environ.pop("GEMINI_API_KEY", None)
            agent = LanguageAgent()
        self.assertFalse(agent.use_gemini)
        out = agent.generate_research_summaries(*research_args())
        self.assertEqual(out["generation"], {"source": "fallback", "model": None, "reason": "no_api_key"})

    def test_cooldown_is_shared_between_agent_instances(self):
        first = FakeModel(ResourceExhausted(DAILY_QUOTA_MSG))
        make_language(first).generate_research_summaries(*research_args())
        second_model = FakeModel(summaries_json())
        out = make_language(second_model).generate_research_summaries(*research_args())
        self.assertEqual(second_model.calls, [])  # not called while the quota cooldown is open
        self.assertEqual(out["generation"]["reason"], QUOTA_EXHAUSTED)

    def test_call_llm_returns_none_and_records_status_on_failure(self):
        agent = make_language(FakeModel(ServiceUnavailable("down")))
        self.assertIsNone(agent.call_llm("p"))
        self.assertEqual(agent.llm_status(), TRANSIENT)
        gemini_client.reset_state()
        ok = make_language(FakeModel("text"))
        self.assertEqual(ok.call_llm("p"), "text")
        self.assertEqual(ok.llm_status(), "ok")


# --- Strategy / Risk / Decision --------------------------------------------

def make_report(**kw) -> ResearchReport:
    base = dict(company="Fixture Co", ticker="FIX", current_price=1000.0, market_cap=16.1e12, pe_ratio=22.0,
                eps=45.5, sector="Energy", high_52_week=1300.0, low_52_week=900.0,
                moving_averages={"20d": 980.0, "50d": 950.0}, rsi=55.0, latest_news=[{"title": "record profit"}],
                fundamental_summary="s", currency="INR")
    base.update(kw)
    return ResearchReport(**base)


STRATEGY_JSON = ('{"bull_thesis": "b", "bear_thesis": "r", "suggested_strategy": "Hold", "entry_zone": "e", '
                 '"exit_zone": "x", "target": "t", "time_horizon": "6m", "confidence": 0.5, "reasoning": "why", "catalysts": []}')
RISK_JSON = ('{"volatility": "Low", "liquidity": "High", "valuation": "Fair", "financial_risk": "Low", "news_risk": "Low", '
             '"macro_risk": "Low", "overall_risk": "Low", "overall_risk_rating": "Low Risk", "risk_score": 20, '
             '"weaknesses": [], "recommendations": [], "reasons": ["stable"]}')
DECISION_JSON = ('{"recommendation": "HOLD", "confidence": 0.5, "reasoning": "r", "overall_summary": "s", '
                 '"supporting_evidence": [], "next_steps": [], "investment_horizon": "6m"}')


class AgentGenerationTests(GeminiTestCase):
    def run_all(self, model):
        language = make_language(model)
        state = WorkflowState(research_report=make_report())
        state.strategy_report = StrategyAgent(language).strategy(workflow_state=state)
        state.risk_report = RiskAgent(language).assess_risk(workflow_state=state)
        state.decision_report = DecisionAgent(language).decide(workflow_state=state)
        return state

    def test_llm_success_is_marked_as_llm(self):
        model = FakeModel(STRATEGY_JSON, RISK_JSON, DECISION_JSON)
        state = self.run_all(model)
        for report in (state.strategy_report, state.risk_report, state.decision_report):
            self.assertEqual(report.generation.source, "llm")
            self.assertEqual(report.generation.model, "test-model")
            self.assertIsNone(report.generation.reason)
        self.assertEqual(state.strategy_report.entry_zone, "e")  # the LLM's content was used
        self.assertEqual(state.decision_report.recommendation, "HOLD")

    def test_gemini_down_still_completes_with_deterministic_reports(self):
        model = FakeModel(ResourceExhausted(RATE_LIMIT_MSG.format(secs="0")))
        state = self.run_all(model)
        for report in (state.strategy_report, state.risk_report, state.decision_report):
            self.assertEqual(report.generation.source, "fallback")
            self.assertEqual(report.generation.reason, RATE_LIMITED)
        self.assertEqual(state.strategy_report.entry_zone, "₹980.00 - ₹1,010.00")
        self.assertIn(state.decision_report.recommendation, ("BUY", "HOLD", "SELL"))
        self.assertIn("Rule-Based Analysis", state.decision_report.reasoning)
        # the cooldown means only the first agent actually reached the API (3 attempts), the rest failed fast
        self.assertEqual(len(model.calls), NO_WAIT.max_retries + 1)

    def test_malformed_json_falls_back_with_reason(self):
        state = self.run_all(FakeModel("not json at all"))
        for report in (state.strategy_report, state.risk_report, state.decision_report):
            self.assertEqual(report.generation.source, "fallback")
            self.assertEqual(report.generation.reason, INVALID_RESPONSE)

    def test_schema_invalid_json_falls_back_with_reason(self):
        bad_strategy = STRATEGY_JSON.replace('"confidence": 0.5', '"confidence": 7')  # outside 0..1
        state = WorkflowState(research_report=make_report())
        report = StrategyAgent(make_language(FakeModel(bad_strategy))).strategy(workflow_state=state)
        self.assertEqual(report.generation.source, "fallback")
        self.assertEqual(report.generation.reason, INVALID_RESPONSE)
        self.assertTrue(report.entry_zone.startswith("₹"))

    def test_unavailable_llm_reports_configuration_reason(self):
        class Off(LanguageAgent):
            def __init__(self):
                self.use_gemini = False
                self.gemini_model = None
                self.unavailable_reason = "no_api_key"

        report = RiskAgent(Off()).assess_risk(research_report=make_report())
        self.assertEqual(report.generation.model_dump(), {"source": "fallback", "model": None, "reason": "no_api_key"})

    def test_generation_is_serialised_additively(self):
        state = self.run_all(FakeModel(STRATEGY_JSON, RISK_JSON, DECISION_JSON))
        payload = state.decision_report.model_dump(mode="json")
        self.assertEqual(payload["generation"], {"source": "llm", "model": "test-model", "reason": None})
        for field in ("recommendation", "confidence", "reasoning", "overall_summary", "supporting_evidence",
                      "next_steps", "investment_horizon", "currency"):
            self.assertIn(field, payload)  # existing fields are all still there


# --- research report end to end ---------------------------------------------

class ResearchReportTests(GeminiTestCase):
    def research(self, language):
        api = mock.Mock()
        frame = pd.DataFrame({"Close": [100.0 + i for i in range(60)]})
        frame.attrs["currency"] = "USD"
        api.get_market_data.return_value = {"TEST": frame}
        api.get_earnings.return_value = None
        agent = ResearchAgent(api_agent=api, scraping_agent=mock.Mock(), retriever_agent=mock.Mock(),
                              language_agent=language, nse_service=None)
        agent._get_nse_service = lambda: None
        agent._fetch_news = lambda symbol: []
        agent._fetch_fundamentals = lambda symbol: Fundamentals(long_name="Test Co", currency="USD")
        return agent.research("TEST")

    def test_report_marks_llm_summaries(self):
        report = self.research(make_language(FakeModel(summaries_json())))
        self.assertEqual(report.generation.source, "llm")
        self.assertEqual(report.fundamental_summary, "F from llm")

    def test_research_completes_when_gemini_is_unavailable(self):
        model = FakeModel(ResourceExhausted(DAILY_QUOTA_MSG))
        report = self.research(make_language(model))
        self.assertEqual(report.generation.source, "fallback")
        self.assertEqual(report.generation.reason, QUOTA_EXHAUSTED)
        self.assertIn("Rule-Based Analysis", report.technical_summary)
        self.assertIsNotNone(report.current_price)
        self.assertEqual(report.model_dump(mode="json")["generation"]["reason"], QUOTA_EXHAUSTED)


# --- query parsing ------------------------------------------------------------

def make_parser(model):
    parser = QueryParser.__new__(QueryParser)
    parser.settings = NO_WAIT
    parser.model_name = NO_WAIT.model
    parser.gemini_model = model
    parser.use_gemini = model is not None
    parser.unavailable_reason = None if model is not None else "no_api_key"
    return parser


class QueryParserTests(GeminiTestCase):
    def test_llm_parse_is_marked_as_llm(self):
        parsed = make_parser(FakeModel('{"companies": ["Reliance"], "tickers": [], "intent": "investment_analysis"}')).parse("Analyze Reliance")
        self.assertEqual(parsed.companies, ["Reliance"])
        self.assertEqual(parsed.generation.source, "llm")

    def test_rate_limited_parse_uses_rule_based_parser(self):
        parsed = make_parser(FakeModel(ResourceExhausted(RATE_LIMIT_MSG.format(secs="0")))).parse("Analyze Reliance for 6 months")
        self.assertTrue(parsed.companies or parsed.tickers)
        self.assertEqual(parsed.generation.model_dump(), {"source": "fallback", "model": None, "reason": RATE_LIMITED})

    def test_malformed_parse_uses_rule_based_parser(self):
        parsed = make_parser(FakeModel("I cannot help with that")).parse("Analyze TCS")
        self.assertTrue(parsed.companies or parsed.tickers)
        self.assertEqual(parsed.generation.reason, INVALID_RESPONSE)

    def test_no_llm_configured(self):
        parsed = make_parser(None).parse("Analyze TCS")
        self.assertEqual(parsed.generation.model_dump(), {"source": "fallback", "model": None, "reason": "no_api_key"})


if __name__ == "__main__":
    unittest.main()
