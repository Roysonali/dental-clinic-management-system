from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
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
    from .prescription import PatientRecordPrescription


class PatientRecordPrescriptionItem(Base):
    """
    Represents a single medicine
    within a prescription.
    """

    __tablename__ = "patient_record_prescription_items"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    prescription_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "patient_record_prescriptions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    medicine_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    dosage: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    frequency: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    duration: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # ======================
    # Relationships
    # ======================

    prescription: Mapped["PatientRecordPrescription"] = relationship(
        "PatientRecordPrescription",
        back_populates="items",
    )

    __table_args__ = (
        Index("ix_patient_record_prescription_items_is_deleted", "is_deleted"),
    )
