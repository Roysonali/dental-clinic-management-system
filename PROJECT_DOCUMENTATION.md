# DensCare — Dental Clinic Management System
## Project Technical Documentation

> **Document Version:** 1.1.0  
> **Last Updated:** July 28, 2026  
> **Status:** Production-Ready

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [High Level Architecture](#2-high-level-architecture)
3. [Complete Folder Structure](#3-complete-folder-structure)
4. [Core Infrastructure](#4-core-infrastructure)
5. [Module Documentation](#5-module-documentation)
6. [Database Design](#6-database-design)
7. [Business Rules](#7-business-rules)
8. [API Documentation](#8-api-documentation)
9. [Validation Rules](#9-validation-rules)
10. [Exception Hierarchy](#10-exception-hierarchy)
11. [Security Features](#11-security-features)
12. [Transaction Management](#12-transaction-management)
13. [Project Standards](#13-project-standards)
14. [Testing Summary](#14-testing-summary)
15. [Current Project Status](#15-current-project-status)
16. [Remaining Modules](#16-remaining-modules)
17. [Development Roadmap](#17-development-roadmap)
18. [Statistics](#18-statistics)
19. [Architecture Evaluation](#19-architecture-evaluation)
20. [Executive Summary](#20-executive-summary)


# 1. Project Overview

## Project Name
**DensCare** — Dental Clinic Management System

## Purpose
DensCare is a comprehensive backend system designed to digitize and streamline the daily operations of a multi-specialty dental clinic. It provides a secure, role-based platform for managing patients, doctors, appointments, clinical records, prescriptions, and administrative workflows in a production healthcare environment.

## Target Users
- **Administrators** — Full system control, user approval, clinic configuration
- **Chief Doctors / General Doctors / Specialist Doctors / Consulting Doctors** — Clinical workflows, patient records, prescriptions
- **Receptionists** — Patient registration, appointment scheduling, front-desk operations
- **Dental Assistants** — Supporting clinical operations

## Real-World Business Problem
Dental clinics in many regions still rely on paper records, manual scheduling, and fragmented software. This leads to lost or illegible patient records, double-booking of appointments, no audit trail for clinical decisions, difficulty tracking patient history and treatment plans, compliance challenges with medical record regulations, and inefficient administrative workflows. DensCare solves these problems by providing a unified, auditable, role-based digital platform.

## Current Project Status
The project has **nine completed modules** with production-ready code:

| Module | Status | Endpoints | Tests |
|--------|--------|-----------|-------|
| Authentication | Complete | 5 | Yes |
| RBAC | Complete | (integrated) | Yes |
| User Management | Complete | 4 | Yes |
| Patient Management | Complete | 6 | Yes |
| Appointment Management | Complete | 5 | Yes |
| Doctor Management | Complete | 25+ | 227+ |
| Patient Records | Complete | 24+ | Yes |
| Treatment Plans | Complete (latest) | 35+ | 50+ |
| Billing & Invoicing | Complete (latest) | 30+ | 60+

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Python | 3.11+ |
| Web Framework | FastAPI | 0.137.0 |
| ORM | SQLAlchemy | 2.0.50 |
| Validation | Pydantic v2 | 2.13.4 |
| Auth | PyJWT (python-jose) | 3.5.0 |
| Password Hashing | Passlib (bcrypt) | 1.7.4 |
| Database | PostgreSQL (psycopg2-binary) | 2.9.12 |
| Migrations | Alembic | 1.18.4 |
| Testing | Pytest | latest |
| Server | Uvicorn | 0.49.0 |

## Architecture Style
**Layered (Clean) Architecture** with Repository Pattern, Service Layer, Validator Layer, and Mapper Layer.

## Design Philosophy
1. **Defense in depth** — Validation at every layer
2. **Fail fast** — Configuration validation at import time
3. **Auditability** — Every state change is tracked via audit columns
4. **Idempotency** — Toggle operations are safe to repeat
5. **Separation of concerns** — Each layer has a single responsibility
6. **Enterprise-grade error handling** — Structured JSON error responses


# 2. High Level Architecture

```
Client (Frontend)
       |
       | HTTP (JSON)
       v
+-----------------------------------------------+
|            API Router Layer                    |
| * Route definitions                            |
| * FastAPI dependency injection                 |
| * RBAC authorization checks                   |
| * Request deserialization (Pydantic)           |
| * Response serialization (Mappers)            |
+---------------------+-------------------------+
                      |
                      v
+-----------------------------------------------+
|           Dependencies Layer                   |
| * get_db() - SQLAlchemy session                |
| * get_current_user() - JWT auth               |
| * require_admin() / require_roles() - RBAC    |
| * Service instantiation                       |
+---------------------+-------------------------+
                      |
                      v
+-----------------------------------------------+
|            Service Layer                       |
| * Business logic orchestration                 |
| * Transaction ownership (commit/rollback)     |
| * Cross-repository coordination               |
| * Audit logging                               |
+---------------------+-------------------------+
                      |
                      v
+-----------------------------------------------+
|      Validator Layer (Pure)                    |
| * Stateless business rule validation           |
| * No database access (receives repo protocols)|
| * Raises domain exceptions on violation       |
| * No transactions, no side effects            |
+---------------------+-------------------------+
                      |
                      v
+-----------------------------------------------+
|           Repository Layer                     |
| * Data access (SQLAlchemy queries)            |
| * flush() / refresh() only (no commit)        |
| * No business logic                           |
| * Returns ORM entities                        |
+---------------------+-------------------------+
                      |
                      v
+-----------------------------------------------+
|      Database (PostgreSQL)                    |
| * Tables, constraints, indexes, sequences     |
| * Migrations managed by Alembic               |
+-----------------------------------------------+
```

## Layer Responsibilities

**Router Layer:** Thin by design — contains no business logic. Handles HTTP concerns (status codes, path/query parameters), enforces auth/authz via dependencies, instantiates services, delegates, maps results to response schemas.

**Dependencies Layer:** Session management (get_db()), JWT auth (get_current_user()), RBAC authz (require_admin(), require_roles() factory), service injection.

**Service Layer:** Transaction ownership (only layer that calls commit()/rollback()), business orchestration, cross-repository coordination, audit logging.

**Validator Layer:** Pure static methods — no state, no side effects, no transactions. Receives repository protocols as parameters. Raises domain exceptions on violation.

**Repository Layer:** Data access only (SQLAlchemy). flush()/refresh() only — never commit(). No business logic.

**Mapper Layer:** Transforms ORM entities to Pydantic response DTOs. Resolves computed fields (full_name, age, user_full_name).


# 3. Complete Folder Structure

The project follows a modular monolith structure:

```
denscare/
+-- README.md
+-- PROJECT_DOCUMENTATION.md
+-- backend/
|   +-- main.py                    FastAPI app entry point
|   +-- requirements.txt           Python dependencies
|   +-- alembic.ini                Alembic configuration
|   +-- alembic/
|   |   +-- env.py                 Migration environment
|   |   +-- script.py.mako         Migration template
|   |   +-- versions/              17 migration files
|   +-- app/
|       +-- core/
|       |   +-- config.py          Settings from env vars
|       |   +-- constants.py       App-wide constants & enums
|       |   +-- security.py        Password hashing, JWT
|       |   +-- exception_handlers.py  Global error handlers
|       +-- database/
|       |   +-- base.py            SQLAlchemy DeclarativeBase
|       |   +-- models.py          Re-exports all ORM models
|       |   +-- session.py         Engine & session factory
|       |   +-- seed_roles.py      Role seeding script
|       |   +-- test_connection.py DB connectivity test
|       +-- dependencies/
|       |   +-- auth.py            JWT auth dependency
|       +-- modules/
|           +-- auth/              Auth module
|           +-- rbac/              RBAC module
|           +-- users/             User management
|           +-- patients/          Patient management
|           +-- appointments/      Appointment module
|           +-- doctors/           Doctor management
|           +-- patient_records/   Patient records module
|           +-- treatment/         Treatment plan module
|           +-- billing/           Billing & invoicing module
```

# 4. Core Infrastructure

## Configuration (app/core/config.py)
The Settings class loads from env vars with fail-fast validation: DATABASE_URL (required), JWT_SECRET (required, >=32 chars), JWT_ALGORITHM (HMAC-SHA only), ACCESS_TOKEN_EXPIRE_MINUTES (default 30).

## Database (app/database/session.py)
Engine with pool_pre_ping=True. get_db() yields a session per request, closes in finally. Auto-flush disabled.

## Security (app/core/security.py)
Password hashing via bcrypt. JWT creation with sub, exp, iat, jti, token_type claims. JWT decode verifies exp/iat with 30-second clock skew.

## Constants (app/core/constants.py)
7 RBAC roles: ADMIN, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR, RECEPTIONIST, DENTAL_ASSISTANT. Doctor roles: CHIEF/GENERAL/SPECIALIST/CONSULTING. User states: pending, active, inactive.

## Exception Handling
Every domain exception has a dedicated handler producing structured JSON: {"success": false, "message": "...", "details": {}}. Handles AuthException, UserException, DoctorException, PatientException, PatientRecordException, TreatmentPlanException, BillingException, AppointmentException, HTTPException, RequestValidationError, and a catch-all for unexpected exceptions.


# 5. Module Documentation

## 5.1 Authentication Module
**Location:** backend/app/modules/auth/

Handles user registration, login, admin approval workflow, and account lifecycle.

**Models:** User (with status lifecycle pending->active->inactive) and Role (7 seeded roles).

**Services (function-based):** register_user(), authenticate_user(), approve_user(), deactivate_user().

**Endpoints:** POST /auth/register, POST /auth/login, GET /auth/me, GET /auth/users/pending, PATCH /auth/users/{id}/approve, PATCH /auth/users/{id}/deactivate.

## 5.2 RBAC Module
**Location:** backend/app/modules/rbac/

Provides require_admin() and require_roles() factory dependencies. Chains onto get_current_user().

## 5.3 User Management Module
**Location:** backend/app/modules/users/

Admin CRUD for users with last-admin protection. Endpoints: GET /users, GET /users/{id}, PATCH /users/{id}/role, PATCH /users/{id}/activate, PATCH /users/{id}/deactivate.

## 5.4 Patient Management Module
**Location:** backend/app/modules/patients/

Patient CRUD with intelligent duplicate detection (exact block + soft warn). Uses PatientMapper. Endpoints: POST/GET/PATCH /patients, PATCH /patients/{id}/activate, PATCH /patients/{id}/deactivate, GET /patients/{id}/profile.

## 5.5 Appointment Management Module
**Location:** backend/app/modules/appointments/

Appointment CRUD with working hours validation, overlap detection, and status state machine (SCHEDULED through COMPLETED/CANCELLED/NO_SHOW). Endpoints: POST/GET /appointments, GET /appointments/today, GET/PUT /appointments/{id}, PATCH /appointments/{id}/cancel.

## 5.6 Doctor Management Module
**Location:** backend/app/modules/doctors/

The most comprehensive module. Full 4-layer architecture with separate files for each concern.

**Models:** Doctor (1:1 with User), Specialization, DoctorSpecialization (join with is_primary), DoctorSchedule.

**Services:** DoctorService (17 methods), ScheduleService (7 methods), SpecializationService (8 methods).

**Validators:** DoctorValidator (10 rules), ScheduleValidator (5 rules), SpecializationValidator (5 rules). All use structural Protocol classes for dependency inversion.

**Bug Fix:** Pydantic HttpUrl -> str conversion in service layer for psycopg2/PostgreSQL compatibility.

**25+ Endpoints** across 3 routers (doctors, specializations, schedules). 227+ tests.

## 5.7 Patient Records Module
**Location:** backend/app/modules/patient_records/

Largest module with internal layered architecture, formal state machine (DRAFT -> IN_PROGRESS -> UNDER_REVIEW -> COMPLETED -> FINALIZED), and orchestrator pattern.

**24+ Endpoints** for records, diagnoses, prescriptions, prescription items, attachments, follow-ups, and audit logs.

## 5.8 Treatment Plan Module
**Location:** backend/app/modules/treatment/

Comprehensive dental treatment planning module with full versioning, status lifecycle, cost estimation, and approval workflow.

**Models:** Procedure (master catalog), TreatmentPlan (aggregate root), TreatmentPlanItem, TreatmentPlanVersion, TreatmentPlanApproval.

**Services:** TreatmentPlanService (20+ methods), ProcedureService (10+ methods).

**Validators:** TreatmentPlanValidator (10+ rules), ProcedureValidator (5+ rules), StateMachineValidator.

**State Machine:** DRAFT -> UNDER_REVIEW -> PROPOSED -> ACCEPTED -> IN_PROGRESS -> ON_HOLD -> COMPLETED (terminal). Rejection from UNDER_REVIEW returns to DRAFT. Full cancellation support from any non-terminal state.

**Features:**
- Auto-generated plan codes (TXN-XXXXXX prefix)
- FDI tooth numbering validation (11-48, 51-85)
- Tooth surface code validation (M/D/B/L/O/I)
- Item-level status tracking (PENDING -> IN_PROGRESS -> COMPLETED/CANCELLED/DEFERRED)
- Version snapshots with JSONB items payload (immutable after creation)
- Version history, restore, and diff capabilities
- Doctor approval workflow with revoke support
- Patient acknowledgment (accept/decline) tracking
- Dashboard statistics (counts by status, pending review/approval/acknowledgment)
- Paginated search, filtering, and sorting across plans
- Procedure master catalog with category classification (diagnostic, preventive, restorative, etc.)

**35+ Endpoints** across 2 routers (treatment plans, procedures).

## 5.9 Billing & Invoicing Module
**Location:** backend/app/modules/billing/

Complete financial module covering invoice lifecycle, payment processing, receipt generation, refunds, credit notes, and billing dashboards. Follows ADR-001 (Invoice as Aggregate Root), ADR-002 (Immutable after issuance), ADR-003 (Sequential numbering), ADR-004 (Payment allocation model), and ADR-005 (Discount approval workflow).

**Models (10):** Invoice, InvoiceItem, Payment, PaymentAllocation, Receipt, Refund, CreditNote, PatientCredit, DocumentSequence, BillingAuditLog.

**Services (8):** InvoiceService, PaymentService, ReceiptService, RefundService, CreditNoteService, DocumentSequenceService, BillingOrchestrationService, FinancialCalculationService.

**Validators (8):** InvoiceValidator, PaymentValidator, ReceiptValidator, RefundValidator, CreditNoteValidator, PatientCreditValidator, DocumentSequenceValidator, FinancialValidator, StateMachineValidator.

**Repositories (8):** InvoiceRepository, PaymentRepository, ReceiptRepository, RefundRepository, CreditNoteRepository, PatientCreditRepository, DocumentSequenceRepository, AuditRepository.

**Mappers (6):** InvoiceMapper, PaymentMapper, ReceiptMapper, RefundMapper, CreditNoteMapper, BillingDashboardMapper.

**State Machines:**
- Invoice: DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID (terminal), CANCELLED/VOID (terminal)
- Payment: PENDING -> COMPLETED/FAILED/VOID, COMPLETED -> REFUNDED/REVERSED
- Refund: PENDING -> APPROVED -> COMPLETED (terminal), PENDING -> REJECTED (terminal)
- Credit Note: DRAFT -> ISSUED -> APPLIED (terminal), VOID/EXPIRED (terminal)
- Receipt: GENERATED (immutable), CANCELLED (terminal)

**Features:**
- Gap-tracked sequential document numbering (ADR-003) for invoices, receipts, payments, refunds, credit notes
- Draft -> Issue workflow with immutability after issuance
- Payment allocation to invoices with partial allocation support
- Overpayment detection and control
- Multi-currency support (USD, EUR, GBP, INR)
- Payment method tracking (cash, card, UPI, bank transfer, cheque, insurance, wallet)
- Refund lifecycle with approval workflow (create -> approve/reject -> complete)
- Credit note generation against issued invoices with expiry tracking
- Receipt generation and regeneration for completed payments
- Dashboard with financial totals (invoiced, collected, refunded, outstanding, credited)
- Entity counts and recent activity tracking
- Optimistic locking with version columns for concurrency control
- Audit logging for all financial operations

**30+ Endpoints** across 6 sub-routers (invoices, payments, receipts, refunds, credit notes, dashboard).


# 6. Database Design

## Complete Table List

| # | Table | Module | Description |
|---|-------|--------|-------------|
| 1 | roles | Auth | RBAC role definitions |
| 2 | users | Auth | System users with auth and status |
| 3 | patients | Patients | Patient demographic records |
| 4 | appointments | Appointments | Appointment scheduling |
| 5 | doctors | Doctors | Doctor profiles (1:1 with users) |
| 6 | specializations | Doctors | Dental specialization master list |
| 7 | doctor_specializations | Doctors | Doctor-Specialization many-to-many |
| 8 | doctor_schedules | Doctors | Weekly availability templates |
| 9 | patient_records | Patient Records | Clinical patient records |
| 10 | patient_record_diagnoses | Patient Records | Diagnoses within records |
| 11 | patient_record_prescriptions | Patient Records | Prescriptions |
| 12 | patient_record_prescription_items | Patient Records | Prescription line items |
| 13 | patient_record_attachments | Patient Records | File attachments |
| 14 | patient_record_followups | Patient Records | Follow-up entries |
| 15 | patient_record_audit_logs | Patient Records | Audit trail |
| 16 | procedures | Treatment | Dental procedure master catalog |
| 17 | treatment_plans | Treatment | Treatment plan aggregate root |
| 18 | treatment_plan_items | Treatment | Procedure line items within a plan |
| 19 | treatment_plan_versions | Treatment | Immutable version snapshots (JSONB) |
| 20 | treatment_plan_approvals | Treatment | Doctor approval and patient acknowledgment records |
| 21 | invoices | Billing | Invoice aggregate root (ADR-001) |
| 22 | invoice_items | Billing | Invoice line items |
| 23 | payments | Billing | Payment records |
| 24 | payment_allocations | Billing | Payment-to-invoice allocations (ADR-004) |
| 25 | receipts | Billing | Official payment receipts |
| 26 | refunds | Billing | Refund requests with approval workflow |
| 27 | credit_notes | Billing | Credit note documents |
| 28 | patient_credits | Billing | Patient credit balance tracking |
| 29 | document_sequences | Billing | Gap-tracked sequential numbering (ADR-003) |
| 30 | billing_audit_logs | Billing | Financial audit trail

## Key Relationships
- users 1:1 doctors (doctor extends user identity)
- users 1:N appointments (as dentist)
- patients 1:N appointments
- patients 1:N patient_records
- patients 1:N treatment_plans
- patients 1:N invoices
- patients 1:N payments
- appointments 1:1 patient_records
- doctors M:N specializations (via doctor_specializations with is_primary flag)
- doctors 1:N doctor_schedules
- doctors 1:N treatment_plans
- procedures 1:N treatment_plan_items
- treatment_plans 1:N treatment_plan_items/versions/approvals
- invoices 1:N invoice_items/payments/credit_notes
- invoices 1:N payment_allocations (via payments)
- payments 1:N receipts/refunds/allocations
- patient_records 1:N child entities (diagnoses, prescriptions, attachments, follow-ups, audit_logs)

## Audit Convention
Every data table has created_by, updated_by, created_at, updated_at columns.

# 7. Business Rules

## Authentication
- BR-AUTH-001: Email must be unique (case-insensitive)
- BR-AUTH-002: Password must contain uppercase, lowercase, digit, and special character
- BR-AUTH-003: New users start as pending, requiring admin approval
- BR-AUTH-004: Admin cannot deactivate their own account
- BR-AUTH-005: Last admin cannot be deactivated
- BR-AUTH-006: Login is case-insensitive

## User Management
- BR-USER-001 to 005: Self operations blocked; last-admin protected

## Patient Management
- BR-PAT-001 to 006: Duplicate detection (exact block + soft warn), auto-generated codes, idempotent status

## Appointment Management
- BR-APT-001 to 009: Working hours/days, duration limits, active patient/dentist, overlap prevention, status transitions

## Doctor Management
- BR-DOC-001 to 020: User eligibility, registration uniqueness, code generation, schedule validation, specialization constraints

## Patient Records
- BR-REC-001 to 010: Existence, uniqueness, finalized immutability, state machine, role-gated transitions, audit


# 8. API Documentation

## Authentication (5 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /auth/register | None | Public |
| POST | /auth/login | None | Public |
| GET | /auth/me | JWT | Any |
| GET | /auth/users/pending | JWT | Admin |
| PATCH | /auth/users/{id}/approve | JWT | Admin |
| PATCH | /auth/users/{id}/deactivate | JWT | Admin |

## User Management (5 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /users | JWT | Admin |
| GET | /users/{id} | JWT | Admin |
| PATCH | /users/{id}/role | JWT | Admin |
| PATCH | /users/{id}/activate | JWT | Admin |
| PATCH | /users/{id}/deactivate | JWT | Admin |

## Patients (7 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /patients | JWT | Admin, Receptionist |
| GET | /patients | JWT | Admin, Receptionist, Doctors |
| GET | /patients/{id} | JWT | Admin, Receptionist, Doctors |
| PATCH | /patients/{id} | JWT | Admin, Receptionist |
| PATCH | /patients/{id}/activate | JWT | Admin |
| PATCH | /patients/{id}/deactivate | JWT | Admin |
| GET | /patients/{id}/profile | JWT | Admin, Receptionist, Doctors |

## Appointments (6 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /appointments | JWT | Admin, Receptionist, Doctors |
| GET | /appointments | JWT | Admin, Receptionist, Doctors |
| GET | /appointments/today | JWT | Admin, Receptionist, Doctors |
| GET | /appointments/{id} | JWT | Admin, Receptionist, Doctors |
| PUT | /appointments/{id} | JWT | Admin, Receptionist, Doctors |
| PATCH | /appointments/{id}/cancel | JWT | Admin, Receptionist, Doctors |

## Doctors (13 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /doctors | JWT | Admin |
| GET | /doctors | JWT | Admin, Receptionist |
| GET | /doctors/{id} | JWT | Admin, Receptionist, Self |
| GET | /doctors/user/{user_id} | JWT | Admin, Receptionist, Self |
| PATCH | /doctors/{id} | JWT | Admin |
| DELETE | /doctors/{id} | JWT | Admin |
| PATCH | /doctors/{id}/activate | JWT | Admin |
| PATCH | /doctors/{id}/deactivate | JWT | Admin |
| PATCH | /doctors/{id}/leave | JWT | Admin |
| PATCH | /doctors/{id}/availability | JWT | Admin |
| POST | /doctors/{id}/specializations | JWT | Admin |
| DELETE | /doctors/{id}/specializations/{sid} | JWT | Admin |
| GET | /doctors/{id}/profile | JWT | Admin, Receptionist, Self |

## Specializations (7 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /specializations | JWT | Admin |
| GET | /specializations | JWT | Admin, Receptionist, Doctors |
| GET | /specializations/{id} | JWT | Admin, Receptionist, Doctors |
| PATCH | /specializations/{id} | JWT | Admin |
| PATCH | /specializations/{id}/activate | JWT | Admin |
| PATCH | /specializations/{id}/deactivate | JWT | Admin |
| DELETE | /specializations/{id} | JWT | Admin |

## Schedules (5 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /doctors/{id}/schedules | JWT | Admin, Receptionist, Self |
| POST | /doctors/{id}/schedules | JWT | Admin |
| PATCH | /doctors/{id}/schedules/{sid} | JWT | Admin |
| DELETE | /doctors/{id}/schedules/{sid} | JWT | Admin |
| PUT | /doctors/{id}/schedules | JWT | Admin |

## Patient Records (9 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /patient-records | JWT | Write roles |
| GET | /patient-records | JWT | Read roles |
| GET | /patient-records/{id} | JWT | Read roles |
| GET | /patient-records/appointment/{id} | JWT | Read roles |
| GET | /patient-records/patient/{id} | JWT | Read roles |
| PATCH | /patient-records/{id} | JWT | Write roles |
| PATCH | /patient-records/{id}/status | JWT | Status change roles |
| POST | /patient-records/{id}/finalize | JWT | Status change roles |
| DELETE | /patient-records/{id} | JWT | Admin |

Plus child entity endpoints for diagnoses, prescriptions, prescription items, attachments, follow-ups, and audit logs.

## Treatment Plans (35+ endpoints)

### Procedures (10 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /procedures | JWT | Admin |
| GET | /procedures | JWT | Admin, Receptionist, Doctors |
| GET | /procedures/search | JWT | Admin, Receptionist, Doctors |
| GET | /procedures/active | JWT | Admin, Receptionist, Doctors |
| GET | /procedures/count | JWT | Admin, Receptionist, Doctors |
| GET | /procedures/{id} | JWT | Admin, Receptionist, Doctors |
| GET | /procedures/by-code/{code} | JWT | Admin, Receptionist, Doctors |
| PATCH | /procedures/{id} | JWT | Admin |
| PATCH | /procedures/{id}/activate | JWT | Admin |
| PATCH | /procedures/{id}/deactivate | JWT | Admin |
| DELETE | /procedures/{id} | JWT | Admin |

### Treatment Plans (25+ endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /treatment-plans | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/search | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/pending-review | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/pending-approval | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/dashboard | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/by-patient/{id} | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/by-doctor/{id} | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/count-by-status | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/count-by-doctor | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/count-by-patient | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/{id} | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/items | JWT | Admin, Receptionist, Doctors |
| PATCH | /treatment-plans/{id}/items/{item_id} | JWT | Admin, Receptionist, Doctors |
| DELETE | /treatment-plans/{id}/items/{item_id} | JWT | Admin, Receptionist, Doctors |
| PUT | /treatment-plans/{id}/items/reorder | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/submit-for-review | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/approve-review | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/reject-review | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/accept | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/decline | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/cancel | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/start-treatment | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/hold | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/resume | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/complete | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/doctor-approve | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/doctor-revoke | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/patient-acknowledge | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/patient-decline | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/versions | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/{id}/versions | JWT | Admin, Receptionist, Doctors |
| GET | /treatment-plans/{id}/versions/{version_id} | JWT | Admin, Receptionist, Doctors |
| POST | /treatment-plans/{id}/versions/{version_id}/restore | JWT | Admin, Receptionist, Doctors |

## Billing & Invoicing (30+ endpoints)

### Invoices (7 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /billing/invoices | JWT | Admin, Receptionist, Doctors, Assistants |
| GET | /billing/invoices/{id} | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/invoices | JWT | Admin, Receptionist, Doctors, Assistants |
| PATCH | /billing/invoices/{id} | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/invoices/{id}/issue | JWT | Admin, Receptionist, Doctors |
| POST | /billing/invoices/{id}/cancel | JWT | Admin, Receptionist, Doctors |
| DELETE | /billing/invoices/{id} | JWT | Admin |

### Payments (11 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /billing/payments | JWT | Admin, Receptionist, Doctors, Assistants |
| GET | /billing/payments/{id} | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/payments | JWT | Admin, Receptionist, Doctors, Assistants |
| PATCH | /billing/payments/{id} | JWT | Admin, Receptionist, Doctors, Assistants |
| DELETE | /billing/payments/{id} | JWT | Admin |
| POST | /billing/payments/{id}/complete | JWT | Admin, Receptionist, Doctors |
| POST | /billing/payments/{id}/fail | JWT | Admin, Receptionist, Doctors |
| POST | /billing/payments/{id}/void | JWT | Admin, Receptionist, Doctors |
| POST | /billing/payments/{id}/allocate | JWT | Admin, Receptionist, Doctors |
| POST | /billing/payments/{id}/deallocate | JWT | Admin, Receptionist, Doctors |
| GET | /billing/payments/{id}/allocations | JWT | Admin, Receptionist, Doctors, Assistants |

### Receipts (3 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /billing/receipts/{id} | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/receipts | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/receipts/{id}/regenerate | JWT | Admin, Receptionist, Doctors |

### Refunds (4 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /billing/refunds | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/refunds/{id}/approve | JWT | Admin, Receptionist, Doctors |
| POST | /billing/refunds/{id}/reject | JWT | Admin, Receptionist, Doctors |
| POST | /billing/refunds/{id}/complete | JWT | Admin, Receptionist, Doctors |

### Credit Notes (4 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| POST | /billing/credit-notes | JWT | Admin, Receptionist, Doctors, Assistants |
| POST | /billing/credit-notes/{id}/issue | JWT | Admin, Receptionist, Doctors |
| POST | /billing/credit-notes/{id}/void | JWT | Admin, Receptionist, Doctors |
| POST | /billing/credit-notes/{id}/apply | JWT | Admin, Receptionist, Doctors |

### Dashboard & Reports (2 endpoints)
| Method | Endpoint | Auth | Roles |
|--------|----------|------|-------|
| GET | /billing/dashboard | JWT | Admin, Receptionist, Doctors, Assistants |
| GET | /billing/summary | JWT | Admin, Receptionist, Doctors, Assistants |


# 9. Validation Rules

Validation is performed at three layers:

1. **Schema Validation (Pydantic)** — Type checking, format validation, length constraints, regex patterns
2. **Business Validation (Validators)** — Domain rules, uniqueness, state transitions, eligibility
3. **Database Constraints** — NOT NULL, UNIQUE, CHECK, FK constraints

Key schema validations:
- Password: 8-128 chars, upper+lower+digit+special
- Phone: 10-15 digits, optional leading plus sign
- Registration number: uppercase letters, digits, hyphens only
- Date of Birth: not future, year >= 1900
- Consultation fee: positive, max 10 digits, 2 decimal places
- Consultation duration: 15-240 minutes
- Years of experience: 0-50
- Languages: list of strings, trimmed, title-cased, deduplicated
- Extra fields: always rejected via ConfigDict(extra="forbid")

# 10. Exception Hierarchy

All domain exceptions follow this pattern:
```python
class DoctorException(Exception):
    def __init__(self, code, message, details=None):
        self.code = code        # Machine-readable
        self.message = message  # Human-readable
        self.details = details  # Optional context
```

Hierarchy: Exception -> AuthException (11 subclasses), UserException (11 subclasses), DoctorException (18 subclasses), PatientException (6 subclasses), PatientRecordException (8 subclasses), AppointmentException (4 subclasses), TreatmentPlanException (20+ subclasses), BillingException (30+ subclasses). Each base class has a dedicated global handler with HTTP status mapping via MRO-based resolution.

# 11. Security Features

- JWT Authentication: HMAC-SHA256, 30s clock skew, unique jti, required exp/iat
- Password hashing: bcrypt via Passlib
- RBAC: 7 roles, require_admin() and require_roles() dependencies
- Object-level ownership checks (doctors self-read only)
- Admin approval workflow for new users
- All endpoints except /auth/register and /auth/login require authentication

# 12. Transaction Management

- Repositories: flush/refresh only, never commit
- Services: own commit() and rollback(), use _run_in_transaction() helper
- Validators: pure static methods, no persistence

Flow: Router -> Service._run_in_transaction() -> Validator.assert_*() -> Repository.add() -> db.flush() -> db.commit(). On error: db.rollback().

# 13. Project Standards

- Files: snake_case, Classes: PascalCase, Functions: snake_case, Constants: UPPER_SNAKE_CASE
- Full type annotations on all function signatures
- Module-level structured logging with contextual extra dict
- Pydantic ConfigDict(extra="forbid") for requests, from_attributes=True for responses
- Repository Pattern, Service Layer, Pure Validators, Mapper Layer
- Protocol classes for dependency inversion in validators

# 14. Testing Summary

- Framework: pytest with function-scoped fixtures
- Database: SQLite in-memory with custom UUID/JSONB compilers
- HTTP Client: FastAPI TestClient

## Module Test Coverage

### Doctor Module: 227+ tests across 5 test files
- 55 validator unit tests (mocked repos)
- 150+ API integration tests
- 20+ edge case/stress tests
- 5 repository tests

### Treatment Module: 50+ tests across 11+ test files
- Unit tests: validators, services, schemas, mappers, repositories, state machine
- Integration tests: procedure routes, treatment plan routes
- Auth integration tests for RBAC enforcement
- Workflow test files

### Billing Module: 60+ tests across 22+ test files
- Unit tests (9+ files): invoice service, payment service, receipt service, refund service, credit note service, billing orchestration service, financial calculation service, payment allocation, document sequence initialization
- Integration tests (13+ files): migration validation, financial integrity, PostgreSQL features, locking/concurrency, transaction behavior, E2E workflows, dependency injection, exception handling, performance smoke tests, production readiness, system integration, E2E business workflows
- Router tests (6+ files): invoice, payment, receipt, refund, credit note, dashboard routes

### Known Limitations
- SQLite dynamic typing masked the HttpUrl bug; regression tests now verify str type explicitly.

# 15. Current Project Status

9 completed modules with 115+ API endpoints, 350+ tests, 17 migrations.

Production-ready checklist:
- [x] Structured error handling with global handlers
- [x] Multi-layer validation
- [x] Audit trails on all tables
- [x] RBAC
- [x] JWT with security best practices
- [x] Configuration validation at import
- [x] CORS configured
- [x] Connection pooling
- [x] Alembic migrations
- [x] PostgreSQL compatibility fixes
- [x] Gap-tracked sequential document numbering (ADR-003)
- [x] Optimistic locking for concurrency control
- [x] Financial integrity invariants and money handling policy
- [x] State machine enforcement (invoice, payment, refund, credit note, treatment plan)
- [x] Audit logging for all financial operations

# 16. Remaining Modules

Dental Chart, Inventory, Laboratory Management, Reports, Notifications, Medical History, Insurance Management.

# 17. Development Roadmap

Priority 1: Dental Chart (clinical) — NEXT
Priority 2: Notifications, Inventory (operational)
Priority 3: Reports, Dashboard (analytics)
Priority 4: Medical History, Insurance Management (expansion)

# 18. Statistics

| Category | Count |
|----------|-------|
| Python source files | 200+ |
| Lines of code | 30,000+ |
| Completed Modules | 9 |
| API Endpoints | 115+ |
| Database Tables | 30 |
| Services | 20+ |
| Repositories | 20+ |
| Custom Exceptions | 75+ |
| Business Rules | 75+ |
| Tests (all modules) | 350+ |
| DB Migrations | 17 |

# 19. Architecture Evaluation

Strengths: Clean separation of concerns, testability, maintainability, scalability, security, auditability.

Future improvements: Request ID tracking, API versioning, rate limiting, Redis caching, Docker-based integration tests, full-text search, event-driven notifications.

# 20. Executive Summary

The DensCare Dental Clinic Management System is a production-ready, enterprise-grade backend API with **nine completed modules** providing secure authentication, RBAC, patient/appointment/doctor management, clinical records, treatment planning with full state machine and versioning, and a comprehensive billing & invoicing system (invoices, payments, receipts, refunds, credit notes, and dashboards). The project demonstrates Clean Architecture, comprehensive testing (350+ tests), and production-hardened code including PostgreSQL compatibility fixes, optimistic locking, sequential document numbering, and financial integrity invariants. It is suitable for production deployment with the addition of a frontend interface.
