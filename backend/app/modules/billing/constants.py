"""Billing Module — Shared constants.

Holds non-business static configuration: code/number generation prefixes,
financial precision and ranges, currency assumptions, field length limits,
and the state-machine transition tables consumed by validators and services.

Only stable, deployment-wide values belong here. Display strings and
user-facing messages are kept in the exception/router layers.

Design notes
------------
* Monetary constants use :class:`decimal.Decimal` to avoid binary float error
  when compared against ``Numeric``/``Decimal`` database columns.
* The transition maps (``INVOICE_TRANSITIONS``) are the **single source of
  truth** for allowed status transitions, expressed with enum members. The
  string-serialized ``VALID_INVOICE_TRANSITIONS`` dict is derived from them
  purely for persistence/serialization.
* ``InvoiceStatus.terminal_statuses()`` is derived from ``INVOICE_TRANSITIONS``
  so the business rule is defined exactly once.
"""

from __future__ import annotations

from decimal import Decimal

from app.modules.billing.enums import (
    CurrencyCode,
    DocumentType,
    InvoiceStatus,
)

# ==========================================================
# Precision / scale policy (see database/15-money-handling-policy.md)
# ==========================================================
# Standard monetary precision: NUMERIC(12,2)
MONEY_TOTAL_DIGITS = 12
MONEY_DECIMAL_PLACES = 2
MONEY_QUANTIZE_EXPONENT = Decimal(f"1e-{MONEY_DECIMAL_PLACES}")

# Tax rate precision: NUMERIC(5,3)
TAX_RATE_TOTAL_DIGITS = 5
TAX_RATE_DECIMAL_PLACES = 3
TAX_RATE_QUANTIZE_EXPONENT = Decimal(f"1e-{TAX_RATE_DECIMAL_PLACES}")

# Discount percentage precision: NUMERIC(5,2)
DISCOUNT_RATE_TOTAL_DIGITS = 5
DISCOUNT_RATE_DECIMAL_PLACES = 2
DISCOUNT_RATE_QUANTIZE_EXPONENT = Decimal(f"1e-{DISCOUNT_RATE_DECIMAL_PLACES}")

# ==========================================================
# Financial bounds (Decimal to match Numeric columns)
# ==========================================================
MAX_MONEY_AMOUNT = Decimal("999999999999.99")
MIN_MONEY_AMOUNT = Decimal("0.00")
ZERO_MONEY = Decimal("0.00")

MAX_TAX_RATE = Decimal("100.000")
MIN_TAX_RATE = Decimal("0.000")
DEFAULT_TAX_RATE = Decimal("0.000")

MAX_DISCOUNT_RATE = Decimal("100.00")
MIN_DISCOUNT_RATE = Decimal("0.00")
DEFAULT_DISCOUNT_RATE = Decimal("0.00")

# ==========================================================
# Currency configuration
# ==========================================================
DEFAULT_CURRENCY: CurrencyCode = CurrencyCode.USD
SUPPORTED_CURRENCIES: frozenset[CurrencyCode] = frozenset(CurrencyCode)

# ==========================================================
# Document numbering (ADR-003)
# ==========================================================
DEFAULT_SEQUENCE_START_VALUE = 1
DEFAULT_SEQUENCE_MIN_DIGITS = 5

DOCUMENT_NUMBER_PREFIXES: dict[DocumentType, str] = {
    DocumentType.INVOICE: "INV-",
    DocumentType.RECEIPT: "RCT-",
    DocumentType.CREDIT_NOTE: "CN-",
}

DOCUMENT_NUMBER_MIN_DIGITS: dict[DocumentType, int] = {
    DocumentType.INVOICE: DEFAULT_SEQUENCE_MIN_DIGITS,
    DocumentType.RECEIPT: DEFAULT_SEQUENCE_MIN_DIGITS,
    DocumentType.CREDIT_NOTE: DEFAULT_SEQUENCE_MIN_DIGITS,
}

INVOICE_NUMBER_PREFIX = DOCUMENT_NUMBER_PREFIXES[DocumentType.INVOICE]
RECEIPT_NUMBER_PREFIX = DOCUMENT_NUMBER_PREFIXES[DocumentType.RECEIPT]
CREDIT_NOTE_NUMBER_PREFIX = DOCUMENT_NUMBER_PREFIXES[DocumentType.CREDIT_NOTE]

# ==========================================================
# Field length limits
# ==========================================================
INVOICE_NUMBER_MAX_LENGTH = 30
PAYMENT_NUMBER_MAX_LENGTH = 30
RECEIPT_NUMBER_MAX_LENGTH = 30
CREDIT_NOTE_NUMBER_MAX_LENGTH = 30
CURRENCY_CODE_LENGTH = 3
TRANSACTION_REFERENCE_MAX_LENGTH = 100
PAYMENT_NOTES_MAX_LENGTH = 500
CANCEL_REASON_MAX_LENGTH = 500
VOID_REASON_MAX_LENGTH = 500
CREDIT_NOTE_REASON_MAX_LENGTH = 500
SEQUENCE_DOCUMENT_TYPE_MAX_LENGTH = 20
SEQUENCE_CONSUMPTION_STATUS_MAX_LENGTH = 20
AUDIT_ACTION_MAX_LENGTH = 30
AUDIT_REASON_MAX_LENGTH = 500

# ==========================================================
# Pagination / listing defaults
# ==========================================================
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_SORT_FIELD = "created_at"
ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(
    {
        "created_at",
        "updated_at",
        "invoice_number",
        "grand_total",
        "status",
        "due_date",
    }
)

# ==========================================================
# Business constants
# ==========================================================
MIN_LINE_ITEMS_PER_INVOICE = 1
MIN_LINE_ITEM_QUANTITY = 1
INITIAL_INVOICE_VERSION_NUMBER = 1
# Maximum sequence value for document numbering (Phase 1 value).
# With DEFAULT_SEQUENCE_MIN_DIGITS = 5, the formatted display supports
# numbers up to 99999. Increase this value in future phases as needed
# to accommodate higher invoice/receipt/credit-note volumes.
MAX_SEQUENCE_NUMBER = 999

# ==========================================================
# State machine configuration (single source of truth)
# ==========================================================
INVOICE_TRANSITIONS: dict[InvoiceStatus, frozenset[InvoiceStatus]] = {
    InvoiceStatus.DRAFT: frozenset(
        {
            InvoiceStatus.ISSUED,
            InvoiceStatus.CANCELLED,
            InvoiceStatus.VOID,
        }
    ),
    InvoiceStatus.ISSUED: frozenset(
        {
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.CANCELLED,
            InvoiceStatus.VOID,
        }
    ),
    InvoiceStatus.PARTIALLY_PAID: frozenset(
        {
            InvoiceStatus.PAID,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.CANCELLED,
            InvoiceStatus.VOID,
        }
    ),
    InvoiceStatus.PAID: frozenset(
        {
            InvoiceStatus.VOID,
        }
    ),
    InvoiceStatus.OVERDUE: frozenset(
        {
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.CANCELLED,
            InvoiceStatus.VOID,
        }
    ),
    InvoiceStatus.CANCELLED: frozenset(),  # Terminal
    InvoiceStatus.VOID: frozenset(),  # Terminal
}

# String-serialized transition map for persistence / API serialization.
# Derived from the enum map above — do not edit by hand.
VALID_INVOICE_TRANSITIONS: dict[str, frozenset[str]] = {
    source.value: frozenset(target.value for target in targets)
    for source, targets in INVOICE_TRANSITIONS.items()
}


def is_valid_currency(code: str) -> bool:
    """Return ``True`` if ``code`` is a supported ISO 4217 currency code.

    Args:
        code: Candidate currency code, e.g. ``"USD"``.

    Returns:
        ``True`` if the code is a member of :class:`CurrencyCode`.
    """
    return code in CurrencyCode.all_values()


__all__ = [
    "MONEY_TOTAL_DIGITS",
    "MONEY_DECIMAL_PLACES",
    "MONEY_QUANTIZE_EXPONENT",
    "TAX_RATE_TOTAL_DIGITS",
    "TAX_RATE_DECIMAL_PLACES",
    "TAX_RATE_QUANTIZE_EXPONENT",
    "DISCOUNT_RATE_TOTAL_DIGITS",
    "DISCOUNT_RATE_DECIMAL_PLACES",
    "DISCOUNT_RATE_QUANTIZE_EXPONENT",
    "MAX_MONEY_AMOUNT",
    "MIN_MONEY_AMOUNT",
    "ZERO_MONEY",
    "MAX_TAX_RATE",
    "MIN_TAX_RATE",
    "DEFAULT_TAX_RATE",
    "MAX_DISCOUNT_RATE",
    "MIN_DISCOUNT_RATE",
    "DEFAULT_DISCOUNT_RATE",
    "DEFAULT_CURRENCY",
    "SUPPORTED_CURRENCIES",
    "DEFAULT_SEQUENCE_START_VALUE",
    "DEFAULT_SEQUENCE_MIN_DIGITS",
    "DOCUMENT_NUMBER_PREFIXES",
    "DOCUMENT_NUMBER_MIN_DIGITS",
    "INVOICE_NUMBER_PREFIX",
    "RECEIPT_NUMBER_PREFIX",
    "CREDIT_NOTE_NUMBER_PREFIX",
    "INVOICE_NUMBER_MAX_LENGTH",
    "PAYMENT_NUMBER_MAX_LENGTH",
    "RECEIPT_NUMBER_MAX_LENGTH",
    "CREDIT_NOTE_NUMBER_MAX_LENGTH",
    "CURRENCY_CODE_LENGTH",
    "TRANSACTION_REFERENCE_MAX_LENGTH",
    "PAYMENT_NOTES_MAX_LENGTH",
    "CANCEL_REASON_MAX_LENGTH",
    "VOID_REASON_MAX_LENGTH",
    "CREDIT_NOTE_REASON_MAX_LENGTH",
    "SEQUENCE_DOCUMENT_TYPE_MAX_LENGTH",
    "SEQUENCE_CONSUMPTION_STATUS_MAX_LENGTH",
    "AUDIT_ACTION_MAX_LENGTH",
    "AUDIT_REASON_MAX_LENGTH",
    "DEFAULT_PAGE_SIZE",
    "MAX_PAGE_SIZE",
    "DEFAULT_SORT_FIELD",
    "ALLOWED_SORT_FIELDS",
    "MIN_LINE_ITEMS_PER_INVOICE",
    "MIN_LINE_ITEM_QUANTITY",
    "INITIAL_INVOICE_VERSION_NUMBER",
    "MAX_SEQUENCE_NUMBER",
    "INVOICE_TRANSITIONS",
    "VALID_INVOICE_TRANSITIONS",
    "is_valid_currency",
]
