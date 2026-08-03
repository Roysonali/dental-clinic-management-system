# Domain Entities — Billing Module

> **Document Type:** Domain Entity Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Domain Entities |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 08-domain-model.md, 10-value-objects.md, 11-aggregate-design.md |

---

## 1. Purpose

This document defines each domain entity within the Billing module. For every entity, it describes the entity's purpose, responsibilities, lifecycle, ownership, relationships, business rules, invariants, and design notes.

---

## 2. Entity: Invoice

| Attribute | Description |
|---|---|
| **Type** | Aggregate Root |
| **Identity** | `InvoiceId` (UUID — internal); `InvoiceNumber` (sequential — display/legal) |
| **Phase** | MVP |

### Purpose

The Invoice is the central financial document in the Billing module. It formally requests payment from a patient for dental services rendered. It owns its line items and status history, and it is the primary entity against which payments are allocated.

### Responsibilities

- Maintain the authoritative record of charges owed by a patient
- Enforce lifecycle transitions (Draft → Issued → Paid/Overdue → Terminal)
- Own and validate its line items (quantities, prices, discounts)
- Compute derived financial totals (subtotal, discount total, tax total, grand total)
- Track outstanding balance in response to payment allocations and refunds
- Provide an immutable audit trail of status changes and price overrides

### Lifecycle

```
Created (Draft) → Editable state, line items can be added/modified/removed
Issued → Financial document is frozen; available for payment collection
Paid → All charges have been settled
Overdue → Due date passed with outstanding balance
Cancelled → Terminated before any payments received (data preserved)
Void → Terminated after payments received (refunds processed first)
```

### Ownership

- **Owns:** LineItem entities, InvoiceStatusHistory records
- **References:** Patient (mandatory), optionally TreatmentPlan, Doctor, Appointment
- **Referenced by:** PaymentAllocation (via invoice_id), CreditNote (via invoice_id)

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Patient | Reference (not owned) | 1:1 | Every invoice belongs to one patient |
| LineItem | Composition (owned) | 1:N | Invoice owns its line items |
| TreatmentPlan | Reference (not owned) | 0:1 | Optionally sourced from a treatment plan |
| Doctor | Reference (not owned) | 0:1 | Optionally references treating doctor |
| Appointment | Reference (not owned) | 0:1 | Optionally references appointment |
| PaymentAllocation | Reference from Payment | 1:N | Payments allocated to this invoice |
| CreditNote | Reference from CreditNote | 1:N | Credit notes issued against this invoice |
| InvoiceStatusHistory | Composition (owned) | 1:N | Status change audit trail |

### Business Rules

- BR-1: Must reference exactly one patient
- BR-2: Must have at least one line item
- BR-3: Must have unique invoice number
- BR-4: Totals computed server-side only
- BR-5: Grand total = subtotal − discount + tax
- BR-10: Starts in Draft status
- BR-12: Immutable after issuance
- BR-116: Cannot be hard-deleted after Draft

### Invariants

- FI-INV-001: Totals cannot change after issuance
- FI-INV-002: Must have at least one line item
- FI-INV-003: Belongs to exactly one patient
- FI-INV-004: Grand total is derived, not stored
- FI-INV-005: Cannot have negative grand total

### Design Notes

- Invoice number is separate from internal ID. The ID is used for internal references; the number is the legal document identifier.
- Outstanding balance is computed (grand total − sum of allocations + sum of refunds) rather than stored, to prevent data inconsistency.
- Price overrides from treatment plan estimates are tracked via original_price and override_reason fields.

---

## 3. Entity: LineItem

| Attribute | Description |
|---|---|
| **Type** | Child Entity (owned by Invoice) |
| **Identity** | `LineItemId` (UUID) |
| **Phase** | MVP |

### Purpose

A LineItem represents a single charge on an invoice — typically a dental procedure, product, or fee. It is the atomic unit of billing.

### Responsibilities

- Record the description, quantity, unit price, discount, and tax for a single charge
- Compute the line item net amount: (unit price × quantity) − discount
- Compute the line item tax amount: net amount × tax rate (Phase 2)
- Track price overrides from treatment plan estimates
- Apply line-item-level discounts

### Lifecycle

```
Added (in Draft invoice) → Editable
Invoice Issued → Frozen (immutable)
Invoice Cancelled/Void → Preserved for audit
```

### Ownership

- **Owned by:** Invoice aggregate root
- **Cannot exist independently** of its parent invoice

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Invoice | Parent (composition) | N:1 | Belongs to exactly one invoice |
| TreatmentPlanItem | Reference (not owned) | 0:1 | Optionally sourced from a specific plan item |
| Procedure | Reference (not owned) | 0:1 | Optionally references a procedure code |

### Business Rules

- BR-30: Must have a description
- BR-31: Unit price ≥ 0
- BR-32: Quantity ≥ 1
- BR-33: Net amount = (unit price × quantity) − discount
- BR-34: Discount is fixed amount OR percentage, not both
- BR-36: Discount cannot exceed subtotal
- BR-46: Price overrides tracked

### Invariants

- FI-LI-001: Cannot exist without parent invoice
- FI-LI-002: Net amount = (unit price × quantity) − discount
- FI-LI-003: Discount cannot exceed subtotal
- FI-LI-004: Unit price ≥ 0
- FI-LI-005: Quantity ≥ 1

### Design Notes

- LineItem is a child entity, not a value object, because it has identity, lifecycle, and can be independently referenced (e.g., for partial refunds).
- Price overrides capture the original treatment-plan-estimated price alongside the actual billed price for reporting and audit.

---

## 4. Entity: Payment

| Attribute | Description |
|---|---|
| **Type** | Aggregate Root |
| **Identity** | `PaymentId` (UUID — internal); `PaymentNumber` (sequential — display) |
| **Phase** | MVP |

### Purpose

Payment records the transfer of funds from a patient to the clinic. It is an independent aggregate root because a single payment can span multiple invoices.

### Responsibilities

- Record the total amount, method, date, and reference of a payment
- Own PaymentAllocation records that distribute the payment across invoices
- Track reversal status (fully/partially reversed)
- Provide refund traceability through allocation references

### Lifecycle

```
Recorded → Payment enters Completed status
Refund → Payment becomes Refunded
Reversal → Payment becomes Reversed
Void → Payment becomes Void
```

### Ownership

- **Owns:** PaymentAllocation entities
- **References:** Patient (mandatory), User who recorded payment

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Patient | Reference (not owned) | 1:1 | Payment from a specific patient |
| PaymentAllocation | Composition (owned) | 1:N | Allocations distributing payment to invoices |
| Receipt | Reference | 1:1 | Automatically generated receipt |
| User (Recorder) | Reference (not owned) | N:1 | User who recorded the payment |

### Business Rules

- BR-60: Must be allocated to at least one invoice
- BR-61: Amount > 0
- BR-62: Allocations must sum to payment total
- BR-63: Allocation cannot exceed invoice outstanding balance (unless overpayment permitted)
- BR-65: Cheque payments require cheque number
- BR-66: Card payments should record transaction ID
- BR-67: Reversal records original payment, reason, authorizer
- BR-68: Reversal restores invoice balance

### Invariants

- FI-PMT-001: Paid amount cannot exceed invoice grand total (unless overpayment permitted)
- FI-PMT-002: Must be allocated to at least one invoice
- FI-PMT-003: Allocations must sum to payment total
- FI-PMT-004: Amount > 0
- FI-PMT-005: Reversal restores invoice balance

### Design Notes

- Payment is an aggregate root because it must maintain its own consistency invariants (allocation total = payment amount) independently of any single invoice.
- The `reversed` flag and `reversal_reason` fields support audit without hard-deleting the original record.

---

## 5. Entity: PaymentAllocation

| Attribute | Description |
|---|---|
| **Type** | Child Entity (owned by Payment) |
| **Identity** | `PaymentAllocationId` (UUID) |
| **Phase** | MVP |

### Purpose

PaymentAllocation links a Payment to an Invoice and records how much of the payment is applied to that specific invoice. This entity enables partial payments, multi-invoice consolidated payments, overpayments, and refunds.

### Responsibilities

- Record the amount allocated from a payment to a specific invoice
- Support refund allocations (is_refund flag) linked to the original allocation
- Enable overpayment tracking through the originating allocation

### Lifecycle

```
Created → With the parent payment
Reversed → When a refund is processed (Phase 2)
```

### Ownership

- **Owned by:** Payment aggregate root

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Payment | Parent (composition) | N:1 | Belongs to exactly one payment |
| Invoice | Reference (not owned) | N:1 | Allocated to exactly one invoice |

### Business Rules

- Inherits from Payment (BR-60 through BR-68)

### Design Notes

- `is_refund` flag differentiates positive allocations (payment applied) from negative allocations (refund). This allows a single PaymentAllocation entity to model both directions.
- `original_allocation_id` provides refund traceability — each refund allocation references the allocation it reverses.

---

## 6. Entity: Receipt

| Attribute | Description |
|---|---|
| **Type** | Aggregate Root |
| **Identity** | `ReceiptId` (UUID — internal); `ReceiptNumber` (sequential — display) |
| **Phase** | MVP |

### Purpose

A Receipt is a formal acknowledgment of payment. It is generated via an explicit API call for a completed payment and serves as the patient's proof of payment.

### Responsibilities

- Provide a formal record of a completed payment transaction
- Reference the payment(s) and invoice(s) involved
- Serve as an immutable document for patient and audit purposes

### Lifecycle

```
Generated → Created via explicit API call with payment_id
Cancelled → Cancelled (terminal)
```

### Ownership

- **Independent aggregate root** (read-only after creation)

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Payment | Reference (not owned) | 1:1 | References the originating payment |
| Invoice | Reference (not owned) | 1:N | References the invoice(s) paid |

### Business Rules

- BR-70: Generated via explicit API call with payment_id
- BR-71: References the payment
- BR-72: References the invoice(s)
- BR-73: Unique receipt number
- BR-75: Re-printable anytime
- BR-76: Not modifiable after generation

### Design Notes

- Receipt is a read-only aggregate. It is created once and never modified.
- Consolidated receipts (covering multiple invoices from one payment) are supported via multiple invoice references.

---

## 7. Entity: CreditNote

| Attribute | Description |
|---|---|
| **Type** | Aggregate Root |
| **Identity** | `CreditNoteId` (UUID — internal); `CreditNoteNumber` (sequential — display) |
| **Phase** | Phase 2 |

### Purpose

A Credit Note is a financial document issued to correct an invoice — for price adjustments, returned services, or billing errors. It preserves the original invoice while transparently recording the correction.

### Responsibilities

- Record the correction amount and reason
- Reference the original invoice being corrected
- Track application status (unapplied, partially applied, fully applied)
- Enforce expiry and immutability rules

### Lifecycle

```
Draft → Editable
Issued → Immutable, available for application
Applied → Used to reduce invoice balance
Expired → Validity period passed
Void → Cancelled before or after issuance
```

### Ownership

- **Independent aggregate root**

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Invoice | Reference (not owned) | N:1 | References the corrected invoice |
| Patient | Reference (not owned) | 1:1 | Belongs to the patient |

### Business Rules

- BR-90: Must reference an invoice
- BR-91: Amount cannot exceed invoice grand total
- BR-93: Unique credit note number
- BR-95: Configurable expiry period
- BR-97: Immutable after issuance
- BR-98: Void reason required for voiding

### Design Notes

- CreditNote is an aggregate root because it has its own lifecycle (Draft → Issued → Applied/Expired/Void) and consistency invariants independent of the Invoice it corrects.
- The expiry mechanism prevents stale credit from lingering indefinitely.

---

## 8. Entity: InvoiceStatusHistory

| Attribute | Description |
|---|---|
| **Type** | Child Entity / Value Object (owned by Invoice) |
| **Identity** | `InvoiceStatusHistoryId` (UUID) |
| **Phase** | MVP |

### Purpose

Records every status transition of an Invoice, providing a complete audit trail of the invoice lifecycle.

### Responsibilities

- Record old status, new status, user, timestamp, and reason for each transition
- Provide an append-only history of state changes

### Lifecycle

```
Created → When invoice status changes
Never modified → Append-only
```

### Ownership

- **Owned by:** Invoice aggregate root

### Business Rules

- BR-112: Records old status, new status, user, timestamp, reason

### Design Notes

- This can be modeled as a child entity or a value object collection within the Invoice aggregate. The choice depends on whether individual history records need to be independently referenced.

---

## 9. Entity: PatientCredit

| Attribute | Description |
|---|---|
| **Type** | Aggregate Root (or child of Patient) |
| **Identity** | `PatientCreditId` (UUID) |
| **Phase** | MVP (overpayment), Phase 3 (wallet) |

### Purpose

PatientCredit tracks positive balances owed to a patient — from overpayments, credit notes, or advance payments. This balance can be applied to future invoices.

### Responsibilities

- Record the current available credit balance
- Track credit consumption against invoices
- Support expiry (credit notes) and non-expiry (overpayment) credit

### Lifecycle

```
Created → From overpayment or credit note
Consumed → Applied to future invoices
Expired → If credit note has expiry
```

### Ownership

- **Independent aggregate root** or **owned by Patient context** (depending on architectural decision)

### Relationships

| Entity | Relationship Type | Cardinality | Description |
|---|---|---|---|
| Patient | Reference (not owned) | N:1 | Belongs to a patient |
| PaymentAllocation | Reference (not owned) | 0:1 | Originating overpayment allocation |
| CreditNote | Reference (not owned) | 0:1 | Originating credit note |

### Design Notes

- PatientCredit sits at the boundary between the Billing context and the Patient context. In Phase 1 (overpayments only), it is managed within Billing. In Phase 3 (patient wallet), it may migrate to the Patient context.
- Credit balance is computed (credits granted − credits consumed) rather than stored, to prevent data inconsistency.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [08-domain-model.md](08-domain-model.md) |
| **Related** | [10-value-objects.md](10-value-objects.md), [11-aggregate-design.md](11-aggregate-design.md) |
| **Next Reading** | [10-value-objects.md](10-value-objects.md) |
