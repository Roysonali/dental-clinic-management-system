from __future__ import annotations

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
    Integer,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base
from app.core.constants import GenderEnum


class Patient(Base):
    """
    Represents a dental patient in the clinic management system.

    Stores demographic information, contact details, and audit
    metadata. Patient records are soft-deleted via is_active flag.
    """

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

    updated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        comment="Foreign key to the user who last modified this record",
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
        foreign_keys=[created_by],
        passive_deletes=True,
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        passive_deletes=True,
    )

    __table_args__ = (
        # patient_code has unique=True, which already creates a unique index.
        # An explicit Index would be redundant — omitted intentionally.

        Index(
            "ix_patients_phone",
            "primary_contact_number",
        ),

        # Partial index: only index non-null emails.
        # Saves space and write overhead since null-email lookups never occur.
        Index(
            "ix_patients_email",
            "email",
            postgresql_where=text("email IS NOT NULL"),
        ),

        # Descending index to match ORDER BY created_at DESC in list queries.
        # Allows PostgreSQL to read the index in the correct order without
        # performing a backward scan.
        Index(
            "ix_patients_created_at",
            created_at.desc(),
        ),

        # Composite index for name-based lookups (duplicate detection, search).
        # The leftmost prefix also covers last_name-only queries.
        Index(
            "ix_patients_name",
            "last_name",
            "first_name",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Patient(id={self.id}, "
            f"code={self.patient_code}, "
            f"name={self.first_name} {self.last_name}, "
            f"active={self.is_active})>"
        )