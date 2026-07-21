"""Billing Module — Invoice and InvoiceStatusHistory models.

Invoice is the billing aggregate root (ADR-001). It owns line items and
status history, references Patient/TreatmentPlan/Doctor/Appointment, and
carries full audit/versioning columns. InvoiceStatusHistory is append-only.
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
    INVOICE_NUMBER_MAX_LENGTH,
    INVOICE_TRANSITIONS,
)
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.mixins.financial import (
    currency_column,
)
from app.modules.billing.mixins.versioning import VersioningMixin

if TYPE_CHECKING:
    from app.modules.appointments.model import Appointment
    from app.modules.auth.models import User
    from app.modules.doctors.models import Doctor
    from app.modules.patients.models import Patient
    from app.modules.treatment.models import TreatmentPlan


class InvoiceStatusHistory(Base):
    """Append-only audit trail of every Invoice status change (FI-AUD-002)."""

    __tablename__ = "invoice_status_history"

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

    from_status: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        comment="Previous status (NULL for initial creation entry).",
    )

    to_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="New status after the transition.",
    )

    changed_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Free-text reason for the status change.",
    )

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="status_history",
    )

    changer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[changed_by],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_invoice_status_history_invoice", "invoice_id", "changed_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<InvoiceStatusHistory(id={self.id}, invoice={self.invoice_id}, "
            f"{self.from_status} -> {self.to_status})>"
        )


class Invoice(Base, VersioningMixin):
    """Billing aggregate root — the central financial document (ADR-001).

    Owns line items and status history. References Patient (mandatory) and
    optionally TreatmentPlan, Doctor, and Appointment. Totals are derived,
    never stored independently (FI-INV-004). Immutable after issuance
    (ADR-002 / FI-INV-001).
    """

    __tablename__ = "invoices"

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

    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="SET NULL"),
        nullable=True,
    )

    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )

    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True,
    )

    invoice_number: Mapped[str] = mapped_column(
        String(INVOICE_NUMBER_MAX_LENGTH),
        nullable=False,
        unique=True,
        comment="Sequential display number (ADR-003).",
    )

    invoice_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        server_default=func.current_date(),
        comment="Date the invoice was created.",
    )

    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Payment due date (default 30 days from invoice_date at app layer).",
    )

    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(
            InvoiceStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=30,
        ),
        nullable=False,
        default=InvoiceStatus.DRAFT,
        comment="Invoice lifecycle status.",
    )

    currency_code: Mapped[str] = mapped_column(
        currency_column(),
        nullable=False,
        comment="ISO 4217 currency code (single currency per invoice, BR-140).",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Free-text notes (append-only after issuance).",
    )

    cancellation_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Required when status transitions to Cancelled.",
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

    items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="InvoiceItem.sequence_number",
    )

    status_history: Mapped[list["InvoiceStatusHistory"]] = relationship(
        "InvoiceStatusHistory",
        back_populates="invoice",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="InvoiceStatusHistory.changed_at",
    )

    credit_notes: Mapped[list["CreditNote"]] = relationship(
        "CreditNote",
        back_populates="invoice",
        lazy="selectin",
    )

    patient: Mapped["Patient"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
        lazy="selectin",
    )

    treatment_plan: Mapped["TreatmentPlan | None"] = relationship(
        "TreatmentPlan",
        foreign_keys=[treatment_plan_id],
        lazy="selectin",
    )

    appointment: Mapped["Appointment | None"] = relationship(
        "Appointment",
        foreign_keys=[appointment_id],
        lazy="selectin",
    )

    doctor: Mapped["Doctor | None"] = relationship(
        "Doctor",
        foreign_keys=[doctor_id],
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
            "due_date >= invoice_date",
            name="ck_invoice_due_after_date",
        ),
        CheckConstraint(
            "status IN ("
            + ", ".join(f"'{s}'" for s in InvoiceStatus.all_values())
            + ")",
            name="ck_invoice_status",
        ),
        CheckConstraint(
            "currency_code ~ '^[A-Z]{3}$'",
            name="ck_invoice_currency_format",
        ),
        CheckConstraint(
            "cancellation_reason IS NOT NULL OR status != 'cancelled'",
            name="ck_invoice_cancel_reason_required",
        ),
        CheckConstraint(
            "void_reason IS NOT NULL OR status != 'void'",
            name="ck_invoice_void_reason_required",
        ),
        CheckConstraint(
            f"version >= {INITIAL_INVOICE_VERSION_NUMBER}",
            name="ck_invoice_version",
        ),
        Index("ix_invoices_patient", "patient_id"),
        Index("ix_invoices_treatment_plan", "treatment_plan_id"),
        Index("ix_invoices_appointment", "appointment_id"),
        Index("ix_invoices_doctor", "doctor_id"),
        Index("ix_invoices_status", "status"),
        Index("ix_invoices_currency", "currency_code"),
        Index("ix_invoices_invoice_date", "invoice_date"),
        Index("ix_invoices_due_date", "due_date"),
        Index("ix_invoices_number", "invoice_number"),
        Index("ix_invoices_created_at", "created_at"),
        Index(
            "ix_invoices_active_status",
            "status",
            "created_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Invoice(id={self.id}, number={self.invoice_number!r}, "
            f"status={self.status}, patient={self.patient_id})>"
        )

    def is_editable(self) -> bool:
        """Return True if the invoice is still mutable (Draft only)."""
        return self.status in InvoiceStatus.editable_statuses()

    def is_immutable(self) -> bool:
        """Return True if the invoice is frozen (issued or beyond)."""
        return self.status.is_immutable()

    def allowed_transitions(self) -> set[str]:
        """Return allowed target statuses from the current state."""
        return INVOICE_TRANSITIONS.get(self.status, set())
