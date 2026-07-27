"""Billing Module — Refund model.

Represents a refund request against a completed payment. The refund follows
a lifecycle: PENDING → APPROVED → COMPLETED, or PENDING → REJECTED.

When a refund reaches COMPLETED status, a PaymentAllocation with
is_refund=True is created to track the financial impact.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
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
from app.modules.billing.constants import (
    REFUND_NUMBER_MAX_LENGTH,
    INITIAL_INVOICE_VERSION_NUMBER,
)
from app.modules.billing.enums import RefundStatus
from app.modules.billing.mixins.financial import money_column
from app.modules.billing.mixins.versioning import VersioningMixin

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.billing.models import Payment


class Refund(Base, VersioningMixin):
    """Financial refund record against a completed payment.

    Owns its status lifecycle independently of the Payment aggregate.
    A completed refund results in a PaymentAllocation with is_refund=True.
    """

    __tablename__ = "refunds"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
    )

    refund_number: Mapped[str] = mapped_column(
        String(REFUND_NUMBER_MAX_LENGTH),
        nullable=False,
        unique=True,
        comment="Sequential display number (ADR-003).",
    )

    amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Refund amount (> 0).",
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Reason for the refund.",
    )

    status: Mapped[RefundStatus] = mapped_column(
        SAEnum(
            RefundStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=20,
        ),
        nullable=False,
        default=RefundStatus.PENDING,
        comment="Refund lifecycle status.",
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        comment="User who approved or rejected the refund.",
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the refund was approved or rejected.",
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for rejection (required when status=REJECTED).",
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

    payment: Mapped["Payment"] = relationship(
        "Payment",
        foreign_keys=[payment_id],
        lazy="selectin",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    reviewer: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy="selectin",
    )

    updater: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_refund_amount_positive",
        ),
        CheckConstraint(
            "status IN ("
            + ", ".join(f"'{s}'" for s in RefundStatus.all_values())
            + ")",
            name="ck_refund_status",
        ),
        CheckConstraint(
            "rejection_reason IS NOT NULL OR status != 'rejected'",
            name="ck_refund_rejection_reason_required",
        ),
        CheckConstraint(
            f"version >= {INITIAL_INVOICE_VERSION_NUMBER}",
            name="ck_refund_version",
        ),
        Index("ix_refunds_payment", "payment_id"),
        Index("ix_refunds_status", "status"),
        Index("ix_refunds_created_at", "created_at"),
        Index("ix_refunds_payment_status", "payment_id", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Refund(id={self.id}, number={self.refund_number!r}, "
            f"amount={self.amount}, status={self.status})>"
        )
