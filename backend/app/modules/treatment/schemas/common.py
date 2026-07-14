"""Treatment Plan module — shared DTOs.

Reusable types and status-count structures
shared across multiple schema files.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StatusTransition(BaseModel):
    """Describes a single allowed status transition for API consumers.

    Returned by transition-query endpoints so clients can dynamically
    render available action buttons.
    """

    model_config = ConfigDict(frozen=True)

    from_status: str = Field(
        ...,
        title="From Status",
        description="Current plan or item status.",
        examples=["draft"],
    )
    to_status: str = Field(
        ...,
        title="To Status",
        description="Target status the plan or item can transition to.",
        examples=["under_review"],
    )


class PlanStatusCounts(BaseModel):
    """A mapping of plan status labels to their counts.

    Used in dashboard and analytics responses.
    """

    model_config = ConfigDict(frozen=True)

    draft: int = Field(default=0, ge=0, title="Draft", description="Count of draft plans.")
    under_review: int = Field(default=0, ge=0, title="Under Review", description="Count of plans under clinical review.")
    proposed: int = Field(default=0, ge=0, title="Proposed", description="Count of proposed plans.")
    rejected: int = Field(default=0, ge=0, title="Rejected", description="Count of rejected plans.")
    accepted: int = Field(default=0, ge=0, title="Accepted", description="Count of accepted plans.")
    in_progress: int = Field(default=0, ge=0, title="In Progress", description="Count of plans in active treatment.")
    on_hold: int = Field(default=0, ge=0, title="On Hold", description="Count of plans on hold.")
    completed: int = Field(default=0, ge=0, title="Completed", description="Count of completed plans.")
    cancelled: int = Field(default=0, ge=0, title="Cancelled", description="Count of cancelled plans.")

    @classmethod
    def from_raw_counts(cls, counts: dict[str, int]) -> "PlanStatusCounts":
        """Create an instance from the raw ``{label: count}`` dict.

        Ensures every known status has a value (defaulting to 0 for
        statuses not present in the input).
        """
        return cls(**{k: counts.get(k, 0) for k in cls.model_fields.keys()})
