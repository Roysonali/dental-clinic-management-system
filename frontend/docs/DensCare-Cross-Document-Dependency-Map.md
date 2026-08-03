# DensCare Enterprise Frontend — Cross-Document Dependency Map

## PART 0 — Document Interconnections, Navigation Flows & Integration Points

---

**Document Type:** Enterprise Architecture Dependency Map  
**Version:** 1.0.0  
**Last Updated:** July 20, 2026  
**Status:** Final — Reviewed & Frozen  
**Owner:** Product Design Consultancy  
**Classification:** Confidential — Internal Use Only  

---

## Table of Contents

1. [Document Inventory](#1-document-inventory)
2. [Dependency Graph](#2-dependency-graph)
3. [Navigation Flow Map](#3-navigation-flow-map)
4. [Patient Journey Across Documents](#4-patient-journey-across-documents)
5. [Screen-to-Screen Routing](#5-screen-to-screen-routing)
6. [Shared Patterns & Components Matrix](#6-shared-patterns--components-matrix)
7. [API Endpoint Distribution](#7-api-endpoint-distribution)
8. [Phase Dependency Timeline](#8-phase-dependency-timeline)
9. [Sidebar Module-to-Document Mapping](#9-sidebar-module-to-document-mapping)
10. [Dashboard Widget-to-Source Mapping](#10-dashboard-widget-to-source-mapping)
11. [Consistency Validation Cross-Reference](#11-consistency-validation-cross-reference)
12. [Document Inheritance Chain](#12-document-inheritance-chain)

---

## 1. Document Inventory

### 1.1 DensCare Frontend Specification Parts

| Part | Document | File | Sections | Quality Score | Status |
|------|----------|------|----------|---------------|--------|
| **2.1** | Design System | `DensCare-Design-System-Part-2.1.md` | Colors, typography, components, accessibility tokens | 10/10 | ✅ Final |
| **2.2** | Core Product Experience | `DensCare-Core-Product-Experience-Part-2.2.md` | 27 sections — Shell, auth (incl. Register), dashboards, nav, search, notifications, responsive | 9.95/10 | ✅ Final |
| **2.3** | Administrative Modules | `DensCare-Administrative-Modules-Part-2.3.md` | 15 sections — Users, Roles, Doctors, Specializations, Schedules, Settings | 10/10 | ✅ Final |
| **2.4** | Clinical Modules | `DensCare-Clinical-Modules-Part-2.4.md` | 17 sections — Patients, Appointments, Records, Diagnoses, Allergies, Timeline | 10/10 | ✅ Final |
| **2.5** | Treatment Modules | `DensCare-Treatment-Modules-Part-2.5.md` | 16 sections — Treatment Plans, Procedures, Clinical Procedures, Progress, Consent | 10/10 | ✅ Final |
| **2.6** | Engineering Blueprint | `DensCare-Engineering-Blueprint-Part-2.6.md` | Architecture, project structure, API layer, state management, testing, AI guide | 10/10 | ✅ Final |
| **2.7** | Billing & Financial Modules | `DensCare-Billing-Modules-Part-2.7.md` | 18 sections — Invoices, Payments, Receipts, Credit Notes, Dashboard, Reports | 9.8/10 | 📝 Draft |
| **0** | **Cross-Document Dependency Map** | **`DensCare-Cross-Document-Dependency-Map.md`** | **12 sections — You are here** | **—** | **✅ This doc** |

### 1.2 Total Specification Coverage

| Metric | Count |
|--------|-------|
| Total sections across all parts | ~120 |
| Total screens specified | ~85+ |
| Total API endpoints mapped | ~145+ |
| Total backend modules covered | 10 of 14 |
| Total role dashboards designed | 7 |
| Total states documented per screen | ~5 avg (loading, empty, error, permission, offline) |
| Total document pages (estimated) | ~600+ |

---

## 2. Dependency Graph

### 2.1 Document Inheritance (Part → Sub-part)

```
Part 2.1  ──► Part 2.2 ──► Part 2.3 ──► Part 2.4 ──► Part 2.5 ──► Part 2.7
  Design       Core          Admin         Clinical      Treatment     Billing
  System       Shell         Modules       Modules       Modules       Modules
    │            │              │              │              │            │
    │            │              │              │              │            │
    ▼            ▼              ▼              ▼              ▼            ▼
                         Part 2.6 — Engineering Blueprint
                         (API layer, state mgmt, testing, project structure)
```

**Inheritance Rule (stated in every Part 2.2+ document):**
> *"This document inherits all patterns from Parts 1, 2.1, 2.2, [...]"*

### 2.2 Explicit Dependency Declarations

Each part declares its dependencies in its Executive Summary:

| Part | Inherits From | Declared In |
|------|---------------|-------------|
| **2.1** Design System | — (foundation) | Its own purpose statement |
| **2.2** Core Shell | 2.1 | Section 1.1 |
| **2.3** Admin Modules | 2.1, 2.2 | Section 1.1 |
| **2.4** Clinical Modules | 2.1, 2.2, 2.3 | Section 1.1 |
| **2.5** Treatment Modules | 2.1, 2.2, 2.3, 2.4 | Section 1.1 |
| **2.6** Engineering Blueprint | 2.1, 2.2, 2.3, 2.4, 2.5 | Section 1.1 |
| **2.7** Billing Modules | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 | Section 1.1 |

### 2.3 Cross-Document Reference Heat Map

The table below shows which documents are **referenced by** which other documents:

| Part → Referenced ↓ | 2.1 | 2.2 | 2.3 | 2.4 | 2.5 | 2.6 | 2.7 |
|---------------------|-----|-----|-----|-----|-----|-----|-----|
| **2.1** Design System | — | 🔗 | 🔗 | 🔗 | 🔗 | 🔗 | 🔗 |
| **2.2** Core Shell | — | — | 🔗 | 🔗 | 🔗 | 🔗 | 🔗 |
| **2.3** Admin Modules | — | 🔗 Back | — | 🔗 | 🔗 | 🔗 | — |
| **2.4** Clinical Modules | — | 🔗 Back | — | — | 🔗 | 🔗 | 🔗 |
| **2.5** Treatment Modules | — | 🔗 Back | — | — | — | 🔗 | 🔗 |
| **2.6** Engineering Blueprint | — | — | — | — | — | — | 🔗 |
| **2.7** Billing Modules | — | 🔗 Back | — | 🔗 Back | 🔗 Back | — | — |

**Legend:** 🔗 = Forward reference (this doc references the other), 🔗 Back = Back-reference (the other doc references this one)

**Key observations:**
- Part 2.2 is the most **referenced-by** document — 6 downstream docs depend on it
- Part 2.4 and 2.5 have the most **bidirectional** links — they reference each other through Patient Profile pages and treatment-billing handoffs
- Part 2.7 is the newest — it has forward references from Part 2.2 (sidebar), 2.4 (billing tab), and 2.5 (billing handoff), but only back-references from those docs

---

## 3. Navigation Flow Map

### 3.1 Application Shell → Module Navigation

This flow shows how a user navigates from the shell (Part 2.2) into any module:

```
┌─ APPLICATION SHELL (Part 2.2) ──────────────────────────────────────┐
│                                                                       │
│  HEADER (Section 5):                                                 │
│  ├── Logo → Role-specific dashboard (Section 7.2)                    │
│  ├── Global Search (Section 15) → Searches across all entities       │
│  │     from Parts 2.3, 2.4, 2.5, 2.7                                │
│  ├── Notifications (Section 16)                                      │
│  └── Profile Menu (Section 5.3.7)                                    │
│                                                                       │
│  SIDEBAR (Section 4):                                                │
│  ├── 📊 Dash → Dashboard (role-specific, Sections 9-14)             │
│  ├── Clinical Section:                                               │
│  │   ├── 👥 Patients → Part 2.4 Section 3 (Patient List)            │
│  │   ├── 📅 Appointments → Part 2.4 Section 4 (Appointment Calendar)│
│  │   └── 🩺 Doctors → Part 2.3 Section 5 (Doctor Listing)           │
│  ├── Administrative Section:                                         │
│  │   ├── ⚙️ Users → Part 2.3 Section 3 (User List)                  │
│  │   ├── Procedures → Part 2.5 Section 4 (Procedure Catalog)        │
│  │   └── Audit Log → Part 2.3 Section 4 (Audit)                     │
│  ├── 💰 Billing → Part 2.7 Section 3.4 (Invoice List)               │
│  └── Future Section:                                                 │
│      ├── 📈 Reports (locked)                                         │
│      └── ⚙️ Settings (locked)                                        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 Login → Dashboard Flow

```
┌─ LOGIN (Part 2.2 Section 6) ────────────────────────────────────────┐
│                                                                       │
│  POST /auth/login → JWT issued                                        │
│  Role determined from token → redirect to role-specific landing      │
│                                                                       │
├──► REGISTER (IF NEW USER)                                              │
│     Part 2.2 Section 6.10 — Self-Registration Page                     │
│     API: POST /auth/register                                            │
│     ───► Account created (is_approved: False) → Pending approval       │
│     ───► Redirect to login with info banner                            │
│                                                                         │
├──► ADMIN ──────────► Part 2.2 Section 9 (Admin Dashboard)             │
│     Role: ADMIN                                                        │
│     Can see: All sidebar items, user management, billing full access  │
│                                                                       │
├──► CHIEF_DOCTOR ──► Part 2.2 Section 13 (Chief Dashboard)           │
│     Role: CHIEF_DOCTOR                                                 │
│     Can see: Clinical + admin items, billing read-only               │
│                                                                       │
├──► GENERAL_DOCTOR ─► Part 2.2 Section 11 (Doctor Dashboard)         │
│     Role: GENERAL_DOCTOR                                               │
│     Can see: Clinical items, billing own patients read-only          │
│                                                                       │
├──► SPECIALIST ─────► Part 2.2 Section 14 (Specialist Dashboard)      │
│     Role: SPECIALIST_DOCTOR                                            │
│     Can see: Clinical items, billing own patients read-only          │
│                                                                       │
├──► CONSULTING ─────► Part 2.2 Section 14 (Consultation Dashboard)    │
│     Role: CONSULTING_DOCTOR                                            │
│     Can see: Clinical items, billing own patients read-only          │
│                                                                       │
├──► RECEPTIONIST ──► Part 2.2 Section 10 (Reception Dashboard)        │
│     Role: RECEPTIONIST                                                 │
│     Can see: Patients, appointments, payment recording               │
│                                                                       │
└──► ASSISTANT ─────► Part 2.2 Section 12 (Assistant Dashboard)        │
      Role: DENTAL_ASSISTANT                                             │
      Can see: Appointments, chair status (no billing)                 │
```

---

## 4. Patient Journey Across Documents

### 4.1 End-to-End Patient Lifecycle

This is the **complete patient journey** showing which document covers each step:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PATIENT JOURNEY (spanning all 6 parts)                                      │
│                                                                               │
│  1. REGISTRATION                                                              │
│     Part 2.4 Section 3.5 — Register New Patient                              │
│     API: POST /patients                                                       │
│     Role: Receptionist                                                        │
│     ───► Creates patient record → Patient Profile available                  │
│                                                                               │
│  2. APPOINTMENT BOOKING                                                       │
│     Part 2.4 Section 4.5 — Book Appointment                                  │
│     API: POST /appointments                                                   │
│     Role: Receptionist, Doctor                                                │
│     ───► Appointment created → Calendar updated                              │
│                                                                               │
│  3. CHECK-IN                                                                  │
│     Part 2.2 Section 10 — Reception Dashboard (Today's Queue)                │
│     Part 2.4 Section 4.4 — Appointment Calendar                              │
│     API: PATCH /appointments/{id} → CHECKED_IN                                │
│     Role: Receptionist                                                        │
│                                                                               │
│  4. DIAGNOSIS                                                                 │
│     Part 2.4 Section 8 — Diagnosis Management                                │
│     Part 2.4 Section 5 — Clinical Record                                     │
│     API: POST /records, POST /records/{id}/diagnoses                          │
│     Role: Doctor                                                              │
│     ───► Clinical record + diagnoses created                                │
│                                                                               │
│  5. PRESCRIPTION (if needed)                                                  │
│     Part 2.4 Section 5.4 — Clinical Record (Prescriptions tab)               │
│     Part 2.4 Section 11.3 — Printable Prescription View (NEW)                │
│     API: POST /records/{id}/prescriptions, GET /records/{id}/prescriptions    │
│     Role: Doctor                                                              │
│     ───► Prescription created → 🖨️ Print or 💾 Download PDF for patient     │
│                                                                                 │
│  6. TREATMENT PLANNING                                                        │
│     Part 2.5 Section 3 — Treatment Plan Module                               │
│     API: POST /treatment-plans, POST .../items                                │
│     Role: Doctor                                                              │
│     ───► Plan created → submitted for review → proposed → accepted          │
│                                                                               │
│  7. TREATMENT EXECUTION                                                       │
│     Part 2.5 Section 5 — Clinical Procedures                                 │
│     Part 2.2 Section 11 — Doctor Dashboard (Today's Schedule)                │
│     API: POST .../start-treatment, PATCH .../items/{id} → COMPLETED          │
│     Role: Doctor                                                              │
│     ───► Items completed → Plan status updated                              │
│                                                                               │
│  8. INVOICING                                                                 │
│     Part 2.5 Section 12.5 — Treatment Plan to Billing Handoff                │
│     Part 2.7 Section 3.6 — Create Invoice from Treatment Plan                │
│     Part 2.7 Section 3.5 — Invoice Detail (Print / Download PDF)            │
│     API: POST /billing/invoices/from-plan/{plan_id}                           │
│     Role: Accountant / Admin                                                  │
│     ───► Invoice created → issued → pending payment                         │
│     ───► 🖨️ Print or 💾 Download PDF for patient                            │
│                                                                               │
│  9. PAYMENT COLLECTION                                                        │
│     Part 2.7 Section 4.3 — Record Payment                                    │
│     Part 2.2 Section 10 — Reception Dashboard (if front-desk)                │
│     API: POST /billing/payments                                               │
│     Role: Receptionist, Accountant                                            │
│     ───► Payment recorded → Invoice status → PAID                           │
│                                                                               │
│  10. RECEIPT                                                                  │
│      Part 2.7 Section 5.2 — Receipt View (Print / Download PDF)              │
│      API: POST /billing/receipts                                               │
│      Role: Receptionist                                                        │
│      ───► Receipt printed/downloaded → given to patient                      │
│                                                                                │
│  11. FOLLOW-UP                                                                │
│      Part 2.4 Section 11 — Follow-up Management                              │
│      Part 2.4 Section 3.9 — Patient Billing Tab (check outstanding)          │
│      Role: Doctor, Receptionist                                               │
│                                                                               │
│  CROSS-CUTTING:                                                               │
│      Part 2.4 Section 12 — Clinical Timeline (all events)                    │
│      Part 2.2 Section 15 — Global Search (find patient anytime)              │
│      Part 2.2 Section 16 — Notifications (appointment reminders, billing)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Patient Profile Tab-to-Document Mapping

The Patient Profile (Part 2.4 Section 3.6) is the **central hub** that links to all other parts:

```
┌─ Patients > Juan Dela Cruz ─────────────────────────────────────┐
│                                                                   │
│  [Overview] — Part 2.4 Section 3.6 (Quick Actions + Alerts)     │
│       │  └── Quick Actions reference:                            │
│       │      ├── 📅 Book Appointment → Part 2.4 Section 4.5      │
│       │      ├── 📝 New Record → Part 2.4 Section 5.5            │
│       │      ├── 🦷 New Treatment Plan → Part 2.5 Section 3.6   │
│       │      ├── 📋 Schedule Follow-up → Part 2.4 Section 11.3  │
│       │      ├── 💰 Record Payment → Part 2.7 Section 4.3        │
│       │      ├── 📊 View Billing → Part 2.7 Section 8 /         │
│       │      │                          Part 2.4 Section 3.9     │
│       │      ├── 🖨️ Print Prescription → Part 2.4 Section 11.3  │
│       │      └── 💾 Download Rx PDF → Part 2.4 Section 11.3     │
│       │                                                          │
│  [Records] — Part 2.4 Section 5 (Clinical Records)              │
│       │  └── Links to: Part 2.4 Sections 6-11 (sub-modules)     │
│       │                                                          │
│  [Treatment Plans] — Part 2.5 Section 3 (Treatment Plans)       │
│       │  └── Links to: Part 2.5 Sections 4-7, Part 2.7 Section 3│
│       │                                                          │
│  [Appointments] — Part 2.4 Section 4 (Appointments)             │
│       │                                                          │
│  [Billing] — Part 2.4 Section 3.9 (Patient Billing Tab)         │
│       │  └── Links to: Part 2.7 Sections 3, 4, 5, 6             │
│       │                                                          │
│  [Audit] — Part 2.4 Section 12 (Clinical Timeline)              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5. Screen-to-Screen Routing

### 5.1 Complete Route Map

Routes are defined in Part 2.6 (Engineering Blueprint) and Part 2.2 Section 25:

| Route | Screen | Source Document | Backend API Module |
|-------|--------|-----------------|-------------------|
| `/auth/login` | Login Screen | Part 2.2 Section 6.4 | Auth |
| `/auth/register` | Self-Registration Page | Part 2.2 Section 6.10 | Auth |
| `/auth/forgot-password` | Forgot Password | Part 2.2 Section 6.5 | Auth |
| `/auth/reset-password` | Reset Password | Part 2.2 Section 6.6 | Auth |
| `/dashboard` | Role-based Dashboard | Part 2.2 Sections 9-14 | Varies by widget |
| `/patients` | Patient List | Part 2.4 Section 3.4 | Patients |
| `/patients/{id}` | Patient Profile | Part 2.4 Section 3.6 | Patients |
| `/patients/{id}/records` | Clinical Records | Part 2.4 Section 5 | Records |
| `/patients/{id}/billing` | Patient Billing Tab | Part 2.4 Section 3.9 | Billing |
| `/appointments` | Appointment Calendar | Part 2.4 Section 4.4 | Appointments |
| `/appointments/today` | Today's Schedule | Part 2.4 Section 4.7 | Appointments |
| `/doctors` | Doctor Listing | Part 2.3 Section 5.3 | Doctors |
| `/doctors/{id}` | Doctor Profile | Part 2.3 Section 5.5 | Doctors |
| `/users` | User List | Part 2.3 Section 3.2 | Users |
| `/users/{id}` | User Profile | Part 2.3 Section 3.3 | Users |
| `/treatment-plans` | Treatment Plan List | Part 2.5 Section 3.4 | Treatment |
| `/treatment-plans/{id}` | Treatment Plan Detail | Part 2.5 Section 3.5 | Treatment |
| `/procedures` | Procedure Catalog | Part 2.5 Section 4.4 | Treatment |
| `/billing/invoices` | Invoice List | Part 2.7 Section 3.4 | Billing |
| `/billing/invoices/{id}` | Invoice Detail | Part 2.7 Section 3.5 | Billing |
| `/billing/payments` | Payment List | Part 2.7 Section 4.4 | Billing |
| `/billing/receipts` | Receipt List | Part 2.7 Section 5 | Billing |
| `/billing/dashboard` | Financial Dashboard | Part 2.7 Section 9 | Billing |
| `/billing/settings` | Billing Settings | Part 2.7 Section 11 | Billing |
| `/settings` | App Settings | Part 2.2 Section 24 (future) | — |
| `/reports` | Reports | Part 2.2 Section 24 (future) | — |

**Route nesting pattern:** All billing routes are nested under `/billing/` prefix following the module-based organization pattern.

### 5.2 Cross-Module Navigation Paths

| From | To | Trigger | Documented In |
|------|----|---------|---------------|
| Patient List → | Patient Profile | Click patient row | Part 2.4 Section 3.4 |
| Patient Profile → | Treatment Plan Detail | Click plan in Plans tab | Part 2.4 Section 3.6 → Part 2.5 Section 3.5 |
| Patient Profile → | Invoice Detail (Patient Billing) | Click invoice in Billing tab | Part 2.4 Section 3.9 → Part 2.7 Section 3.5 |
| Patient Profile → | Record Payment | Click "Record Payment" in Billing tab | Part 2.4 Section 3.9 → Part 2.7 Section 4.3 |
| Treatment Plan Detail → | Create Invoice (from Plan) | Click "💰 Generate Invoice" | Part 2.5 Section 3.5 → Part 2.7 Section 3.6 |
| Doctor Dashboard → | Patient Clinical Workspace | Click patient in schedule | Part 2.2 Section 11.3 → Part 2.4 Section 3.6 |
| Reception Dashboard → | Record Payment | Click "Quick Payment" | Part 2.2 Section 10.4 → Part 2.7 Section 4.3 |
| Admin Dashboard → | Billing Settings | Click billing widget | Part 2.2 Section 9.7 → Part 2.7 Section 11 |
| Invoice List → | Patient Profile | Click patient name/link | Part 2.7 Section 3.4 → Part 2.4 Section 3.6 |
| Global Search → | Any entity | Click search result | Part 2.2 Section 15 → Any Part |

---

## 6. Shared Patterns & Components Matrix

### 6.1 Patterns Shared Across Documents

| Pattern | Defined In | Used By Parts | Notes |
|---------|-----------|---------------|-------|
| Status Badges | Part 2.1 | 2.2, 2.3, 2.4, 2.5, 2.7 | Color + icon + text; color-blind safe |
| Data Table | Part 2.1, 2.6 | 2.2, 2.3, 2.4, 2.5, 2.7 | Sortable headers, pagination, selection |
| Search + Filter Bar | Part 2.1, 2.6 | 2.2, 2.3, 2.4, 2.5, 2.7 | Debounced input, dropdown filters, clear |
| Slide-out Drawer | Part 2.1, 2.6 | 2.3, 2.4, 2.5, 2.7 | 480px or 680px, maintains context |
| Confirmation Dialog | Part 2.1, 2.6 | 2.2, 2.3, 2.4, 2.5, 2.7 | Double-confirmation for destructive actions |
| Toast Notifications | Part 2.1, 2.6 | 2.2, 2.3, 2.4, 2.5, 2.7 | Success (4s), Error (6s), auto-dismiss |
| Skeleton Loading | Part 2.1, 2.2 | 2.3, 2.4, 2.5, 2.7 | Shimmer animation, matches layout |
| Empty State | Part 2.1, 2.2 Section 18 | 2.3, 2.4, 2.5, 2.7 | Illustration + message + CTA |
| 403 Page | Part 2.2 Section 6.9 | 2.3, 2.4, 2.5, 2.7 | Role-gated access denied |
| Pagination | Part 2.1, 2.6 | 2.3, 2.4, 2.5, 2.7 | 20/50/100 per page, jump-to-page |

### 6.2 Component Hierarchy

```
Part 2.1 (Design System)
│
├── Atoms (Button, Input, Badge, Icon, Label)
│
├── Molecules (SearchBar, FilterDropdown, DataTable, Dialog, Toast)
│   │
│   ├── Used by: Part 2.2 (Shell), Part 2.3 (Admin screens)
│   ├── Used by: Part 2.4 (Clinical screens), Part 2.5 (Treatment screens)
│   └── Used by: Part 2.7 (Billing screens)
│
├── Organisms (StatusBadge, PaginationBar, SummaryCard, KPIWidget)
│   │
│   ├── StatusBadge → Part 2.2 (dashboards), Part 2.4 (records), Part 2.7 (invoices)
│   ├── KPIWidget → Part 2.2 (all dashboards), Part 2.7 (financial dashboard)
│   └── SummaryCard → Part 2.4 (patient profile), Part 2.7 (billing summary)
│
└── Templates (PageLayout, DrawerLayout, TabLayout, ModalLayout)
    │
    ├── PageLayout → Part 2.2 (shell wrapping all modules)
    ├── DrawerLayout → Part 2.3 (create user), Part 2.7 (record payment)
    └── TabLayout → Part 2.4 (patient profile), Part 2.7 (invoice detail)
```

---

## 7. API Endpoint Distribution

### 7.1 Endpoints by Module

| Backend Module | Total Endpoints | Documented In | Status |
|----------------|----------------|---------------|--------|
| Auth | 6 | Part 2.2 Section 6 | ✅ Production Ready |
| RBAC | Integrated | Part 2.3 Section 4 | ✅ Production Ready |
| Users | 5 | Part 2.3 Section 3 | ✅ Production Ready |
| Patients | 7 | Part 2.4 Section 3 | ✅ Production Ready |
| Appointments | 6 | Part 2.4 Section 4 | ✅ Production Ready |
| Doctors | 25 | Part 2.3 Section 5 | ✅ Production Ready |
| Patient Records | 21 | Part 2.4 Section 5 | ✅ Production Ready |
| Treatment Plans | 45 | Part 2.5 Section 3 | ✅ Production Ready |
| Procedures Catalog | 11 | Part 2.5 Section 4 | ✅ Production Ready |
| **Billing** | **30+** | **Part 2.7 Section 1.3** | **✅ Production Ready** |
| **Total** | **156+** | **—** | **10 of 14 modules** |

### 7.2 Endpoints Referenced Across Multiple Documents

| Endpoint | Primary Doc | Referenced In | Purpose |
|----------|-------------|---------------|---------|
| `GET /patients` | Part 2.4 Section 3 | Part 2.2 Section 15 (global search) | Patient search across modules |
| `GET /appointments/today` | Part 2.4 Section 4.7 | Part 2.2 Sections 9-14 (widgets) | Dashboard data source |
| `POST /treatment-plans/{id}/accept` | Part 2.5 Section 3 | Part 2.7 Section 3.6 (trigger for billing) | Enables invoice generation |
| `POST /billing/invoices/from-plan/{plan_id}` | Part 2.7 Section 3.6 | Part 2.5 Section 12.5 (handoff) | Treatment-to-billing bridge |
| `PATCH /doctors/{id}/availability` | Part 2.3 Section 5.8 | Part 2.2 Section 10.5 (widget) | Doctor availability display |

---

## 8. Phase Dependency Timeline

### 8.1 Implementation Phases

```
PHASE 1 (MVP) — IMPLEMENTED
═════════════════════════════
  Part 2.1 — Design System (foundation)
  Part 2.2 — Core Shell, Auth, Dashboards, Navigation
  Part 2.3 — User Management, Doctor Management, Specializations, Schedules
  Part 2.4 — Patient Management, Appointments, Clinical Records, Diagnoses, Timeline
  Part 2.5 — Treatment Plans, Procedures, Clinical Progress, Versioning
  Part 2.6 — Engineering Blueprint (architecture, API layer, state management, testing)
  Part 2.7 — Billing (Invoices, Payments, Receipts, Search, Audit, Permissions)

PHASE 2 (FUTURE) — SPECIFIED
═════════════════════════════
  Part 2.4 — Patient Portal link, structured medical history
  Part 2.5 — Odontogram, Consent Management, Prescription Module
  Part 2.7 — Credit Notes, Refunds, Financial Dashboard, Reports, Tax Management,
              Discount Approval Workflow, Patient Financial Summary

PHASE 3 (FUTURE) — OUTLINED
═════════════════════════════
  Part 2.2 — Multi-clinic, multi-branch, kiosk mode
  Part 2.3 — Clinic Configuration, System Settings
  Part 2.7 — Insurance, Payment Gateway, Notifications, Patient Portal Integration,
              Accounting Software Integration, E-Invoicing
```

### 8.2 Feature Dependencies Between Parts

| Feature | Requires From | Blocks | Phase |
|---------|---------------|--------|-------|
| Login (Part 2.2) | — | All other features | MVP |
| Sidebar Navigation (Part 2.2) | Login | All module access | MVP |
| Patient Registration (Part 2.4) | — | Appointments, Records, Treatment, Billing | MVP |
| Treatment Plans (Part 2.5) | Patients, Doctors | Billing (from-plan invoices) | MVP |
| Invoice from Treatment Plan (Part 2.7) | Treatment Plans, Patients | Payment, Receipts | MVP |
| Payment Recording (Part 2.7) | Invoices | Receipts | MVP |
| Financial Dashboard (Part 2.7) | Invoices, Payments | Reports | Phase 2 |
| Patient Portal (Part 2.2) | Auth, Patients, Billing | Self-service payments | Phase 3 |
| Multi-clinic (Part 2.2) | All modules | Branch-scoped billing | Phase 3 |

---

## 9. Sidebar Module-to-Document Mapping

This maps every sidebar item (Part 2.2 Section 4) to its source document and backend API module:

```
DENCARE SIDEBAR (Part 2.2 Section 4)
│
├── 📊 Dashboard
│   ├── Admin → Part 2.2 Section 9
│   ├── Chief Doctor → Part 2.2 Section 13
│   ├── Doctor → Part 2.2 Section 11
│   ├── Receptionist → Part 2.2 Section 10
│   ├── Assistant → Part 2.2 Section 12
│   ├── Specialist → Part 2.2 Section 14
│   └── Consulting → Part 2.2 Section 14
│
├── 👥 Patients
│   ├── List → Part 2.4 Section 3.4
│   ├── Register → Part 2.4 Section 3.5
│   ├── Profile → Part 2.4 Section 3.6
│   │   └── Tabs: Records, Treatment Plans, Appointments, Billing, Audit
│   └── Backend: Patients module (7 endpoints)
│
├── 📅 Appointments
│   ├── Calendar → Part 2.4 Section 4.4
│   ├── Today's Schedule → Part 2.4 Section 4.7
│   └── Backend: Appointments module (6 endpoints)
│
├── 🩺 Doctors
│   ├── Listing → Part 2.3 Section 5.3
│   ├── Profile → Part 2.3 Section 5.5
│   ├── Schedule → Part 2.3 Section 7
│   └── Backend: Doctors module (25 endpoints)
│
├── ⚙️ Users (ADMIN only)
│   ├── List → Part 2.3 Section 3.2
│   ├── Profile → Part 2.3 Section 3.3
│   └── Backend: Users/Auth module (5+ endpoints)
│
├── 📋 Procedures Catalog (ADMIN + CHIEF_DOCTOR)
│   ├── List → Part 2.5 Section 4.4
│   └── Backend: Treatment module (3 endpoints)
│
├── 🔍 Audit Log (ADMIN + CHIEF_DOCTOR)
│   └── Backend: Records/Treatment audit (embedded)
│
├── 💰 Billing (ADMIN, RECEPTIONIST, CHIEF_DOCTOR, ACCOUNTANT)
│   ├── Invoices → Part 2.7 Section 3
│   │   ├── List → Part 2.7 Section 3.4
│   │   ├── Detail → Part 2.7 Section 3.5
│   │   └── Create → Part 2.7 Section 3.6
│   ├── Payments → Part 2.7 Section 4
│   │   ├── Record Payment → Part 2.7 Section 4.3
│   │   └── List → Part 2.7 Section 4.4
│   └── Reports → Part 2.7 Section 9-10 (Phase 2)
│   └── Backend: Billing module (30+ endpoints)
│
├── 📈 Reports (Future — locked)
│
└── ⚙️ Settings (Future — locked)
```

---

## 10. Dashboard Widget-to-Source Mapping

### 10.1 Admin Dashboard Widgets (Part 2.2 Section 9)

| Widget | Data Source Doc | API Endpoint | Click Action Doc |
|--------|----------------|--------------|------------------|
| Pending Approvals | Part 2.3 Section 3 | `GET /users?status=pending` | Part 2.3 Section 3.2 |
| Active Users | Part 2.3 Section 3 | `GET /users?status=active` | Part 2.3 Section 3.2 |
| Active Doctors | Part 2.3 Section 5 | `GET /doctors?is_active=true` | Part 2.3 Section 5.3 |
| Today's Appointments | Part 2.4 Section 4 | `GET /appointments/today` | Part 2.4 Section 4.7 |
| Revenue Today | Part 2.7 Section 9 | `GET /billing/payments?date=today` | Part 2.7 Section 4.4 |
| Pending Invoices | Part 2.7 Section 9 | `GET /billing/invoices?status=ISSUED` | Part 2.7 Section 3.4 |
| Overdue Accounts | Part 2.7 Section 9 | `GET /billing/invoices?status=OVERDUE` | Part 2.7 Section 3.4 |
| Weekly Appt Trend | Part 2.4 Section 4 | Computed from appointments | Part 2.4 Section 4.4 |

### 10.2 Reception Dashboard Widgets (Part 2.2 Section 10)

| Widget | Data Source Doc | API Endpoint | Click Action Doc |
|--------|----------------|--------------|------------------|
| Today's Appointments | Part 2.4 Section 4 | `GET /appointments/today` | Part 2.4 Section 4.7 |
| Checked In | Part 2.4 Section 4 | `GET /appointments?status=checked_in` | Part 2.4 Section 4.6 |
| Waiting Room | Part 2.4 Section 4 | Computed from check-in + treatment | Part 2.4 Section 4.6 |
| New Patients Today | Part 2.4 Section 3 | `GET /patients?created_after=today` | Part 2.4 Section 3.4 |
| Quick Payment | Part 2.7 Section 4.3 | — | Part 2.7 Section 4.3 |

### 10.3 Doctor Dashboard Widgets (Part 2.2 Section 11)

| Widget | Data Source Doc | API Endpoint | Click Action Doc |
|--------|----------------|--------------|------------------|
| Today's Patients | Part 2.4 Section 4 | `GET /appointments?doctor_id=me&date=today` | Part 2.4 Section 4.7 |
| In Treatment | Part 2.4 Section 4 | `GET /appointments?status=in_treatment` | Part 2.4 Section 4.6 |
| Pending Records | Part 2.4 Section 5 | `GET /records?doctor_id=me&status=draft` | Part 2.4 Section 5.4 |
| Clinical Alerts | Part 2.4 Section 7 | Embedded (allergies) | Part 2.4 Section 7.2 |
| Active Treatment Plans | Part 2.5 Section 3 | `GET /treatment-plans/by-doctor/{id}` | Part 2.5 Section 3.5 |
| Pending Billing (own patients) | Part 2.7 Section 3 | `GET /billing/invoices?doctor_id=me&status=ISSUED` | Part 2.7 Section 3.4 |

### 10.4 Chief Doctor Dashboard Widgets (Part 2.2 Section 13)

| Widget | Data Source Doc | API Endpoint | Click Action Doc |
|--------|----------------|--------------|------------------|
| Pending Reviews | Part 2.5 Section 3 | `GET /treatment-plans/pending-review` | Part 2.5 Section 3.5 |
| Active Plans | Part 2.5 Section 3 | `GET /treatment-plans?status=in_progress` | Part 2.5 Section 3.5 |
| Doctors Online | Part 2.3 Section 5 | `GET /doctors?available=true` | Part 2.3 Section 5.3 |
| Revenue (read-only) | Part 2.7 Section 9 | `GET /billing/dashboard` | Part 2.7 Section 9 |

---

## 11. Consistency Validation Cross-Reference

### 11.1 Terminology Consistency

| Term | Part 2.1 | Part 2.2 | Part 2.3 | Part 2.4 | Part 2.5 | Part 2.7 |
|------|----------|----------|----------|----------|----------|----------|
| Status Badge format | ✅ Icon+Color+Text | ✅ Used | ✅ Used | ✅ Used | ✅ Used | ✅ Used |
| Currency display | — | ✅ ₱ prefix | — | — | ✅ ₱ / $ | ✅ ₱ prefix |
| Patient Code (PAT-XXXX) | — | ✅ | — | ✅ | ✅ | ✅ |
| Doctor Code (DOC-XXXX) | — | ✅ | ✅ | — | — | — |
| Invoice Number (INV-XXXX) | — | ✅ Updated | — | — | ✅ | ✅ |
| Plan Code (TXN-XXXX) | — | ✅ | — | — | ✅ | ✅ |

### 11.2 Role Consistency

| Role | Part 2.2 (Sidebar) | Part 2.3 (Admin) | Part 2.4 (Clinical) | Part 2.5 (Treatment) | Part 2.7 (Billing) |
|------|-------------------|-------------------|---------------------|----------------------|---------------------|
| ADMIN | Full access | Full | Full | Full | Full |
| CHIEF_DOCTOR | Clinical + admin read | Read-only admin | Read clinical | Create, review plans | ✅ Read-only billing |
| GENERAL_DOCTOR | Clinical only | ❌ No admin | Create records | Create plans, treat | ✅ Own patients read-only |
| SPECIALIST_DOCTOR | Clinical only | ❌ No admin | Create records | Create plans | ✅ Own patients read-only |
| CONSULTING_DOCTOR | Clinical only | ❌ No admin | Read records | View plans | ✅ Own patients read-only |
| RECEPTIONIST | Patients, Appts | — | Register patients, book | View plans | ✅ Payment + view |
| DENTAL_ASSISTANT | Appts only | — | ❌ Limited | View plans | ❌ No billing |

### 11.3 Status Lifecycle Consistency

| Entity | Statuses Defined In | Module Document | Frontend Doc |
|--------|--------------------|-----------------|--------------|
| Patient | Active / Inactive | Part 2.4 (backend) | Part 2.4 Section 3.8 |
| Appointment | SCHEDULED → COMPLETED / CANCELLED | Part 2.4 (backend) | Part 2.4 Section 4.4 |
| Record | DRAFT → FINALIZED | Part 2.4 (backend) | Part 2.4 Section 1.4 |
| Treatment Plan | DRAFT → CANCELLED (9 statuses) | Part 2.5 (backend) | Part 2.5 Section 1.5 |
| Invoice | DRAFT → VOID (7 statuses) | Part 2.7 (backend) | Part 2.7 Section 1.4 |
| Payment | PENDING → REVERSED (5 statuses) | Part 2.7 (backend) | Part 2.7 Section 1.5 |

---

## 12. Document Inheritance Chain

### 12.1 What Each Part Inherits (Design Tokens & Patterns)

```
Part 2.1 — Design System
├── Color tokens (color-primary-500, color-neutral-200, etc.)
├── Typography scale (text-h1, text-body, text-caption, etc.)
├── Component specifications (Button, Input, Badge, Table, Dialog, Toast)
├── Spacing scale (4px base, 8px, 16px, 24px, 32px, 48px)
├── Breakpoints (≥1280px, 1024-1279px, 768-1023px, <768px)
├── Accessibility requirements (WCAG 2.1 AA, ARIA patterns)
└── Icon system (Lucide icons, 20px default)

Part 2.2 — Core Product Experience (inherits 2.1)
├── Application shell (header 56px, sidebar 240/64px, workspace)
├── Authentication flows (login, forgot/reset password, session timeout)
├── Role-based dashboards (7 role-specific dashboards)
├── Sidebar navigation (role-filtered items, pinned, recent, badges)
├── Global search pattern
├── Notification center pattern
├── Empty state strategy
├── Loading strategy (skeleton loading)
├── Error strategy (403, 404, 500 pages)
└── Responsive strategy (mobile-first)

Part 2.3 — Administrative Modules (inherits 2.1, 2.2)
├── User management screens (list, profile, create, approve)
├── Doctor management screens (list, profile, create, edit, status)
├── Specialization management screens
├── Schedule management screens
└── Role/permission matrix view

Part 2.4 — Clinical Modules (inherits 2.1, 2.2, 2.3)
├── Patient management screens (list, register, profile, edit)
├── Appointment management screens (calendar, book, detail, today)
├── Clinical record screens (view, create, edit, list)
├── Diagnosis management screens
├── Medical history, allergies, attachments, follow-ups
├── Clinical timeline
├── Printable Prescription View (Section 11.3 — NEW)
└── Patient Billing tab (references Part 2.7)

Part 2.5 — Treatment Modules (inherits 2.1, 2.2, 2.3, 2.4)
├── Treatment plan screens (list, detail, create, edit, version history)
├── Procedure catalog screens
├── Clinical procedure execution
├── Treatment progress tracking
├── Treatment Plan → Billing handoff (references Part 2.7)
└── Business workflows (multi-visit, revision, hold/resume)

Part 2.7 — Billing Modules (inherits ALL above parts)
├── Invoice management screens (list, detail, create, edit, print, download PDF)
├── Payment management screens (record, list, reverse)
├── Receipt screens (view, print, reprint)
├── Credit note screens (Phase 2)
├── Refund processing screens (Phase 2)
├── Patient Financial Summary (scoped view)
├── Financial Dashboard (aggregate view)
├── Financial Reports
└── Billing Settings & Configuration

Part 2.6 — Engineering Blueprint (inherits ALL parts)
├── Project structure (React + TypeScript + Tailwind + shadcn/ui)
├── Component architecture (all screens from Parts 2.2-2.7)
├── API layer (all endpoints from Parts 2.2-2.7)
├── State management (React Query, URL params, local state)
├── Routing strategy (all routes from Parts 2.2-2.7)
└── Testing strategy (unit, integration, E2E)
```

---

## Appendix A: Document Update History

| Date | Document | Change | Author |
|------|----------|--------|--------|
| Jul 18, 2026 | Parts 2.1-2.6 | Initial release (Final) | Product Design Consultancy |
| Jul 20, 2026 | Part 2.7 | Created — Billing & Financial Modules | Product Design Consultancy |
| Jul 20, 2026 | Part 2.2 | Updated — Billing promoted from 🔒 Future to active module | Product Design Consultancy |
| Jul 20, 2026 | Part 2.4 | Updated — Added Patient Billing Tab to Patient Profile | Product Design Consultancy |
| Jul 20, 2026 | Part 2.5 | Updated — Added Treatment Plan to Billing Handoff workflow | Product Design Consultancy |
| Jul 20, 2026 | **This doc** | **Created — Cross-Document Dependency Map** | **Product Design Consultancy** |
| Jul 20, 2026 | Part 2.2 | Added Self-Registration Page (Section 6.10), Register link on Login screen | Product Design Consultancy |
| Jul 20, 2026 | Part 2.4 | Added Printable Prescription View (Section 11.3) | Product Design Consultancy |
| Jul 20, 2026 | Part 2.7 | Added Invoice PDF Download option to Invoice Detail | Product Design Consultancy |
| Jul 28, 2026 | **This doc** | **Audited — Added Register, Prescription, Invoice Download references** | **Consistency Audit** |

---

## Appendix B: Lovable.dev Integration Guide

When using Lovable.dev to generate the DensCare frontend, provide documents in this **dependency order**:

| Step | Document | Why This Order |
|------|----------|----------------|
| 1 | Part 2.1 — Design System | Foundation — all tokens, components, patterns |
| 2 | Part 2.2 — Core Shell | Application layout, auth, navigation |
| 3 | Part 2.3 — Admin Modules | User and doctor management |
| 4 | Part 2.4 — Clinical Modules | Patient and appointment management |
| 5 | Part 2.5 — Treatment Modules | Treatment plans and procedures |
| 6 | Part 2.7 — Billing Modules | Financial operations |
| 7 | Part 2.6 — Engineering Blueprint | Architecture for final integration |
| 8 | **This doc** | **Cross-reference map for consistency** |

**Key prompt strategy:** Build in this order but use the **Screen-to-Screen Routing** (Section 5.2) and **Navigation Flow Map** (Section 3) to help Lovable understand how screens connect across modules.
