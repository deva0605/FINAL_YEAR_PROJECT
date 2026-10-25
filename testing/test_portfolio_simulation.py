import unittest

from pydantic import ValidationError

from backend.portfolio_simulation import (
    Holding,
    PortfolioSimulationRequest,
    simulate_portfolio,
)


class PortfolioSimulationTests(unittest.TestCase):
    def test_stress_scenario_calculates_weighted_portfolio_impact(self):
        request = PortfolioSimulationRequest(
            scenario_name="Test market stress",
            cash=100,
            holdings=[
                Holding(symbol="aapl", quantity=10, current_price=100, shock_percent=-10),
                Holding(symbol="MSFT", quantity=5, current_price=200, shock_percent=-20),
            ],
        )

        result = simulate_portfolio(request)

        self.assertEqual(result.current_portfolio_value, 2100.0)
        self.assertEqual(result.estimated_portfolio_loss, 300.0)
        self.assertEqual(result.post_shock_portfolio_value, 1800.0)
        self.assertEqual(result.holdings[0].symbol, "AAPL")
        self.assertAlmostEqual(result.estimated_loss_percent, 14.29, places=2)
        self.assertAlmostEqual(sum(item.portfolio_weight_percent for item in result.holdings), 95.24, places=2)

    def test_positive_shock_is_reported_as_gain(self):
        request = PortfolioSimulationRequest(
            holdings=[Holding(symbol="DEMO", quantity=2, current_price=50, shock_percent=10)]
        )

        result = simulate_portfolio(request)

        self.assertEqual(result.estimated_portfolio_loss, -10.0)
        self.assertEqual(result.post_shock_portfolio_value, 110.0)
        self.assertEqual(result.estimated_loss_percent, -10.0)

    def test_rejects_zero_or_negative_quantity(self):
        with self.assertRaises(ValidationError):
            Holding(symbol="AAPL", quantity=0, current_price=100, shock_percent=-10)

    def test_rejects_shock_outside_supported_range(self):
        with self.assertRaises(ValidationError):
            Holding(symbol="AAPL", quantity=1, current_price=100, shock_percent=-101)


if __name__ == "__main__":
    unittest.main()
