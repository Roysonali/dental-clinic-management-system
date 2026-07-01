from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base

if TYPE_CHECKING:
    from .patient_record import PatientRecord


class PatientRecordAuditLog(Base):
    __tablename__ = "patient_record_audit_logs"

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

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    old_value: Mapped[str | None] = mapped_column(Text)

    new_value: Mapped[str | None] = mapped_column(Text)

    performed_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    patient_record: Mapped["PatientRecord"] = relationship(
        back_populates="audit_logs",
    )