from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.patient_records.enums import RecordStatus

if TYPE_CHECKING:
    from .diagnosis import PatientRecordDiagnosis
    from .prescription import PatientRecordPrescription
    from .attachment import PatientRecordAttachment
    from .followup import PatientRecordFollowup
    from .audit_log import PatientRecordAuditLog


class PatientRecord(Base):
    """
    Stores the complete clinical record
    associated with a patient appointment.
    """

    __tablename__ = "patient_records"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    patient_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )

    appointment_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus),
        nullable=False,
        default=RecordStatus.DRAFT,
    )

    chief_complaint: Mapped[str | None] = mapped_column(Text)
    clinical_notes: Mapped[str | None] = mapped_column(Text)
    doctor_remarks: Mapped[str | None] = mapped_column(Text)
    treatment_recommendation: Mapped[str | None] = mapped_column(Text)

    systemic_diseases: Mapped[str | None] = mapped_column(Text)
    surgeries: Mapped[str | None] = mapped_column(Text)
    medications: Mapped[str | None] = mapped_column(Text)
    habits: Mapped[str | None] = mapped_column(Text)
    medical_alerts: Mapped[str | None] = mapped_column(Text)

    allergies: Mapped[str | None] = mapped_column(Text)
    dental_history: Mapped[str | None] = mapped_column(Text)

    is_finalized: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    diagnoses: Mapped[list["PatientRecordDiagnosis"]] = relationship(
        back_populates="patient_record",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    prescriptions: Mapped[list["PatientRecordPrescription"]] = relationship(
        back_populates="patient_record",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    attachments: Mapped[list["PatientRecordAttachment"]] = relationship(
        back_populates="patient_record",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    followups: Mapped[list["PatientRecordFollowup"]] = relationship(
        back_populates="patient_record",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    audit_logs: Mapped[list["PatientRecordAuditLog"]] = relationship(
        back_populates="patient_record",
        cascade="all, delete-orphan",
        lazy="selectin",
    )