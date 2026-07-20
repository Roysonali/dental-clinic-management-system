"""Billing Module — Versioning mixin.

Provides optimistic-locking and versioning **helper methods** shared by
billing aggregate roots. Implements:

* **Optimistic concurrency** helpers: ``next_version()`` returns the next
  integer ``version`` counter that services increment on every mutating save
  (FI-AUD / concurrency safety).
* **Document versioning** helpers: ``next_doc_version()`` returns the next
  logical revision of an issued document (ADR / version snapshots).

The mixin provides default initial values and helper methods **only**. Models
that include this mixin **must** declare their own ``version`` and
``doc_version`` mapped columns using ``Mapped[int] = mapped_column(...)``.
The mixin does **not** emit SQLAlchemy column declarations at import time.
"""

from __future__ import annotations

from app.modules.billing.constants import INITIAL_INVOICE_VERSION_NUMBER


class VersioningMixin:
    """Provides optimistic-lock and document-version helpers for billing models.

    Models that include this mixin **must** declare their own ``version`` and
    ``doc_version`` mapped columns. The mixin only provides default initial
    values and helper methods (``next_version``, ``next_doc_version``).

    Class Attributes:
        version: Default initial value (``1``). Model must declare a
            ``Mapped[int]`` column for this.
        doc_version: Default initial value (``1``). Model must declare a
            ``Mapped[int]`` column for this.
    """

    version: int = INITIAL_INVOICE_VERSION_NUMBER  # type: ignore[assignment]
    doc_version: int = INITIAL_INVOICE_VERSION_NUMBER  # type: ignore[assignment]

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
