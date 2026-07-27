"""Billing Module — Invoice Item schemas.

Provides dedicated Pydantic v2 DTOs for the InvoiceItem child entity:
request schemas for create/update operations, response schemas for reads,
and lightweight summary DTOs for embedding in invoice-level responses.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.billing.schemas.base import (
    BillingBaseModel,
    BillingCreateSchema,
    BillingResponseSchema,
    BillingUpdateSchema,
)
from app.modules.billing.schemas.common import (
    MoneyBreakdown,
)
from app.modules.billing.schemas.mixins import (
    AuditMixin,
    TimestampMixin,
)
from app.modules.billing.schemas.validators import BillingValidators
from app.modules.billing.schemas.types import (
    NonNegativeDecimal,
)


# ======================================================================
# Core type aliases used in invoice item schemas
# ======================================================================

ItemQuantity = int
PositiveMoney = Decimal
NonNegativeMoney = Decimal
CurrencyCodeStr = str


# ======================================================================
# Base schema
# ======================================================================


class InvoiceItemBase(BillingBaseModel):
    """Shared fields for invoice line item schemas.

    Contains the structural fields common to create, update, and
    read representations. Structural validation only—business rules
    (e.g. net amount calculations) live in the service/validator layer.
    """

    description: str = Field(
        ...,
        min_length=1,
        max_length=500,
        title="Description",
        description="Human-readable charge description.",
        examples=["Root Canal Treatment - Tooth #36"],
    )
    quantity: int = Field(
        default=1,
        ge=1,
        title="Quantity",
        description="Quantity billed (must be >= 1).",
        examples=[1],
    )
    unit_price: NonNegativeDecimal = Field(
        ...,
        title="Unit Price",
        description="Price per unit before any discounts (NUMERIC(12,2)).",
        examples=[Decimal("1500.00")],
    )
    discount_type: str | None = Field(
        default=None,
        title="Discount Type",
        description="Discount kind. ``PERCENTAGE`` or ``FIXED_AMOUNT``.",
        examples=["PERCENTAGE"],
    )
    discount_value: NonNegativeDecimal | None = Field(
        default=None,
        title="Discount Value",
        description="Discount amount or percentage (context determined by discount_type).",
        examples=[Decimal("10.00")],
    )
    net_amount: NonNegativeDecimal = Field(
        ...,
        title="Net Amount",
        description="(unit_price * quantity) - discount_value.",
        examples=[Decimal("1350.00")],
    )
    tax_rate_id: UUID | None = Field(
        default=None,
        title="Tax Rate ID",
        description="FK to tax_rates table (Phase 2). Null if no tax applies.",
    )
    tax_amount: NonNegativeDecimal | None = Field(
        default=None,
        title="Tax Amount",
        description="Tax amount per line (Phase 2).",
        examples=[Decimal("10.00")],
    )
    original_price: NonNegativeDecimal | None = Field(
        default=None,
        title="Original Price",
        description="Original treatment plan estimate price for audit trail.",
        examples=[Decimal("1500.00")],
    )
    override_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Override Reason",
        description="Required when pricing deviates from the treatment plan estimate.",
        examples=["Patient opted for premium material"],
    )
    currency_code: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )


# ======================================================================
# Request schemas
# ======================================================================


class InvoiceItemCreate(BillingCreateSchema, InvoiceItemBase, BillingValidators):
    """Request body for creating an invoice line item.

    Inherits all structural fields from :class:`InvoiceItemBase` and adds
    optional foreign keys to the originating treatment plan item and
    diagnosis. Financial fields are normalized via the shared billing
    validator mixin.
    """

    sequence_number: int = Field(
        ...,
        ge=1,
        title="Sequence Number",
        description="1-based order within the parent invoice (unique per invoice).",
        examples=[1],
    )
    plan_item_id: UUID | None = Field(
        default=None,
        title="Plan Item ID",
        description="Optional FK to the originating treatment plan item.",
    )
    diagnosis_id: UUID | None = Field(
        default=None,
        title="Diagnosis ID",
        description="Optional FK to the linked patient record diagnosis.",
    )

    @field_validator(
        "unit_price",
        "discount_value",
        "net_amount",
        "tax_amount",
        "original_price",
        mode="before",
    )
    @classmethod
    def _validate_money_amounts(cls, value: object) -> Decimal | None:
        """Normalize monetary fields to 2 decimal places in the allowed range."""
        if value is None:
            return value
        return cls.validate_money_amount(value)

    @field_validator(
        "tax_rate_id", "plan_item_id", "diagnosis_id", mode="before"
    )
    @classmethod
    def _validate_uuids(cls, value: object) -> UUID | None:
        if value is None:
            return value
        if isinstance(value, UUID):
            return value
        try:
            return UUID(str(value))
        except (ValueError, TypeError) as exc:
            raise TypeError("Expected a valid UUID.") from exc


class InvoiceItemUpdate(BillingUpdateSchema, BillingValidators):
    """Request body for updating an invoice line item.

    All fields are optional (PATCH semantics). Only provided fields are
    updated. Null values clear nullable fields.
    """

    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
        title="Description",
        description="Updated charge description.",
    )
    quantity: ItemQuantity | None = Field(
        default=None,
        ge=1,
        title="Quantity",
        description="Updated quantity (>= 1).",
    )
    unit_price: NonNegativeDecimal | None = Field(
        default=None,
        title="Unit Price",
        description="Updated price per unit.",
    )
    discount_type: str | None = Field(
        default=None,
        title="Discount Type",
        description="Updated discount kind (PERCENTAGE or FIXED_AMOUNT).",
    )
    discount_value: NonNegativeDecimal | None = Field(
        default=None,
        title="Discount Value",
        description="Updated discount amount or percentage.",
    )
    net_amount: NonNegativeDecimal | None = Field(
        default=None,
        title="Net Amount",
        description="Updated net line amount.",
    )
    tax_rate_id: UUID | None = Field(
        default=None,
        title="Tax Rate ID",
        description="Updated tax rate FK.",
    )
    tax_amount: NonNegativeDecimal | None = Field(
        default=None,
        title="Tax Amount",
        description="Updated tax amount.",
    )
    original_price: NonNegativeDecimal | None = Field(
        default=None,
        title="Original Price",
        description="Updated original price reference.",
    )
    override_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Override Reason",
        description="Updated override reason.",
    )
    currency_code: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )

    @field_validator(
        "unit_price",
        "discount_value",
        "net_amount",
        "tax_amount",
        "original_price",
        mode="before",
    )
    @classmethod
    def _validate_money_amounts(cls, value: object) -> Decimal | None:
        if value is None:
            return value
        return cls.validate_money_amount(value)


# ======================================================================
# Response schemas
# ======================================================================


class InvoiceItemRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full invoice line item returned by single-item GET endpoints.

    Composes structural fields with timestamps, audit user IDs, and an
    optional line-level ``MoneyBreakdown`` for display purposes.
    `from_attributes=True` enables ``model_validate(orm_instance)``.
    """

    id: UUID = Field(
        ...,
        title="Item ID",
        description="Unique identifier of the line item.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    invoice_id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Parent invoice UUID.",
    )
    plan_item_id: UUID | None = Field(
        default=None,
        title="Plan Item ID",
        description="Optional FK to the originating treatment plan item.",
    )
    diagnosis_id: UUID | None = Field(
        default=None,
        title="Diagnosis ID",
        description="Optional FK to the linked patient record diagnosis.",
    )
    sequence_number: int = Field(
        ...,
        title="Sequence Number",
        description="1-based order within the parent invoice.",
    )
    description: str = Field(
        ...,
        title="Description",
        description="Human-readable charge description.",
    )
    quantity: int = Field(
        ...,
        title="Quantity",
        description="Quantity billed.",
    )
    unit_price: NonNegativeDecimal = Field(
        ...,
        title="Unit Price",
        description="Price per unit before discounts.",
    )
    discount_type: str | None = Field(
        default=None,
        title="Discount Type",
        description="PERCENTAGE or FIXED_AMOUNT.",
    )
    discount_value: NonNegativeDecimal | None = Field(
        default=None,
        title="Discount Value",
        description="Discount percentage or fixed amount.",
    )
    net_amount: NonNegativeDecimal = Field(
        ...,
        title="Net Amount",
        description="Net line amount after discount.",
    )
    tax_rate_id: UUID | None = Field(
        default=None,
        title="Tax Rate ID",
        description="FK to tax_rates (Phase 2).",
    )
    tax_amount: NonNegativeDecimal | None = Field(
        default=None,
        title="Tax Amount",
        description="Tax amount per line (Phase 2).",
    )
    original_price: NonNegativeDecimal | None = Field(
        default=None,
        title="Original Price",
        description="Original treatment plan estimate for audit trail.",
    )
    override_reason: str | None = Field(
        default=None,
        title="Override Reason",
        description="Reason for deviating from the treatment plan estimate.",
    )
    currency_code: str = Field(
        ...,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )
    financial_breakdown: MoneyBreakdown | None = Field(
        default=None,
        title="Financial Breakdown",
        description="Line-level monetary breakdown.",
    )


# ======================================================================
# Summary / list DTOs
# ======================================================================


class InvoiceItemSummary(BaseModel):
    """Lightweight line item representation for embedding in invoice responses.

    Excludes deep audit and nullable financial detail to keep payloads
    small when an invoice has many items.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Item ID",
        description="Unique identifier of the line item.",
    )
    sequence_number: int = Field(
        ...,
        title="Sequence Number",
        description="Ordering position within the invoice.",
    )
    description: str = Field(
        ...,
        title="Description",
        description="Human-readable charge description.",
    )
    quantity: int = Field(
        ...,
        title="Quantity",
        description="Quantity billed.",
    )
    unit_price: NonNegativeDecimal = Field(
        ...,
        title="Unit Price",
        description="Price per unit.",
    )
    discount_type: str | None = Field(
        default=None,
        title="Discount Type",
        description="PERCENTAGE or FIXED_AMOUNT.",
    )
    discount_value: NonNegativeDecimal | None = Field(
        default=None,
        title="Discount Value",
        description="Discount value.",
    )
    net_amount: NonNegativeDecimal = Field(
        ...,
        title="Net Amount",
        description="Net line amount after discount.",
    )
    tax_amount: NonNegativeDecimal | None = Field(
        default=None,
        title="Tax Amount",
        description="Tax applied to this line.",
    )
    currency_code: str = Field(
        ...,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )


__all__ = [
    "InvoiceItemBase",
    "InvoiceItemCreate",
    "InvoiceItemRead",
    "InvoiceItemSummary",
    "InvoiceItemUpdate",
    "ItemQuantity",
]
