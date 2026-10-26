"""Central Gemini access: model configuration, bounded retries, error classification, fallback metadata.

Every Gemini call in the project goes through `create_model` / `generate_text`, so model choice,
timeouts and retry policy live in one place.

SDK note: this uses `google-generativeai`, which PyPI marks as deprecated in favour of `google-genai`.
The SDK is touched in exactly two places (`create_model` and the `model.generate_content(...)` call in
`generate_text`), which is also the whole surface a future migration would need to change.

Configuration (environment variables, all optional; invalid values fall back to the default with a warning):
    GEMINI_API_KEY                  API key; without it the deterministic fallback is used.
    GEMINI_MODEL                    Model name. Default: gemini-3.8-flash (the model the project already used).
    GEMINI_MAX_RETRIES              Retries after the first attempt for 429 / transient errors.
                                    Integer 0-5 (higher values are clamped to 5). Default 2.
    GEMINI_RETRY_BASE_SECONDS       First backoff delay (doubles each retry). 0-60. Default 1.0.
    GEMINI_RETRY_MAX_SECONDS        Longest single wait we accept, including a server-provided retry delay.
                                    If the server asks for longer, we do not wait. 0-120. Default 15.
                                    The base delay is reduced to this value if it is larger.
    GEMINI_REQUEST_TIMEOUT_SECONDS  Timeout of one API request. > 0 and <= 120. Default 20 (the SDK default is 600).
    GEMINI_TOTAL_BUDGET_SECONDS     Hard wall-clock budget for one call including retries. > 0 and <= 600. Default 45.
    Numbers must be finite (inf / nan are rejected); values above a maximum are clamped, other bad values ignored.
"""
from __future__ import annotations

import logging
import math
import os
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Literal, Optional

from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-3.8-flash"

# error kinds (also used as the `reason` of a fallback)
RATE_LIMITED = "rate_limited"
QUOTA_EXHAUSTED = "quota_exhausted"
TRANSIENT = "transient_error"
AUTH = "auth_error"
MODEL_NOT_FOUND = "model_not_found"
INVALID_REQUEST = "invalid_request"
INVALID_RESPONSE = "invalid_response"
UNKNOWN = "unknown_error"
OK = "ok"

_RETRYABLE = {RATE_LIMITED, TRANSIENT}
AUTH_COOLDOWN_SECONDS = 300.0  # a bad key / model does not fix itself in seconds
QUOTA_COOLDOWN_SECONDS = 300.0  # daily quota, or a rate limit without a usable retry delay
EXHAUSTED_COOLDOWN_SECONDS = 30.0  # after retries are used up, stop hammering the API for a while


MAX_RETRIES_LIMIT = 5  # more than this never helps within the time budget and only burns quota
# (minimum, maximum) accepted per setting; the minimum is exclusive for the two that must be strictly positive
_LIMITS = {
    "GEMINI_MAX_RETRIES": (0, MAX_RETRIES_LIMIT),
    "GEMINI_RETRY_BASE_SECONDS": (0.0, 60.0),
    "GEMINI_RETRY_MAX_SECONDS": (0.0, 120.0),
    "GEMINI_REQUEST_TIMEOUT_SECONDS": (0.0, 120.0),
    "GEMINI_TOTAL_BUDGET_SECONDS": (0.0, 600.0),
}
_EXCLUSIVE_MINIMUM = {"GEMINI_REQUEST_TIMEOUT_SECONDS", "GEMINI_TOTAL_BUDGET_SECONDS"}


def _env_setting(name: str, default: float, *, integer: bool = False) -> float:
    """Read one numeric setting strictly.

    Unset/blank -> default. Unparseable, non-finite (inf, nan) or below the minimum -> default, with a warning.
    Above the maximum -> clamped to the maximum, with a warning. A bad value never raises and never silently
    becomes something unbounded.
    """
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    minimum, maximum = _LIMITS[name]
    try:
        value = int(raw) if integer else float(raw)
    except ValueError:
        logger.warning("Ignoring %s=%r: not a valid %s; using %s", name, raw, "integer" if integer else "number", default)
        return default
    if not math.isfinite(value):
        logger.warning("Ignoring %s=%r: must be a finite number; using %s", name, raw, default)
        return default
    too_small = value <= minimum if name in _EXCLUSIVE_MINIMUM else value < minimum
    if too_small:
        bound = f"> {minimum:g}" if name in _EXCLUSIVE_MINIMUM else f">= {minimum:g}"
        logger.warning("Ignoring %s=%r: must be %s; using %s", name, raw, bound, default)
        return default
    if value > maximum:
        logger.warning("%s=%r exceeds the maximum %s; using %s", name, raw, maximum, maximum)
        return maximum
    return value


@dataclass(frozen=True)
class GeminiSettings:
    model: str = DEFAULT_MODEL
    max_retries: int = 2
    base_delay: float = 1.0
    max_delay: float = 15.0
    timeout: float = 20.0
    total_budget: float = 45.0

    @classmethod
    def from_env(cls) -> "GeminiSettings":
        max_delay = float(_env_setting("GEMINI_RETRY_MAX_SECONDS", cls.max_delay))
        base_delay = float(_env_setting("GEMINI_RETRY_BASE_SECONDS", cls.base_delay))
        if base_delay > max_delay:  # the cap on any single wait wins
            logger.warning("GEMINI_RETRY_BASE_SECONDS=%s exceeds GEMINI_RETRY_MAX_SECONDS=%s; using %s", base_delay, max_delay, max_delay)
            base_delay = max_delay
        return cls(
            model=(os.getenv("GEMINI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL,
            max_retries=int(_env_setting("GEMINI_MAX_RETRIES", cls.max_retries, integer=True)),
            base_delay=base_delay,
            max_delay=max_delay,
            timeout=float(_env_setting("GEMINI_REQUEST_TIMEOUT_SECONDS", cls.timeout)),
            total_budget=float(_env_setting("GEMINI_TOTAL_BUDGET_SECONDS", cls.total_budget)),
        )


class GenerationInfo(BaseModel):
    """Whether a report's generated text came from the LLM or the deterministic fallback."""

    model_config = ConfigDict(extra="ignore")

    source: Literal["llm", "fallback"]
    model: Optional[str] = None  # the Gemini model, when source == "llm"
    reason: Optional[str] = None  # why the fallback was used, when source == "fallback"

    @classmethod
    def llm(cls, model: Optional[str]) -> "GenerationInfo":
        return cls(source="llm", model=model)

    @classmethod
    def fallback(cls, reason: Optional[str]) -> "GenerationInfo":
        return cls(source="fallback", reason=reason or "llm_unavailable")


class GeminiError(Exception):
    def __init__(self, kind: str, message: str = "", retry_after: Optional[float] = None):
        super().__init__(message or kind)
        self.kind = kind
        self.retry_after = retry_after


# ---------------------------------------------------------------------------
# Process-wide cool-down: several agents (and several LanguageAgent instances) share one API quota,
# so once the API says "stop" the remaining calls of a request fail fast instead of each waiting.
# ---------------------------------------------------------------------------

class _Cooldown:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._until = 0.0
        self._kind = ""
        self._detail = ""

    def reset(self) -> None:
        with self._lock:
            self._until, self._kind, self._detail = 0.0, "", ""

    def block(self, kind: str, seconds: float, detail: str, now: float) -> None:
        with self._lock:
            self._until, self._kind, self._detail = now + seconds, kind, detail

    def check(self, now: float) -> None:
        with self._lock:
            remaining = self._until - now
            kind, detail = self._kind, self._detail
        if remaining > 0:
            raise GeminiError(kind, f"Gemini calls paused for another {remaining:.0f}s after: {detail}", retry_after=remaining)


_cooldown = _Cooldown()


def reset_state() -> None:
    """Clear the shared cool-down (used by tests and for manual recovery)."""
    _cooldown.reset()


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

_RETRY_IN_RE = re.compile(r"retry in ([\d.]+)\s*s", re.IGNORECASE)
_RETRY_DELAY_RE = re.compile(r"retry_delay\s*\{\s*seconds:\s*(\d+)", re.IGNORECASE)


def _http_status(exc: BaseException) -> Optional[int]:
    for attr in ("code", "status_code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int) and 100 <= value <= 599:
            return value
    return None


def parse_retry_after(exc: BaseException) -> Optional[float]:
    """Server-provided retry delay, from an attribute or the error text; None when absent."""
    direct = getattr(exc, "retry_after", None) or getattr(exc, "retry_delay", None)
    seconds = getattr(direct, "seconds", direct)
    if isinstance(seconds, (int, float)) and seconds > 0:
        return float(seconds)
    text = str(exc)
    match = _RETRY_IN_RE.search(text) or _RETRY_DELAY_RE.search(text)
    return float(match.group(1)) if match else None


def classify_error(exc: BaseException) -> tuple[str, Optional[float]]:
    """Map an SDK / network exception to (kind, server_retry_after_seconds)."""
    name = type(exc).__name__
    text = str(exc)
    lowered = text.lower()
    status = _http_status(exc)
    retry_after = parse_retry_after(exc)

    if "api key not valid" in lowered or "api_key_invalid" in lowered or "api key expired" in lowered:
        return AUTH, None
    if status == 429 or name in ("ResourceExhausted", "TooManyRequests"):
        if "perday" in lowered.replace(" ", "").replace("_", "") or "per day" in lowered:
            return QUOTA_EXHAUSTED, retry_after
        return RATE_LIMITED, retry_after
    if status in (401, 403) or name in ("Unauthenticated", "PermissionDenied", "Forbidden", "Unauthorized"):
        return AUTH, None
    if status == 404 or name == "NotFound":
        return MODEL_NOT_FOUND, None
    if status == 400 or name in ("InvalidArgument", "FailedPrecondition", "BadRequest"):
        return INVALID_REQUEST, None
    if (
        status in (500, 502, 503, 504)
        or name in ("ServiceUnavailable", "InternalServerError", "DeadlineExceeded", "GatewayTimeout", "RetryError", "Aborted")
        or isinstance(exc, (TimeoutError, ConnectionError))
    ):
        return TRANSIENT, retry_after
    return UNKNOWN, None


def _response_text(response: Any) -> str:
    try:
        text = response.text if response is not None else ""
    except ValueError as exc:  # the SDK raises ValueError when the answer was blocked / has no parts
        raise GeminiError(INVALID_RESPONSE, f"response has no usable text: {str(exc)[:120]}") from exc
    text = (text or "").strip()
    if not text:
        raise GeminiError(INVALID_RESPONSE, "empty response")
    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_model(settings: Optional[GeminiSettings] = None) -> tuple[Any, Optional[str]]:
    """Build the SDK model. Returns (model, None) or (None, reason_it_is_unavailable)."""
    settings = settings or GeminiSettings.from_env()
    try:
        import google.generativeai as genai
    except ImportError:
        return None, "sdk_not_installed"
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None, "no_api_key"
    try:
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(settings.model), None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not initialize Gemini model '%s': %s", settings.model, str(exc)[:200])
        return None, "client_init_failed"


def generate_text(
    model: Any,
    prompt: str,
    settings: Optional[GeminiSettings] = None,
    *,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> str:
    """One bounded Gemini call. Returns non-empty text or raises GeminiError (never retries forever).

    429 and transient errors are retried with exponential backoff, honouring a server-provided retry
    delay when it is within `max_delay`; auth, model, request and response problems are not retried.

    `total_budget` is a hard wall-clock limit: a retry is only started if its delay plus a full request
    timeout still fits in the remaining budget, and the first request's timeout is itself capped at the budget.
    """
    settings = settings or GeminiSettings.from_env()
    _cooldown.check(clock())
    started = clock()
    request_timeout = min(settings.timeout, settings.total_budget)
    attempt = 0
    while True:
        attempt += 1
        try:
            # retry=None turns off the SDK's own retry (it would retry for up to 600s); we retry below
            response = model.generate_content(prompt, request_options={"timeout": request_timeout, "retry": None})
            return _response_text(response)
        except GeminiError:
            raise
        except Exception as exc:  # noqa: BLE001 - classified below
            kind, retry_after = classify_error(exc)
            detail = f"{type(exc).__name__}: {str(exc)[:160]}"
            if kind not in _RETRYABLE:
                if kind in (AUTH, MODEL_NOT_FOUND):
                    _cooldown.block(kind, AUTH_COOLDOWN_SECONDS, detail, clock())
                elif kind == QUOTA_EXHAUSTED:
                    _cooldown.block(kind, retry_after or QUOTA_COOLDOWN_SECONDS, detail, clock())
                logger.warning("Gemini call failed (%s): %s", kind, detail)
                raise GeminiError(kind, detail, retry_after) from exc

            if retry_after is not None and retry_after > settings.max_delay:
                _cooldown.block(kind, retry_after, detail, clock())
                logger.warning("Gemini asked to wait %.0fs (> %.0fs limit); not retrying", retry_after, settings.max_delay)
                raise GeminiError(kind, f"server retry delay {retry_after:.0f}s exceeds limit: {detail}", retry_after) from exc

            delay = retry_after if retry_after is not None else min(settings.max_delay, settings.base_delay * 2 ** (attempt - 1))
            over_budget = (clock() - started) + delay + request_timeout > settings.total_budget
            if attempt > settings.max_retries or over_budget:
                why = "retry limit reached" if attempt > settings.max_retries else "the next attempt would exceed the time budget"
                _cooldown.block(kind, retry_after or EXHAUSTED_COOLDOWN_SECONDS, detail, clock())
                logger.warning("Gemini retries stopped after %d attempt(s) (%s; %s): %s", attempt, why, kind, detail)
                raise GeminiError(kind, f"retries stopped after {attempt} attempt(s) ({why}): {detail}", retry_after) from exc

            logger.info("Gemini %s (attempt %d/%d); retrying in %.1fs: %s", kind, attempt, settings.max_retries + 1, delay, detail[:120])
            sleep(delay)


_PLACEHOLDERS = {"n/a", "na", "none", "null", "unknown", "tbd", "nil", "-", "--", "..."}


def meaningful_text(value: Any) -> bool:
    """True for a non-blank string that carries content (not whitespace, punctuation or a placeholder like 'N/A')."""
    if not isinstance(value, str):
        return False
    text = value.strip()
    return bool(text) and text.lower() not in _PLACEHOLDERS and any(ch.isalnum() for ch in text)


def reject_llm_output(language_agent: Any, why: str) -> None:
    """Record that the LLM answered but its content was unusable, so the report falls back with reason invalid_response."""
    logger.warning("Rejecting unusable LLM output: %s", why)
    setter = getattr(language_agent, "set_llm_status", None)
    if callable(setter):
        setter(INVALID_RESPONSE)


def generation_info(language_agent: Any, used_llm: bool) -> GenerationInfo:
    """GenerationInfo for a report, derived from the LanguageAgent that produced (or failed to produce) it."""
    if used_llm:
        return GenerationInfo.llm(getattr(language_agent, "model_name", None))
    if not getattr(language_agent, "use_gemini", False):
        return GenerationInfo.fallback(getattr(language_agent, "unavailable_reason", None))
    status_fn = getattr(language_agent, "llm_status", None)
    status = status_fn() if callable(status_fn) else None
    # status "ok" means the call itself worked but its output was unusable (bad JSON / failed validation)
    return GenerationInfo.fallback(status if status not in (None, OK) else INVALID_RESPONSE)
