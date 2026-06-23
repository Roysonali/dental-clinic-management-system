# app/modules/appointments/model.py

from sqlalchemy import (
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
    func,
)

from sqlalchemy.orm import relationship

from app.database.base import Base

from app.modules.appointments.enums import (
    AppointmentStatus,
    AppointmentType,
)


class Appointment(Base):
    """
    Appointment entity.

    Stores scheduling information only.
    Business validation belongs elsewhere.
    """

    __tablename__ = "appointments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    appointment_number = Column(
        String(30),
        nullable=False,
        unique=True,
    )

    patient_id = Column(
        Integer,
        ForeignKey(
            "patients.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    dentist_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    appointment_date = Column(
        Date,
        nullable=False,
        index=True,
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
        ),
        nullable=False,
    )

    status = Column(
        Enum(
            AppointmentStatus,
            name="appointment_status_enum",
        ),
        nullable=False,
        default=AppointmentStatus.SCHEDULED,
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
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    updated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
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
        back_populates="appointments",
    )

    dentist = relationship(
        "User",
        foreign_keys=[dentist_id],
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
    )

    __table_args__ = (
        Index(
            "idx_appointment_schedule",
            "dentist_id",
            "appointment_date",
            "start_time",
        ),
        Index(
            "idx_patient_schedule",
            "patient_id",
            "appointment_date",
        ),
    )