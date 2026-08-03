# Value Objects — Billing Module

> **Document Type:** Value Object Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Value Objects |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 08-domain-model.md, 09-domain-entities.md, 11-aggregate-design.md |

---

## 1. Purpose

This document defines all value objects within the Billing domain model. Value objects are immutable, have no identity, and are defined entirely by their attributes. They model conceptual financial primitives — amounts, quantities, rates, identifiers — that are used across the domain.

---

## 2. Value Object Principles

| Principle | Description |
|---|---|
| **Immutability** | Once created, a value object cannot be modified. Creating a new value replaces the old one. |
| **No identity** | Two value objects with the same attributes are considered equal. They are interchangeable. |
| **Self-validating** | Value objects validate their state at construction time. An invalid value object cannot be created. |
| **Behavior-rich** | Value objects encapsulate behavior relevant to their domain concept (e.g., Money can add and subtract). |

---

## 3. Value Object Catalog

### 3.1 Money

| Attribute | Description |
|---|---|
| **Purpose** | Represents a monetary amount with a specific currency |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| Amount | Decimal(12,2) | ≥ 0 for most contexts; negative allowed for refunds | The numeric value |
| Currency | CurrencyCode | Required; ISO 4217 3-letter code (e.g., USD, EUR, GBP) | The currency of the amount |

**Validation Expectations:**

- Amount precision must not exceed the currency's standard decimal places (2 for most currencies, 0 for JPY, 3 for KWD)
- Currency must be a valid ISO 4217 code
- Amount must not have more decimal places than the currency supports
- Negative amounts allowed only in specific contexts (refund allocations, credit notes)

**Behavior:**

- `add(Money other): Money` — Returns new Money with sum, same currency (throws if currencies differ)
- `subtract(Money other): Money` — Returns new Money with difference, same currency
- `multiply(Decimal factor): Money` — Returns new Money with amount × factor
- `negate(): Money` — Returns new Money with negative amount (for refunds)
- `isZero(): Boolean` — True if amount = 0
- `isPositive(): Boolean` — True if amount > 0
- `compareTo(Money other): Integer` — Compare with another Money (same currency only)

**Examples:**

| Example | Description |
|---|---|
| `Money(500.00, USD)` | Five hundred US dollars |
| `Money(0, USD)` | Zero — no charge (complimentary item) |
| `Money(-50.00, USD)` | Negative — refund allocation (context: refund) |

**Design Notes:**

- Money is the most fundamental value object in the Billing domain. It is used everywhere — invoice totals, line item prices, payment amounts, refunds, credit notes.
- Currency consistency is enforced at the value object level: operations between different currencies throw a domain exception.
- Amount is stored with full precision (12,2) to prevent rounding errors in accumulated calculations.

---

### 3.2 InvoiceNumber

| Attribute | Description |
|---|---|
| **Purpose** | Represents the display/legal identifier of an invoice |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| Prefix | String(10) | Alphanumeric + hyphen; e.g., "INV-" | Configurable prefix |
| Sequence | Long | ≥ 1; gapless | Sequential number portion |
| Formatted | String | Computed: `{prefix}{sequence}` padded to min digits | Full display number |

**Validation Expectations:**

- Prefix must not be empty
- Sequence must be positive
- Formatted number must be unique within the sequence

**Examples:**

| Example | Description |
|---|---|
| `InvoiceNumber("INV-", 1)` → `"INV-00001"` | First invoice with 5-digit padding |
| `InvoiceNumber("DENS-", 1000)` → `"DENS-01000"` | Invoice starting from 1000 |
| `InvoiceNumber("INV-", 100000)` → `"INV-100000"` | No padding needed beyond 5 digits |

**Design Notes:**

- The formatted string is the legal document identifier. It appears on the physical invoice, receipts, and all correspondence.
- The prefix and digit length are configurable via the admin UI, but once an invoice is issued, its number is frozen.
- InvoiceNumber is a value object because two invoices with the same number are indistinguishable in display — but this should never happen due to the uniqueness invariant.

---

### 3.3 PaymentMethod

| Attribute | Description |
|---|---|
| **Purpose** | Enumerates the valid methods of payment |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Valid Values:**

| Value | Description | Requires Reference | Phase |
|---|---|---|---|
| Cash | Physical currency | No | MVP |
| Card | Credit/debit card | Transaction ID (recommended) | MVP |
| Cheque | Cheque payment | Cheque number (required) | MVP |
| BankTransfer | Direct bank transfer | Reference number (optional) | MVP |
| Wallet | Patient wallet / advance payment | Wallet transaction ID | Phase 3 |
| Other | Other payment method | Description (required) | MVP |

**Design Notes:**

- PaymentMethod controls which additional fields are required (e.g., Cheque requires cheque number).
- The list is extensible via configuration. Future payment methods (e.g., Insurance, Mobile Money) can be added without schema changes.

---

### 3.4 Discount

| Attribute | Description |
|---|---|
| **Purpose** | Represents a discount applied to a line item or invoice |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| Type | DiscountType | PERCENTAGE or FIXED_AMOUNT | How the discount is expressed |
| Value | Decimal(12,2) | > 0 for both types | The discount value |
| PercentageRate | Decimal(5,2) | 0 < rate ≤ 100 (if PERCENTAGE) | Only for percentage type |
| FixedAmount | Money | > 0 (if FIXED_AMOUNT) | Only for fixed amount type |
| ApprovalStatus | DiscountApprovalStatus | APPROVED, PENDING, REJECTED, NOT_REQUIRED | Approval state |

**Sub-value objects:**

| Value Object | Description |
|---|---|
| `DiscountType` | Enum: PERCENTAGE, FIXED_AMOUNT |
| `DiscountApprovalStatus` | Enum: APPROVED, PENDING, REJECTED, NOT_REQUIRED (Phase 2) |

**Validation Expectations:**

- Discount type must be either PERCENTAGE or FIXED_AMOUNT, not both
- For PERCENTAGE: rate must be > 0 and ≤ 100
- For FIXED_AMOUNT: amount must be > 0
- Discount cannot exceed the line item or invoice subtotal it applies to

**Computed Value:**

- `discountAmount` = If PERCENTAGE: `subtotal × (rate / 100)`; if FIXED_AMOUNT: `fixedAmount`

**Examples:**

| Example | Description |
|---|---|
| `Discount(PERCENTAGE, 10)` | 10% discount on applicable subtotal |
| `Discount(FIXED_AMOUNT, Money(50.00, USD))` | $50 fixed discount |

**Design Notes:**

- Discount expresses *how* the discount is specified (percentage or amount), but the *calculated* discount amounts are stored separately on the LineItem or Invoice.
- The approval workflow (Phase 2) adds an ApprovalStatus that governs whether the discount can be applied.

---

### 3.5 TaxRate

| Attribute | Description |
|---|---|
| **Purpose** | Represents a tax rate applicable to a line item |
| **Phase** | Phase 2 |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| Name | String(50) | Required; e.g., "GST", "VAT 20%" | Display name |
| Rate | Decimal(5,3) | 0 ≤ rate ≤ 100 | Percentage rate |
| IsActive | Boolean | Default true | Whether the rate is available for use |
| Jurisdiction | String(100) | Required; e.g., "Federal", "State/Province" | Tax jurisdiction |

**Validation Expectations:**

- Rate must be ≥ 0 and ≤ 100
- Name must not be empty
- A tax rate cannot be deleted if it has been used on any invoice (historical preservation)

**Computed Value:**

- `taxAmount` = `netAmount × (rate / 100)`

**Examples:**

| Example | Description |
|---|---|
| `TaxRate("GST", 5.0, "Federal")` | Canadian GST at 5% |
| `TaxRate("VAT 20%", 20.0, "National")` | UK/EU VAT at 20% |
| `TaxRate("Zero Rated", 0.0, "Exempt")` | Zero-rated tax |

**Design Notes:**

- TaxRate is frozen at invoice creation time. Changes to the master tax rate do not affect already-issued invoices.
- Multiple tax rates can apply to a single line item (e.g., GST + PST in Canada).

---

### 3.6 InvoiceStatus

| Attribute | Description |
|---|---|
| **Purpose** | Enumerates the possible states of an Invoice |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Valid Values:**

| Status | Description | Terminal? |
|---|---|---|
| Draft | Invoice being prepared, fully editable | No |
| Issued | Invoice sent to patient, line items frozen | No |
| PartiallyPaid | Some payments received, balance remains | No |
| Paid | All charges settled | No |
| Overdue | Due date passed with outstanding balance | No |
| Cancelled | Terminated with no payments received | Yes |
| Void | Terminated after payments refunded | Yes |

---

### 3.7 PaymentStatus

| Attribute | Description |
|---|---|
| **Purpose** | Enumerates the possible states of a Payment |
| **Phase** | MVP (Completed, Failed); Phase 2 (Full) |
| **Immutability** | Immutable |

**Valid Values:**

| Status | Description | Terminal? |
|---|---|---|
| Pending | Payment initiated, awaiting confirmation | No |
| Completed | Payment successfully processed | No |
| Failed | Payment declined or processing error | No |
| Refunded | All funds returned to patient | Yes |
| Reversed | Payment reversed (undo completed payment) | Yes |
| Void | Payment voided before completion | Yes |

---

### 3.8 CreditNoteStatus

| Attribute | Description |
|---|---|
| **Purpose** | Enumerates the possible states of a Credit Note |
| **Phase** | Phase 2 |
| **Immutability** | Immutable |

**Valid Values:**

| Status | Description | Terminal? |
|---|---|---|
| Draft | Credit note being prepared, editable | No |
| Issued | Credit note finalized, immutable | No |
| Applied | Full credit applied to invoices | Yes |
| Expired | Validity period passed with unapplied balance | Yes |
| Void | Cancelled before or after issuance | Yes |

---

### 3.9 MoneyRange

| Attribute | Description |
|---|---|
| **Purpose** | Represents a range of monetary values (min, max) |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints |
|---|---|---|
| Min | Money | Optional (null = unbounded) |
| Max | Money | Optional (null = unbounded) |

**Validation Expectations:**

- If both set, Min ≤ Max
- Same currency for both

**Examples:**

| Example | Description |
|---|---|
| `MoneyRange(Min=0, Max=null)` | Any non-negative amount |
| `MoneyRange(Min=0, Max=Money(500, USD))` | 0 to $500 |

---

### 3.10 DateRange

| Attribute | Description |
|---|---|
| **Purpose** | Represents a range of dates with optional start and end |
| **Phase** | MVP |
| **Immutability** | Immutable |

**Attributes:**

| Field | Type | Constraints |
|---|---|---|
| StartDate | Date | Optional (null = open start) |
| EndDate | Date | Optional (null = open end) |

**Validation Expectations:**

- If both set, StartDate ≤ EndDate

**Examples:**

| Example | Description |
|---|---|
| `DateRange(start=2026-07-01, end=2026-07-31)` | July 2026 |
| `DateRange(start=null, end=2026-07-31)` | All dates up to July 31 |

---

## 4. Value Object Relationships

```
Money ──────────────────────► Used by: LineItem, Invoice, Payment,
│                               Receipt, CreditNote, Discount, TaxRate
│
├── InvoiceNumber ──────────► Used by: Invoice
├── PaymentMethod ──────────► Used by: Payment
├── Discount ───────────────► Used by: LineItem, Invoice
├── TaxRate ────────────────► Used by: LineItem (Phase 2)
├── InvoiceStatus ──────────► Used by: Invoice
├── PaymentStatus ──────────► Used by: Payment
├── CreditNoteStatus ───────► Used by: CreditNote
├── MoneyRange ─────────────► Used by: Discount thresholds, approval rules
└── DateRange ──────────────► Used by: Search/filter, reporting
```

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [09-domain-entities.md](09-domain-entities.md) |
| **Related** | [11-aggregate-design.md](11-aggregate-design.md), [16-financial-calculation-model.md](16-financial-calculation-model.md) |
| **Next Reading** | [11-aggregate-design.md](11-aggregate-design.md) |
