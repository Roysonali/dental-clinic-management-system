# Entity-Relationship Diagram — Billing Module

> **Document Type:** Conceptual ER Diagram (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Entity-Relationship Diagram |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 12-entity-relationships.md, 11-aggregate-design.md, diagrams/entity-relationship.md |

---

## 1. Purpose

This document presents the conceptual entity-relationship diagram for the Billing domain model. It shows all domain entities, their attributes (conceptually), and the relationships between them. This is an implementation-independent ER diagram — it describes *what* exists and *how* entities relate, without specifying database schema details.

---

## 2. Conceptual ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     INVOICE (Aggregate Root)                      │   │
│  │──────────────────────────────────────────────────────────────────│   │
│  │  PK: InvoiceId (UUID)                                            │   │
│  │  FK: PatientId (reference to Patient module)                     │   │
│  │  FK: TreatmentPlanId (optional — reference to Treatment Plans)    │   │
│  │  FK: AppointmentId (optional — reference to Appointments)         │   │
│  │  FK: DoctorId (optional — reference to Doctors)                  │   │
│  │  FK: CreatedBy (reference to Users)                               │   │
│  │  FK: UpdatedBy (reference to Users)                               │   │
│  │                                                                   │   │
│  │  InvoiceNumber (value object)                                     │   │
│  │  InvoiceDate (Date)                                               │   │
│  │  DueDate (Date)                                                   │   │
│  │  Status (InvoiceStatus enum)                                      │   │
│  │  Currency (CurrencyCode)                                          │   │
│  │  Notes (Text — mutable, append-only after issue)                  │   │
│  │  CancellationReason (Text — nullable)                             │   │
│  │  VoidReason (Text — nullable)                                     │   │
│  │  CreatedAt (Timestamp)                                            │   │
│  │  UpdatedAt (Timestamp)                                            │   │
│  └──────────────────┬───────────────────────────────────────────────┘   │
│                     │                                                    │
│         ┌───────────┴───────────┐                                        │
│         │                       │                                        │
│         ▼                       ▼                                        │
│  ┌──────────────┐   ┌──────────────────────┐                            │
│  │   LINE ITEM   │   │INVOICE STATUS HISTORY│                            │
│  │──────────────│   │──────────────────────│                            │
│  │ PK: LineItemId│   │ PK: StatusHistoryId  │                            │
│  │ FK: InvoiceId │   │ FK: InvoiceId        │                            │
│  │(composition)  │   │(composition)         │                            │
│  │               │   │                      │                            │
│  │ Description   │   │ FromStatus           │                            │
│  │ Quantity      │   │ ToStatus             │                            │
│  │ UnitPrice     │   │ ChangedBy            │                            │
│  │ Discount      │   │ ChangedAt            │                            │
│  │ DiscountType  │   │ Reason               │                            │
│  │ NetAmount     │   └──────────────────────┘                            │
│  │ TaxRateId     │                                                       │
│  │ TaxAmount     │  ← Phase 2                                            │
│  │ FK: PlanItemId│                                                       │
│  │ DiagnosisRef  │  ← Optional                                           │
│  └───────┬───────┘                                                       │
│          │                                                               │
│          │              ┌─────────────────────────────────────────┐      │
│          │              │          PAYMENT (Aggregate Root)        │      │
│          │              │─────────────────────────────────────────│      │
│          │              │  PK: PaymentId (UUID)                    │      │
│          └──────────────┤  FK: PatientId (reference to Patients)   │      │
│                         │  FK: CreatedBy (reference to Users)      │      │
│                         │                                          │      │
│                         │  PaymentNumber (value object)            │      │
│                         │  PaymentMethod (enum)                    │      │
│                         │  TotalAmount (Money)                     │      │
│                         │  PaymentDate (Date)                      │      │
│                         │  ReferenceNumber (nullable)              │      │
│                         │  IsReversed (Boolean)                    │      │
│                         │  ReversalReason (nullable)               │      │
│                         │  Notes (Text)                            │      │
│                         └──────────────┬──────────────────────────┘      │
│                                        │                                 │
│                                        ▼                                 │
│                         ┌──────────────────────────────┐                 │
│                         │    PAYMENT ALLOCATION         │                 │
│                         │──────────────────────────────│                 │
│                         │  PK: AllocationId (UUID)      │                 │
│                         │  FK: PaymentId (composition)  │                 │
│                         │  FK: InvoiceId (reference)    │                 │
│                         │                               │                 │
│                         │  AllocatedAmount (Money)      │                 │
│                         │  IsRefund (Boolean)           │                 │
│                         │  RefundReason (nullable)      │                 │
│                         │  FK: OriginalAllocationId     │                 │
│                         │     (self-ref — for refunds)  │                 │
│                         │  CreatedAt (Timestamp)        │                 │
│                         └──────────────────────────────┘                 │
│                                                                            │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────┐    │
│  │    RECEIPT       │   │  CREDIT NOTE    │   │   PATIENT CREDIT     │    │
│  │  (Agg Root)      │   │  (Agg Root)     │   │   (Agg Root)         │    │
│  │─────────────────│   │─────────────────│   │──────────────────────│    │
│  │ PK: ReceiptId    │   │ PK: CreditNoteId│   │ PK: PatientCreditId  │    │
│  │ FK: PaymentId    │   │ FK: InvoiceId   │   │ FK: PatientId        │    │
│  │ FK: InvoiceId(s) │   │ FK: PatientId   │   │ FK: SourceAllocId    │    │
│  │                  │   │                 │   │ FK: SourceCreditNote │    │
│  │ ReceiptNumber    │   │ CreditNoteNumber│   │                      │    │
│  │ ReceiptDate      │   │ IssueDate       │   │ OriginalAmount       │    │
│  │ Amount           │   │ Amount          │   │ RemainingAmount      │    │
│  │ CreatedAt        │   │ Reason          │   │ ExpiryDate           │    │
│  │                  │   │ Status          │   │ (nullable)           │    │
│  │                  │   │ ExpiryDate      │   │ CreatedAt            │    │
│  │                  │   │ VoidReason      │   │                      │    │
│  └─────────────────┘   └─────────────────┘   └──────────────────────┘    │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    DOCUMENT SEQUENCE (Utility)                      │  │
│  │────────────────────────────────────────────────────────────────────│  │
│  │  DocumentType (PK) — 'invoice', 'receipt', 'payment', 'refund',    │  │
│  │                     'credit_note'                                  │  │
│  │  Prefix, CurrentValue, MinDigits, StartValue, UpdatedAt, UpdatedBy │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                  SEQUENCE CONSUMPTION LOG                           │  │
│  │────────────────────────────────────────────────────────────────────│  │
│  │  PK: Id, DocumentType, NumberAssigned, ReservedAt, ReservedBy,     │  │
│  │  DocumentId (nullable — NULL if creation failed), Status            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Relationship Summary

| Entity A | Relationship | Entity B | Cardinality | Description |
|---|---|---|---|---|
| Invoice | owns → | LineItem | 1:N | Composition — invoice owns its line items |
| Invoice | owns → | InvoiceStatusHistory | 1:N | Composition — invoice owns its status history |
| Payment | owns → | PaymentAllocation | 1:N | Composition — payment owns its allocations |
| PaymentAllocation | allocates → | Invoice | N:1 | Each allocation targets one invoice |
| PaymentAllocation | self-ref → | PaymentAllocation | 0:1 | Refund allocation references original (optional) |
| Receipt | references → | Payment | N:1 | Receipt references the originating payment |
| Receipt | references → | Invoice | N:N | Receipt references one or more invoices |
| CreditNote | corrects → | Invoice | N:1 | Credit note references the corrected invoice |
| PatientCredit | originates from → | PaymentAllocation | 0:1 | Optional source (overpayment) |
| PatientCredit | originates from → | CreditNote | 0:1 | Optional source (credit note surplus) |

---

## 4. External References (Not Owned by Billing)

| Entity | Reference | External Module | Cardinality |
|---|---|---|---|
| Invoice | → PatientId | Patient Management | 1:1 |
| Invoice | → TreatmentPlanId | Treatment Plans | 0:1 |
| Invoice | → AppointmentId | Appointment Management | 0:1 |
| Invoice | → DoctorId | Doctor Management | 0:1 |
| Invoice | → CreatedBy | User Management | N:1 |
| Invoice | → UpdatedBy | User Management | N:1 |
| LineItem | → PlanItemId | Treatment Plans | 0:1 |
| LineItem | → DiagnosisId | Patient Records | 0:1 |
| Payment | → PatientId | Patient Management | 1:1 |
| Payment | → CreatedBy | User Management | N:1 |
| CreditNote | → PatientId | Patient Management | 1:1 |
| PatientCredit | → PatientId | Patient Management | 1:1 |

---

## 5. Key Modeling Decisions

| Decision | Rationale |
|---|---|
| PaymentAllocation as separate entity | Enables partial payments, multi-invoice payments, and refund traceability (see ADR-004) |
| PaymentAllocation owned by Payment | A payment must maintain its allocation total invariant. Placing allocations in the Payment aggregate ensures the sum of allocations always equals the payment amount. |
| Receipt as standalone aggregate | Receipts are read-only documents created via explicit API call. They have no transactional relationship with other aggregates after creation. |
| InvoiceStatusHistory as lazy-loaded | Status history is needed only for audit display, not for business logic. Lazy loading optimizes common invoice operations. |
| External references by ID only | Avoids tight coupling with other modules. Billing never owns data managed by other DensCare modules. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [12-entity-relationships.md](12-entity-relationships.md), [11-aggregate-design.md](11-aggregate-design.md) |
| **Related** | [diagrams/entity-relationship.md](diagrams/entity-relationship.md) |
| **Next Reading** | [19-architecture-decisions.md](19-architecture-decisions.md) |
