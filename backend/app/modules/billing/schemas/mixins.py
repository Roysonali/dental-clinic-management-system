"""Billing Module — Schema mixins.

Pure field-group mixins that inherit from :class:`pydantic.BaseModel` and
define **no** ``model_config``. They are designed to be combined with one of
the base schema classes (which supplies the ``ConfigDict``) via Python's
method-resolution order.

Because these mixins do not declare ``model_config``, Pydantic v2 does not
override the configuration of the primary schema base. This makes them safe
to compose with ``BillingResponseSchema``, ``BillingCreateSchema``, etc.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field


class TimestampMixin:
    """Mixin adding standard creation/modification timestamps.

    Combine with a base schema that provides ``from_attributes=True`` when
    mapping from SQLAlchemy models.
    """

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the record was created (UTC).",
    )
    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the record was last modified (UTC).",
    )


class AuditMixin:
    """Mixin adding audit user-tracking fields.

    Note: ``created_by`` and ``updated_by`` are ``int`` because
    ``auth.users.id`` is an INTEGER primary key (not UUID).
    """

    created_by: int = Field(
        ...,
        title="Created By",
        description="ID of the user who created the record (auth.users.id).",
        examples=[1],
    )
    updated_by: int | None = Field(
        default=None,
        title="Updated By",
        description="ID of the user who last modified the record (auth.users.id).",
        examples=[1],
    )


class StatusTransitionMixin:
    """Mixin for status-transition metadata."""

    from_status: str = Field(
        ...,
        title="From Status",
        description="Previous status value.",
        examples=["draft"],
    )
    to_status: str = Field(
        ...,
        title="To Status",
        description="New status value.",
        examples=["issued"],
    )


class DocumentNumberingMixin:
    """Mixin for document-numbering fields."""

    document_number: str = Field(
        ...,
        title="Document Number",
        description="Formatted document number (e.g. ``INV-00001``).",
    )
    document_type: str = Field(
        ...,
        title="Document Type",
        description="Billing document category.",
    )


__all__ = [
    "AuditMixin",
    "DocumentNumberingMixin",
    "StatusTransitionMixin",
    "TimestampMixin",
]
