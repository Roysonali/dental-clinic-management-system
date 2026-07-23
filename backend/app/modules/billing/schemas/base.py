"""Billing Module — Base schema classes.

Provides a common Pydantic v2 configuration baseline for every billing
request/response schema. Schema authors should inherit from one of the
specialized base classes rather than from :class:`pydantic.BaseModel` directly
so that module-wide conventions (extra-forbid, whitespace stripping, attribute
deserialization) remain consistent.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class BillingBaseModel(BaseModel):
    """Base schema with sensible defaults for the Billing module.

    All billing request/response schemas should inherit from this class
    or one of its specialized subclasses.

    Defaults
    --------
    * ``extra="forbid"`` — reject unexpected input fields early.
    * ``str_strip_whitespace=True`` — normalize leading/trailing whitespace.
    * ``validate_default=True`` — validate factory-supplied default values.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        validate_default=True,
    )


class BillingResponseSchema(BillingBaseModel):
    """Base for response DTOs materialized from ORM instances.

    Extends :class:`BillingBaseModel` with ``from_attributes=True`` so
    ``model_validate(obj)`` can deserialize SQLAlchemy model instances.

    Pydantic v2 replaces a child class's ``model_config`` entirely rather than
    merging it with the parent's configuration. Therefore, this subclass
    redeclares the inherited configuration and adds ``from_attributes=True``
    so that the final effective config includes both the base defaults and the
    response-specific setting.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
        validate_default=True,
    )


class BillingCreateSchema(BillingBaseModel):
    """Base for create-request DTOs.

    Inherits the default strict configuration. Domain schemas add their
    own required fields on top.
    """

    pass


class BillingUpdateSchema(BillingBaseModel):
    """Base for update-request DTOs.

    Intended for ``PATCH``/``PUT`` endpoints where every field should be
    optional. Domain schemas declare fields with ``default=None``.
    Response DTOs should inherit from :class:`BillingResponseSchema` instead.
    """

    pass


__all__ = [
    "BillingBaseModel",
    "BillingCreateSchema",
    "BillingResponseSchema",
    "BillingUpdateSchema",
]
