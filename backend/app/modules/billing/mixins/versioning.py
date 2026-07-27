"""Billing Module — Versioning mixin.

Declares optimistic-locking and versioning columns shared by billing
aggregate roots. Implements:

* **Optimistic concurrency** via an integer ``version`` column that services
  increment on every mutating save.
* **Document versioning** via a ``doc_version`` column recording the logical
  revision of an issued document.

The mixin uses ``mapped_column`` with ``Mapped[]`` annotations so SQLAlchemy
treats ``version`` and ``doc_version`` as persistent columns. No SQL is
emitted on import.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.billing.constants import INITIAL_INVOICE_VERSION_NUMBER

if TYPE_CHECKING:
    pass  # Reserved for future type-checking imports


class VersioningMixin:
    """Adds optimistic-lock and document-version columns to a billing model.

    Columns:
        version: Optimistic-lock counter (increment on every update).
        doc_version: Logical document revision, starting at
            :data:`INITIAL_INVOICE_VERSION_NUMBER`.
    """

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=INITIAL_INVOICE_VERSION_NUMBER,
        comment="Optimistic-lock version counter.",
    )

    doc_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=INITIAL_INVOICE_VERSION_NUMBER,
        comment="Logical document revision number.",
    )

    @staticmethod
    def next_version(current: int) -> int:
        """Return the next optimistic-lock version for ``current``.

        Args:
            current: The current version value.

        Returns:
            ``current + 1`` (or the initial value when ``None``/``0``).
        """
        if current is None or current < 1:
            return INITIAL_INVOICE_VERSION_NUMBER
        return current + 1

    @staticmethod
    def next_doc_version(current: int) -> int:
        """Return the next logical document revision for ``current``."""
        if current is None or current < 1:
            return INITIAL_INVOICE_VERSION_NUMBER
        return current + 1


__all__ = [
    "VersioningMixin",
    "INITIAL_INVOICE_VERSION_NUMBER",
]
