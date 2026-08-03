# Future Compatibility — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document describes how the Billing module's database schema is designed to accommodate future requirements without requiring a schema redesign. It covers extensibility points, planned evolution paths, and the interfaces between current and future functionality.

---

## 2. Future Feature Readiness

| Future Feature | Current Design | Migration Path |
|---|---|---|
| **Insurance Support** | Patient credit + payment method field supports patient-paid → insurance-reimbursed workflow | Add `insurance_claim_id` to `invoice_line_items`; add `insurance_policies` table; no core schema changes |
| **GST / Tax** | `tax_rate_id` and `tax_amount` on `invoice_line_items` exist but default to zero | Enable via configuration; add jurisdiction-level rates to `tax_rates`; no schema changes needed |
| **Payment Gateway** | `reference_number` on `payments` accepts any gateway transaction ID | Add gateway-specific columns or a `gateway_transactions` table; `payments` table unchanged |
| **Multi-branch** | UUID PKs enable cross-branch uniqueness; `document_sequences` supports branch-specific prefixes | Add `branch_id` column to core tables; branch-specific sequences via prefix |
| **Patient Wallet** | `patient_credits` table with `remaining_amount` and `expiry_date` | Add wallet-specific fields; extend `patient_credits` or create `patient_wallet` table |
| **Multi-currency** | `currency` column on `invoices` with ISO 4217; `Money` value object | Extend `tax_rates` with currency; add exchange rate freezing at invoice creation |
| **Notifications** | No notification-specific schema needed | Notifications module reads billing events; no Billing schema changes |
| **Accounting Integration** | Audit columns and immutable records provide source data | Journal entry extraction queries; no schema changes |

---

## 3. Extension Points (MVP Schema)

The MVP schema includes these extension points that can be activated later:

| Extension Point | Current Table | Column(s) | Future Use |
|---|---|---|---|
| Tax rates | `invoice_line_items` | `tax_rate_id`, `tax_amount` | Currently NULL; populated when tax is enabled |
| Gateway reference | `payments` | `reference_number` | Currently optional; will store gateway transaction ID |
| Source plan | `invoices` | `treatment_plan_id` | Optional reference; required for plan-linked billing |
| Source plan item | `invoice_line_items` | `plan_item_id` | Optional reference; enables treatment-vs-billed comparison |
| Payment method | `payments` | `payment_method` | Extensible VARCHAR; 'Wallet', 'Insurance' can be added |
| Patient credit source | `patient_credits` | `source_allocation_id`, `source_credit_note_id` | Enables full credit traceability |
| Expiry | `patient_credits` | `expiry_date` | Optional; used for credit-note-sourced credits |

---

## 4. Schema Evolution Examples

### 4.1 Adding Branch Support (Phase 3)

```
Current: invoices.patient_id (UUID)
Add:     invoices.branch_id (UUID, nullable)
Add:     document_sequences already supports prefix-based branch separation
         e.g., branch "BR1" → prefix "BR1-INV-"
```

### 4.2 Adding Insurance (Phase 3)

```
New table: insurance_claims
  claim_id UUID PK
  invoice_id UUID FK → invoices
  patient_id UUID
  policy_number VARCHAR
  claim_amount NUMERIC(12,2)
  status VARCHAR(30)

New table: insurance_payments
  insurance_payment_id UUID PK
  claim_id UUID FK → insurance_claims
  payment_id UUID FK → payments
  amount NUMERIC(12,2)
```

### 4.3 Enabling GST (Phase 2 → Phase 3)

```
No schema changes needed:
1. Populate tax_rates with actual rates (e.g., 5% GST, 10% VAT)
2. Invoice line items reference tax_rate_id
3. Tax computation enabled in invoice calculation
```

---

## 5. Backward Compatibility Policy

| Change Type | Policy |
|---|---|
| **Add nullable column** | Always backward compatible |
| **Add NOT NULL column with default** | Always backward compatible |
| **Add table** | Always backward compatible |
| **Add index** | Always backward compatible |
| **Modify column type** | Requires migration; prefer adding new column + deprecating old |
| **Drop column** | Requires deprecation period; never drop columns with audit data |
| **Drop table** | Never; use status-based retirement instead |
| **Rename table/column** | Avoid; migration must handle both old and new names |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [11-performance-considerations.md](11-performance-considerations.md) |
| **Next** | [13-schema-review-checklist.md](13-schema-review-checklist.md) |
