"""Billing Module — BillingAuditLog model.

Append-only audit trail for all billing financial records (FI-AUD-001 through
FI-AUD-004). Captures creation, status changes, price overrides, payments,
refunds, and credit applications across all billing aggregates.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.base import Base
from app.modules.billing.constants import (
    AUDIT_ACTION_MAX_LENGTH,
    AUDIT_REASON_MAX_LENGTH,
)
from app.modules.billing.enums import AuditAction

if TYPE_CHECKING:
    from app.modules.auth.models import User


class BillingAuditLog(Base):
    """Append-only audit event for billing aggregates.

    Records creation, status changes, price overrides, payments, refunds,
    and credit applications. Never modified after insert (FI-AUD-003).
    """

    __tablename__ = "billing_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Billing entity type (e.g. 'invoice', 'payment', 'credit_note').",
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        comment="ID of the billing entity being audited.",
    )

    action: Mapped[str] = mapped_column(
        String(AUDIT_ACTION_MAX_LENGTH),
        nullable=False,
        comment="Audit action verb (see AuditAction enum).",
    )

    old_value: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Previous state snapshot (JSON, NULL for creation events).",
    )

    new_value: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="New state snapshot (JSON, NULL for deletion events).",
    )

    changed_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Free-text reason for the change.",
    )

    changer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[changed_by],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_billing_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_billing_audit_logs_action", "action"),
        Index("ix_billing_audit_logs_changed_by", "changed_by"),
        Index("ix_billing_audit_logs_changed_at", "changed_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<BillingAuditLog(id={self.id}, "
            f"entity={self.entity_type}:{self.entity_id}, "
            f"action={self.action!r})>"
        )
