"""Regression tests for history-window handling and the 20d/50d MA and 52-week range indicators.

All price data is synthetic and generated here; none of it is (or claims to be) market data.
Run with: python -m unittest testing.test_indicator_history
"""
import sys
import types
import unittest
from datetime import datetime, timedelta
from unittest import mock

import numpy as np
import pandas as pd

from backend.agents.research_agent import (
    MIN_52W_BARS,
    ResearchAgent,
    ResearchReport,
)
from backend.scoring_engine import ScoringEngine
from data_ingestion.api_agent import DEFAULT_HISTORY_LOOKBACK_DAYS, APIAgent


class _NoCalls:
    def __getattr__(self, name):
        raise AssertionError(f"unexpected call to {name}")


def make_agent() -> ResearchAgent:
    return ResearchAgent(
        api_agent=_NoCalls(), scraping_agent=_NoCalls(), retriever_agent=_NoCalls(),
        language_agent=_NoCalls(), nse_service=_NoCalls(),
    )


def business_days(n: int, end: datetime = datetime(2026, 10, 23)) -> list[datetime]:
    days = pd.bdate_range(end=end, periods=n)
    return [d.to_pydatetime() for d in days]


def frame(closes, end=datetime(2026, 10, 23), with_dates=True, highs=None, lows=None) -> pd.DataFrame:
    closes = list(closes)
    data = {"Close": closes, "Volume": [1000] * len(closes)}
    if highs is not None:
        data["High"] = list(highs)
    if lows is not None:
        data["Low"] = list(lows)
    df = pd.DataFrame(data)
    if with_dates:
        df.insert(0, "Date", [d.strftime("%Y-%m-%d") for d in business_days(len(closes), end)])
    return df


class MovingAverageTests(unittest.TestCase):
    def test_sufficient_history_computes_exact_windows(self):
        closes = [float(i) for i in range(1, 301)]  # 1..300
        ind = make_agent()._build_technical_indicators(frame(closes))
        self.assertAlmostEqual(ind.moving_average_20, np.mean(closes[-20:]))  # 290.5
        self.assertAlmostEqual(ind.moving_average_50, np.mean(closes[-50:]))  # 275.5
        self.assertNotEqual(ind.moving_average_20, ind.moving_average_50)
        self.assertEqual(ind.latest_close, 300.0)

    def test_exactly_minimum_bars_is_valid(self):
        ind = make_agent()._build_technical_indicators(frame([float(i) for i in range(50)]))
        self.assertAlmostEqual(ind.moving_average_50, np.mean(range(50)))
        self.assertAlmostEqual(ind.moving_average_20, np.mean(range(30, 50)))

    def test_ma50_unavailable_below_50_bars_but_ma20_valid(self):
        ind = make_agent()._build_technical_indicators(frame([float(i) for i in range(1, 31)]))
        self.assertIsNone(ind.moving_average_50)
        self.assertAlmostEqual(ind.moving_average_20, np.mean(range(11, 31)))

    def test_both_unavailable_below_20_bars(self):
        ind = make_agent()._build_technical_indicators(frame([10.0] * 19))
        self.assertIsNone(ind.moving_average_20)
        self.assertIsNone(ind.moving_average_50)
        self.assertEqual(ind.latest_close, 10.0)

    def test_49_bars_is_not_enough_for_ma50(self):
        ind = make_agent()._build_technical_indicators(frame([5.0] * 49))
        self.assertIsNone(ind.moving_average_50)

    def test_missing_observations_do_not_count_toward_the_window(self):
        closes = [float(i) for i in range(1, 56)]  # 55 rows
        for i in (3, 10, 20, 30, 40):  # 5 NaN closes -> 50 valid
            closes[i] = float("nan")
        valid = [c for c in closes if not np.isnan(c)]
        ind = make_agent()._build_technical_indicators(frame(closes))
        self.assertAlmostEqual(ind.moving_average_50, np.mean(valid[-50:]))

        closes[45] = float("nan")  # 49 valid -> 50d MA must now be unavailable
        ind = make_agent()._build_technical_indicators(frame(closes))
        self.assertIsNone(ind.moving_average_50)
        self.assertIsNotNone(ind.moving_average_20)

    def test_unsorted_rows_and_tz_aware_dates_are_ordered_chronologically(self):
        closes = [float(i) for i in range(1, 61)]
        df = frame(closes)
        df["Date"] = [f"{d} 00:00:00{'-04:00' if i % 2 else '-05:00'}" for i, d in enumerate(df["Date"])]
        shuffled = df.sample(frac=1.0, random_state=7).reset_index(drop=True)
        ind = make_agent()._build_technical_indicators(shuffled)
        self.assertEqual(ind.latest_close, 60.0)
        self.assertAlmostEqual(ind.moving_average_20, np.mean(closes[-20:]))

    def test_no_close_column_yields_no_indicators(self):
        ind = make_agent()._build_technical_indicators(pd.DataFrame({"Volume": [1, 2, 3]}))
        self.assertIsNone(ind.latest_close)
        self.assertIsNone(ind.moving_average_20)
        self.assertIsNone(ind.high_52_week)


class FiftyTwoWeekRangeTests(unittest.TestCase):
    def test_full_year_uses_high_and_low_columns_inside_the_window(self):
        n = 300
        closes = [100.0 + (i % 10) for i in range(n)]
        highs = [c + 1 for c in closes]
        lows = [c - 1 for c in closes]
        end = datetime(2026, 10, 23)
        df = frame(closes, end=end, highs=highs, lows=lows)
        # spike that is older than 365 days must be excluded from the range
        old_idx = max(i for i, d in enumerate(business_days(n, end)) if d < end - timedelta(days=380))
        df.loc[old_idx, "High"] = 9999.0
        df.loc[old_idx, "Low"] = 1.0
        ind = make_agent()._build_technical_indicators(df)
        self.assertEqual(ind.high_52_week, 110.0)  # max close 109 + 1
        self.assertEqual(ind.low_52_week, 99.0)    # min close 100 - 1

    def test_falls_back_to_close_when_no_high_low_columns(self):
        closes = [50.0 + (i % 7) for i in range(280)]
        ind = make_agent()._build_technical_indicators(frame(closes))
        self.assertEqual(ind.high_52_week, 56.0)
        self.assertEqual(ind.low_52_week, 50.0)

    def test_short_history_is_not_labelled_52_week(self):
        for n in (21, 60, 120, MIN_52W_BARS - 1):
            ind = make_agent()._build_technical_indicators(frame([100.0 + i for i in range(n)]))
            self.assertIsNone(ind.high_52_week, n)
            self.assertIsNone(ind.low_52_week, n)

    def test_enough_bars_but_span_too_short_is_unavailable(self):
        # 300 bars squeezed into ~300 calendar days (calendar-daily, not business-daily)
        end = datetime(2026, 10, 23)
        dates = [(end - timedelta(days=299 - i)).strftime("%Y-%m-%d") for i in range(300)]
        df = pd.DataFrame({"Date": dates, "Close": [10.0 + i for i in range(300)]})
        ind = make_agent()._build_technical_indicators(df)
        self.assertIsNone(ind.high_52_week)

    def test_sparse_year_with_too_few_bars_is_unavailable(self):
        end = datetime(2026, 10, 23)
        dates = [(end - timedelta(days=400 - 4 * i)).strftime("%Y-%m-%d") for i in range(100)]
        df = pd.DataFrame({"Date": dates, "Close": [10.0 + i for i in range(100)]})
        ind = make_agent()._build_technical_indicators(df)
        self.assertIsNone(ind.high_52_week)

    def test_missing_closes_reduce_the_valid_count(self):
        closes = [100.0 + (i % 5) for i in range(262)]  # 262 business days span ~366 calendar days
        df = frame(closes)
        self.assertIsNotNone(make_agent()._build_technical_indicators(df).high_52_week)
        for i in range(0, 50, 2):  # drop 25 closes -> 237 valid, below the 240 minimum
            df.loc[i, "Close"] = float("nan")
        self.assertIsNone(make_agent()._build_technical_indicators(df).high_52_week)

    def test_frame_without_dates_uses_bar_count(self):
        closes = [20.0 + (i % 4) for i in range(260)]
        ind = make_agent()._build_technical_indicators(frame(closes, with_dates=False))
        self.assertEqual((ind.low_52_week, ind.high_52_week), (20.0, 23.0))
        ind = make_agent()._build_technical_indicators(frame(closes[:100], with_dates=False))
        self.assertIsNone(ind.high_52_week)


class WarningTests(unittest.TestCase):
    def test_warnings_state_what_is_missing_and_how_much_history_exists(self):
        agent = make_agent()
        df = frame([float(i) for i in range(1, 31)])
        ind = agent._build_technical_indicators(df)
        warnings = agent._indicator_warnings(df, ind, [])
        self.assertTrue(any("50-day moving average unavailable: only 30" in w for w in warnings))
        self.assertTrue(any("52-week range unavailable" in w for w in warnings))
        self.assertFalse(any("20-day" in w for w in warnings))

    def test_no_warnings_with_full_history(self):
        agent = make_agent()
        df = frame([100.0 + (i % 9) for i in range(300)])
        ind = agent._build_technical_indicators(df)
        self.assertEqual(agent._indicator_warnings(df, ind, []), [])

    def test_existing_52_week_warning_is_not_duplicated(self):
        agent = make_agent()
        df = frame([float(i) for i in range(1, 61)])
        ind = agent._build_technical_indicators(df)
        warnings = agent._indicator_warnings(df, ind, ["52-week range unavailable (NSE live quote missing)"])
        self.assertFalse(any("52-week" in w for w in warnings))


class ResearchPipelineTests(unittest.TestCase):
    def _research(self, df: pd.DataFrame) -> ResearchReport:
        api = mock.Mock()
        api.get_market_data.return_value = {"TEST": df}
        api.get_earnings.return_value = None
        scraping = mock.Mock()
        scraping.get_news.return_value = []
        language = mock.Mock()
        language.generate_research_summaries.return_value = {
            "fundamental_summary": "", "technical_summary": "", "sentiment": "Neutral",
        }
        agent = ResearchAgent(
            api_agent=api, scraping_agent=scraping, retriever_agent=mock.Mock(),
            language_agent=language, nse_service=None,
        )
        agent._get_nse_service = lambda: None
        agent._fetch_fundamentals = lambda symbol: types.SimpleNamespace(
            long_name="Test Co", sector=None, industry=None, market_cap=None, pe_ratio=None,
            model_dump=lambda: {},
        )
        agent._fetch_news = lambda symbol: []
        return agent.research("TEST")

    def test_short_history_report_marks_indicators_unavailable(self):
        report = self._research(frame([100.0 + i for i in range(30)]))
        self.assertIsNone(report.moving_averages["50d"])
        self.assertIsNotNone(report.moving_averages["20d"])
        self.assertIsNone(report.high_52_week)
        self.assertIsNone(report.low_52_week)
        self.assertTrue(any("50-day moving average unavailable" in w for w in report.market_data_warnings))

    def test_full_history_report_has_all_indicators_and_no_indicator_warnings(self):
        report = self._research(frame([100.0 + (i % 11) for i in range(300)]))
        self.assertIsNotNone(report.moving_averages["50d"])
        self.assertIsNotNone(report.high_52_week)
        self.assertFalse(any("unavailable" in w for w in report.market_data_warnings))


class DownstreamTests(unittest.TestCase):
    def report(self, **kw):
        base = dict(company="X", ticker="X", current_price=110.0, market_cap=5e10, pe_ratio=20.0,
                    rsi=50.0, sector="S", fundamental_summary="s", latest_news=[{"title": "t"}])
        base.update(kw)
        return ResearchReport(**base)

    def test_no_trend_claim_when_moving_averages_unavailable(self):
        report = self.report(moving_averages={"20d": None, "50d": None})
        reasons = ScoringEngine().compute_scores(report).technical_reasons
        text = " ".join(reasons)
        self.assertNotIn("positive trend", text)
        self.assertNotIn("negative trend", text)
        self.assertNotIn("Bullish trend", text)
        self.assertIn("50d moving average unavailable", text)

    def test_trend_claim_still_made_with_valid_averages(self):
        report = self.report(moving_averages={"20d": 105.0, "50d": 100.0})
        reasons = " ".join(ScoringEngine().compute_scores(report).technical_reasons)
        self.assertIn("Bullish trend", reasons)

    def test_completeness_ignores_all_none_moving_averages(self):
        engine = ScoringEngine()
        none_ma = engine.compute_scores(self.report(moving_averages={"20d": None, "50d": None})).data_completeness
        with_ma = engine.compute_scores(self.report(moving_averages={"20d": 1.0, "50d": 1.0})).data_completeness
        self.assertLess(none_ma, with_ma)


class FetchWindowTests(unittest.TestCase):
    def test_default_lookback_covers_a_full_year_of_sessions(self):
        self.assertGreaterEqual(DEFAULT_HISTORY_LOOKBACK_DAYS, 365)
        captured = {}

        class FakeTicker:
            def __init__(self, symbol):
                pass

            def history(self, start=None, end=None):
                captured["start"], captured["end"] = start, end
                idx = pd.bdate_range(start=start, end=end, name="Date")
                return pd.DataFrame({"Close": range(len(idx))}, index=idx)

        fake_yf = types.SimpleNamespace(Ticker=FakeTicker)
        with mock.patch.dict(sys.modules, {"yfinance": fake_yf}):
            data = APIAgent().get_market_data(["TEST"])
        span = (datetime.strptime(captured["end"], "%Y-%m-%d") - datetime.strptime(captured["start"], "%Y-%m-%d")).days
        self.assertEqual(span, DEFAULT_HISTORY_LOOKBACK_DAYS)
        self.assertGreaterEqual(len(data["TEST"]), MIN_52W_BARS)

    def test_explicit_dates_are_respected(self):
        captured = {}

        class FakeTicker:
            def __init__(self, symbol):
                pass

            def history(self, start=None, end=None):
                captured.update(start=start, end=end)
                return pd.DataFrame()

        with mock.patch.dict(sys.modules, {"yfinance": types.SimpleNamespace(Ticker=FakeTicker)}):
            APIAgent().get_market_data(["TEST"], start_date="2026-01-01", end_date="2026-02-01")
        self.assertEqual((captured["start"], captured["end"]), ("2026-01-01", "2026-02-01"))


if __name__ == "__main__":
    unittest.main()
