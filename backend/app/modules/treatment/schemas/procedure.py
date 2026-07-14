"""Treatment Plan module — Procedure master catalog schemas.

Request / response DTOs for the Procedure entity (master catalog
of dental procedures managed by administrators).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.treatment.constants import (
    MAX_ESTIMATED_COST,
    MIN_ESTIMATED_COST,
    PROCEDURE_CODE_MAX_LENGTH,
    PROCEDURE_NAME_MAX_LENGTH,
)
from app.modules.treatment.enums import ProcedureCategory


# ======================================================================
# Request schemas
# ======================================================================


class ProcedureCreate(BaseModel):
    """Request body for ``POST /procedures``.

    Creates a new procedure in the master catalog.
    """

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        ...,
        min_length=1,
        max_length=PROCEDURE_CODE_MAX_LENGTH,
        title="Code",
        description="Unique business code (will be uppercased by the service).",
        examples=["RCT001"],
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=PROCEDURE_NAME_MAX_LENGTH,
        title="Name",
        description="Display name of the procedure.",
        examples=["Root Canal Treatment - Molar"],
    )
    default_cost: Decimal = Field(
        ...,
        ge=MIN_ESTIMATED_COST,
        le=MAX_ESTIMATED_COST,
        max_digits=10,
        decimal_places=2,
        title="Default Cost",
        description="Default cost of the procedure.",
        examples=[Decimal("15000.00")],
    )
    category: ProcedureCategory = Field(
        ...,
        title="Category",
        description="Procedure category.",
        examples=["endodontic"],
    )
    description: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=2000,
        title="Description",
        description="Optional detailed description of the procedure.",
    )


class ProcedureUpdate(BaseModel):
    """Request body for ``PATCH /procedures/{id}``.

    All fields are optional. Only provided fields are updated.
    """

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=PROCEDURE_NAME_MAX_LENGTH,
        title="Name",
        description="Display name of the procedure.",
    )
    default_cost: Optional[Decimal] = Field(
        default=None,
        ge=MIN_ESTIMATED_COST,
        le=MAX_ESTIMATED_COST,
        max_digits=10,
        decimal_places=2,
        title="Default Cost",
        description="Default cost of the procedure.",
    )
    category: Optional[ProcedureCategory] = Field(
        default=None,
        title="Category",
        description="Procedure category.",
    )
    description: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=2000,
        title="Description",
        description="Optional detailed description of the procedure.",
    )


# ======================================================================
# Response schemas
# ======================================================================


class ProcedureSummary(BaseModel):
    """Lightweight procedure representation for embedding in plan items.

    Used inside ``TreatmentPlanItemResponse`` to avoid repeating
    full procedure details when the item already references them.
    """

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: int = Field(
        ...,
        title="Procedure ID",
        description="Primary key of the procedure.",
    )
    code: str = Field(
        ...,
        title="Code",
        description="Unique business code.",
        examples=["RCT001"],
    )
    name: str = Field(
        ...,
        title="Name",
        description="Display name.",
        examples=["Root Canal Treatment - Molar"],
    )
    category: ProcedureCategory = Field(
        ...,
        title="Category",
        description="Procedure category.",
        examples=["endodontic"],
    )
    default_cost: Decimal = Field(
        ...,
        title="Default Cost",
        description="Default cost of the procedure.",
        examples=[Decimal("15000.00")],
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the procedure is active in the catalog.",
    )


class ProcedureResponse(BaseModel):
    """Full procedure response returned in single-resource API calls."""

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: int = Field(
        ...,
        title="Procedure ID",
        description="Primary key of the procedure.",
    )
    code: str = Field(
        ...,
        title="Code",
        description="Unique business code.",
        examples=["RCT001"],
    )
    name: str = Field(
        ...,
        title="Name",
        description="Display name.",
        examples=["Root Canal Treatment - Molar"],
    )
    description: Optional[str] = Field(
        default=None,
        title="Description",
        description="Optional description.",
    )
    default_cost: Decimal = Field(
        ...,
        title="Default Cost",
        description="Default cost of the procedure.",
        examples=[Decimal("15000.00")],
    )
    category: ProcedureCategory = Field(
        ...,
        title="Category",
        description="Procedure category.",
        examples=["endodontic"],
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the procedure is active in the catalog.",
    )
