"""Deterministic portfolio stress testing for the financial decision prototype.

This module applies explicit hypothetical price shocks to a user-supplied portfolio.
It is a scenario calculator, not a market forecast or investment recommendation.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


class Holding(BaseModel):
    symbol: str = Field(min_length=1, max_length=24)
    
    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        symbol = value.strip().upper()
        if not symbol:
            raise ValueError("Symbol must contain a non-whitespace character")
        return symbol
    quantity: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    current_price: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    shock_percent: float = Field(default=-10.0, ge=-100.0, le=100.0, allow_inf_nan=False)


class PortfolioSimulationRequest(BaseModel):
    holdings: list[Holding] = Field(min_length=1, max_length=100)
    scenario_name: str = Field(default="Custom stress scenario", min_length=1, max_length=80)
    
    @field_validator("scenario_name")
    @classmethod
    def normalize_scenario_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Scenario name must contain a non-whitespace character")
        return name
    cash: float = Field(default=0.0, ge=0, le=1_000_000_000_000, allow_inf_nan=False)

    @model_validator(mode="after")
    def cap_portfolio_value(self):
        gross_value = sum(item.quantity * item.current_price for item in self.holdings)
        if gross_value + self.cash > 1_000_000_000_000:
            raise ValueError("Portfolio value exceeds supported simulation limit")
        return self


class HoldingSimulation(BaseModel):
    symbol: str
    current_value: float
    shock_percent: float
    estimated_loss: float
    post_shock_value: float
    portfolio_weight_percent: float


class PortfolioSimulationResponse(BaseModel):
    scenario_name: str
    methodology: str
    current_portfolio_value: float
    estimated_portfolio_loss: float
    estimated_loss_percent: float
    post_shock_portfolio_value: float
    holdings: list[HoldingSimulation]
    assumptions: list[str]


def simulate_portfolio(request: PortfolioSimulationRequest) -> PortfolioSimulationResponse:
    """Calculate portfolio outcome under independent user-specified shocks."""
    positions = []
    for holding in request.holdings:
        value = holding.quantity * holding.current_price
        shocked_value = value * (1.0 + holding.shock_percent / 100.0)
        positions.append({
            "symbol": holding.symbol.strip().upper(),
            "current_value": value,
            "shock_percent": holding.shock_percent,
            "estimated_loss": value - shocked_value,
            "post_shock_value": shocked_value,
        })

    invested_value = sum(position["current_value"] for position in positions)
    current_total = invested_value + request.cash
    loss = sum(position["estimated_loss"] for position in positions)
    post_shock_total = current_total - loss

    rows = [
        HoldingSimulation(
            **position,
            portfolio_weight_percent=(position["current_value"] / current_total * 100.0 if current_total else 0.0),
        )
        for position in positions
    ]
    return PortfolioSimulationResponse(
        scenario_name=request.scenario_name.strip(),
        methodology="Deterministic scenario analysis: each holding's market value is multiplied by (1 + shock_percent / 100).",
        current_portfolio_value=round(current_total, 2),
        estimated_portfolio_loss=round(loss, 2),
        estimated_loss_percent=round(loss / current_total * 100.0, 2) if current_total else 0.0,
        post_shock_portfolio_value=round(post_shock_total, 2),
        holdings=rows,
        assumptions=[
            "Shock percentages are hypothetical user inputs, not predictions.",
            "Cash is unchanged by the scenario.",
            "Taxes, fees, liquidity, correlations, rebalancing, dividends and market impact are excluded.",
            "A negative estimated loss means the scenario produces a gain.",
        ],
    )
