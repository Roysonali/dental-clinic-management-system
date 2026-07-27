"""Billing Module — InvoiceItem model.

Child entity of the Invoice aggregate. Represents a single charge line on an
invoice. Quantity, unit price, discount, and net amount are stored directly;
derived totals are computed by the service layer (FI-LI-002).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.billing.constants import (
    CREDIT_NOTE_REASON_MAX_LENGTH,
    INITIAL_INVOICE_VERSION_NUMBER,
    MONEY_TOTAL_DIGITS,
)
from app.modules.billing.mixins.financial import money_column
from app.modules.billing.mixins.versioning import VersioningMixin

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.patient_records.models.diagnosis import PatientRecordDiagnosis
    from app.modules.treatment.models import TreatmentPlanItem


class InvoiceItem(Base, VersioningMixin):
    """Single charge line on an invoice (child of Invoice aggregate).

    Quantity must be >= 1 (FI-LI-005). Unit price must be >= 0 (FI-LI-004).
    Net amount is derived as (unit_price * quantity) - discount_value
    (FI-LI-002). Discount cannot exceed subtotal (FI-LI-003).
    """

    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
    )

    plan_item_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("treatment_plan_items.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional source treatment plan item.",
    )

    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patient_record_diagnoses.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional linked diagnosis.",
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="1-based order within the parent invoice.",
    )

    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Human-readable charge description.",
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Quantity billed (>= 1).",
    )

    unit_price: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Price per unit (>= 0, NUMERIC(12,2)).",
    )

    discount_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="'PERCENTAGE' or 'FIXED_AMOUNT'.",
    )

    discount_value: Mapped[Decimal | None] = mapped_column(
        money_column(),
        nullable=True,
        comment="Discount percentage or fixed amount.",
    )

    net_amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="(unit_price * quantity) - discount_value.",
    )

    tax_rate_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
        comment="FK to tax_rates (Phase 2).",
    )

    tax_amount: Mapped[Decimal | None] = mapped_column(
        money_column(),
        nullable=True,
        comment="Tax amount per line (Phase 2).",
    )

    original_price: Mapped[Decimal | None] = mapped_column(
        money_column(),
        nullable=True,
        comment="Original treatment plan estimate price (FI-AUD-004).",
    )

    override_reason: Mapped[str | None] = mapped_column(
        String(CREDIT_NOTE_REASON_MAX_LENGTH),
        nullable=True,
        comment="Reason for price override from treatment plan estimate.",
    )

    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # VersioningMixin provides version, doc_version

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="items",
    )

    plan_item: Mapped["TreatmentPlanItem | None"] = relationship(
        "TreatmentPlanItem",
        foreign_keys=[plan_item_id],
        lazy="selectin",
    )

    diagnosis: Mapped["PatientRecordDiagnosis | None"] = relationship(
        "PatientRecordDiagnosis",
        foreign_keys=[diagnosis_id],
        lazy="selectin",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    updater: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "quantity >= 1",
            name="ck_invoice_item_quantity",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_invoice_item_unit_price",
        ),
        CheckConstraint(
            "net_amount >= 0",
            name="ck_invoice_item_net_amount",
        ),
        CheckConstraint(
            "discount_value IS NULL OR discount_value >= 0",
            name="ck_invoice_item_discount_nonneg",
        ),
        CheckConstraint(
            "discount_type IS NULL OR discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')",
            name="ck_invoice_item_discount_type",
        ),
        CheckConstraint(
            f"version >= {INITIAL_INVOICE_VERSION_NUMBER}",
            name="ck_invoice_item_version",
        ),
        UniqueConstraint(
            "invoice_id", "sequence_number", name="uq_invoice_item_sequence"
        ),
        Index("ix_invoice_item_invoice", "invoice_id"),
        Index("ix_invoice_item_plan_item", "plan_item_id"),
        Index("ix_invoice_item_diagnosis", "diagnosis_id"),
        Index("ix_invoice_item_tax_rate", "tax_rate_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<InvoiceItem(id={self.id}, invoice={self.invoice_id}, "
            f"seq={self.sequence_number}, net={self.net_amount})>"
        )
