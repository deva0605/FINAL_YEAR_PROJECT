"""Currency resolution and display formatting.

Raw numbers stay raw everywhere (reports carry plain floats plus an ISO `currency` code);
only the text built for humans goes through the formatters here.

An unknown currency is represented explicitly: `currency` is None and formatted amounts carry the
generic currency sign "¤" instead of a guessed "$" or "₹".
"""
from __future__ import annotations

from typing import Iterable, Optional

UNKNOWN_SYMBOL = "¤"  # ISO/Unicode generic currency sign: "some currency, not identified"
NSE_SOURCE_LABEL = "NSE India MCP"

_SYMBOLS = {"INR": "₹", "USD": "$"}


def normalize_currency(code: object) -> Optional[str]:
    """Return a reported currency code, or None when it is missing or not a 3-letter code.
    Codes are kept as reported (so Yahoo's pence code 'GBp' is not folded into 'GBP')."""
    if not isinstance(code, str):
        return None
    code = code.strip()
    if len(code) != 3 or not code.isalpha():
        return None
    return code.upper() if code.upper() in _SYMBOLS else code


def _prefix(currency: Optional[str]) -> str:
    code = normalize_currency(currency)
    if code is None:
        return UNKNOWN_SYMBOL
    return _SYMBOLS.get(code, f"{code} ")


def format_money(value: Optional[float], currency: Optional[str], decimals: int = 2) -> str:
    """'₹1,190.00', '$347.73', 'EUR 12.50' or '¤1,190.00' (unknown currency)."""
    if value is None:
        return "N/A"
    sign = "-" if value < 0 else ""
    return f"{sign}{_prefix(currency)}{abs(value):,.{decimals}f}"


def format_large_amount(value: Optional[float], currency: Optional[str]) -> str:
    """Scaled amounts for market cap, revenue and earnings: '₹16.1 trillion', '$3.5 billion'."""
    if value is None:
        return "N/A"
    sign = "-" if value < 0 else ""
    magnitude = abs(value)
    for threshold, word in ((1e12, "trillion"), (1e9, "billion"), (1e6, "million")):
        if magnitude >= threshold:
            return f"{sign}{_prefix(currency)}{magnitude / threshold:.1f} {word}"
    return format_money(value, currency)


def resolve_currency(candidates: Iterable[tuple[str, object]]) -> tuple[Optional[str], Optional[str], list[str]]:
    """Pick the instrument currency from `(source, reported_code)` candidates.

    Returns (currency, source, warnings). The currency is only set when at least one source reports a
    valid code and every reporting source agrees; disagreement or silence yields None plus a warning.
    """
    reported: list[tuple[str, str]] = []
    for source, code in candidates:
        normalized = normalize_currency(code)
        if normalized is not None:
            reported.append((source, normalized))
    if not reported:
        return None, None, [
            f"Currency could not be verified from any data source; amounts are shown with '{UNKNOWN_SYMBOL}' instead of a currency symbol"
        ]
    codes = {code.upper() for _, code in reported}
    if len(codes) > 1:
        detail = ", ".join(f"{source}: {code}" for source, code in reported)
        return None, None, [
            f"Data sources disagree on the instrument currency ({detail}); amounts are shown with '{UNKNOWN_SYMBOL}'"
        ]
    return reported[0][1], reported[0][0], []


def currency_prompt_note(currency: Optional[str]) -> str:
    """One sentence for LLM prompts so generated text uses the verified currency."""
    code = normalize_currency(currency)
    if code is None:
        return "The currency of the monetary values is unknown; do not assume one and do not use a currency symbol.\n"
    return f"All monetary values are in {code}; use that currency when writing amounts.\n"
