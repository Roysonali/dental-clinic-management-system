"""DocumentSequenceRepository — persistence primitives for document numbering.

This repository manages the ``DocumentSequence`` aggregate root and its child
entity ``SequenceConsumptionLog``. Per the sprint requirement, only persistence
primitives are implemented here: fetch, lock, increment, and persist consumption
log. The sequence reservation workflow and business validation are **not**
implemented here — they belong to the service / numbering utility layer.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_document_type``, ``exists``,
  ``increment``.
* **Row-locking**: ``get_for_update``.
* **Consumption log persistence**: ``persist_consumption_log``,
  ``get_recent_consumption_logs``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` but never ``commit()`` / ``rollback()``. Logging is query-level
only; business events are logged by the service layer.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.billing.models import (
    DocumentSequence,
    SequenceConsumptionLog,
)

logger = logging.getLogger(__name__)


class DocumentSequenceRepository:
    """Data access layer for ``DocumentSequence`` and ``SequenceConsumptionLog``.

    Provides persistence primitives for sequential number generation (ADR-003).
    Does not implement reservation workflows or business validation.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------------------------------------------------------------- create
    def create(self, document_sequence: DocumentSequence) -> DocumentSequence:
        """Persist a new document sequence and return the managed instance.

        No ``refresh()`` is needed: the composite primary key is provided
        client-side and ``DocumentSequence`` has no server-defaulted columns
        that require a round-trip. The service layer owns the transaction.
        """
        self.db.add(document_sequence)
        self.db.flush()
        return document_sequence

    # ----------------------------------------------------------------- read
    def get_by_document_type(self, document_type: str) -> Optional[DocumentSequence]:
        """Fetch a document sequence by its primary key (document type)."""
        return self.db.get(DocumentSequence, document_type)

    def get_for_update(self, document_type: str) -> Optional[DocumentSequence]:
        """Fetch a document sequence with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent increment of the same sequence. The caller must
        ensure the sequence exists before attempting to increment.

        Args:
            document_type: The document type key (e.g. ``'invoice'``).

        Returns:
            The locked DocumentSequence entity, or None if not found.
        """
        stmt = (
            select(DocumentSequence)
            .where(DocumentSequence.document_type == document_type)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, document_type: str) -> bool:
        """Return ``True`` if a document sequence for the given type exists."""
        stmt = (
            select(DocumentSequence.document_type)
            .where(DocumentSequence.document_type == document_type)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    # -------------------------------------------------------------- mutation
    def increment(self, document_type: str) -> Optional[DocumentSequence]:
        """Increment the sequence value for a document type.

        This is a persistence primitive — it updates ``current_value`` and
        flushes. The caller is responsible for ensuring the sequence exists
        and for any business validation (e.g. not exceeding
        ``MAX_SEQUENCE_NUMBER``).

        Args:
            document_type: The document type key to increment.

        Returns:
            The updated DocumentSequence, or None if the sequence does not
            exist.
        """
        sequence = self.get_for_update(document_type)
        if sequence is None:
            return None
        sequence.current_value += 1
        self.db.flush()
        return sequence

    # -------------------------------------------- consumption log persistence
    def persist_consumption_log(
        self, consumption_log: SequenceConsumptionLog
    ) -> SequenceConsumptionLog:
        """Persist a new sequence consumption log entry.

        The caller (service) is responsible for setting
        ``consumption_log.document_type``, ``consumption_log.number_assigned``,
        and ``consumption_log.reserved_by`` — this is a persistence operation
        only. Flushes; no commit; no ``refresh()`` (the log has a
        client-side UUID PK).
        """
        self.db.add(consumption_log)
        self.db.flush()
        return consumption_log

    def get_recent_consumption_logs(
        self,
        document_type: str,
        limit: int = 20,
    ) -> list[SequenceConsumptionLog]:
        """Return recent consumption log entries for a document type.

        Intended for audit and gap-tracking. Results are ordered by
        reservation time descending (most recent first).

        Args:
            document_type: The document type key to filter by.
            limit: Maximum number of log entries to return (clamped to >= 1).

        Returns:
            List of ``SequenceConsumptionLog`` entities.
        """
        if limit < 1:
            limit = 20
        stmt = (
            select(SequenceConsumptionLog)
            .where(SequenceConsumptionLog.document_type == document_type)
            .order_by(SequenceConsumptionLog.reserved_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def count(self) -> int:
        """Count all document sequences."""
        stmt = select(func.count()).select_from(DocumentSequence)
        return self.db.execute(stmt).scalar() or 0
