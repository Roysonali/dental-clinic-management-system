# ADR-004: Payment Allocation Model

| Field | Value |
|---|---|
| **ADR ID** | ADR-004 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Module** | Billing |
| **Deciders** | Engineering Team |

---

## Context

Patients frequently make payments that do not map 1:1 to invoices. A patient may pay part of an invoice (partial payment), pay for multiple invoices at once (consolidated payment), overpay (creating a credit balance), or have payments refunded and re-allocated. The payment model must support these real-world scenarios while maintaining accurate outstanding balance calculations and a complete audit trail.

Additionally, Payment is not owned by any single Invoice — a single Payment can span multiple Invoices. This means Payment cannot live inside the Invoice aggregate boundary.

## Problem

How should payments be modeled to support partial payments, multi-invoice payments, overpayments, and refunds while maintaining accurate invoice balances and audit integrity?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Payment as independent aggregate + PaymentAllocation join entity** | Payment is an aggregate root. PaymentAllocation is a separate entity linking Payment to Invoice with the allocated amount. Invoice tracks its own outstanding balance. | Clean separation; supports all payment scenarios; maintainable; auditable | Requires join queries for payment-to-invoice mapping; balance is computed rather than stored |
| **B: Payment stored as attribute of Invoice** | Payment is embedded within the Invoice aggregate — each Invoice has one or more payments. | Simple; single-aggregate reads; no joins for invoice balance | Cannot model multi-invoice payments; overpayments are awkward; violates aggregate boundary |
| **C: Single Payment aggregate with JSONB allocations** | Payment stores allocation data as JSONB with invoice IDs and amounts. | Flexible schema; no join tables | Not queryable; no referential integrity; audit trail is opaque |
| **D: Balance tracking via event stream** | Each payment and refund is an event. Invoice balance is derived by replaying all events. | Full audit trail; no balance computation errors | Query-time performance cost; complex implementation; over-engineered |

## Decision

**Option A: Payment as independent aggregate root + PaymentAllocation join entity.**

## Rationale

- **Multi-invoice support:** A single payment can be split across multiple invoices via multiple PaymentAllocation rows. This is essential for consolidated payments.
- **Partial payment support:** Multiple PaymentAllocation rows for the same invoice allow partial payments.
- **Overpayment handling:** If a payment exceeds the invoice total, the excess creates a PaymentAllocation with an overpayment flag, and a patient credit balance is recorded.
- **Auditability:** Each PaymentAllocation records the exact amount allocated to each invoice, the user who made the allocation, and the timestamp. This provides a complete audit trail.
- **Balance computation:** The invoice's outstanding balance is computed as `grand_total − SUM(allocations) + SUM(refunds)`. This is computed in real time and never stored, preventing data inconsistency.
- **Refund traceability:** A refund PaymentAllocation records the original allocation being reversed, providing a clear chain from payment to refund.

## Consequences

### Positive
- Supports all payment scenarios (partial, multi-invoice, overpayment, refund)
- Clean aggregate boundary — Payment is independent of Invoice
- Accurate balance computation — derived, never stored
- Complete audit trail — every allocation recorded
- Refund traceability — original allocation referenced

### Negative
- Reading invoice balance requires a JOIN or aggregation (acceptable performance impact — indexed queries)
- Payment creation requires multiple INSERTs (payment + allocations) within a transaction (acceptable — sub-millisecond operation)
- Overpayment requires creation of a patient credit record (additional step, but explicit)

## Payment Model

```
Payment (aggregate root)
───────────────────────
  id                  UUID          PK
  patient_id          UUID          FK → patients
  payment_method      VARCHAR(20)   -- Cash, Card, Cheque, Bank Transfer, Other
  total_amount        DECIMAL(12,2) -- total payment amount
  reference_number    VARCHAR(100)  -- optional (cheque #, transaction ID)
  payment_date        DATE
  notes               TEXT
  created_by          UUID          FK → users
  created_at          TIMESTAMP
  reversed            BOOLEAN       -- true if fully reversed
  reversal_reason     TEXT          -- if reversed

PaymentAllocation
─────────────────
  id                  UUID          PK
  payment_id          UUID          FK → payments
  invoice_id          UUID          FK → invoices
  allocated_amount    DECIMAL(12,2) -- amount allocated to this invoice
  is_refund           BOOLEAN       -- true if this is a refund allocation
  refund_reason       TEXT          -- if refund
  original_allocation_id UUID      FK → payment_allocations (if refund)
  created_by          UUID          FK → users
  created_at          TIMESTAMP

PatientCredit (when overpayment occurs)
─────────────
  id                  UUID          PK
  patient_id          UUID          FK → patients
  source_allocation_id UUID         FK → payment_allocations
  credit_amount       DECIMAL(12,2) -- current available credit
  consumed_amount     DECIMAL(12,2) -- amount already applied to invoices
  expiry_date         DATE          -- optional
  created_at          TIMESTAMP
```

## Payment Scenarios

### Scenario 1: Single Invoice, Full Payment

```
Payment: $500 total
Allocation: Invoice INV-00001 → $500
Result: INV-00001 status → Paid
```

### Scenario 2: Single Invoice, Partial Payment

```
Payment: $200 total
Allocation: Invoice INV-00001 → $200 (of $500 total)
Result: INV-00001 status → Partially Paid, outstanding $300
```

### Scenario 3: Multi-Invoice Payment (Consolidated)

```
Payment: $800 total
Allocations: Invoice INV-00001 → $500, Invoice INV-00002 → $300
Result: INV-00001 → Paid, INV-00002 → Partially Paid ($200 of $500 paid)
```

### Scenario 4: Overpayment

```
Payment: $600 total
Invoice INV-00001 total: $500
Allocation: INV-00001 → $500 (flagged as full payment)
Overpayment: $100 → recorded as PatientCredit
Result: INV-00001 → Paid, Patient has $100 credit
```

### Scenario 5: Refund

```
Original Payment: $200 allocated to INV-00001
Refund Payment: $50
Refund Allocation: INV-00001 → -$50 (is_refund=true)
  references original_allocation_id
Result: INV-00001 balance increases by $50
```

## Alternatives Rejected

**Option B (Payment as Invoice attribute)** was rejected because it cannot model multi-invoice payments. A single payment paying for multiple invoices would require splitting the payment across multiple Invoice aggregates, which violates the aggregate boundary.

**Option C (JSONB allocations)** was rejected because allocations need to be individually queryable (by invoice, by date, by user) and modifiable (for refunds). A JSONB array makes these operations impractical.

**Option D (Event stream)** was rejected as over-engineered. The PaymentAllocation join table provides adequate audit trail without the complexity of event sourcing.

## Future Considerations

If the clinic needs to support split payments across different payment methods (e.g., $300 cash + $200 card for a single $500 invoice), the model supports this naturally — two Payment records each with their own PaymentAllocation referencing the same invoice.

Payment gateway integration (Phase 3) will add gateway transaction IDs and webhook processing. The Payment model already stores a generic `reference_number` field for this purpose.

## Related ADRs

- ADR-001 (Invoice as Aggregate Root) — defines Invoice as a separate aggregate from Payment
- ADR-002 (Immutable Invoice After Issuance) — payment allocations continue to be added to issued invoices
- ADR-003 (Sequential Numbering Strategy) — receipt numbering uses the sequence table
