from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base

if TYPE_CHECKING:
    from .patient_record import PatientRecord


class PatientRecordFollowup(Base):
    __tablename__ = "patient_record_followups"

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

    followup_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(Text)

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
        back_populates="followups",
    )

    __table_args__ = (
        Index("ix_patient_record_followups_is_deleted", "is_deleted"),
        Index("ix_patient_record_followups_followup_date", "followup_date"),
    )