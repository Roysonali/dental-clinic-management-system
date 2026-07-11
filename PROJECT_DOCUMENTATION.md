# DensCare — Dental Clinic Management System
## Project Technical Documentation

> **Document Version:** 1.0.0  
> **Last Updated:** July 11, 2026  
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
The project has **seven completed modules** with production-ready code:

| Module | Status | Endpoints | Tests |
|--------|--------|-----------|-------|
| Authentication | Complete | 5 | Yes |
| RBAC | Complete | (integrated) | Yes |
| User Management | Complete | 4 | Yes |
| Patient Management | Complete | 6 | Yes |
| Appointment Management | Complete | 5 | Yes |
| Doctor Management | Complete (latest) | 25+ | 227+ |
| Patient Records | Complete | 24+ | Yes |

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
|   |   +-- versions/              14 migration files
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
Every domain exception has a dedicated handler producing structured JSON: {"success": false, "message": "...", "details": {}}. Handles AuthException, UserException, DoctorException, PatientException, PatientRecordException, HTTPException, RequestValidationError, and a catch-all for unexpected exceptions.


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

## Key Relationships
- users 1:1 doctors (doctor extends user identity)
- users 1:N appointments (as dentist)
- patients 1:N appointments
- patients 1:N patient_records
- appointments 1:1 patient_records
- doctors M:N specializations (via doctor_specializations with is_primary flag)
- doctors 1:N doctor_schedules
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

Hierarchy: Exception -> AuthException (11 subclasses), UserException (11 subclasses), DoctorException (18 subclasses), PatientException (6 subclasses), PatientRecordException (3 subclasses), AppointmentException (4 subclasses). Each base class has a dedicated global handler.

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

Doctor module: 227+ tests across 5 test files
- 55 validator unit tests (mocked repos)
- 150+ API integration tests
- 20+ edge case/stress tests
- 5 repository tests

Known limitation: SQLite dynamic typing masked the HttpUrl bug; regression tests now verify str type explicitly.

# 15. Current Project Status

7 completed modules with 50+ API endpoints, 300+ tests, 14 migrations.

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

# 16. Remaining Modules

Billing & Invoicing, Treatment Plans, Dental Chart, Inventory, Laboratory Management, Payments, Reports, Notifications, Dashboard, Medical History, Insurance Management.

# 17. Development Roadmap

Priority 1: Treatment Plans, Dental Chart (clinical)
Priority 2: Billing, Payments (financial)
Priority 3: Notifications, Inventory (operational)
Priority 4: Reports, Dashboard (analytics)

# 18. Statistics

| Category | Count |
|----------|-------|
| Python source files | 100+ |
| Lines of code | 15,000+ |
| Completed Modules | 7 |
| API Endpoints | 50+ |
| Database Tables | 15 |
| Services/Repositories | 10+ each |
| Custom Exceptions | 45+ |
| Business Rules | 50+ |
| Tests (Doctor module) | 227+ |
| DB Migrations | 14 |

# 19. Architecture Evaluation

Strengths: Clean separation of concerns, testability, maintainability, scalability, security, auditability.

Future improvements: Request ID tracking, API versioning, rate limiting, Redis caching, Docker-based integration tests, full-text search, event-driven notifications.

# 20. Executive Summary

The DensCare Dental Clinic Management System is a production-ready, enterprise-grade backend API with seven completed modules providing secure authentication, RBAC, patient/appointment/doctor management, and clinical records. The project demonstrates Clean Architecture, comprehensive testing (227+ tests), and production-hardened code (including PostgreSQL compatibility fixes). It is suitable for production deployment with the addition of a frontend interface.
