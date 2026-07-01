from uuid import uuid4
from sqlalchemy import (
    ForeignKey,
    Text,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.modules.patient_records.enums import DiagnosisType


from typing import TYPE_CHECKING
from sqlalchemy.orm import relationship

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

    diagnosis_type: Mapped[DiagnosisType]= mapped_column(
        Enum(DiagnosisType),
        nullable=False,
    )

    diagnosis: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    patient_record: Mapped["PatientRecord"] = relationship(
    "PatientRecord",
    back_populates="diagnoses",
    )

