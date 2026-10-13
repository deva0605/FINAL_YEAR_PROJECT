"""Low-level client for NSE India's remote MCP servers.

Verified against the live servers (see docs/nse_mcp_integration.md):
  * CM Market Live  -> https://mcp.nseindia.in/cmmkt/mcp
  * NSE Bhavcopy    -> https://mcp.nseindia.in/bhavcopy/cm/mcp

Observed server behaviour this client is built around:
  * Both are stateless Streamable-HTTP servers; they reject session DELETE (501),
    so sessions are opened per call and never explicitly terminated.
  * Connections / list_tools / call_tool intermittently hang, so every attempt has a
    hard timeout and is retried.
  * Tool-level failures are returned as a *successful* MCP result whose JSON body is
    {"error": "..."} (isError is false), so the body is inspected.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Any, Optional

import anyio
import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

logger = logging.getLogger(__name__)

CM_MARKET_ENDPOINT = "cm_market"
BHAVCOPY_ENDPOINT = "bhavcopy"

DEFAULT_ENDPOINT_URLS = {
    CM_MARKET_ENDPOINT: "https://mcp.nseindia.in/cmmkt/mcp",
    BHAVCOPY_ENDPOINT: "https://mcp.nseindia.in/bhavcopy/cm/mcp",
}


class NSEMCPError(Exception):
    """Base class for NSE MCP failures."""


class NSEMCPDisabledError(NSEMCPError):
    """NSE MCP integration is switched off (NSE_MCP_ENABLED=false)."""


class NSEMCPConnectionError(NSEMCPError):
    """The server could not be reached or the protocol exchange failed."""


class NSEMCPTimeoutError(NSEMCPConnectionError):
    """The server did not answer within the allotted time."""


class NSEMCPToolError(NSEMCPError):
    """The tool ran but reported an error (bad symbol, bad argument, ...)."""

    def __init__(self, message: str, tool: str, hint: Optional[str] = None) -> None:
        super().__init__(message)
        self.tool = tool
        self.hint = hint


MIN_ATTEMPT_SECONDS = 0.5  # don't start an attempt with less than this left in the budget


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def nse_mcp_enabled() -> bool:
    return os.getenv("NSE_MCP_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


class _LoopThread:
    """A private event loop on a daemon thread.

    The FastAPI handlers in this project are `async def` but call synchronous agents,
    so `asyncio.run` from agent code would fail (a loop is already running). Running
    every MCP exchange on one dedicated loop makes the sync API safe from any thread.
    """

    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()

    def _ensure(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            if self._loop is None or self._loop.is_closed():
                loop = asyncio.new_event_loop()
                threading.Thread(target=loop.run_forever, name="nse-mcp-loop", daemon=True).start()
                self._loop = loop
            return self._loop

    def run(self, coro: Any, timeout: float) -> Any:
        future = asyncio.run_coroutine_threadsafe(coro, self._ensure())
        try:
            return future.result(timeout)
        except FutureTimeoutError as exc:
            future.cancel()
            raise NSEMCPTimeoutError(f"NSE MCP call exceeded {timeout:.0f}s") from exc


_loop_thread = _LoopThread()


def _leaf_exception(exc: BaseException) -> BaseException:
    """Unwrap (nested) ExceptionGroups raised by anyio task groups."""
    while getattr(exc, "exceptions", None):
        exc = exc.exceptions[0]
    return exc


class NSEMCPClient:
    """Synchronous, thread-safe facade over the MCP Python SDK for NSE's servers."""

    def __init__(
        self,
        endpoint_urls: Optional[dict[str, str]] = None,
        timeout: Optional[float] = None,
        attempts: Optional[int] = None,
        cooldown_seconds: Optional[float] = None,
        max_concurrency: int = 4,
    ) -> None:
        self.endpoint_urls = {
            CM_MARKET_ENDPOINT: os.getenv("NSE_MCP_CM_URL", DEFAULT_ENDPOINT_URLS[CM_MARKET_ENDPOINT]),
            BHAVCOPY_ENDPOINT: os.getenv("NSE_MCP_BHAVCOPY_URL", DEFAULT_ENDPOINT_URLS[BHAVCOPY_ENDPOINT]),
        }
        if endpoint_urls:
            self.endpoint_urls.update(endpoint_urls)
        self.timeout = timeout if timeout is not None else _env_float("NSE_MCP_TIMEOUT_SECONDS", 10.0)
        self.attempts = max(1, attempts if attempts is not None else _env_int("NSE_MCP_ATTEMPTS", 3))
        self.cooldown_seconds = (
            cooldown_seconds if cooldown_seconds is not None else _env_float("NSE_MCP_COOLDOWN_SECONDS", 45.0)
        )
        self._slots = threading.BoundedSemaphore(max_concurrency)
        self._cooldown_until: dict[str, float] = {}

    # ------------------------------------------------------------------ public API
    def list_tools(self, endpoint: str) -> list[dict[str, Any]]:
        """Return the live tool catalogue (name, description, inputSchema) of an endpoint."""

        async def op(session: ClientSession) -> list[dict[str, Any]]:
            result = await session.list_tools()
            return [
                {"name": t.name, "description": t.description, "inputSchema": t.inputSchema}
                for t in result.tools
            ]

        return self._run(endpoint, op)

    def call_tool(
        self,
        endpoint: str,
        tool: str,
        arguments: Optional[dict[str, Any]] = None,
        deadline: Optional[float] = None,
    ) -> Any:
        """Call a tool and return its decoded payload.

        `deadline` is an absolute `time.monotonic()` value. Every attempt is capped by the
        time left, and no attempt starts once it is (nearly) spent.

        Raises NSEMCPToolError if the tool reports an error, NSEMCPConnectionError /
        NSEMCPTimeoutError if the server cannot be reached. Never returns a fabricated value.
        """
        args = arguments or {}

        async def op(session: ClientSession) -> Any:
            result = await session.call_tool(tool, args)
            return self._decode(tool, result)

        return self._run(endpoint, op, deadline)

    # ------------------------------------------------------------------ internals
    def _run(self, endpoint: str, op: Any, deadline: Optional[float] = None) -> Any:
        if not nse_mcp_enabled():
            raise NSEMCPDisabledError("NSE MCP integration is disabled (NSE_MCP_ENABLED=false)")
        if endpoint not in self.endpoint_urls:
            raise ValueError(f"Unknown NSE MCP endpoint '{endpoint}'")

        remaining = self._cooldown_until.get(endpoint, 0.0) - time.monotonic()
        if remaining > 0:
            raise NSEMCPConnectionError(
                f"NSE MCP endpoint '{endpoint}' is cooling down after repeated failures "
                f"(retry in {remaining:.0f}s)"
            )

        last_error: Optional[NSEMCPError] = None
        attempted = False  # budget exhaustion alone is not evidence the endpoint is down
        with self._slots:
            for attempt in range(1, self.attempts + 1):
                timeout = self.timeout
                if deadline is not None:
                    remaining = deadline - time.monotonic()
                    if remaining < MIN_ATTEMPT_SECONDS:
                        last_error = last_error or NSEMCPTimeoutError("NSE time budget exhausted")
                        break
                    timeout = min(timeout, remaining)
                attempted = True
                try:
                    result = _loop_thread.run(
                        self._session_call(self.endpoint_urls[endpoint], op, timeout),
                        timeout=timeout + 2,
                    )
                    self._cooldown_until.pop(endpoint, None)
                    return result
                except NSEMCPToolError:
                    # The server answered; this is a legitimate "no" and retrying won't change it.
                    self._cooldown_until.pop(endpoint, None)
                    raise
                except NSEMCPError as exc:
                    last_error = exc
                    logger.warning("NSE MCP %s attempt %d/%d failed: %s", endpoint, attempt, self.attempts, exc)
                    if attempt < self.attempts:
                        backoff = min(0.5 * attempt, 1.5)
                        if deadline is not None and deadline - time.monotonic() - backoff < MIN_ATTEMPT_SECONDS:
                            break  # no further attempt can fit in the budget; don't sleep for nothing
                        time.sleep(backoff)

        if attempted:
            self._cooldown_until[endpoint] = time.monotonic() + self.cooldown_seconds
        assert last_error is not None
        raise last_error

    async def _session_call(self, url: str, op: Any, timeout: float) -> Any:
        try:
            with anyio.fail_after(timeout):
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(timeout), follow_redirects=True
                ) as http_client:
                    async with streamable_http_client(
                        url, http_client=http_client, terminate_on_close=False
                    ) as (read, write, _):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            return await op(session)
        except TimeoutError as exc:
            raise NSEMCPTimeoutError(f"No response from NSE MCP within {timeout:.1f}s") from exc
        except NSEMCPError:
            raise
        except BaseException as exc:  # noqa: BLE001 - SDK raises ExceptionGroups and httpx errors
            if isinstance(exc, (KeyboardInterrupt, SystemExit, asyncio.CancelledError)):
                raise
            leaf = _leaf_exception(exc)
            if isinstance(leaf, NSEMCPError):
                raise leaf
            if isinstance(leaf, TimeoutError):
                raise NSEMCPTimeoutError(f"No response from NSE MCP within {timeout:.1f}s") from leaf
            raise NSEMCPConnectionError(f"{type(leaf).__name__}: {leaf}") from leaf

    @staticmethod
    def _decode(tool: str, result: Any) -> Any:
        texts = [c.text for c in result.content if getattr(c, "type", None) == "text"]
        if result.isError:
            raise NSEMCPToolError(" ".join(texts) or f"Tool '{tool}' failed", tool)
        if not texts:
            raise NSEMCPConnectionError(f"Tool '{tool}' returned no text content")
        raw = texts[0]
        try:
            payload = json.loads(raw)
        except (TypeError, ValueError):
            return raw  # e.g. get_ltp_by_date returns a bare string
        if isinstance(payload, dict) and payload.get("error"):
            raise NSEMCPToolError(str(payload["error"]), tool, hint=payload.get("hint"))
        return payload
