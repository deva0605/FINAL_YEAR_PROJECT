"""Backend package for the research-oriented API surface."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
	"DefaultWorkflowOrchestrator",
	"WorkflowOrchestrator",
	"WorkflowMetadata",
	"WorkflowState",
	"WorkflowStep",
]


def __getattr__(name: str) -> Any:
	if name in {"WorkflowMetadata", "WorkflowState", "WorkflowStep"}:
		module = import_module("backend.workflow_state")
		return getattr(module, name)
	if name in {"DefaultWorkflowOrchestrator", "WorkflowOrchestrator"}:
		module = import_module("backend.workflow_orchestrator")
		return getattr(module, name)
	raise AttributeError(f"module 'backend' has no attribute {name!r}")
