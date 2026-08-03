# Module Interaction Matrix — Billing Module

> **Document Type:** Integration Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Document how the Billing module interacts with every other DensCare module — what information is consumed, what is produced, and the nature of the dependency.

| Field | Value |
|---|---|
| Document | Module Interaction Matrix |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 00-module-overview.md, 01-business-analysis.md, 08-future-scope.md |

---

## Table of Contents

1. [Interaction Model](#1-interaction-model)
2. [Authentication](#2-authentication)
3. [RBAC](#3-rbac)
4. [User Management](#4-user-management)
5. [Patient Management](#5-patient-management)
6. [Doctor Management](#6-doctor-management)
7. [Appointment Management](#7-appointment-management)
8. [Patient Records](#8-patient-records)
9. [Treatment Plans](#9-treatment-plans)
10. [Inventory (Future)](#10-inventory-future)
11. [Notifications (Future)](#11-notifications-future)
12. [Dashboard](#12-dashboard)
13. [Insurance (Future)](#13-insurance-future)
14. [Interaction Summary Matrix](#14-interaction-summary-matrix)

---

## 1. Interaction Model

Each interaction is described using the following dimensions:

| Dimension | Description |
|---|---|
| **Information Consumed** | Data that Billing reads from the module |
| **Information Produced** | Data that Billing writes and makes available to the module |
| **Business Dependency** | Whether the module is Required (MVP cannot function without it) or Optional (enhancement for specific workflows) |
| **Integration Direction** | Billing → Module (Billing provides data), Module → Billing (Billing consumes data), or Bidirectional |

---

## 2. Authentication

| Dimension | Description |
|---|---|
| **Information Consumed** | User identity and authentication status; JWT tokens for session validation |
| **Information Produced** | None — Billing does not manage authentication |
| **Business Dependency** | Required — all billing API endpoints require authenticated access |
| **Integration Direction** | Auth → Billing (Billing consumes) |
| **Phase** | MVP |

---

## 3. RBAC

| Dimension | Description |
|---|---|
| **Information Consumed** | User role assignment; permission definitions for billing operations; role hierarchy |
| **Information Produced** | Defined set of billing-specific permissions (e.g., CREATE_INVOICE, RECORD_PAYMENT) that RBAC enforces |
| **Business Dependency** | Required — all billing operations are gated by role-based permissions |
| **Integration Direction** | Bidirectional — RBAC provides enforcement; Billing defines required permissions |
| **Phase** | MVP |

---

## 4. User Management

| Dimension | Description |
|---|---|
| **Information Consumed** | User identity (ID, name, email, active status) for audit trail attribution; user role for permission evaluation |
| **Information Produced** | Payment collector attribution (who recorded the payment); invoice creator/updater attribution |
| **Business Dependency** | Required — every financial mutation must be attributed to a user |
| **Integration Direction** | Users → Billing (Billing consumes user data) |
| **Phase** | MVP |

---

## 5. Patient Management

| Dimension | Description |
|---|---|
| **Information Consumed** | Patient identity (ID, name, contact); patient active/inactive status; patient demographics for invoice/receipt headers |
| **Information Produced** | Invoiced amount totals per patient; payment history per patient; outstanding balance per patient; credit note balance |
| **Business Dependency** | Required — every invoice must reference a valid patient |
| **Integration Direction** | Bidirectional — Billing consumes patient data and produces financial summaries per patient |
| **Phase** | MVP |

---

## 6. Doctor Management

| Dimension | Description |
|---|---|
| **Information Consumed** | Doctor identity (ID, name, specialization) for invoice attribution when a treating doctor is specified |
| **Information Produced** | Revenue per doctor (billed amount for treatments performed by each doctor) |
| **Business Dependency** | Optional — invoices can be created without a doctor reference; doctor revenue reporting is Phase 2 |
| **Integration Direction** | Bidirectional — Billing consumes doctor data and produces revenue attribution |
| **Phase** | MVP (optional), Phase 2 (revenue reporting) |

---

## 7. Appointment Management

| Dimension | Description |
|---|---|
| **Information Consumed** | Appointment ID and date for optional invoice reference (linking an invoice to a specific visit) |
| **Information Produced** | Billing status per appointment (whether procedures were invoiced) |
| **Business Dependency** | Optional — invoices can be created without an appointment reference |
| **Integration Direction** | Appointments → Billing (Billing consumes appointment data) |
| **Phase** | MVP (optional) |

---

## 8. Patient Records

| Dimension | Description |
|---|---|
| **Information Consumed** | Diagnosis IDs for optional line item diagnosis references (linking billed procedures to diagnosed conditions) |
| **Information Produced** | Billing status of specific diagnoses (whether treatment for the diagnosis has been billed) |
| **Business Dependency** | Optional — line items can be created without diagnosis references |
| **Integration Direction** | Patient Records → Billing (Billing consumes diagnosis data) |
| **Phase** | MVP (optional) |

---

## 9. Treatment Plans

| Dimension | Description |
|---|---|
| **Information Consumed** | Treatment plan ID, status, and line items (procedure, estimated cost, quantity, discounts) for invoice generation |
| **Information Produced** | Invoice references on treatment plan items (marking items as invoiced); price override audit data; billing status per plan |
| **Business Dependency** | Required — primary source of invoice line items for treatment-related billing |
| **Integration Direction** | Bidirectional — Billing consumes plan data and produces billing status updates |
| **Phase** | MVP |

---

## 10. Inventory (Future)

| Dimension | Description |
|---|---|
| **Information Consumed** | Material/item costs for invoices that include physical supplies (e.g., lab materials, implants) |
| **Information Produced** | Cost of goods sold data from invoiced materials |
| **Business Dependency** | Optional — future integration for clinics that manage dental inventory |
| **Integration Direction** | Bidirectional |
| **Phase** | Phase 3 |

---

## 11. Notifications (Future)

| Dimension | Description |
|---|---|
| **Information Consumed** | Notification delivery status (sent/failed) for billing notifications |
| **Information Produced** | Invoice issuance events, payment confirmation events, overdue alerts, receipt events — all requiring patient notification |
| **Business Dependency** | Optional — clinics can operate without automated notifications |
| **Integration Direction** | Billing → Notifications (Billing emits events, Notifications delivers them) |
| **Phase** | Phase 3 |

---

## 12. Dashboard

| Dimension | Description |
|---|---|
| **Information Consumed** | None — Dashboard is a consumer of Billing data |
| **Information Produced** | Aggregated financial metrics: daily/monthly revenue, outstanding balance, receivables aging, payment method distribution, invoice status distribution, tax collected |
| **Business Dependency** | Optional — Dashboard is a Phase 2 reporting feature |
| **Integration Direction** | Billing → Dashboard (Billing provides data, Dashboard visualizes) |
| **Phase** | Phase 2 |

---

## 13. Insurance (Future)

| Dimension | Description |
|---|---|
| **Information Consumed** | Insurance provider master data; patient policy details (coverage, deductible, effective dates); claim status updates |
| **Information Produced** | Invoice line items as insurance claim data (procedure codes, charges, patient/dentist information); payment allocations for insurance payments |
| **Business Dependency** | Optional — dedicated Insurance module integration for clinics that bill insurance |
| **Integration Direction** | Bidirectional |
| **Phase** | Phase 3 |

---

## 14. Interaction Summary Matrix

| Module | Consumed By Billing | Produced By Billing | Dependency | Direction | Phase |
|---|---|---|---|---|---|
| Authentication | User identity, auth status | — | Required | Auth → Billing | MVP |
| RBAC | Role definitions, permissions | Permission requirements | Required | Bidirectional | MVP |
| User Management | User identity, active status | Payment/invoice attribution | Required | Users → Billing | MVP |
| Patient Management | Patient identity, demographics | Financial summaries per patient | Required | Bidirectional | MVP |
| Doctor Management | Doctor identity, specialization | Revenue per doctor | Optional | Bidirectional | MVP (P2 for reporting) |
| Appointment Management | Appointment ID, date | Billing status per appointment | Optional | Appt → Billing | MVP |
| Patient Records | Diagnosis IDs | Billing status per diagnosis | Optional | PR → Billing | MVP |
| Treatment Plans | Plan items, costs, status | Invoice references, billing status | Required | Bidirectional | MVP |
| Inventory (Future) | Material costs | COGS data | Optional | Bidirectional | Phase 3 |
| Notifications (Future) | Delivery status | Billing events to notify | Optional | Billing → Notifications | Phase 3 |
| Dashboard | — | Aggregated financial metrics | Optional | Billing → Dashboard | Phase 2 |
| Insurance (Future) | Provider data, policies, claim status | Claim data, payment allocations | Optional | Bidirectional | Phase 3 |

**Legend:** Required = MVP cannot function without this module; Optional = enhancement for specific workflows or future phases.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [00-module-overview.md](00-module-overview.md) |
| **Related** | [01-business-analysis.md](01-business-analysis.md), [08-future-scope.md](08-future-scope.md) |
| **Next Reading** | [11-business-events.md](11-business-events.md) |
