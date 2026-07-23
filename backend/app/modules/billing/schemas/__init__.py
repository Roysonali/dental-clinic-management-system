"""Billing Module — Schema package.

Exports all reusable DTOs, base classes, and schema infrastructure for the
Billing public API, including domain-specific schemas for Invoice,
Payment, Receipt, and Refund aggregates.
"""

from __future__ import annotations

from app.modules.billing.schemas import base, common, invoice, invoice_item, metadata, mixins, pagination, payment, receipt, refund, summaries, types, validators

__all__ = [
    # Base classes
    "base",
    # Common DTOs
    "common",
    # Domain schemas
    "invoice",
    "invoice_item",
    # Metadata envelopes
    "metadata",
    # Schema mixins
    "mixins",
    # Pagination
    "pagination",
    # Domain schemas
    "payment",
    # Domain schemas
    "receipt",
    # Domain schemas
    "refund",
    # Shared summary DTOs
    "summaries",
    # Type aliases
    "types",
    # Shared validators
    "validators",
]
