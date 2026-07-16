"""Treatment Plan module — error response DTOs.

Standardised error envelopes returned by the global exception handler.
Reuses the ``to_dict()`` pattern from the domain exceptions so that
the envelope is consistent whether the error originates from the
treatment module or any other DensCare module.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Standard error detail envelope.

    Mirrors the shape produced by ``TreatmentPlanException.to_dict()``.
    """

    code: str = Field(
        ...,
        title="Error Code",
        description="Stable machine-readable error code.",
        examples=["PLAN_NOT_FOUND"],
    )
    message: str = Field(
        ...,
        title="Error Message",
        description="Human-readable error description.",
        examples=["Treatment plan not found"],
    )
    details: Any = Field(
        default=None,
        title="Details",
        description="Optional structured context (e.g. field name, rejected value).",
    )


class ErrorResponse(BaseModel):
    """Top-level error response body.

    .. code-block:: json

        {
            "error": {
                "code": "PLAN_NOT_FOUND",
                "message": "Treatment plan not found",
                "details": {"plan_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"}
            }
        }
    """

    error: ErrorDetail = Field(
        ...,
        title="Error",
        description="Error detail envelope.",
    )


class ValidationErrorItem(BaseModel):
    """A single field-level validation error.

    Used in 422 responses to report one or more invalid fields.
    """

    field: str = Field(
        ...,
        title="Field",
        description="Name of the invalid field (dot-separated for nested).",
        examples=["estimated_cost"],
    )
    message: str = Field(
        ...,
        title="Message",
        description="Human-readable validation message.",
        examples=["Value must be between 0 and 999999.99"],
    )
    rejected_value: Any = Field(
        default=None,
        title="Rejected Value",
        description="The value that failed validation.",
    )


class ValidationErrorResponse(BaseModel):
    """422 validation error response body.

    .. code-block:: json

        {
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": null
            },
            "validation_errors": [
                {"field": "estimated_cost", "message": "...", "rejected_value": "abc"}
            ]
        }
    """

    error: ErrorDetail = Field(
        ...,
        title="Error",
        description="Top-level error envelope.",
    )
    validation_errors: list[ValidationErrorItem] = Field(
        default_factory=list,
        title="Validation Errors",
        description="List of individual field-level validation failures.",
    )
