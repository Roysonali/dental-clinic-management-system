# DensCare — Solution Architecture Diagram


## Overview

DensCare follows a **layered architecture** pattern. This means the system is organized into distinct layers, each with a specific responsibility. Data flows downward from the user interface through business logic to the database, and responses flow back up.

This approach is used by enterprise systems in banking, healthcare, and government because it is:
- **Easy to maintain** — changes in one layer do not break others
- **Easy to test** — each layer can be tested independently
- **Easy to understand** — new developers can quickly learn how the system works

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                         CLINIC STAFF                                    │
│                                                                         │
│    Administrator · Chief Doctor · General Doctor · Specialist Doctor    │
│    Consulting Doctor · Receptionist · Dental Assistant                  │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                HTTPS (encrypted)
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                      FRONTEND (React SPA)                               │
│                                                                         │
│    ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────────┐   │
│    │   Routing    │ │   Forms      │ │   State Management          │   │
│    │   (React     │ │   (React     │ │   (React Query + Zustand)   │   │
│    │    Router)   │ │   Hook Form) │ │                             │   │
│    └─────────────┘ └──────────────┘ └─────────────────────────────┘   │
│    ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────────┐   │
│    │   UI        │ │   API        │ │   Authentication            │   │
│    │   Components│ │   Services   │ │   (JWT token management)    │   │
│    │   (50+)     │ │   (Axios)    │ │                             │   │
│    └─────────────┘ └──────────────┘ └─────────────────────────────┘   │
│                                                                         │
│    Tailwind CSS 4 · TypeScript 6 · Vite 8 · Lucide Icons              │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                              HTTP/JSON (Axios)
                              Authorization: Bearer <JWT>
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        BACKEND (FastAPI)                                 │
│                                                                         │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                    MIDDLEWARE LAYER                           │    │
│    │                                                              │    │
│    │   CORS Configuration · Request Logging · Error Handling      │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│                                     ▼                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                  ROUTER LAYER (API Endpoints)                │    │
│    │                                                              │    │
│    │   /auth/*        Authentication & User Approval              │    │
│    │   /users/*       User Management                             │    │
│    │   /patients/*    Patient CRUD                                │    │
│    │   /doctors/*     Doctor Profiles & Schedules                 │    │
│    │   /specializations/*  Specialization Master Data             │    │
│    │   /appointments/*     Scheduling                              │    │
│    │   /patient-records/*  Clinical Records                       │    │
│    │   /procedures/*       Procedure Catalog                       │    │
│    │   /treatment-plans/*  Treatment Planning                      │    │
│    │   /billing/*          Invoices, Payments, Receipts, Refunds  │    │
│    │                                                              │    │
│    │   Total: 115+ endpoints with full OpenAPI documentation      │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │               AUTHENTICATION & AUTHORIZATION                 │    │
│    │                                                              │    │
│    │   JWT Token Verification · RBAC (7 Roles)                   │    │
│    │   require_admin() · require_roles() factory                  │    │
│    │                                                              │    │
│    │   Roles: Admin, Chief Doctor, General Doctor,               │    │
│    │          Specialist Doctor, Consulting Doctor,               │    │
│    │          Receptionist, Dental Assistant                       │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│                                     ▼                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                   SERVICE LAYER                              │    │
│    │                                                              │    │
│    │   Business Logic · Transaction Management (commit/rollback)  │    │
│    │   Cross-Repository Coordination · Audit Logging              │    │
│    │                                                              │    │
│    │   PatientService · DoctorService · AppointmentService        │    │
│    │   PatientRecordService · TreatmentPlanService                │    │
│    │   InvoiceService · PaymentService · ReceiptService           │    │
│    │   RefundService · CreditNoteService                          │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│                                     ▼                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                  VALIDATOR LAYER                             │    │
│    │                                                              │    │
│    │   Pure business rules (no database access, no side effects)  │    │
│    │   State machines for status transitions                      │    │
│    │   Domain exception raising on rule violations                 │    │
│    │                                                              │    │
│    │   PatientValidator · DoctorValidator · AppointmentValidator  │    │
│    │   TreatmentPlanValidator · InvoiceValidator · PaymentValidator│   │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│                                     ▼                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                 REPOSITORY LAYER                             │    │
│    │                                                              │    │
│    │   SQLAlchemy queries · flush() / refresh() only              │    │
│    │   No commits (transactions owned by Service layer)           │    │
│    │   Returns ORM entities to the Service layer                  │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                     │                                   │
│                                     ▼                                   │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                   MAPPER LAYER                               │    │
│    │                                                              │    │
│    │   ORM Entity → Pydantic Response DTO transformation          │    │
│    │   Computed fields (full_name, age, totals)                   │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                              SQLAlchemy ORM
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     PostgreSQL DATABASE                                 │
│                                                                         │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                                                              │    │
│    │   30 Tables · UUID Primary Keys · CHECK Constraints         │    │
│    │   Foreign Keys · Indexes · JSONB Columns                     │    │
│    │   Audit Columns (created_by, updated_by, timestamps)         │    │
│    │   Optimistic Locking (treatment_plans)                       │    │
│    │                                                              │    │
│    │   Migrations: 20 Alembic files (version-controlled)         │    │
│    │                                                              │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


EXTERNAL SERVICES (Configured / Planned):
├── Razorpay — Online Payment Processing
│       └── India-focused gateway, 2% per transaction
│
├──  SMTP Email — Password Reset & Notifications
│       └── Configured via environment variables (SMTP_HOST, etc.)
│
└── File Storage — Patient Record Attachments
        └── Currently: local filesystem (uploads/ directory)
        └── Future: AWS S3 or similar object storage
```

---

## Detailed Module Map

The following diagram shows how the nine modules connect to each other through database relationships:

```
                        ┌──────────┐
                        │  USERS   │
                        │ (7 roles)│
                        └────┬─────┘
                             │
              ┌──────────────┼──────────────────┐
              │              │                  │
              ▼              ▼                  ▼
        ┌──────────┐  ┌──────────┐      ┌────────────┐
        │ PATIENTS │  │ DOCTORS  │      │    AUTH     │
        │          │  │ (1:1 with│      │ (JWT, Login │
        │ UUID PK  │  │  Users)  │      │  Password)  │
        └────┬─────┘  └────┬─────┘      └────────────┘
             │              │
             │              ├── Specializations (M:N)
             │              └── Schedules (1:N)
             │
    ┌────────┼────────────────┐
    │        │                │
    ▼        ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────────────┐
│APPOINT-  │ │PATIENT   │ │  TREATMENT       │
│MENTS     │ │ RECORDS  │ │  PLANS           │
│          │ │          │ │                  │
│ UUID PK  │ │ UUID PK  │ │  UUID PK         │
│ links to │ │ 1 per    │ │  links to        │
│ Patient  │ │ Appt.    │ │  Patient +       │
│ + Doctor │ │          │ │  Doctor          │
└──────────┘ └────┬─────┘ └────────┬─────────┘
                  │                 │
     ┌────────────┼──────┐         │
     │            │      │         │
     ▼            ▼      ▼         ▼
┌─────────┐ ┌────────┐ ┌──────┐ ┌────────────────┐
│Diagnoses│ │Prescrip│ │Attach│ │Treatment Plan  │
│         │ │-tions  │ │ments │ │Items           │
│ Type:   │ │   │    │ │      │ │ (links back    │
│ Prov/   │ │   ▼    │ │Types:│ │  to Diagnosis) │
│ Confirmed│ │Items  │ │Image │ └────────────────┘
└─────────┘ │(meds)  │ │PDF   │
            └────────┘ │Report│
                       │Scan  │
                       │Doc   │
                       └──────┘

                  ┌──────────────────┐
                  │     BILLING      │
                  │                  │
                  │  Invoices ◄──────┤── Treatment Plans
                  │  Invoice Items   │── Patients
                  │  Payments        │── Appointments
                  │  Payment Alloc.  │── Doctors
                  │  Receipts        │
                  │  Refunds         │
                  │  Credit Notes    │
                  │  Patient Credits │
                  │  Doc Sequences   │
                  │  Audit Logs      │
                  └──────────────────┘
```

---

## Key Data Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Users → Roles | Many-to-One | Each user has one role (Admin, Doctor, Receptionist, etc.) |
| Users → Doctors | One-to-One | A doctor profile extends a user account |
| Doctors → Specializations | Many-to-Many | Via `doctor_specializations` join table with `is_primary` flag |
| Doctors → Schedules | One-to-Each | Weekly availability templates per doctor |
| Patients → Appointments | One-to-Many | A patient can have many appointments |
| Doctors → Appointments | One-to-Many | A doctor can have many appointments |
| Appointments → Patient Records | One-to-One | Each appointment has at most one clinical record |
| Patient Records → Diagnoses | One-to-Many | A record can have multiple diagnoses |
| Patient Records → Prescriptions | One-to-Many | A record can have multiple prescriptions |
| Prescriptions → Prescription Items | One-to-Many | A prescription contains multiple medicines |
| Patient Records → Attachments | One-to-Many | X-rays, PDFs, reports |
| Patient Records → Follow-ups | One-to-Many | Scheduled follow-up visits |
| Treatment Plans → Items | One-to-Many | Procedure line items within a plan |
| Treatment Plans → Versions | One-to-Many | Immutable version snapshots (JSONB) |
| Treatment Plans → Approvals | One-to-One | Doctor approval and patient acknowledgment |
| Treatment Plan Items → Diagnoses | Many-to-One (optional) | Links back to a specific diagnosis |
| Treatment Plan Items → Appointments | Many-to-One (optional) | Links to a specific appointment |
| Invoices → Invoice Items | One-to-Many | Line items on the invoice |
| Invoices → Status History | One-to-Many | Append-only audit trail |
| Payments → Payment Allocations | One-to-Many | Distribute payment across invoices |
| Payments → Receipts | One-to-One | One receipt per payment |
| Invoices → Credit Notes | One-to-Many | Credit notes correcting an invoice |

---

## Request Lifecycle — Complete Trace

Here is the complete journey of a request through every layer, using "Create Patient Record" as an example:

```
USER ACTION: Doctor clicks "Create Record" and fills in the form
    │
    ▼
FRONTEND:
    1. React Hook Form validates the input using Zod schema
    2. If valid, patientRecordService.createRecord() is called
    3. Axios sends: POST /patient-records with JWT token in header
    │
    ▼
BACKEND - ROUTER LAYER:
    4. FastAPI matches the request to the /patient-records POST endpoint
    5. Pydantic validates the request body (PatientRecordCreate schema)
    6. Dependency: get_db() creates a database session
    7. Dependency: get_current_user() decodes JWT, loads User from DB
    8. Dependency: require_patient_record_write() checks user has write role
    9. Dependency: get_patient_record_service() creates PatientRecordService
   10. Router calls service.create_patient_record(payload, actor_id)
    │
    ▼
BACKEND - SERVICE LAYER:
   11. Service validates patient exists (via PatientRepository)
   12. Service validates appointment exists (via AppointmentRepository)
   13. Service checks appointment does not already have a record
   14. Service creates PatientRecord ORM entity in DRAFT status
   15. Service writes audit log entry
   16. Service calls db.flush() (writes to DB but does not commit)
   17. Service calls db.commit() (finalizes the transaction)
    │
    ▼
BACKEND - MAPPER LAYER:
   18. PatientRecordMapper.to_response() converts ORM entity to Pydantic DTO
   19. Response sent back as JSON with HTTP 201 status
    │
    ▼
FRONTEND:
   20. React Query cache is invalidated (patient records list refreshes)
   21. UI updates to show the new record in the list
   22. Success notification displayed to the doctor
```

---

## Security Flow — Authentication and Authorization

```
USER: Enters email and password, clicks "Login"
    │
    ▼
FRONTEND:
    1. authService.login(email, password) called
    2. Axios sends: POST /auth/login (OAuth2 form data)
    │
    ▼
BACKEND:
    3. FastAPI extracts form data (OAuth2PasswordRequestForm)
    4. authenticate_user() looks up user by email (case-insensitive)
    5. verify_password() checks bcrypt hash
    6. If valid: create_access_token() generates JWT with:
       ├── sub: user email
       ├── exp: current time + 30 minutes
       ├── iat: current time
       ├── jti: unique identifier
       └── token_type: "access"
    7. Returns: {"access_token": "...", "token_type": "bearer"}
    │
    ▼
FRONTEND:
    8. Token stored in localStorage (if "Remember Me") or sessionStorage
    9. authService.getMe() called to load user profile
   10. AuthProvider updates React context with user data
   11. Route guard (ProtectedRoute) allows access to authenticated screens
    │
    ▼
SUBSEQUENT REQUESTS:
   12. Axios interceptor attaches: Authorization: Bearer <token>
   13. Backend verifies JWT signature, expiration, and token_type
   14. Backend loads user and checks role for the requested endpoint
   15. If role matches → request proceeds
   16. If role does not match → 403 Forbidden
   17. If token expired → 401 Unauthorized → frontend clears session
```

---

## State Machines — Record Lifecycle

DensCare uses formal state machines to control the lifecycle of key entities. This prevents invalid transitions and ensures data integrity.

### Patient Record Status

```
    DRAFT
      │
      │ Doctor/Receptionist starts work
      ▼
  IN_PROGRESS ◄─────── UNDER_REVISION
      │                       │
      │ Doctor submits        │ Admin requests revision
      │ for review            │
      ▼                       │
  UNDER_REVIEW ───────────────┘
      │
      │ Admin approves review
      ▼
   COMPLETED ◄──────── Admin reopens
      │
      │ Admin finalizes (with confirmation)
      ▼
  FINALIZED (terminal — immutable)
```

### Invoice Status

```
    DRAFT
      │
      │ Admin/Receptionist issues invoice
      ▼
   ISSUED
      │
      ├── Partial payment ──► PARTIALLY_PAID ──► Fully paid ──► PAID
      │
      ├── Admin cancels ──► CANCELLED (terminal)
      │
      └── Admin voids ──► VOID (terminal)
```

### Payment Status

```
   PENDING
      │
      ├── Payment completed ──► COMPLETED
      │                              │
      │                              ├── Refunded ──► REFUNDED
      │                              └── Reversed ──► REVERSED
      │
      ├── Payment failed ──► FAILED (terminal)
      │
      └── Payment voided ──► VOID (terminal)
```

### Treatment Plan Status

```
    DRAFT
      │
      │ Submit for review
      ▼
  UNDER_REVIEW
      │
      ├── Approved ──► PROPOSED
      │                    │
      │                    ├── Patient accepts ──► ACCEPTED
      │                    │                            │
      │                    │                            ├── Start treatment ──► IN_PROGRESS
      │                    │                            │                           │
      │                    │                            │                           ├── On hold ──► ON_HOLD
      │                    │                            │                           │                  │
      │                    │                            │                           │                  └── Resume ──► IN_PROGRESS
      │                    │                            │                           │
      │                    │                            │                           └── Complete ──► COMPLETED (terminal)
      │                    │
      │                    └── Patient declines ──► DECLINED (terminal)
      │
      └── Rejected ──► DRAFT (returns for revision)

  Any non-terminal state ──► CANCELLED (terminal)
```

---

## Summary

DensCare is built on a proven, enterprise-grade architecture that is:

- **Modular** — 9 independent modules with clear boundaries
- **Layered** — Router → Service → Validator → Repository → Database
- **Secure** — JWT authentication, 7-role RBAC, audit logging
- **Reliable** — PostgreSQL with constraints, state machines, optimistic locking
- **Maintainable** — Clean code, 350+ tests, comprehensive documentation
- **Scalable** — Designed for growth from a single clinic to multiple locations
