"""Billing Module — Audit mixin.

Provides creation/modification audit columns and an append-only audit-event
helper shared by all billing financial records. Implements FI-AUD-001
(creation user + timestamp) and FI-AUD-002 / FI-AUD-003 (append-only status
change history with old/new values and reason).

The mixin declares columns on the consuming declarative model and exposes
factory methods to build audit payloads. It performs **no** database access and
emits no SQL at import time.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    DateTime,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.billing.constants import (
    AUDIT_ACTION_MAX_LENGTH,
    AUDIT_REASON_MAX_LENGTH,
)


class AuditMixin:
    """Adds creation/modification audit columns to a billing model.

    Columns:
        created_by: UUID of the user who created the row (FI-AUD-001).
        created_at: Server-default creation timestamp (UTC).
        updated_by: UUID of the last user to modify the row.
        updated_at: Server-default modification timestamp (UTC), auto-updated.
    """

    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
        comment="User who created the record (FI-AUD-001).",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Creation timestamp (UTC).",
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
        comment="User who last modified the record.",
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last modification timestamp (UTC).",
    )


class AuditEventBuilder:
    """Builds append-only audit event payloads for billing records.

    Stateless helper used by services to construct consistent audit entries
    (status changes, price overrides, payments). It does not persist anything.
    """

    @staticmethod
    def status_change(
        action: str,
        from_status: str,
        to_status: str,
        changed_by: uuid.UUID,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Build a status-change audit payload (FI-AUD-002).

        Args:
            action: Audit action verb (see :class:`AuditAction`).
            from_status: Previous status value.
            to_status: New status value.
            changed_by: User performing the change.
            reason: Optional free-text reason (capped to policy length).

        Returns:
            A serializable audit-event dict.
        """
        return {
            "action": action,
            "from_status": from_status,
            "to_status": to_status,
            "changed_by": str(changed_by),
            "reason": (reason or "")[:AUDIT_REASON_MAX_LENGTH] or None,
            "occurred_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    @staticmethod
    def price_override(
        action: str,
        original_value: str,
        new_value: str,
        changed_by: uuid.UUID,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Build a price-override audit payload (FI-AUD-004).

        Args:
            action: Audit action verb (``price_overridden``).
            original_value: Original price/rate as a string.
            new_value: Overridden price/rate as a string.
            changed_by: User performing the override.
            reason: Optional reason (capped to policy length).

        Returns:
            A serializable audit-event dict.
        """
        return {
            "action": action,
            "original_value": original_value,
            "new_value": new_value,
            "changed_by": str(changed_by),
            "reason": (reason or "")[:AUDIT_REASON_MAX_LENGTH] or None,
            "occurred_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }


__all__ = [
    "AuditMixin",
    "AuditEventBuilder",
]
