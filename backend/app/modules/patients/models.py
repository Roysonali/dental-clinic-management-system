import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Enum,
    Text,
    Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base
from app.core.constants import GenderEnum


class Patient(Base):
    __tablename__ = "patients"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    patient_code = Column(
        String(20),
        nullable=False,
        unique=True,
    )

    first_name = Column(
        String(100),
        nullable=False,
    )

    middle_name = Column(
        String(100),
        nullable=True,
    )

    last_name = Column(
        String(100),
        nullable=False,
    )

    date_of_birth = Column(
        Date,
        nullable=False,
    )

    gender = Column(
        Enum(
            GenderEnum,
            name="gender_enum",
        ),
        nullable=False,
    )

    primary_contact_number = Column(
        String(30),
        nullable=False,
    )

    emergency_contact_number = Column(
        String(30),
        nullable=True,
    )

    email = Column(
        String(255),
        nullable=True,
    )

    address = Column(
        Text,
        nullable=True,
    )

    remarks = Column(
        Text,
        nullable=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_by = Column(
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

    creator = relationship(
        "User",
        passive_deletes=True,
    )

    __table_args__ = (
        Index(
            "ix_patients_patient_code",
            "patient_code",
        ),

        Index(
            "ix_patients_phone",
            "primary_contact_number",
        ),

        Index(
            "ix_patients_email",
            "email",
        ),

        Index(
            "ix_patients_created_at",
            "created_at",
        ),

        Index(
            "ix_patients_name",
            "last_name",
            "first_name",
        ),
    )