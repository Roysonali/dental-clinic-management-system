from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Enum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.modules.patient_records.enums import DiagnosisType

if TYPE_CHECKING:
    from .patient_record import PatientRecord


class PatientRecordDiagnosis(Base):
    __tablename__ = "patient_record_diagnoses"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    patient_record_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patient_records.id"),
        nullable=False,
        index=True,
    )

    diagnosis_type: Mapped[DiagnosisType] = mapped_column(
        Enum(DiagnosisType),
        nullable=False,
    )

    diagnosis_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
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

    patient_record: Mapped["PatientRecord"] = relationship(
        "PatientRecord",
        back_populates="diagnoses",
    )

    __table_args__ = (
        Index("ix_patient_record_diagnoses_is_deleted", "is_deleted"),
    )

