import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base
from app.modules.doctors.constants import (
    MAX_CONSULTATION_DURATION,
    MIN_CONSULTATION_DURATION,
)


class Doctor(Base):
    """
    Doctor profile — 1:1 extension of the ``users`` table.

    Identity data (full_name, email) resides on the linked User record;
    this table stores practice-specific fields such as qualifications,
    consultation fee, schedule templates, and availability flags.
    """

    __tablename__ = "doctors"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    doctor_code = Column(
        String(20),
        nullable=False,
        unique=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )

    # Personal Information
    date_of_birth = Column(
        Date,
        nullable=True,
    )

    gender = Column(
        String(10),
        nullable=True,
    )

    # Contact Information
    primary_phone = Column(
        String(20),
        nullable=False,
    )

    address = Column(
        Text,
        nullable=True,
    )

    emergency_contact_name = Column(
        String(100),
        nullable=True,
    )

    emergency_contact_phone = Column(
        String(20),
        nullable=True,
    )

    # Professional Information
    qualification = Column(
        String(500),
        nullable=True,
    )

    registration_number = Column(
        String(100),
        nullable=True,
        unique=True,
    )

    years_of_experience = Column(
        Integer,
        nullable=True,
    )

    consultation_fee = Column(
        Numeric(10, 2, asdecimal=True),
        nullable=True,
    )

    consultation_duration = Column(
        Integer,
        nullable=True,
    )

    languages_known = Column(
        JSONB(none_as_null=True),
        nullable=True,
        default=list,
        comment="Array of language strings stored as PostgreSQL JSONB for queryability",
    )

    # Profile
    profile_photo_url = Column(
        String(500),
        nullable=True,
    )

    biography = Column(
        Text,
        nullable=True,
    )

    # Status Flags
    available_for_appointment = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    on_leave = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )

    is_active = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    # Audit Fields
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    # Relationships
    user = relationship(
        "User",
        foreign_keys=[user_id],
        passive_deletes=True,
        lazy="selectin",
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        passive_deletes=True,
        lazy="selectin",
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        passive_deletes=True,
        lazy="selectin",
    )

    specializations = relationship(
        "DoctorSpecialization",
        back_populates="doctor",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    schedules = relationship(
        "DoctorSchedule",
        back_populates="doctor",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "years_of_experience >= 0",
            name="ck_doctors_years_experience",
        ),
        CheckConstraint(
            "consultation_fee > 0",
            name="ck_doctors_fee_positive",
        ),
        CheckConstraint(
            (
                f"consultation_duration >= {MIN_CONSULTATION_DURATION} "
                f"AND consultation_duration <= {MAX_CONSULTATION_DURATION}"
            ),
            name="ck_doctors_duration_range",
        ),
        Index(
            "ix_doctors_active_available",
            "is_active",
            "available_for_appointment",
        ),
        Index(
            "ix_doctors_created_by",
            "created_by",
        ),
        Index(
            "ix_doctors_updated_by",
            "updated_by",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Doctor(id={self.id}, "
            f"code={self.doctor_code}, "
            f"user_id={self.user_id}, "
            f"active={self.is_active})>"
        )


class Specialization(Base):
    """
    Master list of dental specializations.

    Managed by administrators. Each specialization has a unique name
    and a short code for programmatic reference.
    """

    __tablename__ = "specializations"

    id = Column(
        Integer,
        primary_key=True,
    )

    name = Column(
        String(100),
        nullable=False,
        unique=True,
    )

    code = Column(
        String(20),
        nullable=False,
        unique=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    # Relationships
    doctor_assignments = relationship(
        "DoctorSpecialization",
        back_populates="specialization",
        passive_deletes=True,
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_specializations_active",
            "is_active",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Specialization(id={self.id}, "
            f"name={self.name!r}, "
            f"code={self.code!r}, "
            f"active={self.is_active})>"
        )


class DoctorSpecialization(Base):
    """
    Join table linking doctors to their specializations.

    Supports one primary specialization per doctor with optional
    secondary specializations. The partial unique index
    ``uq_doctor_primary_specialization`` enforces exactly one
    primary per doctor at the database level.
    """

    __tablename__ = "doctor_specializations"

    doctor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        primary_key=True,
    )

    specialization_id = Column(
        Integer,
        ForeignKey("specializations.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    is_primary = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    certification_date = Column(
        Date,
        nullable=True,
    )

    # Relationships
    doctor = relationship(
        "Doctor",
        back_populates="specializations",
        lazy="selectin",
    )

    specialization = relationship(
        "Specialization",
        back_populates="doctor_assignments",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_ds_specialization",
            "specialization_id",
        ),
        Index(
            "ix_ds_doctor_specialization",
            "doctor_id",
            "specialization_id",
        ),
        Index(
            "uq_doctor_primary_specialization",
            "doctor_id",
            unique=True,
            postgresql_where=text("is_primary = true"),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<DoctorSpecialization(doctor_id={self.doctor_id}, "
            f"spec_id={self.specialization_id}, "
            f"primary={self.is_primary})>"
        )


class DoctorSchedule(Base):
    """
    Weekly recurring availability template for a doctor.

    Defines default working hours per day-of-week. This is NOT an
    appointment calendar — Appointments own actual booked slots.
    """

    __tablename__ = "doctor_schedules"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    doctor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
    )

    day_of_week = Column(
        Integer,
        nullable=False,
        comment="0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday",
    )

    start_time = Column(
        Time,
        nullable=False,
        comment="Work day start time (e.g. 09:00)",
    )

    end_time = Column(
        Time,
        nullable=False,
        comment="Work day end time (e.g. 17:00)",
    )

    is_active = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    # Relationships
    doctor = relationship(
        "Doctor",
        back_populates="schedules",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "day_of_week >= 0 AND day_of_week <= 5",
            name="ck_schedule_day_of_week",
        ),
        CheckConstraint(
            "end_time > start_time",
            name="ck_schedule_end_after_start",
        ),
        Index(
            "ix_schedule_doctor_day",
            "doctor_id",
            "day_of_week",
        ),
        Index(
            "ix_schedule_active",
            "doctor_id",
            "is_active",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<DoctorSchedule(id={self.id}, "
            f"doctor_id={self.doctor_id}, "
            f"day={self.day_of_week}, "
            f"active={self.is_active})>"
        )
