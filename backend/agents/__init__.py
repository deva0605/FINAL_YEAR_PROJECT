"""Agent implementations for backend research workflows."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
	"ResearchAgent",
	"ResearchReport",
	"StrategyAgent",
	"StrategyReport",
	"StrategyRequest",
	"RiskAgent",
	"RiskReport",
	"RiskRequest",
]


def __getattr__(name: str) -> Any:
	if name in {"ResearchAgent", "ResearchReport"}:
		module = import_module("backend.agents.research_agent")
		return getattr(module, name)
	if name in {"StrategyAgent", "StrategyReport", "StrategyRequest"}:
		module = import_module("backend.agents.strategy_agent")
		return getattr(module, name)
	if name in {"RiskAgent", "RiskReport", "RiskRequest"}:
		module = import_module("backend.agents.risk_agent")
		return getattr(module, name)
	raise AttributeError(f"module 'backend.agents' has no attribute {name!r}")


