# Integration Boundaries — Billing Module

> **Document Type:** Integration Boundary Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Integration Boundaries |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 10-module-interaction-matrix.md, 11-aggregate-design.md, 12-entity-relationships.md |

---

## 1. Purpose

This document defines how the Billing module integrates with other DensCare modules. It specifies what data Billing consumes from and produces for each module, the ownership boundaries, and the nature of the integration (hard vs. soft dependency).

**Key principle:** Billing must not own data managed by other modules. It references external entities by ID only.

---

## 2. Integration Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Billing Module                                │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Owned Data (Billing)                         │  │
│  │  Invoice, LineItem, Payment, PaymentAllocation, Receipt,         │  │
│  │  CreditNote, PatientCredit, DocumentSequence, StatusHistory      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│              │                    │                    │                │
│              ▼                    ▼                    ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Read from    │    │ Write to     │    │ Read from    │              │
│  │ (by ID ref)  │    │ (events)     │    │ (queries)    │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Integration Details

### 3.1 Authentication Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Hard |
| **Information Consumed** | User identity (user_id, username, authentication token) |
| **Information Produced** | None |
| **Business Dependency** | All billing operations require authenticated users. Every financial record must record who performed the action. |
| **Integration Direction** | Billing → Auth (reads user identity at request time) |
| **Ownership** | Auth module owns user credentials and authentication state. Billing stores only user_id references on audit fields (created_by, updated_by). |

### 3.2 RBAC Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Hard |
| **Information Consumed** | User role assignments, permission grants (e.g., can_create_invoice, can_void_invoice, can_approve_discount) |
| **Information Produced** | None |
| **Business Dependency** | Every billing operation must be authorized against the caller's permissions. Sensitive operations (void, refund, discount approval) require elevated permissions. |
| **Integration Direction** | Billing → RBAC (reads permissions at request time) |
| **Ownership** | RBAC module owns role definitions and permission assignments. Billing defines which permissions are required for each operation (see 05-user-roles-and-permissions.md). |

### 3.3 User Management Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Hard |
| **Information Consumed** | User profile data (name, role, department) for audit trail display, payment attribution, receipt display |
| **Information Produced** | None (Billing records user_id references) |
| **Business Dependency** | Financial audit trail requires attribution to a user. Receipts display the collector's name. |
| **Integration Direction** | Billing → Users (reads user data); Users → Billing (no data produced by Billing) |
| **Ownership** | User Management owns user profiles. Billing stores only user_id as a foreign reference. |

### 3.4 Patient Management Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Hard |
| **Information Consumed** | Patient identity (patient_id, name, contact, patient status) |
| **Information Produced** | None (Billing records patient_id references on financial records) |
| **Business Dependency** | Every invoice, payment, credit note, and patient credit references exactly one patient. Patient data appears on all financial documents. |
| **Integration Direction** | Billing → Patients (reads patient data for display and validation); Patients → Billing (no data owned by Billing) |
| **Ownership** | Patient Management owns patient demographic data. Billing owns only the patient_id reference on financial records. **Patient-merged scenario (EC-7):** When patient records are merged, financial record references must be updated to point to the target patient. This is a cross-module operation. |

### 3.5 Doctor Management Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Soft |
| **Information Consumed** | Doctor identity (doctor_id, name, specialization) for invoice reference |
| **Information Produced** | None |
| **Business Dependency** | Invoices may optionally reference the treating doctor for reporting (revenue by doctor). Not required for core invoicing. |
| **Integration Direction** | Billing → Doctors (reads doctor data for display) |
| **Ownership** | Doctor Management owns doctor profiles. Billing stores only doctor_id on invoice records. |

### 3.6 Appointment Management Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Soft |
| **Information Consumed** | Appointment identity (appointment_id, date, time) for invoice reference |
| **Information Produced** | None |
| **Business Dependency** | Invoices may optionally reference the appointment that generated the charges. Provides clinical context for billing. |
| **Integration Direction** | Billing → Appointments (reads appointment reference) |
| **Ownership** | Appointment Management owns appointment data. Billing stores only appointment_id on invoice records. |

### 3.7 Patient Records Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Soft |
| **Information Consumed** | Diagnosis references (diagnosis_id, description) for line item clinical context |
| **Information Produced** | None |
| **Business Dependency** | Invoice line items may optionally reference diagnoses from patient records for clinical context (e.g., "Scaling performed for chronic periodontitis"). |
| **Integration Direction** | Billing → Patient Records (reads diagnosis reference) |
| **Ownership** | Patient Records owns diagnosis data. Billing stores only diagnosis_id on line item records. |

### 3.8 Treatment Plans Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Hard (for plan-linked invoices) |
| **Information Consumed** | Treatment plan items with procedure details and cost estimates; treatment plan status |
| **Information Produced** | Invoice creation status (marks plan items as invoiced); invoice ID reference on plan |
| **Business Dependency** | The primary mechanism for generating invoices is from treatment plans. Billing consumes plan cost estimates as default line item prices and reports back which items have been billed. |
| **Integration Direction** | Billing ↔ Treatment Plans (bidirectional — reads plan data, writes invoiced status) |
| **Ownership** | Treatment Plans owns plan data, including cost estimates. Billing owns invoice data. The "invoiced" status on treatment plan items is a cross-module concern: either the plan module maintains it (and Billing notifies it), or Billing manages it (and the plan module queries it). **Recommendation:** Treatment Plans module owns the "invoiced" status, updated via a domain event or service call from Billing. |

### 3.9 Dashboard Module

| Aspect | Description |
|---|---|
| **Dependency Type** | Soft |
| **Information Consumed** | None (Dashboard queries Billing data) |
| **Information Produced** | Financial metrics: daily/monthly revenue, outstanding balance, collection rate, overdue count, revenue by doctor/procedure |
| **Business Dependency** | Dashboard displays billing KPIs for clinic management. Billing must expose query interfaces for these metrics. |
| **Integration Direction** | Dashboard → Billing (reads aggregated billing data) |
| **Ownership** | Billing owns the raw financial data. Dashboard owns the visualization and aggregation logic (but may cache or pre-aggregate Billing data). |

### 3.10 Inventory Module (Future)

| Aspect | Description |
|---|---|
| **Dependency Type** | Future / Soft |
| **Information Consumed** | Product/consumable prices for line items (consumables used during procedures) |
| **Information Produced** | Inventory consumption records (items billed to patients) |
| **Business Dependency** | When inventory items are used during treatment, the Billing module should be able to add them as invoice line items with prices sourced from the Inventory module. |
| **Integration Direction** | Billing ↔ Inventory (bidirectional — reads prices, records consumption) |
| **Ownership** | Inventory owns product data and stock levels. Billing owns the charges. Inventory consumption is updated when an invoice including inventory items is issued. |

### 3.11 Notifications Module (Future)

| Aspect | Description |
|---|---|
| **Dependency Type** | Future / Soft |
| **Information Consumed** | Notification delivery status (optional) |
| **Information Produced** | Notification triggers: overdue invoice alert, receipt available, payment confirmed, credit note issued |
| **Business Dependency** | Patients and staff should be notified of billing events (invoice issued, payment due, receipt available). |
| **Integration Direction** | Billing → Notifications (triggers notifications) |
| **Ownership** | Notifications owns delivery configuration (email templates, SMS gateways). Billing owns the event triggers. |

### 3.12 Insurance Module (Future)

| Aspect | Description |
|---|---|
| **Dependency Type** | Future / Hard (when enabled) |
| **Information Consumed** | Insurance eligibility, coverage details, claim status, copay amounts |
| **Information Produced** | Claim submissions (invoice data mapped to insurance claim format); claim status updates |
| **Business Dependency** | When insurance is involved, the invoice may need to be split into patient-pay and insurance-pay portions. Claims are submitted using invoice line item data. |
| **Integration Direction** | Billing ↔ Insurance (bidirectional — reads coverage, writes claims) |
| **Ownership** | Insurance module owns insurance policy data and claim processing. Billing owns the invoice data used as claim input. |

---

## 4. Data Ownership Matrix

| Data Element | Owned By | Referenced By (Billing) |
|---|---|---|
| Patient identity & demographics | Patient Management | invoice.patient_id, payment.patient_id, credit_note.patient_id |
| User identity & profile | User Management | invoice.created_by, invoice.updated_by, payment.created_by |
| Doctor identity & specialization | Doctor Management | invoice.doctor_id (optional) |
| Appointment details | Appointment Management | invoice.appointment_id (optional) |
| Diagnosis records | Patient Records | line_item.diagnosis_id (optional) |
| Treatment plan & cost estimates | Treatment Plans | invoice.treatment_plan_id (optional) |
| Treatment plan item invoiced status | Treatment Plans (recommended) | Updated by Billing when invoice is created |
| Invoice data | **Billing** | — |
| Line item data | **Billing** | — |
| Payment data | **Billing** | — |
| Payment allocation data | **Billing** | — |
| Receipt data | **Billing** | — |
| Credit note data | **Billing** (Phase 2) | — |
| Patient credit data | **Billing** | — |
| Document number sequences | **Billing** | — |
| Invoice status history | **Billing** | — |

---

## 5. Integration Design Rules

| Rule | Description |
|---|---|
| **No direct database access** | Billing must not read from or write to other modules' database tables directly. All cross-module data access goes through the owning module's service interface or API. |
| **ID-only references** | Billing stores only foreign IDs for data owned by other modules. It does not cache or duplicate other modules' data unless explicitly required for performance (with synchronization strategy). |
| **Event-driven integration** | Cross-module updates (e.g., marking plan items as invoiced) use domain events, not direct service calls within the same transaction. This prevents cross-module transaction coupling. |
| **Ownership boundary enforcement** | Billing must never attempt to insert, update, or delete data owned by other modules through any path other than the owning module's public interface. |
| **Read-model optimization** | For performance-sensitive queries (e.g., invoice listing with patient name), Billing may maintain a read-optimized projection. This projection is eventually consistent with the source data. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [10-module-interaction-matrix.md](../10-module-interaction-matrix.md) |
| **Related** | [11-aggregate-design.md](11-aggregate-design.md), [13-domain-services.md](13-domain-services.md) |
| **Next Reading** | [18-er-diagram.md](18-er-diagram.md) |
