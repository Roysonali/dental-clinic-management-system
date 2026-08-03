# Money Handling Policy — Billing Module

> **Document Type:** Financial Architecture Policy
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Money Handling Policy |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 01-database-overview.md, 14-database-decision-log.md, 07-normalization.md |

---

## 1. Purpose

This document defines the enterprise policy for handling monetary values within the DensCare Billing module. It establishes principles for storage precision, rounding, currency assumptions, and validation expectations — applicable across all financial computations.

---

## 2. Fundamental Principle: Why FLOAT Must Never Be Used

Financial amounts must **never** be stored or computed using IEEE 754 floating-point types (`FLOAT`, `REAL`, `DOUBLE PRECISION`).

| Reason | Explanation |
|---|---|
| **Binary representation error** | Values like `0.10` (10 cents) cannot be represented exactly in binary floating point. Storing `100.10` as FLOAT produces `100.099999...` — a rounding error that accumulates over time. |
| **Accumulated discrepancy** | A single invoice with 20 line items, each rounded to 2 decimal places, may produce a cent-level discrepancy in the grand total. Over thousands of invoices, this discrepancy compounds to significant amounts. |
| **Audit failure** | Financial auditors expect exact reconciliation. Floating-point rounding errors are not explainable and constitute an audit finding. |
| **Legal liability** | Inaccurate financial records due to floating-point errors expose the clinic to legal and regulatory risk. |

**Policy:** All monetary amounts **must** use `NUMERIC` (also called `DECIMAL`) with explicitly defined precision and scale. Integer-based cents (`BIGINT` storing cents) is an acceptable alternative but not preferred for this schema.

---

## 3. Precision and Scale Policy

| Concept | Specification | Rationale |
|---|---|---|
| **Default precision** | `NUMERIC(12,2)` | 12 total digits, 2 decimal places. Supports amounts up to `$9,999,999,999.99`. |
| **Scale (decimal places)** | `2` for all monetary amounts | Matches standard currency subdivision (cents, paise, etc.) for all major currencies. |
| **Tax rate precision** | `NUMERIC(5,3)` | 5 digits, 3 decimal places. Supports rates like `7.500%` without rounding. |
| **Discount percentage** | `NUMERIC(5,2)` | 5 digits, 2 decimal places. Supports `0.01%` to `100.00%`. |

### Precision Hierarchy

```
LineItem.unit_price          NUMERIC(12,2)
LineItem.discount_value      NUMERIC(12,2)  (or NUMERIC(5,2) for percentage)
LineItem.tax_amount          NUMERIC(12,2)
LineItem.net_amount          NUMERIC(12,2)
Invoice.grand_total          Computed (not stored)
Payment.total_amount         NUMERIC(12,2)
PaymentAllocation.amount     NUMERIC(12,2)
Receipt.amount               NUMERIC(12,2)
CreditNote.amount            NUMERIC(12,2)
PatientCredit.amount         NUMERIC(12,2)
```

---

## 4. Rounding Philosophy

| Aspect | Policy | Rationale |
|---|---|---|
| **Rounding method** | Half-up (commercial rounding) | Standard financial rounding: `2.345` → `2.35`, `2.344` → `2.34`. This is the most widely accepted rounding method in accounting. |
| **Rounding granularity** | 2 decimal places for display and storage | All monetary amounts are rounded to the nearest cent (or equivalent smallest currency unit). |
| **Intermediate rounding** | No intermediate rounding | During multi-step calculations (e.g., applying discount then tax), carry full precision and round only at the final line item amount. |
| **Tax rounding** | Round per line item, then sum | Calculate tax on each line item individually, round to 2 decimal places, then sum for invoice total tax. This is the legally required approach in most jurisdictions. |

### Rounding Flow

```
1. Line item subtotal = unit_price × quantity            (no rounding — integer × decimal)
2. Discount amount      = subtotal × (rate / 100)         (round to 2 dp at final step)
3. Net amount           = subtotal − discount             (no rounding — subtraction)
4. Tax amount           = net × (rate / 100)              (round to 2 dp at final step)
5. Invoice total        = sum of net amounts + sum of tax  (sums are exact — no rounding)
```

---

## 5. Display Rounding vs. Storage Precision

| Concept | Storage | Display |
|---|---|---|
| **Internal precision** | Full `NUMERIC(12,2)` precision | — |
| **User-facing display** | — | Rounded to 2 decimal places with standard currency formatting (e.g., `$1,234.56`) |
| **Report display** | — | Same as user-facing; optional thousands separator |
| **Export (CSV/Excel)** | — | Full stored value exported without additional rounding |

**Principle:** Display rounding never alters stored values. What the user sees is a formatted representation, not a truncation.

---

## 6. Currency Assumptions

| Current Policy | Detail |
|---|---|
| **Default currency** | USD (United States Dollar) |
| **Storage** | ISO 4217 3-letter code (`VARCHAR(3)`) on the `invoices` table |
| **Single-currency invoices** | All line items on an invoice must share the same currency (BR-140) |
| **Exchange rate** | Not stored in Phase 1. Future multi-currency support will freeze the exchange rate at invoice creation time. |

---

## 7. Future Multi-Currency Considerations

The current `NUMERIC(12,2)` policy assumes all currencies use 2 decimal places. This must be revisited when multi-currency support is added:

| Currency | Standard Decimal Places | Required Precision |
|---|---|---|
| USD, EUR, GBP, INR | 2 | `NUMERIC(12,2)` ✅ |
| JPY (Japanese Yen) | 0 | `NUMERIC(12,0)` — no decimal places |
| KWD (Kuwaiti Dinar) | 3 | `NUMERIC(12,3)` — requires 3 decimal places |
| BHD (Bahraini Dinar) | 3 | `NUMERIC(12,3)` |

**Migration path:** When multi-currency is required, increase precision to `NUMERIC(12,4)` across all monetary columns, and store the currency-specific decimal places as configuration. The extra decimal places provide headroom for exchange rate calculations without data loss.

---

## 8. Negative Values Policy

| Context | Negative Allowed? | Rationale |
|---|---|---|
| Line item unit price | ❌ No (BR-31) | Zero for complimentary items, never negative |
| Invoice grand total | ❌ No (BR-7) | Negative totals must use credit notes |
| Payment amount | ❌ No (BR-61) | Payments are always positive; reversals create refund allocations |
| Refund allocation | ✅ Yes | `payment_allocations` with `is_refund = TRUE` and positive `allocated_amount` |
| Patient credit balance | ❌ No | Credit cannot go negative (BR-150) |

---

## 9. Validation Expectations

Every monetary operation must validate:

1. **Precision integrity**: No value exceeds its column's precision (e.g., `99999999.99` max for `NUMERIC(10,2)`)
2. **Sign correctness**: Value sign matches the context (positive for charges, positive for payments, positive for refund allocations with `is_refund = TRUE`)
3. **Arithmetic correctness**: Computed values match their derivation (net_amount = unit_price × quantity − discount)
4. **Currency consistency**: Operations involve only matching currencies (cross-currency operations are not supported in Phase 1)

---

## 10. Consistency Rules

| Rule | Description |
|---|---|
| **Server-side computation** | All monetary calculations are performed server-side. Client-provided amounts are treated as input data; computed values always take precedence. |
| **No stored totals** | Invoice grand total, outstanding balance, and total discount/tax are computed on read, never stored. |
| **Frozen at issuance** | Tax rates, prices, and discount rules in effect at invoice issuance are frozen. Subsequent changes do not retroactively affect issued invoices. |
| **Snapshotted details** | Line item amounts are snapshotted at invoice creation (see Invoice Snapshot Policy). They do not change even if reference data (procedure costs) changes. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-database-overview.md](01-database-overview.md) |
| **Related** | [14-database-decision-log.md](14-database-decision-log.md) (Decision DB-10), [07-normalization.md](07-normalization.md) |
| **Next** | [01-database-overview.md](01-database-overview.md) |
