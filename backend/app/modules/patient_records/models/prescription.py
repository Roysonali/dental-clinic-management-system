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
    from .prescription_item import PatientRecordPrescriptionItem
    from app.modules.auth.models import User


class PatientRecordPrescription(Base):
    """
    Represents a prescription document issued
    during a patient visit.

    One prescription can contain multiple medicines.
    """

    __tablename__ = "patient_record_prescriptions"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    patient_record_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "patient_records.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    prescribed_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    prescribed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    notes: Mapped[str | None] = mapped_column(
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

    patient_record: Mapped["PatientRecord"] = relationship(
        "PatientRecord",
        back_populates="prescriptions",
    )

    prescriber: Mapped["User"] = relationship(
        "User",
        foreign_keys=[prescribed_by],
    )

    items: Mapped[list["PatientRecordPrescriptionItem"]] = relationship(
        "PatientRecordPrescriptionItem",
        back_populates="prescription",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def medicine_count(self) -> int:
        return len(self.items) if self.items else 0
    
    __table_args__ = (
        Index("ix_patient_record_prescriptions_is_deleted", "is_deleted"),
    )
