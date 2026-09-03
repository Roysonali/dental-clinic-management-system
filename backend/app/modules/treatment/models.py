"""Treatment Plan Module — SQLAlchemy 2.x ORM models.

Five entities:

* ``Procedure``               — master catalog of dental procedures (Integer PK)
* ``TreatmentPlan``           — aggregate root (UUID PK)
* ``TreatmentPlanItem``       — procedure line item owned by a plan (UUID PK)
* ``TreatmentPlanVersion``    — immutable JSONB snapshot on post-acceptance edits
* ``TreatmentPlanApproval``   — 1:1 doctor approval + patient acknowledgment

Conventions follow the newest DensCare module (``patient_records``):
typed ``Mapped``/``mapped_column``, explicit ``__tablename__`` and
``__table_args__``, and string-based relationships to other modules' classes
(resolved via the shared mapper registry in ``app.database.models``).

Status / category columns are stored as ``String`` and guarded by ``CHECK``
constraints; the application enums and the state machine provide the
authoritative value sets.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Date,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.modules.treatment.constants import (
    APPROVAL_NOTES_MAX_LENGTH,
    ARCH_MAX_LENGTH,
    CHANGE_REASON_MAX_LENGTH,
    FDI_PERMANENT_MAX,
    FDI_PERMANENT_MIN,
    FDI_PRIMARY_MAX,
    FDI_PRIMARY_MIN,
    INITIAL_VERSION_NUMBER,
    MAX_ITEM_QUANTITY,
    MIN_ITEM_QUANTITY,
    PLAN_CODE_MAX_LENGTH,
    PROCEDURE_CODE_MAX_LENGTH,
    PROCEDURE_NAME_MAX_LENGTH,
    QUADRANT_MAX_LENGTH,
    TOOTH_SURFACE_MAX_LENGTH,
)
from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from app.modules.appointments.model import Appointment
    from app.modules.auth.models import User
    from app.modules.doctors.models import Doctor
    from app.modules.patient_records.models.diagnosis import PatientRecordDiagnosis
    from app.modules.patients.models import Patient


class Procedure(Base):
    """Master catalog of dental procedures.

    Seeded at deployment and maintained by administrators. Reusable across
    all treatment plans with consistent naming and pricing.
    """

    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    code: Mapped[str] = mapped_column(
        String(PROCEDURE_CODE_MAX_LENGTH),
        nullable=False,
        unique=True,
    )

    name: Mapped[str] = mapped_column(
        String(PROCEDURE_NAME_MAX_LENGTH),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    default_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    category: Mapped[ProcedureCategory] = mapped_column(
        SAEnum(
            ProcedureCategory,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=30,
        ),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    __table_args__ = (
        CheckConstraint("default_cost >= 0", name="ck_proc_default_cost"),
        CheckConstraint(
            "category IN (" +
            ", ".join(f"'{c}'" for c in ProcedureCategory.all_values()) +
            ")",
            name="ck_proc_category",
        ),
        Index("ix_procedures_active", "is_active"),
        Index("ix_procedures_category", "category"),
    )

    def __repr__(self) -> str:
        return (
            f"<Procedure(id={self.id}, code={self.code!r}, "
            f"name={self.name!r}, category={self.category!r})>"
        )


class TreatmentPlan(Base):
    """Aggregate root for a dental treatment plan.

    Owns its items, version snapshots, and approval record. References a
    patient and the creating doctor, and carries full audit fields.
    """

    __tablename__ = "treatment_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    plan_code: Mapped[str] = mapped_column(
        String(PLAN_CODE_MAX_LENGTH),
        nullable=False,
        unique=True,
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
    )

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="RESTRICT"),
        nullable=False,
    )

    clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    dentist_recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)

    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[TreatmentPlanStatus] = mapped_column(
        SAEnum(
            TreatmentPlanStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=20,
        ),
        nullable=False,
        default=TreatmentPlanStatus.DRAFT,
    )

    current_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=INITIAL_VERSION_NUMBER,
    )

    # Optimistic concurrency token (SQLAlchemy ``version_id_col``). This is
    # intentionally separate from ``current_version``: ``current_version`` is
    # the *business* version history of clinical plan revisions, whereas
    # ``lock_version`` guards against lost updates when two transactions edit
    # the same plan row concurrently. SQLAlchemy increments it on every UPDATE
    # and fails the transaction if the value changed underneath us.
    lock_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    __mapper_args__ = {"version_id_col": lock_version}

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    items: Mapped[list["TreatmentPlanItem"]] = relationship(
        "TreatmentPlanItem",
        back_populates="plan",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="TreatmentPlanItem.sequence_number",
    )

    versions: Mapped[list["TreatmentPlanVersion"]] = relationship(
        "TreatmentPlanVersion",
        back_populates="plan",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="TreatmentPlanVersion.version_number",
    )

    approval: Mapped["TreatmentPlanApproval | None"] = relationship(
        "TreatmentPlanApproval",
        back_populates="plan",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    patient: Mapped["Patient"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
        lazy="selectin",
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        foreign_keys=[doctor_id],
        lazy="selectin",
    )

    creator: Mapped["User | None"] = relationship(
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
            "valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to",
            name="ck_tp_valid_dates",
        ),
        CheckConstraint(
            "status IN (" +
            ", ".join(f"'{s}'" for s in TreatmentPlanStatus.all_values()) +
            ")",
            name="ck_tp_status",
        ),
        Index("ix_tp_patient", "patient_id"),
        Index("ix_tp_doctor", "doctor_id"),
        Index("ix_tp_status", "status"),
        Index("ix_tp_active_status", "is_active", "status"),
        Index("ix_tp_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<TreatmentPlan(id={self.id}, code={self.plan_code!r}, "
            f"status={self.status}, patient={self.patient_id})>"
        )


class TreatmentPlanItem(Base):
    """A single procedure line item within a treatment plan.

    Items are ordered by an explicit ``sequence_number`` (unique per plan).
    Tooth-level specificity, costs, and optional links to appointments and
    diagnoses are supported.
    """

    __tablename__ = "treatment_plan_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
    )

    procedure_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("procedures.id", ondelete="RESTRICT"),
        nullable=False,
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    tooth_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tooth_surface: Mapped[str | None] = mapped_column(
        String(TOOTH_SURFACE_MAX_LENGTH), nullable=True
    )
    quadrant: Mapped[str | None] = mapped_column(
        String(QUADRANT_MAX_LENGTH), nullable=True
    )
    arch: Mapped[str | None] = mapped_column(String(ARCH_MAX_LENGTH), nullable=True)

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    estimated_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    discount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    item_status: Mapped[TreatmentPlanItemStatus] = mapped_column(
        SAEnum(
            TreatmentPlanItemStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=20,
        ),
        nullable=False,
        default=TreatmentPlanItemStatus.PENDING,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )

    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patient_record_diagnoses.id", ondelete="SET NULL"),
        nullable=True,
    )

    plan: Mapped["TreatmentPlan"] = relationship(
        "TreatmentPlan",
        back_populates="items",
    )

    procedure: Mapped["Procedure"] = relationship(
        "Procedure",
        lazy="selectin",
    )

    appointment: Mapped["Appointment | None"] = relationship(
        "Appointment",
        foreign_keys=[appointment_id],
        lazy="selectin",
    )

    diagnosis: Mapped["PatientRecordDiagnosis | None"] = relationship(
        "PatientRecordDiagnosis",
        foreign_keys=[diagnosis_id],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            f"quantity >= {MIN_ITEM_QUANTITY} AND quantity <= {MAX_ITEM_QUANTITY}",
            name="ck_tpi_quantity",
        ),
        CheckConstraint("estimated_cost >= 0", name="ck_tpi_estimated_cost"),
        CheckConstraint("discount >= 0", name="ck_tpi_discount"),
        CheckConstraint(
            "discount <= estimated_cost * quantity",
            name="ck_tpi_discount_le_cost",
        ),
        CheckConstraint(
            "tooth_number IS NULL OR "
            f"(tooth_number BETWEEN {FDI_PERMANENT_MIN} AND {FDI_PERMANENT_MAX}) OR "
            f"(tooth_number BETWEEN {FDI_PRIMARY_MIN} AND {FDI_PRIMARY_MAX})",
            name="ck_tpi_tooth_number",
        ),
        CheckConstraint(
            "item_status IN (" +
            ", ".join(f"'{s}'" for s in TreatmentPlanItemStatus.all_values()) +
            ")",
            name="ck_tpi_item_status",
        ),
        UniqueConstraint("plan_id", "sequence_number", name="uq_tp_item_sequence"),
        Index("ix_tpi_plan", "plan_id"),
        Index("ix_tpi_plan_sequence", "plan_id", "sequence_number"),
        Index("ix_tpi_procedure", "procedure_id"),
        Index("ix_tpi_status", "plan_id", "item_status"),
        Index("ix_tpi_appointment", "appointment_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<TreatmentPlanItem(id={self.id}, plan={self.plan_id}, "
            f"seq={self.sequence_number}, procedure={self.procedure_id})>"
        )


class TreatmentPlanVersion(Base):
    """Immutable snapshot of a plan's items at a point in time.

    Created when an accepted/in-progress plan is modified. ``items_snapshot``
    is a JSONB document that is **never updated after insert** (see
    :class:`~app.modules.treatment.exceptions.VersionImmutable`). Its shape::

        {
            "version_number": int,
            "captured_at": "ISO-8601 UTC timestamp",
            "items": [
                {
                    "sequence_number": int,
                    "procedure_id": int,
                    "procedure_code": str,
                    "tooth_number": int | null,
                    "tooth_surface": str | null,
                    "quadrant": str | null,
                    "arch": str | null,
                    "quantity": int,
                    "estimated_cost": str,   # Decimal serialized as string
                    "discount": str,         # Decimal serialized as string
                    "item_status": str,
                    "notes": str | null
                },
                ...
            ]
        }

    Serialization is performed by the service layer (state machine / service);
    this model only stores the resulting mapping.
    """

    __tablename__ = "treatment_plan_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
    )

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    items_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )

    change_reason: Mapped[str] = mapped_column(
        String(CHANGE_REASON_MAX_LENGTH),
        nullable=False,
    )

    changed_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    plan: Mapped["TreatmentPlan"] = relationship(
        "TreatmentPlan",
        back_populates="versions",
    )

    changer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[changed_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            f"version_number >= {INITIAL_VERSION_NUMBER}",
            name="ck_tpv_version_number",
        ),
        # Database-level guarantee: a plan cannot contain duplicate version
        # numbers. The resulting unique index also serves (plan, version)
        # lookups; a separate non-unique index would be redundant.
        UniqueConstraint("plan_id", "version_number", name="uq_tp_version_number"),
    )

    def __repr__(self) -> str:
        return (
            f"<TreatmentPlanVersion(id={self.id}, plan={self.plan_id}, "
            f"version={self.version_number})>"
        )


class TreatmentPlanApproval(Base):
    """Doctor approval and patient acknowledgment for a plan (1:1)."""

    __tablename__ = "treatment_plan_approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    approved_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    patient_status: Mapped[PatientAcknowledgmentStatus] = mapped_column(
        SAEnum(
            PatientAcknowledgmentStatus,
            native_enum=False,
            create_constraint=False,
            values_callable=lambda ec: [e.value for e in ec],
            length=20,
        ),
        nullable=False,
        default=PatientAcknowledgmentStatus.PENDING,
    )

    patient_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    approval_notes: Mapped[str | None] = mapped_column(
        String(APPROVAL_NOTES_MAX_LENGTH),
        nullable=True,
    )

    plan: Mapped["TreatmentPlan"] = relationship(
        "TreatmentPlan",
        back_populates="approval",
    )

    approver: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[approved_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "patient_status IN (" +
            ", ".join(f"'{s}'" for s in PatientAcknowledgmentStatus.all_values()) +
            ")",
            name="ck_tpa_patient_status",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<TreatmentPlanApproval(id={self.id}, plan={self.plan_id}, "
            f"patient_status={self.patient_status})>"
        )
