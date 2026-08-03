# ADR-002: Immutable Invoice After Issuance

| Field | Value |
|---|---|
| **ADR ID** | ADR-002 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Module** | Billing |
| **Deciders** | Engineering Team |

---

## Context

Once an invoice is issued to a patient, it becomes a legal financial document. The patient may use it for tax purposes, insurance claims, or payment processing. Modifying an issued invoice retroactively would break the audit trail, create discrepancies with payments already made, and violate financial record-keeping regulations in many jurisdictions.

However, billing errors do occur — incorrect prices, wrong procedures billed, duplicate charges. The system must support corrections without undermining the integrity of the original financial record.

## Problem

How should invoice corrections be handled after issuance while maintaining financial integrity, audit compliance, and a clear correction trail?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Immutable after issuance + corrections via Credit Notes / Cancellation** | Once issued, invoice line items and totals are frozen. Corrections require a separate Credit Note (for price adjustments) or invoice cancellation + re-issuance (for full corrections). | Full audit trail; compliant with financial regulations; no data loss; clear correction history | Additional steps required for corrections; patients see both original and corrected documents |
| **B: Editable after issuance with audit log** | Issued invoices can be modified, but every change is logged with before/after values | Flexible; quick corrections | Weak audit trail — original document is lost; complex compliance; insurer may reject adjusted invoices; regulators may require original document preservation |
| **C: Soft-delete + re-create** | Delete the original invoice (with soft delete), create a new corrected invoice with a new number | Simple concept | Destroys original document; gaps in invoice numbering sequence; new invoice number differs from original — confusing for patients and auditors |
| **D: Versioned invoice** | Each modification creates a new version of the invoice (like treatment plan versions). All versions are retained. | Full history; similar to treatment plan pattern | Over-engineered for invoices — financial corrections are rare events, not iterative revisions; multiple versions of an invoice confuse patients; version numbering on a financial document is unusual |

## Decision

**Option A: Immutable after issuance + corrections via Credit Notes / Cancellation.**

## Rationale

- **Regulatory compliance:** Many jurisdictions require that issued invoices remain unmodified. Corrections must be documented as separate credit notes or corrective invoices. Option A is the only option that satisfies this requirement.
- **Audit clarity:** The correction trail is explicit — a Credit Note references the original invoice, states the reason, and shows the adjusted amount. An auditor can follow the chain from original invoice → credit note → corrected invoice without ambiguity.
- **Patient clarity:** The patient sees both the original invoice and the credit note. They can reconcile their payments against the original document and understand why a correction was issued.
- **Insurance compatibility:** Insurance claims are submitted against specific invoice numbers. An immutable invoice ensures that the claim reference remains valid even if a correction is issued later.
- **Tax compliance:** Tax authorities require that the original invoice be preserved and corrections be documented as separate credit notes (or debit notes). This maps directly to Option A's workflow.

## Consequences

### Positive
- Full regulatory compliance — original invoice is always preserved
- Explicit, auditable correction trail
- Insurance and tax compatibility
- No invoice number sequence gaps from corrections
- Simple to implement — no versioning infrastructure needed

### Negative
- Correction requires multiple steps (credit note + optionally a new invoice)
- Patients receive multiple documents for a single corrected transaction
- Reconciliation must account for both original and corrected amounts

## Correction Workflows

### Scenario 1: Price Adjustment (Partial Correction)

```
1. Original invoice INV-00001 issued ($500)
2. Error discovered — overcharged by $50
3. Credit Note CN-00001 issued ($50), referencing INV-00001
4. Patient receives credit of $50 (refund or apply to outstanding)
5. INV-00001 remains unchanged at $500
```

### Scenario 2: Complete Correction (Invoice Cancelled + Re-issued)

```
1. Original invoice INV-00001 issued ($500) — wrong patient
2. INV-00001 cancelled (no payments received)
3. New invoice INV-00002 issued ($500) — correct patient
4. INV-00001 preserved as cancelled record
```

### Scenario 3: Full Void (Invoice with Payments)

```
1. Original invoice INV-00001 issued ($500)
2. Patient paid $300 (partial payment)
3. Invoice needs to be voided
4. Payment $300 refunded to patient
5. INV-00001 voided (terminal status) — all data preserved
```

## Immutability Boundaries

| Aspect | Immutable? | Details |
|---|---|---|
| Line items (description, quantity, unit price) | Yes | Cannot add, remove, or modify after Issued |
| Invoice-level discount | Yes | Frozen at issue time |
| Tax amounts | Yes | Computed at issue time and frozen |
| Grand total | Yes | Computed and frozen |
| Invoice notes | No | Free-text notes may be added (audited) |
| Payment allocation | No | Payments continue to be allocated against issued invoices |
| Invoice status | No | Status transitions are allowed (Paid, Overdue, Cancelled, Void) |

## Alternatives Rejected

**Option B (Editable with audit log)** was rejected because most jurisdictions' tax regulations require the original financial document to be preserved unmodified. An audit log of changes cannot replace the original document for legal purposes.

**Option C (Soft-delete + re-create)** was rejected because it destroys the original invoice record and creates a gap in the numbering sequence. Auditors and tax authorities require a complete, gapless sequence of invoice numbers.

**Option D (Versioned invoice)** was rejected because financial corrections are rare events (unlike treatment plan revisions which are expected). Versioning adds complexity without commensurate benefit, and multiple versions of the same invoice confuse patients and payment processes.

## Future Considerations

If the volume of corrections grows significantly, consider implementing a "Corrective Invoice" workflow where a new invoice with a reference to the original is automatically generated alongside the credit note, reducing manual steps for the billing team.

## Related ADRs

- ADR-001 (Invoice as Aggregate Root) — defines the aggregate boundary that becomes immutable upon issuance
- ADR-003 (Sequential Numbering Strategy) — defines how credit notes are numbered in a separate sequence
- ADR-004 (Payment Allocation Model) — defines how refunds interact with immutable invoices
