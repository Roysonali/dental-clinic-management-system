"""Billing Module — CreditNote model.

CreditNote is an independent aggregate root (domain model §3.6). It corrects
an issued invoice without modifying the original document. Immutable after
issuance (FI-CN-003). Supports application to invoices, expiry, and voiding.
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
)
from app.modules.billing.enums import CreditNoteStatus
from app.modules.billing.mixins.financial import money_column
from app.modules.billing.mixins.versioning import VersioningMixin

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.patients.models import Patient
    from app.modules.billing.models import Invoice


class CreditNote(Base, VersioningMixin):
    """Financial document that corrects an issued invoice (domain model §3.6).

    Owns its own lifecycle (Draft -> Issued -> Applied/Expired/Void).
    Immutable after issuance (FI-CN-003).
    """

    __tablename__ = "credit_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Invoice being corrected.",
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Patient the credit note belongs to.",
    )

    credit_note_number: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        comment="Sequential display number (ADR-003).",
    )

    issue_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        server_default=func.current_date(),
        comment="Date the credit note was issued.",
    )

    amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Credit note amount (cannot exceed invoice grand total, BR-91).",
    )

    remaining_balance: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Unapplied balance (decreases as applied to invoices).",
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Reason for issuing the credit note.",
    )

    status: Mapped[CreditNoteStatus] = mapped_column(
        SAEnum(
            CreditNoteStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=30,
        ),
        nullable=False,
        default=CreditNoteStatus.DRAFT,
        comment="Credit note lifecycle status.",
    )

    expiry_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Configurable validity period (BR-95).",
    )

    void_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Required when status transitions to Void.",
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

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="credit_notes",
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
            "amount > 0",
            name="ck_credit_note_amount_positive",
        ),
        CheckConstraint(
            "remaining_balance >= 0",
            name="ck_credit_note_remaining_nonneg",
        ),
        CheckConstraint(
            "remaining_balance <= amount",
            name="ck_credit_note_remaining_le_amount",
        ),
        CheckConstraint(
            "status IN ("
            + ", ".join(f"'{s}'" for s in CreditNoteStatus.all_values())
            + ")",
            name="ck_credit_note_status",
        ),
        CheckConstraint(
            "void_reason IS NOT NULL OR status != 'void'",
            name="ck_credit_note_void_reason_required",
        ),
        CheckConstraint(
            f"version >= {INITIAL_INVOICE_VERSION_NUMBER}",
            name="ck_credit_note_version",
        ),
        Index("ix_credit_notes_invoice", "invoice_id"),
        Index("ix_credit_notes_patient", "patient_id"),
        Index("ix_credit_notes_status", "status"),
        Index("ix_credit_notes_expiry", "expiry_date"),
        Index("ix_credit_notes_number", "credit_note_number"),
        Index("ix_credit_notes_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<CreditNote(id={self.id}, number={self.credit_note_number!r}, "
            f"amount={self.amount}, status={self.status})>"
        )
