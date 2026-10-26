"""A slow synchronous workflow must not block unrelated endpoints of the FastAPI app.

The orchestrator and query/ticker helpers are replaced by stubs, so no Gemini, market-data or NSE request is made.

Run with: python -m unittest testing.test_event_loop
"""
import inspect
import socket
import threading
import time
import unittest
from unittest import mock

import httpx
import uvicorn

import orchestrator.orchestrator as orch
from backend.query_understanding import ParsedQuery
from backend.workflow_state import WorkflowState

SLOW_SECONDS = 2.0
SYNC_ROUTES = ("retrieve", "analyze", "strategy", "risk", "decision", "execute_workflow")


class RouteDefinitionTests(unittest.TestCase):
    def test_routes_doing_synchronous_work_are_plain_functions(self):
        for name in SYNC_ROUTES:
            self.assertFalse(inspect.iscoroutinefunction(getattr(orch, name)), f"{name} must not run on the event loop")

    def test_health_check_stays_async(self):
        self.assertTrue(inspect.iscoroutinefunction(orch.health_check))


class SlowWorkflowDoesNotBlockTests(unittest.TestCase):
    def setUp(self):
        class StubParser:
            def parse(self, query):
                return ParsedQuery(original_query=query, companies=["stub"], generation=None)

        def slow_execute(symbol, state=None, parsed_query=None):
            time.sleep(SLOW_SECONDS)  # stands in for Gemini retry waits inside the synchronous client
            return WorkflowState()

        patches = [
            mock.patch.object(orch, "query_parser", StubParser()),
            mock.patch.object(orch.ticker_resolver, "resolve", lambda target: "STUB.NS"),
            mock.patch.object(orch.workflow_orchestrator, "execute", slow_execute),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            self.port = sock.getsockname()[1]
        self.server = uvicorn.Server(uvicorn.Config(orch.app, host="127.0.0.1", port=self.port, log_level="critical"))
        thread = threading.Thread(target=self.server.run, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 10)
        self.addCleanup(setattr, self.server, "should_exit", True)
        self.base = f"http://127.0.0.1:{self.port}"
        for _ in range(100):
            try:
                httpx.get(self.base + "/", timeout=1)
                break
            except httpx.HTTPError:
                time.sleep(0.1)
        else:
            self.fail("test server did not start")

    def test_health_check_answers_while_a_workflow_is_running(self):
        results = {}

        def run_workflow():
            started = time.monotonic()
            results["response"] = httpx.post(self.base + "/workflow/execute", json={"symbol": "anything"}, timeout=30)
            results["workflow_seconds"] = time.monotonic() - started

        worker = threading.Thread(target=run_workflow)
        worker.start()
        time.sleep(0.5)  # the workflow request is now inside the slow stub

        started = time.monotonic()
        health = httpx.get(self.base + "/", timeout=30)
        health_seconds = time.monotonic() - started
        worker.join()

        self.assertEqual(health.status_code, 200)
        self.assertEqual(results["response"].status_code, 200)
        self.assertGreaterEqual(results["workflow_seconds"], SLOW_SECONDS)
        # blocked on the event loop this took ~1.5s (the rest of the workflow); in the thread pool it is milliseconds
        self.assertLess(health_seconds, SLOW_SECONDS / 2)

    def test_two_workflows_run_concurrently(self):
        started = time.monotonic()
        threads = [
            threading.Thread(target=lambda: httpx.post(self.base + "/workflow/execute", json={"symbol": "x"}, timeout=30))
            for _ in range(2)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertLess(time.monotonic() - started, SLOW_SECONDS * 1.6)  # serial execution would take ~4s


if __name__ == "__main__":
    unittest.main()
