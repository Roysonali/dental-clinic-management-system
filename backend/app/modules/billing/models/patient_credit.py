"""Billing Module — PatientCredit model.

Tracks positive balances owed to a patient from overpayments, credit notes,
or advance payments. This balance can be applied to future invoices (FI-CROSS).

Domain model §3.9 describes it as an aggregate root (or child of Patient).
The table stores both the original and remaining amounts for efficiency;
the service layer validates that remaining_amount <= original_amount.
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
    from app.modules.patients.models import Patient
    from app.modules.billing.models import (
        CreditNote,
        PaymentAllocation,
    )


class PatientCredit(Base):
    """Positive balance owed to a patient (domain model §3.9).

    Originates from overpayments or credit notes. Can be consumed against
    future invoices. Optional expiry for credit-note-sourced credits.
    """

    __tablename__ = "patient_credits"

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

    source_allocation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payment_allocations.id", ondelete="SET NULL"),
        nullable=True,
        comment="Source payment allocation (overpayment).",
    )

    source_credit_note_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("credit_notes.id", ondelete="SET NULL"),
        nullable=True,
        comment="Source credit note.",
    )

    original_amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Original credit amount.",
    )

    remaining_amount: Mapped[Decimal] = mapped_column(
        money_column(),
        nullable=False,
        comment="Currently available credit.",
    )

    expiry_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Optional expiry for credit-note-sourced credits.",
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

    patient: Mapped["Patient"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
        lazy="selectin",
    )

    source_allocation: Mapped["PaymentAllocation | None"] = relationship(
        "PaymentAllocation",
        foreign_keys=[source_allocation_id],
        lazy="selectin",
    )

    source_credit_note: Mapped["CreditNote | None"] = relationship(
        "CreditNote",
        foreign_keys=[source_credit_note_id],
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
            "original_amount > 0",
            name="ck_patient_credit_original_positive",
        ),
        CheckConstraint(
            "remaining_amount >= 0",
            name="ck_patient_credit_remaining_nonneg",
        ),
        CheckConstraint(
            "remaining_amount <= original_amount",
            name="ck_patient_credit_remaining_le_original",
        ),
        Index("ix_patient_credits_patient", "patient_id"),
        Index("ix_patient_credits_source_allocation", "source_allocation_id"),
        Index("ix_patient_credits_source_credit_note", "source_credit_note_id"),
        Index("ix_patient_credits_expiry", "expiry_date"),
    )

    def __repr__(self) -> str:
        return (
            f"<PatientCredit(id={self.id}, patient={self.patient_id}, "
            f"remaining={self.remaining_amount})>"
        )
