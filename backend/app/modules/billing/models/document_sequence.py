"""Billing Module — DocumentSequence and SequenceConsumptionLog models.

DocumentSequence is a utility root that manages sequential number generation
per document type (ADR-003). SequenceConsumptionLog is a child entity that
audits every number reservation, enabling gap tracking and explainability to
auditors.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.billing.constants import (
    SEQUENCE_CONSUMPTION_STATUS_MAX_LENGTH,
    SEQUENCE_DOCUMENT_TYPE_MAX_LENGTH,
)
from app.modules.billing.mixins.audit import AuditMixin

if TYPE_CHECKING:
    from app.modules.auth.models import User


class SequenceConsumptionLog(Base):
    """Audit record of every number reserved from a sequence (ADR-003).

    Records the document type, assigned number, user, timestamp, and the
    resulting document ID (or NULL if creation failed). This enables gap
    tracking and audit explainability.
    """

    __tablename__ = "sequence_consumption_log"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    document_type: Mapped[str] = mapped_column(
        String(SEQUENCE_DOCUMENT_TYPE_MAX_LENGTH),
        ForeignKey("document_sequences.document_type", ondelete="CASCADE"),
        nullable=False,
        comment="Which sequence was consumed.",
    )

    number_assigned: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="The reserved sequence value.",
    )

    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the number was reserved.",
    )

    reserved_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="User who triggered the reservation.",
    )

    document_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
        comment="Created document ID (NULL if creation failed).",
    )

    status: Mapped[str] = mapped_column(
        String(SEQUENCE_CONSUMPTION_STATUS_MAX_LENGTH),
        nullable=False,
        default="completed",
        comment="'completed', 'failed', or 'rolled_back'.",
    )

    sequence: Mapped["DocumentSequence"] = relationship(
        "DocumentSequence",
        back_populates="consumption_logs",
        lazy="selectin",
    )

    reserver: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reserved_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "number_assigned >= 1",
            name="ck_sequence_consumption_number_positive",
        ),
        CheckConstraint(
            "status IN ('completed', 'failed', 'rolled_back')",
            name="ck_sequence_consumption_status",
        ),
        Index("ix_sequence_consumption_document_type", "document_type"),
        Index("ix_sequence_consumption_reserved_by", "reserved_by"),
        Index("ix_sequence_consumption_reserved_at", "reserved_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<SequenceConsumptionLog(id={self.id}, "
            f"type={self.document_type}, number={self.number_assigned})>"
        )


class DocumentSequence(Base):
    """Manages sequential number generation per document type (ADR-003).

    One row per document type (invoice, receipt, credit_note). Supports
    future extension for multi-branch, insurance, payment gateway, GST,
    and multi-currency without schema redesign via the flexible document_type
    key and additional config columns if needed.
    """

    __tablename__ = "document_sequences"

    document_type: Mapped[str] = mapped_column(
        String(SEQUENCE_DOCUMENT_TYPE_MAX_LENGTH),
        primary_key=True,
        comment="Document type key (e.g. 'invoice', 'receipt', 'credit_note').",
    )

    prefix: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Display prefix, e.g. 'INV-', 'RCT-', 'CN-'.",
    )

    current_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Current maximum assigned sequence value.",
    )

    min_digits: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
        comment="Minimum zero-pad width for the sequence part.",
    )

    start_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Initial sequence value (for resets or new branches).",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last increment timestamp.",
    )

    updated_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="User who last triggered an increment.",
    )

    updater: Mapped["User"] = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="selectin",
    )

    consumption_logs: Mapped[list["SequenceConsumptionLog"]] = relationship(
        "SequenceConsumptionLog",
        back_populates="sequence",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="SequenceConsumptionLog.reserved_at",
    )

    __table_args__ = (
        CheckConstraint(
            "current_value >= 0",
            name="ck_document_sequence_current_nonneg",
        ),
        CheckConstraint(
            "min_digits >= 1",
            name="ck_document_sequence_min_digits",
        ),
        CheckConstraint(
            "start_value >= 1",
            name="ck_document_sequence_start_value",
        ),
        CheckConstraint(
            "prefix ~ '^[A-Z-]+$'",
            name="ck_document_sequence_prefix_format",
        ),
        Index("ix_document_sequences_updated_at", "updated_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<DocumentSequence(type={self.document_type}, "
            f"prefix={self.prefix!r}, current={self.current_value})>"
        )
