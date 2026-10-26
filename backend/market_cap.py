"""Market-cap size tiers.

The tier floors are stated in US dollars and apply ONLY to amounts verified to be in USD. They are the
thresholds this project already used everywhere (scoring engine, risk agent, language agent, frontend):
mega >= 200B, large >= 10B, mid >= 2B, otherwise small.

No other currency has a threshold here, deliberately: converting at an assumed FX rate would be
invented, and the Indian categorisation (SEBI/AMFI) is rank-based (top 100 companies = large cap,
101-250 = mid cap, the rest = small cap), not a fixed rupee amount, so it cannot be applied from a
single market-cap number. For INR, other currencies and an unverified currency the result is None
("unclassified") and callers must say so instead of picking a category.
"""
from __future__ import annotations

from typing import Optional

from backend.currency import normalize_currency

# (tier key, minimum market cap in USD), checked in order; anything below the last floor is "small"
USD_TIER_FLOORS: tuple[tuple[str, float], ...] = (("mega", 200e9), ("large", 10e9), ("mid", 2e9))


def classify_market_cap(market_cap: Optional[float], currency: Optional[str]) -> Optional[str]:
    """'mega' | 'large' | 'mid' | 'small', or None when unclassified (no value, or no verified
    thresholds for this currency)."""
    if market_cap is None:
        return None
    code = normalize_currency(currency)
    if code is None or code.upper() != "USD":
        return None
    for tier, floor in USD_TIER_FLOORS:
        if market_cap >= floor:
            return tier
    return "small"


def unclassified_reason(currency: Optional[str]) -> str:
    """Why `classify_market_cap` returned None for a market cap that does have a value."""
    code = normalize_currency(currency)
    if code is None:
        return "currency could not be verified"
    return f"no verified size thresholds for {code}"


def tier_prompt_note(market_cap: Optional[float], currency: Optional[str]) -> str:
    """One sentence for LLM prompts, only when a market cap exists but has no verified tier.
    Empty string when the tier is classified or there is no market cap to classify."""
    if market_cap is None or classify_market_cap(market_cap, currency) is not None:
        return ""
    return (
        f"The market-cap size tier is unclassified ({unclassified_reason(currency)}); "
        "do not describe the company as mega-cap, large-cap, mid-cap or small-cap, "
        "and do not infer a size category from the market capitalization.\n"
    )
