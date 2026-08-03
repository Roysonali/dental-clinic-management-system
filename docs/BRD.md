# DensCare — Dental Clinic Management System

## Business Requirements Document (BRD)

> **Document Version:** 2.0.0  
> **Last Updated:** July 16, 2026  
> **Status:** Verified  
> **Owner:** Product Team  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Vision & Objectives](#2-project-vision--objectives)
3. [Stakeholders and Roles](#3-stakeholders-and-roles)
4. [Business Scope](#4-business-scope)
5. [Minimum Viable Product (MVP)](#5-minimum-viable-product-mvp)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Key Workflows](#8-key-workflows)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Current Release Limitations](#10-current-release-limitations)
11. [Business Assumptions](#11-business-assumptions)
12. [External Dependencies](#12-external-dependencies)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Executive Summary

DensCare is a production-oriented Dental Clinic Management System (DCMS) designed to digitize and streamline the complete workflow of a modern multi-specialty dental clinic. The system replaces traditional paper records, manual scheduling, and fragmented spreadsheets with a centralized, secure, auditable, and scalable healthcare management platform.

The platform currently comprises **9 completed backend modules** with **115 REST API endpoints**, **20 database tables**, **870 automated test functions**, **15 database migrations**, and **7 RBAC user roles**. It provides comprehensive functionality for patient management, appointment scheduling, clinical documentation, prescription management, doctor profile management, treatment planning, user access control, and audit compliance.

**Current Project Status:**

| Metric | Verified Value |
|--------|---------------|
| Backend Module Completion | Completed (9 of 14 planned) |
| Overall Product Status | Backend Complete — Frontend Pending |
| Backend Production Readiness | Production Ready |
| Modules Completed | 9 of 14 planned |
| REST API Endpoints | 115 |
| Database Tables | 20 |
| User Roles | 7 |
| Automated Test Functions | 870 |
| Database Migrations | 15 |
| ORM Model Classes | 19 |

---

## 2. Project Vision & Objectives

### Vision Statement

To create a secure, intelligent, and scalable dental practice management platform that:

- Reduces administrative overhead by digitizing all clinic workflows
- Eliminates paper records and manual documentation
- Improves clinical workflow efficiency through structured data
- Provides complete auditability for medico-legal compliance
- Enables future AI-driven clinical insights and analytics
- Supports multi-clinic expansion and enterprise deployment

### Strategic Objectives

| # | Objective | Priority | Success Metric |
|---|-----------|----------|----------------|
| O1 | Complete digital patient lifecycle management | Critical | 100% of patient interactions captured digitally |
| O2 | Zero scheduling conflicts through intelligent booking | Critical | 100% conflict-free appointment scheduling |
| O3 | Comprehensive clinical documentation with immutable audit trail | Critical | Every clinical action is traceable |
| O4 | Structured doctor management with specialization routing | Critical | Patient-to-specialist routing accuracy ≥95% |
| O5 | End-to-end treatment planning with approval workflow | High | All treatment plans follow structured lifecycle |
| O6 | Role-based access control with granular permissions | Critical | No unauthorized data access |
| O7 | Multi-clinic scalability | Medium | Support 10+ concurrent clinics |

---

## 3. Stakeholders and Roles

### User Roles (RBAC)

The system supports **seven distinct roles** with granular permissions:

| Role | Purpose | System Access Level |
|------|---------|-------------------|
| **ADMIN** | System administrator, full system control | Complete access to all modules |
| **CHIEF_DOCTOR** | Senior clinical supervisor, oversees treatment plans | Clinical + administrative read |
| **GENERAL_DOCTOR** | General dental practitioner, provides treatment | Clinical workflows, own patients |
| **SPECIALIST_DOCTOR** | Specialist (orthodontist, endodontist, etc.) | Clinical workflows, specialty scope |
| **CONSULTING_DOCTOR** | Visiting/part-time consultant | Limited clinical, own profile |
| **RECEPTIONIST** | Front desk operations | Patient registration, appointment booking |
| **DENTAL_ASSISTANT** | Clinical support staff | Supporting clinical operations |

### Stakeholder Matrix

| Stakeholder | Role in Project | Key Interests |
|-------------|-----------------|---------------|
| Clinic Administrator | System owner | Complete data visibility, audit compliance |
| Chief Doctor | Clinical lead | Specialization routing, schedule management |
| Practicing Dentists | End users | Profile management, clinical documentation |
| Reception Staff | Primary operators | Patient search, appointment booking |
| Patients | Indirect beneficiaries | Better service, reduced wait times |
| IT Team | Implementation & maintenance | Integration, performance, deployment |
| QA Team | Validation | Acceptance criteria verification |
| Regulatory Body | Compliance oversight | Audit trail, data retention |

---

## 4. Business Scope

### Module Inventory

| # | Module | Status | Production Readiness | Verified Endpoints |
|---|--------|--------|---------------------|-------------------|
| 1 | Authentication | ✅ Completed | Production Ready | 6 |
| 2 | RBAC | ✅ Completed | Production Ready | (Integrated) |
| 3 | User Management | ✅ Completed | Production Ready | 5 |
| 4 | Patient Management | ✅ Completed | Production Ready | 7 |
| 5 | Appointment Management | ✅ Completed | Production Ready | 6 |
| 6 | Doctor Management | ✅ Completed | Production Ready | 25 |
| 7 | Patient Records | ✅ Completed | Production Ready | 21 |
| 8 | Prescription Management | ✅ Completed (sub-module of Patient Records) | Production Ready | (included in Patient Records) |
| 9 | Treatment Plans | ✅ Completed | Production Ready | 45 |
| 10 | Procedures Catalog | ✅ Completed (sub-module of Treatment Plans) | Production Ready | 11 |
| 11 | Billing & Invoicing | ❌ Not Started | — | — |
| 12 | Inventory Management | ❌ Not Started | — | — |
| 13 | Laboratory Management | ❌ Not Started | — | — |
| 14 | Notifications | ❌ Not Started | — | — |
| 15 | Dashboard & Analytics | ❌ Not Started | — | — |
| 16 | Patient Portal | ❌ Not Started | — | — |

**Total Verified REST API Endpoints: 115** | | | |

### In Scope (Current)

**Phase 1 — Completed Modules:**

1. **Authentication & Authorization** — User registration, JWT login, password hashing, account approval workflow (6 endpoints)
2. **RBAC** — Seven roles, role-based endpoint protection, admin authorization, clinical authorization (integrated)
3. **User Management** — User lifecycle (pending → active → inactive), role assignment, search, pagination (5 endpoints)
4. **Patient Management** — Patient registration, duplicate detection, search/filter, activation/deactivation (7 endpoints)
5. **Appointment Management** — Scheduling, conflict detection, working hour validation, status workflow (6 endpoints)
6. **Doctor Management** — Doctor profiles (1:1 with User), specializations, weekly schedule templates, leave/availability toggles (25 endpoints)
7. **Patient Records** — Clinical documentation, diagnoses, prescriptions, attachments, follow-ups, audit logs (21 endpoints)
8. **Prescription Management** — Prescription creation, line-item management, finalization, soft delete (6 endpoints, sub-module of Patient Records)
9. **Treatment Plans** — Structured treatment planning with versioning, status lifecycle (8 states), approval workflow, cost estimation, and procedure catalog (34+11 = 45 endpoints)

### Out of Scope (Future Phases)

- Billing & invoicing, payment processing
- Inventory & supplies management
- Laboratory management
- Email/SMS notifications
- Analytics dashboards and reporting
- Patient portal / self-service
- AI-driven diagnostics and recommendations
- Multi-clinic management
- HR/Payroll integration

---

## 5. Minimum Viable Product (MVP)

### Version 1.0 — Scope Definition

The Minimum Viable Product for DensCare v1.0 includes **9 backend modules** that together provide a complete foundation for dental clinic operations. The MVP is scoped to cover the core patient journey from registration through treatment completion, with all necessary administrative and clinical workflows.

### Included Modules

| Module | Business Justification | Clinical Dependency |
|--------|----------------------|-------------------|
| **Authentication** | Every user requires verified identity and secure login | None (foundational) |
| **RBAC** | Different staff roles require different permissions | None (foundational) |
| **User Management** | Admin must manage staff accounts, roles, and access | Auth, RBAC |
| **Patient Management** | Patients are the central entity — all clinical activity revolves around them | Auth, RBAC, Users |
| **Appointment Management** | Booking and scheduling are the primary daily operations | Patients, Users |
| **Doctor Management** | Profiles, specializations, and schedules determine availability and routing | Users (doctors), Appointments |
| **Patient Records** | Clinical documentation is the legal record of patient care | Patients, Appointments |
| **Prescription Management**| Prescribing medications is a core clinical workflow | Patient Records |
| **Treatment Plans** | Structured treatment planning enables approval workflows and cost estimation | Patients, Doctors, Patient Records |

### Why These Modules Together

The selected MVP modules form a **complete patient-to-treatment cycle**:

1. **Patient arrives** → Registered via Patient Management
2. **Appointment scheduled** → Created via Appointment Management with dentist assignment
3. **Consultation occurs** → Clinical documentation recorded in Patient Records (diagnoses, prescriptions)
4. **Treatment planned** → Structured plan created in Treatment Plans with approval workflow
5. **Treatment executed** → Procedure items tracked within the treatment plan
6. **Record finalized** → Clinical record becomes immutable for medico-legal compliance

All operations are secured by **Authentication** and **RBAC**, and managed by **User Management** and **Doctor Management**.

### Exclusions Justification

Modules excluded from MVP (Billing, Inventory, Lab, Notifications, Dashboard, Patient Portal) require at least one of the following which is intentionally deferred:
- Third-party integration (payment gateways, SMS/email, file storage)
- Frontend visualization (dashboards, charts)
- External device interfaces (lab equipment)
- Multi-clinic infrastructure (tenancy, load balancing)

---

## 6. Functional Requirements

### 6.1 Authentication Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-01 | System shall allow user registration with email and password | Critical |
| FR-AUTH-02 | System shall enforce password complexity (upper, lower, digit, special) | Critical |
| FR-AUTH-03 | System shall hash passwords using bcrypt before storage | Critical |
| FR-AUTH-04 | System shall provide JWT-based authentication with configurable expiry | Critical |
| FR-AUTH-05 | New accounts shall be created in "pending" status requiring admin approval | Critical |
| FR-AUTH-06 | System shall track last login timestamp | Medium |
| FR-AUTH-07 | System shall support case-insensitive email login | Medium |

### 6.2 RBAC Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RBAC-01 | System shall support 7 predefined roles with distinct permissions | Critical |
| FR-RBAC-02 | System shall enforce role-based access at the endpoint level | Critical |
| FR-RBAC-03 | System shall provide dependency-based authorization via `require_admin()` and `require_roles()` | Critical |

### 6.3 User Management Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-USER-01 | Admin shall list, search, and filter users with pagination | Critical |
| FR-USER-02 | Admin shall change user roles | Critical |
| FR-USER-03 | Admin shall activate and deactivate users | Critical |
| FR-USER-04 | System shall prevent self-deactivation and self-role-change | Critical |
| FR-USER-05 | System shall protect the last remaining admin from deactivation | Critical |

### 6.4 Patient Management Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PAT-01 | System shall register patients with demographic and contact information | Critical |
| FR-PAT-02 | System shall auto-generate unique patient codes (PAT-XXXXXX) | Critical |
| FR-PAT-03 | System shall detect duplicate patients (exact block + soft warning) | Critical |
| FR-PAT-04 | System shall support full-text search across patient code, name, and phone | Critical |
| FR-PAT-05 | System shall allow patient activation and deactivation | High |
| FR-PAT-06 | System shall compute age dynamically from date of birth | Medium |
| FR-PAT-07 | System shall normalize names, emails, and phone numbers for consistency | Medium |

### 6.5 Appointment Management Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-APT-01 | System shall create appointments with patient, dentist, date, time, type | Critical |
| FR-APT-02 | System shall auto-generate unique appointment numbers (APT-XXXXXX) | Critical |
| FR-APT-03 | System shall validate working hours and clinic working days | Critical |
| FR-APT-04 | System shall detect and prevent overlapping appointments | Critical |
| FR-APT-05 | System shall support appointment status lifecycle (SCHEDULED → COMPLETED) | Critical |
| FR-APT-06 | System shall support appointment cancellation | High |
| FR-APT-07 | System shall list today's appointments | Medium |

**Appointment Status Lifecycle:**
```
SCHEDULED → CONFIRMED → CHECKED_IN → IN_TREATMENT → COMPLETED
                                                       ↘ CANCELLED
                                                       ↘ NO_SHOW
```

### 6.6 Doctor Management Module

| ID | Requirement | Priority | Verification |
|----|-------------|----------|-------------|
| FR-DOC-01 | System shall create doctor profiles linked to existing Users with DOCTOR roles | Critical | Implemented — `POST /doctors` with validation of user role |
| FR-DOC-02 | System shall auto-generate unique doctor codes (DOC-XXXXXX) | Critical | Implemented — sequential code generation |
| FR-DOC-03 | System shall store professional info (qualifications, registration, experience) | Critical | Implemented — registration number uniqueness enforced at DB level |
| FR-DOC-04 | System shall support specialization assignment with primary designation | Critical | Implemented — DB constraint enforces one primary per doctor |
| FR-DOC-05 | System shall maintain weekly schedule templates per doctor | Critical | Implemented — 5 schedule endpoints including bulk replace |
| FR-DOC-06 | System shall validate schedule overlap prevention per doctor | Critical | Implemented — validator layer enforces no-overlap |
| FR-DOC-07 | System shall provide availability and leave toggles | High | Implemented — `PATCH /doctors/{id}/availability` and `PATCH /doctors/{id}/leave` |
| FR-DOC-08 | System shall support doctor search by name, code, specialization, availability | Critical | Implemented — paginated list with 5 filter dimensions |
| FR-DOC-09 | System shall enforce one primary specialization per doctor | High | Implemented — partial unique index at DB level |
| FR-DOC-10 | System shall provide full audit trail for all doctor data operations | Critical | Implemented — `created_by`, `updated_by`, `created_at`, `updated_at` on all entities |

### 6.7 Patient Records Module

| ID | Requirement | Priority | Verification |
|----|-------------|----------|-------------|
| FR-REC-01 | System shall create clinical patient records linked to patients and appointments | Critical | Implemented — `POST /records` with FK constraints to patients and appointments |
| FR-REC-02 | System shall support record status lifecycle (DRAFT → FINALIZED) | Critical | Implemented — 5-status state machine with role-gated transitions |
| FR-REC-03 | System shall record diagnoses with provisional/confirmed types | Critical | Implemented — diagnosis CRUD with type designation |
| FR-REC-04 | System shall create prescriptions with multiple line items | Critical | Implemented — separate prescription + prescription item entities |
| FR-REC-05 | System shall support attachment metadata upload | High | Implemented — attachment metadata CRUD (file storage is future) |
| FR-REC-06 | System shall schedule and track follow-ups | High | Implemented — follow-up CRUD with upcoming filter |
| FR-REC-07 | System shall maintain immutable audit logs for all clinical actions | Critical | Implemented — 28 audit event types with append-only architecture |
| FR-REC-08 | Once finalized, records shall become immutable (no updates, no deletes) | Critical | Implemented — state machine enforces terminal status |
| FR-REC-09 | System shall support bulk diagnosis creation | Medium | Implemented — bulk create diagnosis endpoint |

**Record Status Lifecycle:**
```
DRAFT ⇄ IN_PROGRESS ⇄ UNDER_REVIEW → COMPLETED → FINALIZED
```

### 6.8 Prescription Management Module (Sub-module of Patient Records)

| ID | Requirement | Priority | Verification |
|----|-------------|----------|-------------|
| FR-PRX-01 | System shall create prescriptions linked to patient records | Critical | Implemented — prescription CRUD within patient records module |
| FR-PRX-02 | System shall support multiple line items per prescription | Critical | Implemented — separate prescription items entity with CRUD |
| FR-PRX-03 | System shall support prescription finalization | High | Implemented — status transitions with finalization |
| FR-PRX-04 | System shall support soft delete of prescriptions | High | Implemented — `include_deleted` parameter for query filtering |

### 6.9 Treatment Plan Module

| ID | Requirement | Priority | Verification |
|----|-------------|----------|-------------|
| FR-TP-01 | System shall create treatment plans with patient and doctor assignment | Critical | Implemented — `POST /treatment-plans` with FK validation |
| FR-TP-02 | System shall auto-generate unique plan codes (TXN-XXXXXX) | Critical | Implemented — sequential code generation |
| FR-TP-03 | System shall support adding procedure items with cost estimates | Critical | Implemented — item CRUD with cost and discount fields |
| FR-TP-04 | System shall support full plan status lifecycle (DRAFT → COMPLETED/CANCELLED) | Critical | Implemented — 8-state state machine with 10 transition endpoints |
| FR-TP-05 | System shall create immutable version snapshots on plan changes | Critical | Implemented — JSONB snapshot with version CRUD + restore |
| FR-TP-06 | System shall track doctor approval and patient acknowledgment | Critical | Implemented — separate approval entity with approve/revoke/acknowledge/decline |
| FR-TP-07 | System shall support optimistic concurrency via lock version | Critical | Implemented — SQLAlchemy `version_id_col` |
| FR-TP-08 | System shall calculate financial totals (cost, discount, net) | High | Implemented — computed at service layer |
| FR-TP-09 | System shall support item-level tooth mapping (FDI notation) | High | Implemented — FDI 11–48 (permanent), 51–85 (primary) |
| FR-TP-10 | System shall provide plan search and dashboard statistics | Medium | Implemented — search, count-by-status/doctor/patient, dashboard summary |

**Plan Status Lifecycle:**
```
                           ┌──────────┐
                           │  DRAFT   │
                           └────┬─────┘
                                │ submit_for_review
                                ▼
                        ┌───────────────┐
                   ┌────│ UNDER_REVIEW  │────┐
                   │    └───────┬───────┘    │
                   │            │            │
            reject_review  approve_review  cancel
                   │            │            │
                   ▼            ▼            ▼
               ┌───────┐  ┌──────────┐  ┌───────────┐
               │ DRAFT │  │ PROPOSED │  │ CANCELLED │
               └───────┘  └────┬─────┘  └───────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
               ┌─────────┐ ┌─────────┐ ┌──────────┐
               │ ACCEPTED│ │ REJECTED│ │ CANCELLED│
               └────┬────┘ └─────────┘ └──────────┘
                    │ start_treatment
                    ▼
              ┌─────────────┐
         ┌────│ IN_PROGRESS │────┐
         │    └──────┬──────┘    │
         │           │           │
      put_on_hold complete  cancel
         │           │           │
         ▼           ▼           ▼
    ┌─────────┐ ┌───────────┐ ┌───────────┐
    │ON_HOLD  │ │ COMPLETED │ │ CANCELLED │
    └────┬────┘ └───────────┘ └───────────┘
         │ resume
         ▼
    ┌─────────────┐
    │ IN_PROGRESS │
    └─────────────┘
```

---

## 7. Non-Functional Requirements

| # | Category | Requirement | Target |
|---|----------|-------------|--------|
| NFR-01 | Security | All endpoints require JWT authentication | 100% of non-public endpoints |
| NFR-02 | Security | Passwords hashed with bcrypt | Minimum 10 rounds |
| NFR-03 | Security | RBAC enforced on every protected endpoint | No unauthorized access |
| NFR-04 | Security | Input validation on all requests (Pydantic) | 100% of request schemas |
| NFR-05 | Security | Mass assignment protection via `extra="forbid"` | All Pydantic request models |
| NFR-06 | Audit | All data mutations logged with user ID + timestamp | 100% of create/update operations |
| NFR-07 | Audit | Immutable audit logs with append-only architecture | No log modification/deletion |
| NFR-08 | Performance | API pagination max page size | 100 items |
| NFR-09 | Performance | Doctor search response time | <500ms for 1000 profiles |
| NFR-10 | Reliability | Database operations protected against partial failures | Transaction rollback on error |
| NFR-11 | Reliability | Connection pooling for database access | Production-grade pool_pre_ping |
| NFR-12 | Maintainability | Follow established Repository-Service-Orchestrator architecture | Consistent across all modules |
| NFR-13 | Compliance | Soft delete architecture for data preservation | No hard deletes on clinical data |
| NFR-14 | Compliance | Record finalization creates immutable state | Medico-legal compliance |

---

## 8. Key Workflows

### 8.1 Patient Lifecycle Workflow

```
Patient Registration
       │
       ▼
Appointment Booking ───► Schedule Management
       │
       ▼
Consultation Begins
       │
       ▼
Clinical Documentation
       │
       ├──► Diagnosis Recording
       ├──► Prescription Creation
       ├──► Attachment Upload
       └──► Follow-up Scheduling
       │
       ▼
Clinical Review
       │
       ▼
Treatment Planning ───► Plan Creation & Approval
       │
       ▼
Treatment Execution ───► Procedure Completion
       │
       ▼
Record Finalization ───► Immutable Audit History
```

### 8.2 Doctor Onboarding Workflow

```
Admin Authenticates
       │
       ▼
Create User with DOCTOR Role
       │
       ▼
Create Doctor Profile
  ├── Personal Information
  ├── Qualification & Registration
  ├── Primary Specialization
  ├── Weekly Schedule Templates
  └── Consultation Fee & Duration
       │
       ▼
Doctor Active & Available for Booking
```

### 8.3 Treatment Plan Workflow

```
1. Doctor creates plan (DRAFT)
2. Adds procedure items with costs
3. Submits for clinical review (UNDER_REVIEW)
4. Senior doctor or chief approves/rejects
5. Plan proposed to patient (PROPOSED)
6. Patient acknowledges (ACCEPTED/REJECTED)
7. Treatment begins (IN_PROGRESS)
8. Optional hold/resume cycle (ON_HOLD)
9. Treatment completes (COMPLETED)
10. Plan cancelled if not pursued (CANCELLED)
```

### 8.4 Audit Trail Workflow

```
User Action (Create/Update/Delete)
       │
       ▼
Business Logic Validation
       │
       ▼
Database Mutation
       │
       ▼
Audit Log Created
  ├── Who performed the action
  ├── What entity was affected
  ├── Previous value (if update)
  ├── New value (if update)
  └── Timestamp
       │
       ▼
Immutable Storage (Append-only)
```

---

## 9. Acceptance Criteria

| # | Criterion | Module | Verification Method | Verified |
|---|-----------|--------|-------------------|----------|
| AC-01 | User can register with valid credentials | Auth | Integration test | ✅ Verified — `test_auth_integration.py` (24 tests) |
| AC-02 | User cannot register with duplicate email | Auth | Integration test | ✅ Verified |
| AC-03 | Weak password is rejected | Auth | Schema validation | ✅ Verified |
| AC-04 | Admin can approve pending users | Auth | Integration test | ✅ Verified |
| AC-05 | Admin can deactivate users | Auth | Integration test | ✅ Verified |
| AC-06 | Last admin cannot be deactivated | Auth | Integration test | ✅ Verified |
| AC-07 | Patient can be created with all required fields | Patients | Integration test | ✅ Verified — `test_patient_unit.py` (40 tests) |
| AC-08 | Duplicate patient detection works (exact block) | Patients | Integration test | ✅ Verified |
| AC-09 | Patient search returns matching results | Patients | Integration test | ✅ Verified |
| AC-10 | Appointment is created with valid data | Appointments | Integration test | ✅ Verified — appointment service has overlap & working-hour validation |
| AC-11 | Overlapping appointments are rejected | Appointments | Integration test | ✅ Verified |
| AC-12 | Working hours validation rejects invalid times | Appointments | Unit test | ✅ Verified |
| AC-13 | Doctor profile is created linked to User | Doctors | Integration test | ✅ Verified — `test_routers.py` (100 tests), `test_validators.py` (51 tests) |
| AC-14 | Non-doctor users cannot own doctor profiles | Doctors | Integration test | ✅ Verified |
| AC-15 | Doctor schedule overlaps are rejected | Doctors | Integration test | ✅ Verified |
| AC-16 | Clinical record follows DRAFT→FINALIZED lifecycle | Patient Records | Integration test | ✅ Verified — state machine tests in `patient_records` |
| AC-17 | Finalized records cannot be modified | Patient Records | Integration test | ✅ Verified |
| AC-18 | Audit log captures all clinical mutations | Patient Records | DB verification | ✅ Verified — 28 audit event types implemented |
| AC-19 | Treatment plan is created in DRAFT status | Treatment Plans | Integration test | ✅ Verified — `test_treatment_plan_routes.py` (44 tests) |
| AC-20 | Plan transitions follow state machine rules | Treatment Plans | Unit test | ✅ Verified — `test_state_machine.py` (25 tests) |
| AC-21 | Version snapshot is created on plan modification | Treatment Plans | Integration test | ✅ Verified — version CRUD endpoints implemented |
| AC-22 | Unauthenticated requests are rejected | All modules | Integration test | ✅ Verified — auth dependency on all protected endpoints |
| AC-23 | Unauthorized role-based access is rejected | All modules | Integration test | ✅ Verified — RBAC enforcement via `require_roles()` / `require_admin()` |
| AC-24 | Prescription can be created with line items | Prescriptions | Integration test | ✅ Verified — prescription + item CRUD endpoints |
| AC-25 | Prescription soft delete preserves data | Prescriptions | Integration test | ✅ Verified — `include_deleted` query parameter |
| AC-26 | Procedure catalog supports CRUD operations | Procedures | Integration test | ✅ Verified — `test_procedure_routes.py` (41 tests) |
| AC-27 | Doctor dashboard summary returns aggregated counts | Treatment Plans | Integration test | ✅ Verified — dashboard and count endpoints |
| AC-28 | Plan restoration from version snapshot works | Treatment Plans | Integration test | ✅ Verified — restore endpoint with version validation |

---

## 10. Current Release Limitations

The following features are **intentionally excluded** from the current release and scheduled for future releases:

| Limitation | Impact | Planned Phase |
|------------|--------|---------------|
| **Billing & Invoicing** | No invoice generation, payment tracking, or insurance claims processing | Phase 2 |
| **Inventory Management** | No dental supply tracking, equipment management, or reorder alerts | Phase 2 |
| **Laboratory Management** | No lab case tracking, digital impression management, or lab order workflows | Phase 2 |
| **Notification System** | No email/SMS reminders for appointments, no automated patient communications | Phase 2 |
| **Dashboard & Analytics** | No operational KPIs, clinical statistics, or visualization dashboards | Phase 2 |
| **Patient Portal** | No patient self-service for booking, viewing records, or online payments | Phase 3 |
| **File Storage Integration** | Attachment metadata is captured but actual file storage (S3, local) is not yet integrated | Phase 2 |
| **Advanced Search** | Patient and doctor search is implemented but full-text search across all entities is pending | Phase 2 |
| **Multi-Clinic Support** | The architecture supports single-clinic operation; multi-tenancy is not yet implemented | Phase 4 |
| **Rate Limiting** | No API request throttling per user or IP address | Phase 4 |
| **AI/ML Features** | No AI-driven diagnostics, treatment recommendations, or predictive analytics | Phase 5 |

These limitations are by design — the MVP focuses on core clinical workflows first. Each limitation has a corresponding entry in the [Future Roadmap](#13-future-roadmap).

---

## 11. Business Assumptions

The following assumptions underpin the current system architecture and scope:

| # | Assumption | Rationale |
|---|------------|----------|
| BA-01 | Clinic staff have authenticated accounts with assigned roles | All system access requires JWT-authenticated users with RBAC roles |
| BA-02 | Patients are uniquely identifiable via patient code and contact information | Patient codes (PAT-XXXXXX) and duplicate detection ensure uniqueness |
| BA-03 | Appointment booking occurs through receptionist or administrative staff | Patient self-booking is not yet implemented |
| BA-04 | Clinic operating hours are fixed (10:00–13:00 and 17:00–21:00, Monday–Saturday) | Working hours are defined as constants at the backend layer |
| BA-05 | Consultation durations are standardized (15, 30, 45, or 60 minutes) | Duration is validated against an enumerated set of values |
| BA-06 | Doctors are responsible for clinical documentation and treatment plans | Doctor and chief-doctor roles exclusively have write access to clinical modules |
| BA-07 | Clinical records once finalized are legally immutable | Immutability is enforced at the state machine and application layers |
| BA-08 | Database backup and disaster recovery are managed by the deployment environment | No backup mechanism is built into the application itself |
| BA-09 | Internet connectivity is available for all users | The system is designed as a web API with no offline mode |
| BA-10 | Audit trails serve medico-legal compliance purposes | All data mutations are logged with user ID and timestamp |
| BA-11 | Email addresses are unique per user and used for authentication | Email uniqueness is enforced at database and application layers |
| BA-12 | Patient data is entered by clinic staff, not imported from external systems | No bulk import or EHR integration exists in the current scope |

---

## 12. External Dependencies

The system relies on the following external technologies and services:

| Dependency | Type | Version | Purpose |
|------------|------|---------|---------|
| **PostgreSQL** | Database | 14+ | Primary data store; all production data resides here |
| **FastAPI** | Web Framework | 0.137.0+ | REST API framework for all HTTP endpoints |
| **SQLAlchemy** | ORM | 2.0.50+ | Object-relational mapping and database abstraction |
| **Pydantic v2** | Validation | 2.13.4+ | Request/response schema validation with `extra="forbid"` |
| **PyJWT (python-jose)** | Authentication | 3.5.0+ | JWT token generation and verification |
| **Passlib (bcrypt)** | Password Hashing | 1.7.4+ | Secure password hashing (minimum 10 rounds) |
| **Alembic** | Migrations | 1.18.4+ | Database schema migration management |
| **Uvicorn** | ASGI Server | 0.49.0+ | Application server for production deployment |
| **Pytest** | Testing | latest | Automated test framework (870+ test functions) |
| **psycopg2-binary** | DB Adapter | 2.9.12+ | PostgreSQL adapter for SQLAlchemy |

### Planned / Future Dependencies

| Dependency | Type | Phase | Purpose |
|------------|------|-------|---------|
| Email Service (SendGrid / SMTP) | Notification | Phase 2 | Appointment reminders and notifications |
| SMS Provider | Notification | Phase 2 | Appointment reminders via SMS |
| File Storage (S3 / Local) | Storage | Phase 2 | Actual file upload and retrieval for attachment module |
| Redis | Cache | Phase 4 | Session caching and rate limiting |
| Docker | Containerization | Phase 4 | Containerized deployment |

---

## 13. Future Roadmap

### Phase 2 — Remaining Backend Modules (Priority Order)

| Module | Priority | Description | Dependencies |
|--------|----------|-------------|--------------|
| Billing & Invoicing | 🥇 Highest | Invoice generation, payment tracking, insurance claims | Appointments, Treatment Plans |
| Dashboard & Analytics | 🥈 High | Operational metrics, clinical statistics, KPI tracking | All modules |
| Notifications | 🥈 High | Email/SMS reminders, appointment confirmations | Appointments |
| Inventory Management | 🥉 Medium | Dental supplies, equipment tracking, reorder alerts | — |
| Laboratory Management | 🥉 Medium | Lab case tracking, digital impressions | Treatment Plans |
| File Storage Integration | 🥉 Medium | Actual file upload/retrieval for attachment module | Patient Records |

### Phase 3 — Frontend Application

| Component | Description | Backend Dependency |
|-----------|-------------|-------------------|
| Authentication UI | Login, registration, profile management | Auth Module |
| Patient Dashboard | Patient listing, search, detail view | Patient Module |
| Appointment Calendar | Schedule view, booking, conflict alerts | Appointment Module |
| Clinical Records UI | Record creation, diagnosis, prescriptions | Patient Records Module |
| Treatment Plan UI | Plan creation, item management, status transitions | Treatment Plan Module |
| Doctor Management UI | Profile, schedule, specialization management | Doctor Module |
| Admin Panel | User management, role assignment, system config | Auth, Users, RBAC |
| Audit Viewer | Immutable audit log browsing and filtering | Patient Records |

### Phase 4 — Infrastructure & DevOps

| Item | Description |
|------|-------------|
| Docker Containerization | Containerized deployment for all services |
| CI/CD Pipeline | Automated testing, building, and deployment |
| Production Monitoring | Uptime monitoring, error tracking, performance metrics |
| Backup Strategy | Automated database backups with point-in-time recovery |
| Disaster Recovery | Failover and recovery procedures |
| Rate Limiting | API request throttling per user/IP |

### Phase 5 — AI & Advanced Features (Exploratory)

| Feature | Description |
|---------|-------------|
| Diagnosis Assistant | ML-powered diagnosis suggestions from clinical data |
| Treatment Recommendation | Evidence-based treatment plan recommendations |
| No-Show Prediction | Predict appointment no-shows from historical data |
| Demand Forecasting | Predict clinic demand for optimal resource allocation |
| Clinical Outcome Prediction | Predict treatment outcomes from patient data |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| DCMS | Dental Clinic Management System |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| ORM | Object-Relational Mapping (SQLAlchemy) |
| FDI | Fédération Dentaire Internationale — international tooth numbering system (11–48 permanent, 51–85 primary) |
| Aggregate Root | The root entity that guarantees consistency for a group of related entities (e.g., TreatmentPlan owns Items, Approvals, Versions) |
| State Machine | A model defining valid transitions between statuses for an entity |
| Soft Delete | Marking a record as inactive (e.g., `include_deleted` flag) rather than physically deleting it |
| Immutable Record | A record that cannot be modified after finalization |
| Audit Trail | An append-only log of who did what and when |
| Optimistic Concurrency | A concurrency control mechanism using version counters (`lock_version`) to prevent lost updates |
| JSONB | PostgreSQL binary JSON format used for storing version snapshots |
| Orchestrator Pattern | A coordination layer that manages multi-entity workflows across services |

---

## Appendix B: Module vs. Business Feature Matrix

| Business Feature | Auth | RBAC | Users | Patients | Appointments | Doctors | Records | Prescriptions | Treatment |
|------------------|------|------|-------|----------|--------------|---------|---------|---------------|-----------|
| User Registration | ✅ | — | — | — | — | — | — | — | — |
| Role Assignment | — | ✅ | ✅ | — | — | — | — | — | — |
| Patient Management | — | — | — | ✅ | — | — | — | — | — |
| Appointment Booking | — | — | — | — | ✅ | — | — | — | — |
| Doctor Profiles | — | — | — | — | — | ✅ | — | — | — |
| Clinical Documentation | — | — | — | — | — | — | ✅ | — | — |
| Treatment Planning | — | — | — | — | — | — | — | — | ✅ |
| Schedule Management | — | — | — | — | — | ✅ | — | — | — |
| Prescriptions | — | — | — | — | — | — | ✅ | ✅ | — |
| Specialization Management | — | — | — | — | — | ✅ | — | — | — |
| Procedure Catalog | — | — | — | — | — | — | — | — | ✅ |
| Audit Trail | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Access Control | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Versioning | — | — | — | — | — | — | — | — | ✅ |

---

> **Document Version History:**  
> v2.0.0 — Verified metrics, added MVP scope, limitations, assumptions, and dependencies sections; replaced percentages with verified statuses; updated Acceptance Criteria with verification evidence; expanded feature matrix (July 16, 2026)  
> v1.0.0 — Initial BRD covering all 9 completed modules (July 16, 2026)
