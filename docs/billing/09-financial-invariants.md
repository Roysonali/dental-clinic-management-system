# Financial Invariants — Billing Module

> **Document Type:** Invariant Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Document immutable financial truths that the system must always maintain — business rules that cannot be violated under any circumstances.

| Field | Value |
|---|---|
| Document | Financial Invariants |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 06-business-rules.md, 07-workflows.md, adr/ADR-002-immutable-invoice.md |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Invoice Invariants](#2-invoice-invariants)
3. [Line Item Invariants](#3-line-item-invariants)
4. [Payment Invariants](#4-payment-invariants)
5. [Refund Invariants](#5-refund-invariants)
6. [Credit Note Invariants](#6-credit-note-invariants)
7. [Receipt Invariants](#7-receipt-invariants)
8. [Numbering Invariants](#8-numbering-invariants)
9. [Audit Invariants](#9-audit-invariants)
10. [Cross-Entity Invariants](#10-cross-entity-invariants)

---

## 1. Purpose

Financial invariants are immutable truths that the Billing module must always maintain. Unlike business rules (which may have exceptions or be configurable), invariants are absolute — they must hold at all times, across all states, for all transactions. Violating an invariant represents a financial integrity failure.

These invariants guide the database schema design, service layer validations, and testing strategy. They are the foundation upon which all billing logic is built.

---

## 2. Invoice Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-INV-001 | Invoice totals cannot change after issuance | Once an invoice transitions to Issued status, its line items, subtotal, discount, tax, and grand total are permanently frozen. No in-place modifications are permitted. | BR-12 |
| FI-INV-002 | An invoice must have at least one line item | An invoice with zero charges is not a valid financial document. The grand total must be ≥ 0. | BR-2, BR-13 |
| FI-INV-003 | An invoice belongs to exactly one patient | Every invoice must reference a valid patient. An invoice cannot be created without a patient. | BR-1 |
| FI-INV-004 | Invoice grand total is derived, not stored independently | The grand total must always be computed as: subtotal − total discount + total tax. It is never accepted from client input. | BR-4, BR-5 |
| FI-INV-005 | An invoice cannot have a negative grand total | An invoice represents charges owed. A negative total must be handled through a credit note, not by creating a negative invoice. | BR-7 |

---

## 3. Line Item Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-LI-001 | A line item cannot exist without a parent invoice | Line items are always owned by an invoice. Orphaned line items are not permitted. | ADR-001 |
| FI-LI-002 | Line item net amount must equal (unit price × quantity) − discount | The net amount is computed, not stored independently. | BR-33 |
| FI-LI-003 | A line item discount cannot exceed the line item subtotal | Discounting more than the line item value is not permitted (would create negative charges). | BR-36 |
| FI-LI-004 | Unit price must be ≥ 0 | Prices cannot be negative. Zero is allowed for complimentary items. | BR-31 |
| FI-LI-005 | Quantity must be ≥ 1 | Zero or negative quantities are not valid. | BR-32 |

---

## 4. Payment Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-PMT-001 | Paid amount cannot exceed invoice grand total | The sum of all payments allocated to an invoice cannot exceed the invoice's grand total, unless the clinic explicitly permits overpayment. | BR-63 |
| FI-PMT-002 | A payment must be allocated to at least one invoice | Every payment must be attributable to one or more invoices. Unattached payments are not permitted. | BR-60 |
| FI-PMT-003 | Payment allocation amounts must sum to the payment total | The total of all PaymentAllocation records for a Payment must equal the Payment's total amount. | BR-62 |
| FI-PMT-004 | A payment amount must be greater than zero | Zero or negative payments are not valid financial transactions. | BR-61 |
| FI-PMT-005 | A reversed payment must restore the invoice balance | When a payment is reversed, the invoice outstanding balance must increase by the reversed amount. | BR-68 |

---

## 5. Refund Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-RFD-001 | A refund amount cannot exceed the original payment amount | A refund must not return more money than was originally paid. | BR-81 |
| FI-RFD-002 | A refund must reference an existing payment | Every refund must be traceable to the original payment it is correcting. | BR-80 |
| FI-RFD-003 | A refund cannot be applied to a payment that is already fully refunded | Double-refunding the same payment is not permitted. | — |

---

## 6. Credit Note Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-CN-001 | A credit note must reference an existing invoice | Every credit note is a correction to an invoice. Orphaned credit notes are not permitted. | BR-90 |
| FI-CN-002 | A credit note amount cannot exceed the invoice grand total | Crediting more than the original invoice value is not permitted. | BR-91 |
| FI-CN-003 | A credit note cannot be modified after issuance | Once issued, a credit note is immutable. Only voiding is permitted. | BR-97 |
| FI-CN-004 | An expired credit note cannot be applied | Credit notes have a configured validity period. Expired credit notes cannot reduce invoice balances. | BR-96 |

---

## 7. Receipt Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-RCP-001 | A receipt cannot be modified after generation | Receipts are records of completed transactions. They are immutable once created. | BR-76 |
| FI-RCP-002 | Every completed payment should have a corresponding receipt | Receipts are generated via an explicit API call for completed payments. | BR-70 |

---

## 8. Numbering Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-NUM-001 | Invoice numbers must be unique and non-reusable | Two invoices must never share the same number. Cancelled and voided invoice numbers are retired permanently. | BR-3, BR-104 |
| FI-NUM-002 | Receipt numbers must be unique and non-reusable | Same rule applies as FI-NUM-001, within the receipt sequence. | BR-73, BR-105 |
| FI-NUM-003 | Credit note numbers must be unique and non-reusable | Same rule applies as FI-NUM-001, within the credit note sequence. | BR-93, BR-105 |
| FI-NUM-004 | Each document type uses an independent number sequence | Invoice, receipt, and credit note numbers each have their own separate sequence. | BR-106 |

---

## 9. Audit Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-AUD-001 | Every financial record must have a creation user and timestamp | No financial record may be created without identifying who created it and when. | BR-110 |
| FI-AUD-002 | Every status change must be recorded with old/new values and reason | Invoice status changes must always include the previous status, new status, user, timestamp, and reason. | BR-112 |
| FI-AUD-003 | Audit records must be append-only | No audit record may be modified or deleted after creation. | BR-114 |
| FI-AUD-004 | Price overrides must always be tracked | Every price change from a treatment plan estimate must record the original and new values. | BR-113 |

---

## 10. Cross-Entity Invariants

| # | Invariant | Description | Referenced By |
|---|---|---|---|
| FI-CROSS-001 | Outstanding balance must equal grand total − sum(payments) + sum(refunds) − applied credits | The outstanding balance is always derived, never stored independently. | BR-84, BR-94 |
| FI-CROSS-002 | A treatment plan can have at most one active invoice at any time | A plan cannot be billed twice. If an invoice is cancelled or voided, a new invoice can be created. | BR-121 |
| FI-CROSS-003 | Financial records cannot be hard-deleted | No invoice, payment, receipt, credit note, or refund record may be permanently deleted after creation. | BR-8, BR-116, BR-117 |
| FI-CROSS-004 | All line items on a single invoice must use the same currency | Mixed-currency invoices are not permitted. | BR-140 |
| FI-CROSS-005 | Tax rate applied at invoice creation is frozen for that invoice | Changes to tax rates must not retroactively affect issued invoices. | BR-52 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [06-business-rules.md](06-business-rules.md) |
| **Related** | [adr/ADR-002-immutable-invoice-after-issuance.md](adr/ADR-002-immutable-invoice-after-issuance.md), [07-workflows.md](07-workflows.md) |
| **Next Reading** | [10-module-interaction-matrix.md](10-module-interaction-matrix.md) |
