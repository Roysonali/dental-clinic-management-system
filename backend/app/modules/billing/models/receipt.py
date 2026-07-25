"""Billing Module — Receipt and ReceiptInvoice models.

Receipt is an independent aggregate root (domain model §3.5). It is generated
automatically with a payment and is immutable after creation (FI-RCP-001).

ReceiptInvoice is a lightweight association entity supporting consolidated
receipts (one receipt covering multiple invoices from one payment).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
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
from app.modules.billing.constants import RECEIPT_NUMBER_MAX_LENGTH
from app.modules.billing.enums import ReceiptStatus
from app.modules.billing.mixins.financial import money_column

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.billing.models import Invoice, Payment


class ReceiptInvoice(Base):
    """Association between a Receipt and an Invoice (consolidated receipt).

    Allows a single receipt to cover multiple invoices from one payment.
    """

    __tablename__ = "receipt_invoices"

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        primary_key=True,
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    receipt: Mapped["Receipt"] = relationship(
        "Receipt",
        back_populates="receipt_invoices",
    )

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ReceiptInvoice(receipt={self.receipt_id}, "
            f"invoice={self.invoice_id})>"
        )


class Receipt(Base):
    """Formal acknowledgment of a completed payment (domain model §3.5).

    Read-only after creation (FI-RCP-001). Automatically generated when a
    payment is recorded (BR-70). Supports consolidated receipts via
    ReceiptInvoice associations.
    """

    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
        comment="Originating payment (1:1).",
    )

    receipt_number: Mapped[str] = mapped_column(
        String(RECEIPT_NUMBER_MAX_LENGTH),
        nullable=False,
        unique=True,
        comment="Sequential display number (ADR-003).",
    )

    receipt_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        server_default=func.current_date(),
        comment="Date the receipt was generated.",
    )

    amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Total receipted amount.",
    )

    status: Mapped[ReceiptStatus] = mapped_column(
        SAEnum(
            ReceiptStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=20,
        ),
        nullable=False,
        default=ReceiptStatus.GENERATED,
        comment="Receipt lifecycle status.",
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
        back_populates="receipt",
        lazy="selectin",
    )

    receipt_invoices: Mapped[list["ReceiptInvoice"]] = relationship(
        "ReceiptInvoice",
        back_populates="receipt",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ("
            + ", ".join(f"'{s}'" for s in ReceiptStatus.all_values())
            + ")",
            name="ck_receipt_status",
        ),
        Index("ix_receipts_date", "receipt_date"),
        Index("ix_receipts_status", "status"),
        Index("ix_receipts_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Receipt(id={self.id}, number={self.receipt_number!r}, "
            f"amount={self.amount}, status={self.status})>"
        )
