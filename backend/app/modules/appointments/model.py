import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
)

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base

from app.modules.appointments.enums import (
    AppointmentStatus,
    AppointmentType,
)


class Appointment(Base):
    """
    Represents a dental appointment.

    This model stores scheduling information only.

    Business rules such as:
    - working hour validation
    - overlap detection
    - active patient checks
    - active dentist checks
    - status transitions

    are intentionally implemented outside the model.
    """

    __tablename__ = "appointments"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    appointment_number = Column(
        String(20),
        nullable=False,
        unique=True,
    )

    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "patients.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    dentist_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    appointment_date = Column(
        Date,
        nullable=False,
    )

    start_time = Column(
        Time,
        nullable=False,
    )

    end_time = Column(
        Time,
        nullable=False,
    )

    duration_minutes = Column(
        Integer,
        nullable=False,
    )

    appointment_type = Column(
        Enum(
            AppointmentType,
            name="appointment_type_enum",
            values_callable=lambda ec: [m.value for m in ec],
        ),
        nullable=False,
    )

    status = Column(
        Enum(
            AppointmentStatus,
            name="appointment_status_enum",
            values_callable=lambda ec: [m.value for m in ec],
        ),
        nullable=False,
        server_default=AppointmentStatus.SCHEDULED.value,
    )

    reason_for_visit = Column(
        String(500),
        nullable=False,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    updated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    patient = relationship(
        "Patient",
        passive_deletes=True,
    )

    dentist = relationship(
        "User",
        foreign_keys=[dentist_id],
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint(
            "duration_minutes > 0",
            name="ck_appointments_duration_positive",
        ),

        CheckConstraint(
            "end_time > start_time",
            name="ck_appointments_end_after_start",
        ),

        Index(
            "ix_appointments_date",
            "appointment_date",
        ),

        Index(
            "ix_appointments_dentist_schedule",
            "dentist_id",
            "appointment_date",
            "start_time",
        ),

        Index(
            "ix_appointments_patient_schedule",
            "patient_id",
            "appointment_date",
            "start_time",
        ),

        Index(
            "ix_appointments_status",
            "status",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Appointment("
            f"id={self.id}, "
            f"number={self.appointment_number}, "
            f"status={self.status}"
            f")>"
        )