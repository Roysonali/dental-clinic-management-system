"""Billing Module — Payment model.

Payment is an independent aggregate root (domain model §3.3). It owns
PaymentAllocation records that distribute the total across invoices. A single
payment can cover multiple invoices (consolidated payment) or be an advance
payment (no invoice allocated yet).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
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
    INITIAL_INVOICE_VERSION_NUMBER,
    PAYMENT_NOTES_MAX_LENGTH,
    PAYMENT_NUMBER_MAX_LENGTH,
    TRANSACTION_REFERENCE_MAX_LENGTH,
)
from app.modules.billing.enums import PaymentMethod, PaymentStatus
from app.modules.billing.mixins.financial import money_column
from app.modules.billing.mixins.versioning import VersioningMixin

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.patients.models import Patient
    from app.modules.billing.models import (
        Receipt,
    )
    from .payment_allocation import PaymentAllocation


class Payment(Base, VersioningMixin):
    """Financial transaction aggregate root (domain model §3.3).

    Records the transfer of funds from patient to clinic. Owns
    PaymentAllocation records. Supports partial and consolidated payments.
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
    )

    payment_number: Mapped[str] = mapped_column(
        String(PAYMENT_NUMBER_MAX_LENGTH),
        nullable=False,
        unique=True,
        comment="Sequential display number (ADR-003).",
    )

    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(
            PaymentMethod,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=30,
        ),
        nullable=False,
        comment="Method used to settle the payment.",
    )

    total_amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Total payment amount (> 0).",
    )

    payment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        server_default=func.current_date(),
        comment="Date the payment was recorded.",
    )

    reference_number: Mapped[str | None] = mapped_column(
        String(TRANSACTION_REFERENCE_MAX_LENGTH),
        nullable=True,
        comment="Gateway transaction ID, cheque number, etc.",
    )

    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(
            PaymentStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=30,
        ),
        nullable=False,
        default=PaymentStatus.COMPLETED,
        comment="Payment lifecycle status.",
    )

    is_reversed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if the payment has been fully reversed.",
    )

    reversal_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for reversal (required when is_reversed=True).",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Free-text notes.",
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
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

    payment_allocations: Mapped[list["PaymentAllocation"]] = relationship(
        "PaymentAllocation",
        back_populates="payment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="PaymentAllocation.created_at",
    )

    receipt: Mapped["Receipt | None"] = relationship(
        "Receipt",
        back_populates="payment",
        uselist=False,
        lazy="selectin",
    )

    patient: Mapped["Patient"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
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
            "total_amount > 0",
            name="ck_payment_amount_positive",
        ),
        CheckConstraint(
            "status IN ("
            + ", ".join(f"'{s}'" for s in PaymentStatus.all_values())
            + ")",
            name="ck_payment_status",
        ),
        CheckConstraint(
            "reversal_reason IS NOT NULL OR is_reversed = FALSE",
            name="ck_payment_reversal_reason_required",
        ),
        CheckConstraint(
            f"version >= {INITIAL_INVOICE_VERSION_NUMBER}",
            name="ck_payment_version",
        ),
        Index("ix_payments_patient", "patient_id"),
        Index("ix_payments_status", "status"),
        Index("ix_payments_payment_date", "payment_date"),
        Index("ix_payments_number", "payment_number"),
        Index("ix_payments_created_at", "created_at"),
        Index("ix_payments_method_status", "payment_method", "status"),
        Index("ix_payments_patient_status", "patient_id", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Payment(id={self.id}, number={self.payment_number!r}, "
            f"amount={self.total_amount}, status={self.status})>"
        )
