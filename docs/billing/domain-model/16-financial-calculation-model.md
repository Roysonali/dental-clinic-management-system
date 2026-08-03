# Financial Calculation Model — Billing Module

> **Document Type:** Financial Calculation Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Financial Calculation Model |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 06-business-rules.md, 09-financial-invariants.md, 10-value-objects.md |

---

## 1. Purpose

This document defines the conceptual financial calculations within the Billing module. It describes *what* should be computed and *why*, without specifying implementation formulas or code. These calculations are the business logic foundation for invoice totals, discounts, taxes, balances, refunds, and credit notes.

---

## 2. Calculation Principles

| Principle | Description |
|---|---|
| **Server-side computation** | All financial calculations are performed server-side. Client-provided amounts are treated as input data only; computed values always supersede. |
| **Derived, not stored** | Financial totals are computed on read and never stored independently of their source data. This prevents data inconsistency. |
| **Frozen at issuance** | Tax rates, discount rules, and prices in effect at invoice issuance are frozen for that invoice. Subsequent rate changes do not retroactively affect issued invoices. |
| **Precision management** | All monetary calculations use a precision appropriate to the currency (default: 2 decimal places for most currencies). Rounding follows standard financial practice (round half up). |
| **Auditability** | Every computed value must be traceable to its source inputs. An auditor should be able to verify any calculation by examining the underlying data. |

---

## 3. Invoice Total Calculations

### 3.1 Line Item Subtotal

The subtotal for a single line item represents the gross charge before any discounts or taxes.

**Inputs:**
- Unit price (per the agreed rate at time of billing)
- Quantity (number of units being billed)

**Business Logic:**
- The unit price is sourced from the treatment plan estimate, a price override, or manual entry
- Quantity must be ≥ 1
- The subtotal is the multiplication of unit price by quantity

**Dependencies:**
- Unit price must be validated against any price override audit rules (BR-46)
- Quantity must be validated against treatment plan remaining quantity (if applicable)

### 3.2 Line Item Net Amount

The net amount reflects the line item charge after applying any item-level discount.

**Inputs:**
- Line item subtotal
- Line item discount (percentage or fixed amount)

**Business Logic:**
- If discount is percentage: discount amount = subtotal × (percentage / 100)
- If discount is fixed amount: discount amount = fixed value (capped at subtotal)
- Net amount = subtotal − discount amount
- Discount cannot exceed subtotal (BR-36)

### 3.3 Line Item Tax Amount (Phase 2)

The tax amount is the applicable tax charge on the line item.

**Inputs:**
- Line item net amount
- Applicable tax rate(s)

**Business Logic:**
- Tax amount = net amount × (tax rate / 100)
- Multiple tax rates may apply to a single line item (e.g., state + federal)
- Tax-exempt items have tax amount = 0, with exemption reason recorded
- Tax rate is frozen at invoice creation time (BR-52)

### 3.4 Invoice Subtotal

The sum of all line item subtotals.

**Inputs:**
- All line item subtotals on the invoice

**Business Logic:**
- Subtotal = sum of (unit price × quantity) for all line items

### 3.5 Invoice Total Discount

The sum of all discounts applied to line items plus any invoice-level discount.

**Inputs:**
- All line item discount amounts
- Invoice-level discount amount (if applicable)

**Business Logic:**
- Total discount = sum of all line item discount amounts + invoice-level discount
- Total discount cannot exceed configured maximum discount percentage of subtotal (BR-45)
- If invoice-level discount exists, it is applied after line-item discounts

### 3.6 Invoice Total Tax

The sum of all line item tax amounts.

**Inputs:**
- All line item tax amounts

**Business Logic:**
- Total tax = sum of all line item tax amounts
- Tax is calculated on the discounted net amount, not the subtotal

### 3.7 Invoice Grand Total

The final amount payable on the invoice.

**Inputs:**
- Invoice subtotal
- Total discount
- Total tax

**Business Logic:**
- Grand total = subtotal − total discount + total tax
- Grand total must be ≥ 0 (BR-7)

---

## 4. Discount Calculations

### 4.1 Line Item Discount

**Inputs:**
- Line item subtotal
- Discount value (percentage or fixed amount)

**Business Logic:**
- Discount must not exceed subtotal (BR-36)
- Discount type must be percentage OR fixed amount, not both (BR-34)
- If percentage: discount amount = subtotal × (percentage / 100)
- If fixed amount: discount amount = fixed value

### 4.2 Invoice-Level Discount

**Inputs:**
- Invoice subtotal (after line-item discounts)
- Discount value (percentage or fixed amount)

**Business Logic:**
- Applied on top of line-item discounts (cumulative)
- Subject to same threshold rules as line-item discounts
- Total invoice discount = sum of all line-item discounts + invoice-level discount
- Total discount must not exceed configured maximum (BR-45)

### 4.3 Discount Threshold Check (Phase 2)

**Inputs:**
- Discount value (percentage of subtotal and/or fixed amount)
- Configured threshold (percentage and/or fixed amount)

**Business Logic:**
- If discount percentage > configured percentage threshold → approval required
- If discount fixed amount > configured fixed amount threshold → approval required
- If either threshold is exceeded, approval workflow is triggered (BR-130)

---

## 5. Outstanding Balance Calculation

### 5.1 Invoice Outstanding Balance

**Inputs:**
- Invoice grand total
- Sum of all payment allocations (non-refund)
- Sum of all refund allocations
- Sum of all applied credit note amounts

**Business Logic:**
- Outstanding balance = grand total − sum(payment allocations) + sum(refunds) − sum(applied credits)
- Outstanding balance is computed on read, never stored
- Outstanding balance = 0 → invoice is fully paid
- Outstanding balance > 0 → invoice has remaining balance
- Outstanding balance < 0 → invoice is overpaid (patient credit applies)

### 5.2 Patient Credit Balance

**Inputs:**
- Sum of all overpayment credits
- Sum of all credit note credits (unexpired)
- Sum of all advance payments (Phase 3)
- Sum of all consumed credits (applied to invoices)

**Business Logic:**
- Available credit = total credits granted − total credits consumed
- Available credit cannot be negative
- Credit note credits expire after configured period (BR-95)

---

## 6. Payment Calculations

### 6.1 Payment Allocation

**Inputs:**
- Payment total amount
- Allocation amounts for each target invoice

**Business Logic:**
- Sum of all allocation amounts must equal payment total (BR-62)
- Each allocation must not exceed the target invoice's outstanding balance (BR-63, unless overpayment permitted)
- Allocations are recorded at the time of payment and are immutable thereafter

### 6.2 Overpayment Detection

**Inputs:**
- Payment total
- Total outstanding balance of target invoices

**Business Logic:**
- If payment total > total outstanding balance → overpayment exists
- System must prompt for confirmation before proceeding with overpayment
- Excess is recorded as patient credit

### 6.3 Multi-Invoice Payment

**Inputs:**
- Payment total
- List of (invoice_id, allocation_amount) pairs

**Business Logic:**
- The payment total is split across multiple invoices
- Each invoice's outstanding balance is updated independently
- Each allocation is subject to the same validation rules as single-invoice allocations

---

## 7. Refund Calculations (Phase 2)

### 7.1 Refund Amount Validation

**Inputs:**
- Original payment amount
- Requested refund amount
- Amount already refunded (if any)

**Business Logic:**
- Refund amount must not exceed original payment amount (BR-81)
- Cumulative refunds must not exceed original payment amount
- Partial refunds are allowed (BR-83)

### 7.2 Refund Impact on Invoice Balance

**Inputs:**
- Refund amount
- Current invoice outstanding balance

**Business Logic:**
- Refund reverses the original payment allocation
- Invoice outstanding balance increases by the refund amount
- If refund causes outstanding balance > 0, invoice status may revert from Paid to PartiallyPaid

---

## 8. Credit Note Calculations (Phase 2)

### 8.1 Credit Note Amount Validation

**Inputs:**
- Credit note requested amount
- Invoice grand total
- Total credit already issued against the invoice (if any)

**Business Logic:**
- Credit note amount must not exceed invoice grand total (BR-91)
- Cumulative credit notes against an invoice must not exceed invoice grand total
- Partial credit notes are allowed

### 8.2 Credit Note Application

**Inputs:**
- Credit note remaining balance
- Target invoice outstanding balance

**Business Logic:**
- Applied amount = min(credit note remaining, invoice outstanding balance)
- If applied equals remaining → credit note becomes Applied
- If applied is less than remaining → credit note remains Issued (partial application tracked by remaining_balance)

---

## 9. Calculation Dependency Map

```
LineItem.Subtotal = UnitPrice × Quantity
        │
        ▼
LineItem.DiscountAmount = Subtotal × (Discount% / 100)   [if %]
                        = FixedDiscountAmount              [if fixed]
        │
        ▼
LineItem.NetAmount = Subtotal − DiscountAmount
        │
        ▼
LineItem.TaxAmount = NetAmount × (TaxRate / 100)          [Phase 2]
        │
        ▼
Invoice.Subtotal = ∑ LineItem.Subtotal
Invoice.TotalDiscount = ∑ LineItem.DiscountAmount + InvoiceLevelDiscount
Invoice.TotalTax = ∑ LineItem.TaxAmount                   [Phase 2]
Invoice.GrandTotal = Subtotal − TotalDiscount + TotalTax
        │
        ▼
Invoice.OutstandingBalance = GrandTotal − ∑ Payments + ∑ Refunds − ∑ Credits
        │
        ▼
PatientCredit.Available = ∑ Grants − ∑ Consumption
```

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [10-value-objects.md](10-value-objects.md), [06-business-rules.md](../06-business-rules.md) |
| **Related** | [09-financial-invariants.md](../09-financial-invariants.md) |
| **Next Reading** | [17-integration-boundaries.md](17-integration-boundaries.md) |
