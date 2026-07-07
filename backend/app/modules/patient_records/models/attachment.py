from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.patient_records.enums import AttachmentType

if TYPE_CHECKING:
    from .patient_record import PatientRecord


class PatientRecordAttachment(Base):
    __tablename__ = "patient_record_attachments"

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

    attachment_type: Mapped[AttachmentType] = mapped_column(
        Enum(AttachmentType),
        nullable=False,
    )

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    file_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    file_size: Mapped[int | None] = mapped_column(
        BigInteger,
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
        back_populates="attachments",
    )

    __table_args__ = (
        Index("ix_patient_record_attachments_is_deleted", "is_deleted"),
        Index("ix_patient_record_attachments_type", "attachment_type"),
    )