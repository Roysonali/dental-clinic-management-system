from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
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

    # The index is declared via index=True above.
    # The explicit Index() in __table_args__ for performed_by and action
    # covers additional query patterns.

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    old_value: Mapped[str | None] = mapped_column(Text)

    new_value: Mapped[str | None] = mapped_column(Text)

    performed_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    patient_record: Mapped["PatientRecord"] = relationship(
        back_populates="audit_logs",
    )

    __table_args__ = (
        Index("ix_patient_record_audit_logs_performed_by", "performed_by"),
        Index("ix_patient_record_audit_logs_action", "action"),
    )