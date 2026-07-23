"""Billing Module — Shared summary DTOs.

Lightweight nested summary DTOs reused by invoice and payment schemas
to avoid cross-module import coupling.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PatientSummary(BaseModel):
    """Minimal patient data embedded in billing responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Patient ID",
        description="Unique patient identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    patient_code: str = Field(
        ...,
        title="Patient Code",
        description="Auto-generated patient code (e.g. PAT-000001).",
        examples=["PAT-000001"],
    )
    full_name: str = Field(
        ...,
        title="Full Name",
        description="Computed patient full name.",
        examples=["Juan Dela Cruz"],
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the patient record is currently active.",
        examples=[True],
    )


class CreatorSummary(BaseModel):
    """Minimal user data for audit trails on billing documents."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="User ID",
        description="Unique user identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str | None = Field(
        default=None,
        title="Full Name",
        description="Resolved full name of the user.",
        examples=["Admin User"],
    )


__all__ = [
    "CreatorSummary",
    "PatientSummary",
]
