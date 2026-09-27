from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class WorkflowStep(str, Enum):
    RESEARCH = "research"
    STRATEGY = "strategy"
    RISK = "risk"
    DECISION = "decision"
    COMPLETE = "complete"
    FAILED = "failed"


class WorkflowMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    current_step: WorkflowStep = WorkflowStep.RESEARCH
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    execution_time_seconds: Optional[float] = None
    completed_steps: list[WorkflowStep] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class WorkflowState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    research_report: Optional[Any] = None
    strategy_report: Optional[Any] = None
    risk_report: Optional[Any] = None
    decision_report: Optional[Any] = None
    parsed_query: Optional[Any] = None
    metadata: WorkflowMetadata = Field(default_factory=WorkflowMetadata)

    def mark_step(self, step: WorkflowStep) -> None:
        self.metadata.current_step = step

    def complete_step(self, step: WorkflowStep) -> None:
        if step not in self.metadata.completed_steps:
            self.metadata.completed_steps.append(step)
        self.metadata.current_step = step

    def record_error(self, error: str) -> None:
        self.metadata.errors.append(error)
        self.metadata.current_step = WorkflowStep.FAILED

    def finalize(self) -> None:
        completed_at = datetime.now(timezone.utc)
        self.metadata.completed_at = completed_at
        self.metadata.execution_time_seconds = round(
            (completed_at - self.metadata.started_at).total_seconds(),
            6,
        )
