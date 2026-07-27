"""Billing Module — PaymentAllocation model.

Links a Payment to an Invoice with the allocated amount. Owned by the
Payment aggregate. Supports normal allocations, advance payments, and
refund allocations.
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
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.billing.mixins.financial import money_column

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.billing.models import Invoice, Payment


class PaymentAllocation(Base):
    """Links a Payment to an Invoice with the allocated amount.

    Owned by the Payment aggregate. Supports:
    - Normal allocations (invoice_id set, is_refund=False)
    - Advance/unallocated payments (invoice_id NULL, is_refund=False)
    - Refund allocations (is_refund=True, original_allocation_id set)

    The sum of non-refund allocations must equal the payment total (FI-PMT-003).
    """

    __tablename__ = "payment_allocations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
    )

    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Target invoice (NULL for advance/unallocated payments).",
    )

    allocated_amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Amount allocated to this invoice.",
    )

    is_refund: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if this allocation represents a refund.",
    )

    refund_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for refund (required when is_refund=True).",
    )

    original_allocation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payment_allocations.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Self-reference to the allocation being reversed (refunds).",
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

    payment: Mapped["Payment"] = relationship(
        "Payment",
        back_populates="payment_allocations",
    )

    invoice: Mapped["Invoice | None"] = relationship(
        "Invoice",
        foreign_keys=[invoice_id],
        lazy="selectin",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    original_allocation: Mapped["PaymentAllocation | None"] = relationship(
        "PaymentAllocation",
        remote_side=[id],
        foreign_keys=[original_allocation_id],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "allocated_amount > 0",
            name="ck_payment_allocation_amount_positive",
        ),
        CheckConstraint(
            "refund_reason IS NOT NULL OR is_refund = FALSE",
            name="ck_payment_allocation_refund_reason_required",
        ),
        Index("ix_payment_allocation_payment", "payment_id"),
        Index("ix_payment_allocation_invoice", "invoice_id"),
        Index("ix_payment_allocation_original", "original_allocation_id"),
        Index(
            "uq_payment_allocation_active",
            "payment_id",
            "invoice_id",
            unique=True,
            postgresql_where=(
                "is_refund = FALSE AND invoice_id IS NOT NULL"
            ),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PaymentAllocation(id={self.id}, payment={self.payment_id}, "
            f"invoice={self.invoice_id}, amount={self.allocated_amount})>"
        )
