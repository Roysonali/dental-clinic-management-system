"""Appointment sequence — atomic per-day number generation.

Stores one row per date prefix (e.g. ``APT-20260830``). The current_value
is incremented under a row-level lock (``SELECT ... FOR UPDATE``) to
prevent duplicate appointment numbers under concurrent requests.

This mirrors the billing ``DocumentSequence`` pattern but is simplified
because appointment numbers reset daily rather than being global counters.
"""

from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class AppointmentSequence(Base):
    """Per-day counter for appointment number generation.

    One row per date prefix (``APT-YYYYMMDD``). The ``current_value``
    column holds the last-assigned sequence number for that day.
    """

    __tablename__ = "appointment_sequences"

    date_prefix: Mapped[str] = mapped_column(
        String(12),
        primary_key=True,
        comment="Date prefix, e.g. 'APT-20260830'.",
    )

    current_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Last assigned sequence number for this date.",
    )

    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "current_value >= 0",
            name="ck_appointment_seq_current_nonneg",
        ),
        Index(
            "ix_appointment_sequences_updated_at",
            "updated_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<AppointmentSequence("
            f"prefix={self.date_prefix!r}, "
            f"current={self.current_value})>"
        )
