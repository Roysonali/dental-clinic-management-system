"""Billing Module — Number formatting utilities.

Pure functions for formatting sequential financial document numbers per
ADR-003 (Sequential Numbering Strategy). Each document type (invoice, receipt,
credit note) owns an independent, gap-tracked, prefix-qualified number series.

These helpers are deterministic and side-effect free: they format a numeric
``current_value`` into its display string but do **not** reserve or persist
numbers (that is the repository/sequence layer's responsibility).
"""

from __future__ import annotations

import logging
from typing import Mapping

from app.modules.billing.constants import (
    DOCUMENT_NUMBER_MIN_DIGITS,
    DOCUMENT_NUMBER_PREFIXES,
)
from app.modules.billing.enums import DocumentType

logger = logging.getLogger(__name__)


def format_sequence_number(
    document_type: DocumentType | str,
    current_value: int,
    *,
    prefix: str | None = None,
    min_digits: int | None = None,
) -> str:
    """Format a sequential value into its display document number.

    Example::

        format_sequence_number(DocumentType.INVOICE, 42)  -> "INV-00042"

    Args:
        document_type: The document type (enum or its string value).
        current_value: The 1-based sequence value to format.
        prefix: Optional explicit prefix; defaults to the per-type prefix.
        min_digits: Optional zero-pad width; defaults to the per-type width.

    Returns:
        The formatted document number, e.g. ``"INV-00042"``.

    Raises:
        ValueError: If ``current_value`` is not a positive integer.
    """
    if current_value is None or current_value < 1:
        raise ValueError(
            f"current_value must be a positive integer (got {current_value!r})"
        )

    if isinstance(document_type, DocumentType):
        type_key = document_type
    else:
        type_key = DocumentType(document_type)

    resolved_prefix = prefix if prefix is not None else DOCUMENT_NUMBER_PREFIXES[type_key]
    resolved_width = (
        min_digits if min_digits is not None else DOCUMENT_NUMBER_MIN_DIGITS[type_key]
    )

    sequence = str(current_value).zfill(resolved_width)
    return f"{resolved_prefix}{sequence}"


def format_invoice_number(
    current_value: int,
    *,
    prefix: str | None = None,
    min_digits: int | None = None,
) -> str:
    """Format an invoice sequence value (e.g. ``"INV-00001"``)."""
    return format_sequence_number(
        DocumentType.INVOICE,
        current_value,
        prefix=prefix,
        min_digits=min_digits,
    )


def format_receipt_number(
    current_value: int,
    *,
    prefix: str | None = None,
    min_digits: int | None = None,
) -> str:
    """Format a receipt sequence value (e.g. ``"RCT-00001"``)."""
    return format_sequence_number(
        DocumentType.RECEIPT,
        current_value,
        prefix=prefix,
        min_digits=min_digits,
    )


def format_credit_note_number(
    current_value: int,
    *,
    prefix: str | None = None,
    min_digits: int | None = None,
) -> str:
    """Format a credit note sequence value (e.g. ``"CN-00001"``)."""
    return format_sequence_number(
        DocumentType.CREDIT_NOTE,
        current_value,
        prefix=prefix,
        min_digits=min_digits,
    )


def parse_sequence_number(
    document_type: DocumentType | str,
    document_number: str,
) -> int:
    """Extract the integer value from a formatted document number.

    The parsed value is validated against the expected prefix and digit width.
    Useful for audits and for re-deriving a sequence pointer.

    Args:
        document_type: The document type (enum or string value).
        document_number: A formatted number, e.g. ``"INV-00042"``.

    Returns:
        The integer sequence value (e.g. ``42``).

    Raises:
        ValueError: If the number lacks the expected prefix or is not numeric.
    """
    if isinstance(document_type, DocumentType):
        type_key = document_type
    else:
        type_key = DocumentType(document_type)

    expected_prefix = DOCUMENT_NUMBER_PREFIXES[type_key]
    if not document_number.startswith(expected_prefix):
        raise ValueError(
            f"Document number {document_number!r} does not start with "
            f"expected prefix {expected_prefix!r}"
        )

    numeric_part = document_number[len(expected_prefix):]
    if not numeric_part.isdigit():
        raise ValueError(
            f"Document number {document_number!r} has a non-numeric sequence part"
        )
    return int(numeric_part)


def next_sequence_value(current_value: int) -> int:
    """Return the next value in a 1-based sequence.

    Args:
        current_value: The highest value assigned so far.

    Returns:
        ``current_value + 1``.
    """
    if current_value is None or current_value < 0:
        return 1
    return current_value + 1


def build_sequence_config(
    document_type: DocumentType | str,
    *,
    prefix: str | None = None,
    min_digits: int | None = None,
    start_value: int | None = None,
) -> dict[str, object]:
    """Assemble a normalized sequence configuration dict for a document type.

    Used by the sequence repository when initializing or updating a
    ``document_sequences`` row. Centralizes default resolution so that no
    hardcoded values leak into callers.

    Args:
        document_type: The document type (enum or string value).
        prefix: Optional override prefix.
        min_digits: Optional override zero-pad width.
        start_value: Optional override starting value.

    Returns:
        A dict with keys ``document_type``, ``prefix``, ``min_digits``,
        ``start_value``.
    """
    if isinstance(document_type, DocumentType):
        type_key = document_type
    else:
        type_key = DocumentType(document_type)

    return {
        "document_type": type_key.value,
        "prefix": prefix if prefix is not None else DOCUMENT_NUMBER_PREFIXES[type_key],
        "min_digits": (
            min_digits
            if min_digits is not None
            else DOCUMENT_NUMBER_MIN_DIGITS[type_key]
        ),
        "start_value": start_value,
    }


def normalize_sequence_configs(
    overrides: Mapping[DocumentType | str, Mapping[str, object]],
) -> dict[str, dict[str, object]]:
    """Merge caller overrides onto per-type defaults, keyed by string value.

    Args:
        overrides: Mapping of document type -> partial config overrides.

    Returns:
        A dict keyed by document-type string value with fully-resolved configs.
    """
    resolved: dict[str, dict[str, object]] = {}
    for doc_type, override in overrides.items():
        merged = build_sequence_config(
            doc_type,
            prefix=override.get("prefix"),  # type: ignore[arg-type]
            min_digits=override.get("min_digits"),  # type: ignore[arg-type]
            start_value=override.get("start_value"),  # type: ignore[arg-type]
        )
        resolved[merged["document_type"]] = merged  # type: ignore[index]
    return resolved


__all__ = [
    "format_sequence_number",
    "format_invoice_number",
    "format_receipt_number",
    "format_credit_note_number",
    "parse_sequence_number",
    "next_sequence_value",
    "build_sequence_config",
    "normalize_sequence_configs",
]
