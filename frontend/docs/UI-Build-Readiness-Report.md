# DensCare — UI Build Readiness Report

**Version:** 1.0.0  
**Date:** July 28, 2026  
**Status:** ⚠️ Approved with Required Corrections  
**Purpose:** Single authoritative specification for Lovable.dev frontend generation  
**Authority:** Backend implementation is the source of truth

---

### 1.0 Backend Contract Metadata

| Attribute | Value |
|-----------|-------|
| **Backend Framework** | FastAPI (Python 3.12+) |
| **ORM** | SQLAlchemy 2.x (declarative mapping) |
| **API Style** | RESTful (REST, not GraphQL) |
| **Auth Method** | JWT Bearer tokens (HS256) |
| **Password Hashing** | bcrypt (10+ rounds, via passlib) |
| **Validation** | Pydantic v2 (field validators + model validators) |
| **Database** | PostgreSQL (UUID primary keys, Numeric for money) |
| **Migration Tool** | Alembic |
| **API Prefix** | No global prefix (each module defines its own, e.g. `/auth`, `/patients`, `/billing`) |
| **Auth Prefix** | `/auth` |
| **Billing Prefix** | `/billing` |
| **ID Strategy** | User=INTEGER, most entities=UUID v4 |
| **Document Numbering** | ADR-003 sequential gap-tracked numbering (`INV-00001`, `RCT-00001`) |
| **Pagination** | Page-based (`?page=&page_size=`), max 100 per page |
| **Error Format** | `{ "detail": { "error": { "code", "message", "details" } } }` |
| **Validation Errors** | Standard Pydantic `{ "detail": [{ "loc": [], "msg": "", "type": "" }] }` |
| **RBAC** | Role-based via `require_roles()` / `require_admin()` decorators |
| **Audit** | `created_by`, `updated_by`, `created_at`, `updated_at` on all entities |
| **Optimistic Locking** | Treatment plans use `lock_version` (SQLAlchemy `version_id_col`) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
1. [Executive Summary](#1-executive-summary)
    [Backend Contract Metadata](#10-backend-contract-metadata)
2. [Backend Capability Matrix](#15-backend-capability-matrix)
3. [Cross-Document Consistency Resolution](#2-cross-document-consistency-resolution)
4. [Frontend Scope Freeze](#3-frontend-scope-freeze)
5. [Authentication Contract](#4-authentication-contract)
6. [Route Contract](#5-route-contract)
7. [Billing Workflow Diagram](#6-billing-workflow-diagram)
8. [API Contract](#7-api-contract)
9. [State Management Contract](#8-state-management-contract)
10. [ID Type Contract](#9-id-type-contract)
11. [RBAC Contract](#10-rbac-contract)
12. [Validation Contract](#11-validation-contract)
13. [Error Handling Contract](#12-error-handling-contract)
14. [Loading & Empty States](#13-loading--empty-states)
15. [Enum Contract](#14-enum-contract)
16. [Pagination & Filtering Contract](#15-pagination--filtering-contract)
17. [Do Not Invent APIs/DTOs](#16-do-not-invent-apis-dtos)
18. [Production Readiness Checklist](#17-production-readiness-checklist)
19. [AI Execution Guide](#18-ai-execution-guide)
20. [Mandatory Rules for Lovable.dev](#19-mandatory-rules-for-lovabledev)

---

## 1. Executive Summary

### 1.1 Current Backend Implementation Status

| Module | Status | Endpoints | Notes |
|--------|--------|-----------|-------|
| Authentication | ✅ Production Ready | 6 | Login, Register, Me, Pending Users, Approve, Deactivate |
| RBAC | ✅ Production Ready | — | Role-based access via `require_roles()` and `require_admin()` |
| User Management | ✅ Production Ready | 5 | List, Detail, Change Role, Activate, Deactivate |
| Patient Management | ✅ Production Ready | 6 | Create, List, Get, Update, Activate, Deactivate, Profile |
| Appointment Management | ✅ Production Ready | 6 | Create, List, Today's, Get, Update, Cancel |
| Doctor Management | ✅ Production Ready | 25 | Full CRUD, Schedules, Specializations |
| Patient Records | ✅ Production Ready | 21 | Full CRUD with diagnoses, attachments, audit |
| Treatment Plans | ✅ Production Ready | 45 | Full lifecycle, versioning, approvals |
| Procedures Catalog | ✅ Production Ready | 3 | Create, List, Get |
| Prescription Management | ✅ Production Ready | 6 | Within Records module |
| Billing (Invoice, Payment, Receipt) | ✅ Production Ready | 30+ | Full lifecycle, credit notes, refunds, sequences |
| **Total** | **10 of 14 modules complete** | **145+** | |

### 1.2 Not Implemented in Backend (Do NOT Build UI)

| Feature | Reason |
|---------|--------|
| Token Refresh (`POST /auth/refresh`) | No backend endpoint exists |
| Forgot Password (backend) | No backend endpoint; notification module not implemented |
| Reset Password (backend) | No backend endpoint |
| Force Password Change | No backend endpoint or field support |
| Email Notifications | No notification module exists |
| Inventory Module | Not built |
| Laboratory Module | Not built |
| Patient Portal | Not built |
| ACCOUNTANT role | Not defined in `constants.py` |

### 1.3 Frontend Readiness Status

| Category | Status |
|----------|--------|
| UX Spec (Part 2.2) | ✅ Comprehensive — 27 sections |
| Engineering Blueprint (Part 2.6) | ⚠️ Section references wrong; missing Register page; login flow incorrect |
| Cross-Document Dependency Map | ⚠️ Route paths don't match Part 2.6 |
| Backend Alignment | ⚠️ Several documented features don't exist in backend |

### 1.4 Production Recommendation

**⚠️ Approved with Required Corrections**

Lovable.dev can begin building AFTER the corrections in this document are applied. The following MUST be fixed before proceeding:

1. **Part 2.6 section references** — Auth is Part 2.2 §6, not §10
2. **Login flow** — `POST /auth/login` returns only `{ access_token, token_type }` — no `user` object
3. **Register page** — Must be added to Part 2.6 route tree, folder structure, and API hooks
4. **Forgot/Reset Password** — Must be marked as FUTURE in Part 2.6
5. **Token refresh** — Must be removed from Part 2.6 until backend implements it
6. **Cross-Document Dependency Map** — Routes must use `/auth/*` prefix

---

## 1.5 Backend Capability Matrix

### 1.5.1 Complete Module Inventory

| Module | Implemented Endpoints | Frontend Pages | Backend Status | Lovable Priority |
|--------|----------------------|----------------|----------------|------------------|
| **Auth** | 6 | 5 | ✅ Production Ready | P0 — Phase 1 |
| **User Management** | 5 | 5 | ✅ Production Ready | P0 — Phase 1 |
| **Patient Management** | 7 | 4 | ✅ Production Ready | P0 — Phase 2 |
| **Appointment Management** | 6 | 5 | ✅ Production Ready | P0 — Phase 3 |
| **Doctor Management** | 25 | 4 | ✅ Production Ready | P0 — Phase 3 |
| **Patient Records** | 21 | 6 | ✅ Production Ready | P1 — Phase 5 |
| **Treatment Plans** | 45 | 6 | ✅ Production Ready | P0 — Phase 4 |
| **Procedure Catalog** | 3 | 2 | ✅ Production Ready | P1 — Phase 4 |
| **Prescription Management** | 6 | 1 | ✅ Production Ready | P1 — Phase 5 |
| **Billing — Invoices** | 7 | 3 | ✅ Production Ready | P1 — Phase 6 |
| **Billing — Payments** | 11 | 3 | ✅ Production Ready | P1 — Phase 6 |
| **Billing — Receipts** | 3 | 1 | ✅ Production Ready | P1 — Phase 6 |
| **Billing — Credit Notes** | 4 | 2 | ✅ Production Ready | P0 — Phase 4 |
| **Billing — Refunds** | 4 | 2 | ✅ Production Ready | P0 — Phase 4 |
| **Billing — Dashboard** | 2 | 1 | ✅ Production Ready | P0 — Phase 4 |
| **RBAC** | Embedded | 2 | ✅ Production Ready | P0 — Phase 1 |

### 1.5.2 Auth Module — Detailed Endpoint Matrix

| Endpoint | Method | Auth Required | Roles | Status |
|----------|--------|--------------|-------|--------|
| `/auth/register` | POST | ❌ Public | — | ✅ |
| `/auth/login` | POST | ❌ Public | — | ✅ |
| `/auth/me` | GET | ✅ Bearer | All authenticated | ✅ |
| `/auth/users/pending` | GET | ✅ Bearer | ADMIN only | ✅ |
| `/auth/users/{id}/approve` | PATCH | ✅ Bearer | ADMIN only | ✅ |
| `/auth/users/{id}/deactivate` | PATCH | ✅ Bearer | ADMIN only | ✅ |
| `/auth/refresh` | POST | ❌ | — | ❌ Not implemented |
| `/auth/forgot-password` | POST | ❌ | — | ❌ Not implemented |
| `/auth/reset-password` | POST | ❌ | — | ❌ Not implemented |

### 1.5.3 Billing Module — Detailed Endpoint Matrix

| Endpoint | Method | Roles | Status |
|----------|--------|-------|--------|
| `GET /billing/invoices` | GET | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | ✅ |
| `GET /billing/invoices/{id}` | GET | Same as above | ✅ |
| `POST /billing/invoices` | POST | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | ✅ |
| `PATCH /billing/invoices/{id}` | PATCH | Same as create | ✅ |
| `POST /billing/invoices/{id}/issue` | POST | ADMIN, RECEPTIONIST, DOCTOR_ROLES | ✅ |
| `POST /billing/invoices/{id}/cancel` | POST | ADMIN, RECEPTIONIST, DOCTOR_ROLES | ✅ |
| `DELETE /billing/invoices/{id}` | DELETE | ADMIN only | ✅ |
| `GET /billing/payments` | GET | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | ✅ |
| `GET /billing/payments/{id}` | GET | Same as above | ✅ |
| `POST /billing/payments` | POST | Same as above | ✅ |
| `PATCH /billing/payments/{id}` | PATCH | Same as above | ✅ |
| `DELETE /billing/payments/{id}` | DELETE | ADMIN only | ✅ |
| `POST /billing/payments/{id}/complete` | POST | ADMIN, RECEPTIONIST, DOCTOR_ROLES | ✅ |
| `POST /billing/payments/{id}/fail` | POST | Same as above | ✅ |
| `POST /billing/payments/{id}/void` | POST | Same as above | ✅ |
| `POST /billing/payments/{id}/allocate` | POST | Same as above | ✅ |
| `POST /billing/payments/{id}/deallocate` | POST | Same as above | ✅ |
| `GET /billing/payments/{id}/allocations` | GET | Same as invoice read roles | ✅ |
| `GET /billing/receipts/{id}` | GET | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | ✅ |
| `POST /billing/receipts` | POST | Same as invoice write roles | ✅ |
| `POST /billing/receipts/{id}/regenerate` | POST | ADMIN, RECEPTIONIST, DOCTOR_ROLES | ✅ |

---

## 2. Cross-Document Consistency Resolution

### 2.1 Resolved Inconsistencies

| ID | Issue | Documents Involved | Backend Reality | Decision | Lovable Action |
|----|-------|-------------------|-----------------|----------|----------------|
| **I-01** | Wrong section references for Auth | Part 2.6 §2.3, §28 route table | Auth is Part 2.2 §6 (Authentication Experience) | Part 2.6 references to `§10` must be changed to `§6.x` | Use corrected references: Login = §6.4, Register = §6.10, Forgot = §6.5, Reset = §6.6 |
| **I-02** | Register page missing from Engineering Blueprint | Part 2.2 §6.10, Part 2.6 route tree, folder structure | `POST /auth/register` exists and works | **Add Register page** to Part 2.6 | Build `RegisterPage.tsx`, `RegisterForm.tsx`, `useRegister.ts`, add `/auth/register` route |
| **I-03** | Login response includes `user` object in doc but not in backend | Part 2.6 §9.1, Backend `LoginResponse` | Backend returns `{ access_token, token_type }` only | **Fix login flow** — no `user` in login response | Call `GET /auth/me` separately after login to get user profile |
| **I-04** | Token refresh endpoint doesn't exist | Part 2.2 §23.3, Part 2.6 §9.4 | No `POST /auth/refresh` endpoint exists | **Mark as future** — remove refresh logic from MVP | Do NOT build token refresh. Handle 401 by redirecting to login |
| **I-05** | Forgot password listed as active feature in Part 2.6 | Part 2.2 §6.5, Part 2.6 §6 route tree | No backend forgot/reset endpoints | **Mark as future** — Part 2.2 §6.5 states "future" | Build placeholder UI only (form shown, always shows "check email" message) |
| **I-06** | Reset password listed as active feature in Part 2.6 | Part 2.2 §6.6, Part 2.6 §6 route tree | No backend reset endpoint | **Mark as future** | Build placeholder UI only |
| **I-07** | Force password change missing from implementation | Part 2.2 §6.7, Part 2.6 route tree | No backend support for force change | **Mark as future** | Do NOT build; remove from Part 2.6 until backend supports it |
| **I-08** | Route paths inconsistent | Cross-Document Dependency Map (`/login`) vs Part 2.6 (`/auth/login`) | — | **Standardize on `/auth/*`** prefix as defined in Part 2.6 | All auth routes under `/auth/`: login, register, forgot-password, reset-password |
| **I-09** | Token storage contradiction | Part 2.2 §23.2 (memory only) vs Part 2.6 §7.4 (Zustand persist) | No refresh tokens exist | **Zustand persist is acceptable** for MVP since no refresh tokens exist | Store `access_token` in Zustand with `persist` middleware (localStorage). Future: migrate to httpOnly cookie |
| **I-10** | Auth pages count mismatch | Part 2.6 §1.4 claims 5 pages | Only 4 pages defined + Register missing | **Correct to 5 pages**: Login, Register, Forgot Password (placeholder), Reset Password (placeholder), Change Password | Build pages as listed in Section 5 of this report |

---

## 3. Frontend Scope Freeze

### 3.1 Implement Now (Build These)

| Module | Pages | Priority | Backend Ready? |
|--------|-------|----------|----------------|
| **Auth — Login** | Login page, Forgot password (placeholder), Reset password (placeholder) | P0 | ✅ (forgot/reset are placeholder only) |
| **Auth — Register** | Self-registration page | P0 | ✅ |
| **Auth — Profile** | Change password, My profile | P1 | ✅ (change password via user update) |
| **Dashboard** | Admin, Reception, Doctor, Assistant, Chief Doctor, Specialist, Consultant | P0 | ✅ |
| **Sidebar** | Role-filtered navigation, collapsed/expanded states | P0 | ✅ |
| **RBAC** | Route guards, component visibility, navigation filtering | P0 | ✅ |
| **Patients** | List, Register, Profile, Edit, Activate/Deactivate | P0 | ✅ |
| **Doctors** | List, Create, Detail, Edit, Schedules, Specializations | P0 | ✅ |
| **Appointments** | Calendar, Book, Today's Queue, Detail, Cancel | P0 | ✅ |
| **Treatment Plans** | List, Create, Detail, Version History, Approval Workflow | P0 | ✅ |
| **Procedures Catalog** | List, Create, Edit | P1 | ✅ |
| **Patient Records** | List, Create, View, Edit, Diagnoses, Attachments, Timeline | P1 | ✅ |
| **Billing** | Invoice List/Create/Detail, Payment, Receipt, Credit Notes, Refunds | P1 | ✅ |

### 3.2 Consolidated Future Features (Do NOT Build)

#### 3.2.1 Future Features Matrix

| Feature | Status | Why Excluded | Backend Dependency | Lovable Action |
|---------|--------|-------------|-------------------|----------------|
| **Token Refresh** | 🚫 Deferred | `POST /auth/refresh` does not exist in backend | New backend endpoint + refresh token generation | Do NOT build any refresh logic; on 401 redirect to login |
| **Forgot Password (backend)** | 🚫 Deferred | No notification module; no email infrastructure | Notification module + email templates + reset token system | Build placeholder UI only (see below) |
| **Reset Password (backend)** | 🚫 Deferred | No reset token endpoint | Backend must implement token validation + password update | Build placeholder UI only (see below) |
| **Force Password Change** | 🚫 Deferred | No `force_password_change` field on User model | Backend must add field + route protection logic | Do NOT build |
| **Email Notifications** | 🚫 Deferred | No notification module at all | New backend module | Do NOT build |
| **Remember Me** | 🚫 Deferred | No refresh tokens to persist | Requires refresh token system first | All users re-login after token expiry (30 min default) |
| **Sidebar: Reports** | 🔒 Locked | Phase 2+ feature | Nothing yet | Show as locked/"Coming Soon" |
| **Sidebar: Settings** | 🔒 Locked | Phase 2+ feature | Nothing yet | Show as locked/"Coming Soon" |
| **Sidebar: Patient Portal** | 🔒 Locked | Phase 2+ feature | Nothing yet | Show as locked/"Coming Soon" |
| **ACCOUNTANT Role** | 🚫 Deferred | Role not defined in `app/core/constants.py` | Backend must add role + permissions | Do NOT build — billing falls to ADMIN for now |
| **Inventory Module** | 🚫 Deferred | Not in any sprint plan | Full new module | Do NOT build |
| **Laboratory Module** | 🚫 Deferred | Not in any sprint plan | Full new module | Do NOT build |
| **Patient Portal** | 🚫 Deferred | Not in any sprint plan | Full new module + auth | Do NOT build |
| **Multi-Clinic Switching** | 🚫 Deferred | Phase 4 | Infrastructure | Do NOT build |
| **Theme Switcher (Dark/Light)** | 🚫 Deferred | Phase 3 | Non-critical UX | Do NOT build |
| **Collapsible Sidebar Sections** | 🚫 Deferred | Phase 3 | Non-critical UX | Do NOT build |
| **Blood Group Field** | 🚫 Deferred | Does not exist on any backend model | Backend model change | Do NOT build |

#### 3.2.2 Forgot Password — Exact Placeholder Specification

Build a UI-only form. No API call. Exact behavior:

Build a UI-only form. No API call. Exact behavior:

```
┌────────────────────────────────────┐
│  Forgot Password                   │
│                                    │
│  Email                             │
│  ┌──────────────────────────┐      │
│  │                          │      │
│  └──────────────────────────┘      │
│                                    │
│  [Send Reset Link]                 │
│                                    │
│  ← Back to Sign In                 │
└────────────────────────────────────┘

ON SUBMIT:
- Do NOT call any API endpoint
- Show message (same regardless of email existence):
  "If an account exists with this email, you will receive a password reset link."
- Link back to login page
```

#### Reset Password — Exact Placeholder Specification

```
┌────────────────────────────────────┐
│  Reset Password                    │
│                                    │
│  ⚠️ This feature is not yet       │
│  available. Please contact your   │
│  administrator.                   │
│                                    │
│  [← Back to Sign In]              │
└────────────────────────────────────┘

No form, no API call. Simple informational card with back link.
```
| Force Password Change | 🚫 Deferred | No backend support | Backend must add `force_password_change` field |
| Email Notifications | 🚫 Deferred | No notification module | New backend module |
| Inventory Module | 🚫 Deferred | Not in scope | Phase 2 |
| Laboratory Module | 🚫 Deferred | Not in scope | Phase 2 |
| Patient Portal | 🚫 Deferred | Not in scope | Phase 2+ |
| Reports (sidebar) | 🔒 Locked | Future feature | Phase 2+ |
| Settings (sidebar) | 🔒 Locked | Future feature | Phase 2+ |
| ACCOUNTANT role | 🚫 Deferred | Not in backend constants | Backend must add role |
| Multi-clinic switching | 🚫 Deferred | Phase 4 | Infrastructure |
| Theme switcher | 🚫 Deferred | Phase 3 | Non-critical UX |
| Collapsible sidebar sections | 🚫 Deferred | Phase 3 | Non-critical UX |

---

## 4. Authentication Contract

### 4.1 Login Flow (EXACT — Do Not Invent)

**⚠️ CRITICAL: Login uses form-encoded body, NOT JSON.**

The backend uses FastAPI's `OAuth2PasswordRequestForm` which expects:
- `Content-Type: application/x-www-form-urlencoded`
- Fields: `username` (maps to email) and `password`

If you send `{ "email": "...", "password": "..." }` as JSON, the server will return **422 Validation Error**.

```
User enters email + password
        │
        ▼
POST /auth/login  (uses OAuth2PasswordRequestForm, sends `username` and `password`)
        │
        ▼
Receive: {
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
        │
        ▼
Store access_token in Zustand auth store (persisted to localStorage)
        │
        ▼
GET /auth/me  (with Authorization: Bearer <token>)
        │
        ▼
Receive: User object (id, full_name, email, status, role_id, role)
        │
        ▼
Store user in Zustand auth store
        │
        ▼
Navigate to role-specific dashboard
```

**Critical Rules:**
- ✅ Do: Send `username` field (maps to email) + `password` via form-encoded body
- ✅ Do: Call `GET /auth/me` AFTER login to populate user store
- ❌ Do NOT: Expect `user` in login response — backend does not return it
- ❌ Do NOT: Build token refresh logic — endpoint does not exist
- ✅ Do: On 401, clear store + redirect to `/auth/login`
- ✅ Do: Normalize email to lowercase before sending

### 4.2 Register Flow

```
User fills registration form (full_name, email, password)
        │
        ▼
Client-side validation (password: 8+ chars, upper+lower+digit+special)
        │
        ▼
POST /auth/register  with JSON { "full_name": "...", "email": "...", "password": "..." }
        │
        ▼
Receive: { "message": "Registration submitted. Waiting for admin approval." }
        │
        ▼
HTTP 201 Created  (if success)
        │
        ▼
Redirect to /auth/login with banner: "Account created! Pending admin approval."
```

**API Details:**
- `POST /auth/register` → `201 Created`
- Request: `{ "full_name": str, "email": str, "password": str }`
- Response: `{ "message": str }`
- Errors: 409 (email exists), 422 (validation — weak password, invalid email)

### 4.3 Logout

```
Clear Zustand auth store (user + tokens)
Clear TanStack Query cache
Navigate to /auth/login
```

**No `POST /auth/logout` endpoint exists** — logout is entirely client-side.

### 4.4 Session Check on App Mount

```
On app load:
  if access_token exists in store:
    GET /auth/me
      if success → hydrate Zustand with user data
      if 401 → clear store, redirect to login
  if no access_token:
    show login page
```

### 4.5 Session Expiry

- Access token TTL: configured via `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30 min)
- On 401 response from ANY API call → clear session → redirect to `/auth/login`
- **No refresh token exists** — expired session means full re-login
- **Remember Me** feature cannot be implemented until refresh tokens exist. For MVP, all users must re-login after token expiry.

### 4.6 Authentication Workflow Diagram (Complete Lifecycle)

```
                        ┌──────────────────────┐
                        │   User opens app      │
                        └──────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  Check localStorage for       │
                    │  existing access_token        │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌──────────────────┐   ┌──────────────────────┐
          │  Token found      │   │  No token             │
          └────────┬─────────┘   └──────────┬───────────┘
                   │                        │
                   ▼                        ▼
          ┌──────────────────┐   ┌──────────────────────┐
          │  GET /auth/me     │   │  Show Login Screen   │
          └────────┬─────────┘   └──────────┬───────────┘
                   │                        │
          ┌────────┴────────┐               │
          ▼                 ▼               │
   ┌──────────┐    ┌────────────────┐       │
   │ 200 OK   │    │ 401 (expired)  │       │
   └────┬─────┘    └───────┬────────┘       │
        │                  │                │
        ▼                  ▼                │
   ┌──────────┐    ┌──────────────┐         │
   │ Hydrate  │    │ Clear token  │         │
   │ Zustand  │    │ Show login   │         │
   │ with     │    │ screen       │         │
   │ user     │    └──────────────┘         │
   └────┬─────┘                             │
        │                                   │
        ▼                                   ▼
   ┌──────────────────────────────────────────────┐
   │          LOGIN SCREEN                         │
   │                                              │
   │  ┌────────────────────────────────────┐       │
   │  │  Email + Password (form-encoded!)   │       │
   │  │  POST /auth/login                   │       │
   │  │  ↓                                  │       │
   │  │  { access_token, token_type }        │       │
   │  │  ↓                                  │       │
   │  │  Store token in Zustand             │       │
   │  │  ↓                                  │       │
   │  │  GET /auth/me (with Bearer token)   │       │
   │  │  ↓                                  │       │
   │  │  { id, full_name, email, status,    │       │
   │  │    role_id, role }                   │       │
   │  │  ↓                                  │       │
   │  │  Store user in Zustand              │       │
   │  │  ↓                                  │       │
   │  │  Navigate to role dashboard          │       │
   │  └────────────────────────────────────┘       │
   │                                              │
   │  Alternative paths from login:                │
   │  ┌────────────────────────────────────┐       │
   │  │ 403 → Account pending/inactive     │       │
   │  │        → Show info banner          │       │
   │  ├────────────────────────────────────┤       │
   │  │ 401 → Invalid credentials          │       │
   │  │        → Inline error              │       │
   │  └────────────────────────────────────┘       │
   └──────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────┐
   │         AUTHENTICATED APPLICATION                  │
   │  ┌──────────────────────────────────────────┐     │
   │  │  Any API call triggers Axios interceptor:  │     │
   │  │  • 2xx → Normal response                   │     │
   │  │  • 401 → logout() + redirect /auth/login  │     │
   │  │  • 403 → Show 403 page or disable action  │     │
   │  └──────────────────────────────────────────┘     │
   │                                                  │
   │  Token expires → next 401 → redirect to login    │
   │  (No refresh token → full re-login required)     │
   └──────────────────────────────────────────────────┘

        REGISTRATION FLOW (separate path)
   ┌──────────────────────────────────────────────┐
   │  /auth/register                               │
   │  ┌──────────────────────────────────────┐     │
   │  │  Client-side validation:              │     │
   │  │  • full_name: 2-100 chars            │     │
   │  │  • email: valid format                │     │
   │  │  • password: 8+ chars, upper+lower+  │     │
   │  │    digit+special                      │     │
   │  │  • confirm password: must match       │     │
   │  │  • terms checkbox: must be checked    │     │
   │  ├──────────────────────────────────────┤     │
   │  │  POST /auth/register                  │     │
   │  │  JSON: { full_name, email, password }  │     │
   │  ├──────────────────────────────────────┤     │
   │  │  201 Created → { message }            │     │
   │  │  409 Conflict → Email already exists  │     │
   │  │  422 Validation → Field errors        │     │
   │  ├──────────────────────────────────────┤     │
   │  │  On success:                          │     │
   │  │  Redirect to /auth/login with banner:  │     │
   │  │  "Account created! Pending admin       │     │
   │  │   approval."                           │     │
   │  └──────────────────────────────────────┘     │
   └──────────────────────────────────────────────┘
```

---

## 5. Route Contract

### 5.1 Final Route Tree (Frozen)

```
/auth                              # AuthLayout (public)
  /auth/login                      # LoginPage
  /auth/register                   # RegisterPage
  /auth/forgot-password            # ForgotPasswordPage (placeholder UI only)
  /auth/reset-password             # ResetPasswordPage (placeholder UI only)

/                                  # DashboardLayout (protected)
  /                                # Dashboard — role-based redirect
  /patients                        # PatientListPage
  /patients/register               # PatientRegistrationPage
  /patients/:patientId             # PatientProfilePage
  /patients/:patientId/records/:recordId  # ClinicalRecordPage
  /patients/:patientId/treatment-plans/:planId  # TreatmentPlanDetailPage
  /appointments                    # AppointmentCalendarPage
  /appointments/:appointmentId     # AppointmentDetailPage
  /treatment-plans                 # TreatmentPlanListPage
  /treatment-plans/create          # CreateTreatmentPlanPage
  /treatment-plans/:planId         # TreatmentPlanDetailPage
  /procedures                      # ProcedureCatalogPage
  /admin/users                     # UserListPage (ADMIN only)
  /admin/users/:userId             # UserDetailPage (ADMIN only)
  /admin/roles                     # RoleManagementPage (ADMIN only)
  /admin/doctors                   # DoctorListPage (ADMIN only)
  /admin/doctors/:doctorId         # DoctorDetailPage (ADMIN only)
  /admin/doctors/schedule          # DoctorSchedulePage (ADMIN only)
  /admin/settings                  # SettingsPage (ADMIN only — empty/placeholder)
  /403                             # ForbiddenPage
  *                                # NotFoundPage
```

### 5.2 Route Rules

- All `/auth/*` routes are **public** — no authentication required
- All other routes are **protected** — redirect to `/auth/login` if unauthenticated
- Role-based routes use `<RoleRoute>` component — redirect to `/403` if insufficient role
- All routes use `React.lazy()` for code-splitting
- `*` wildcard shows a **NotFoundPage** (not a redirect)

---

## 6. Billing Workflow Diagram

### 6.1 Invoice Lifecycle

```
                         INVOICE LIFECYCLE

     ┌─────────────────────────────────────────────────────────────┐
     │                     DRAFT                                    │
     │  • Editable: notes, due_date, line items                    │
     │  • Temporary number (DRAFT-XXXXXXXX)                        │
     │  • Deleteable (ADMIN only)                                  │
     │  • Only editable status                                     │
     └─────────────────────────┬───────────────────────────────────┘
                               │
                    POST /billing/invoices/{id}/issue
                               │
                               ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                     ISSUED                                   │
     │  • IMMUTABLE — no further edits                             │
     │  • Permanent sequential number assigned (INV-00001)         │
     │  • Financial document — audit trail created                 │
     │  • Awaiting payment                                         │
     └────────────┬────────────┬──────────────┬────────────────────┘
                  │            │              │
          Payment │            │ Overdue      │ Cancellation
          arrives │            │ detected     │ requested
                  ▼            ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ PARTIALLY    │ │   OVERDUE    │ │  CANCELLED   │
     │ PAID         │ │              │ │  (terminal)  │
     │              │ │ • Past due   │ └──────────────┘
     │ • Remaining  │ │   date       │
     │   balance    │ │ • Can still  │        
     └──────┬───────┘ │   receive    │
            │         │   payment    │
     Full   │         └──────┬───────┘
     payment│                │ Payment
     received│               │ arrives
            ▼                ▼
     ┌────────────────────────────────────┐
     │               PAID                  │
     │  • Fully settled                    │
     │  • Only transition: VOID            │
     │  • Receipt can be generated         │
     └────────────────┬───────────────────┘
                      │
                      │ POST /billing/invoices/{id}/void
                      ▼
     ┌────────────────────────────────────┐
     │               VOID                  │
     │  • Terminal state                   │
     │  • Requires void_reason             │
     │  • Financial reversal recorded      │
     └────────────────────────────────────┘

     Roles for invoice operations:
     ┌─────────────┬──────────────────────────────────┐
     │ Operation   │ Allowed Roles                     │
     ├─────────────┼──────────────────────────────────┤
     │ Create      │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Read        │ ADMIN, RECEPTIONIST, DOCTORS,     │
     │             │ DENTAL_ASSISTANT                  │
     │ Issue       │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Cancel      │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Delete      │ ADMIN only                        │
     └─────────────┴──────────────────────────────────┘
```

### 6.2 Payment Lifecycle

```
                        PAYMENT LIFECYCLE

     ┌─────────────────────────────────────────────────────────────┐
     │                     PENDING                                  │
     │  • Editable: reference_number, notes                        │
     │  • Not yet allocated to any invoice                         │
     │  • Deleteable (ADMIN only)                                  │
     └────────────┬────────────────┬───────────────────────────────┘
                  │                │
          Complete│                │ Fail
                  ▼                ▼
     ┌──────────────────┐ ┌──────────────────┐
     │    COMPLETED      │ │     FAILED        │
     │                   │ │                   │
     │ • Ready for       │ │ • Can transition  │
     │   allocation      │ │   back to PENDING │
     │ • Can be allocated │ │   for retry      │
     │   to Issued/      │ └──────────────────┘
     │   Partially Paid/ │
     │   Overdue invoices│
     └────────┬─────────┘
              │
     Allocate │ POST /billing/payments/{id}/allocate
     payment  │ (allocates portion to specific invoice)
              ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  ALLOCATION RECORD                                          │
     │  • Links payment → invoice with amount                     │
     │  • Updates invoice status (ISSUED→PARTIALLY_PAID/PAID)     │
     │  • Deallocatable (reverses the allocation)                  │
     │  • Multiple allocations per payment allowed                │
     └─────────────────────────────────────────────────────────────┘

     From COMPLETED, a payment can also be:
     • VOIDED → terminal state (requires reason, ADMIN only)
     • REFUNDED → via separate Refund aggregate (future)

     Roles for payment operations:
     ┌─────────────┬──────────────────────────────────┐
     │ Operation   │ Allowed Roles                     │
     ├─────────────┼──────────────────────────────────┤
     │ Create      │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Read        │ ADMIN, RECEPTIONIST, DOCTORS,     │
     │             │ DENTAL_ASSISTANT                  │
     │ Complete    │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Fail/Void   │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Allocate    │ ADMIN, RECEPTIONIST, DOCTORS      │
     │ Delete      │ ADMIN only                        │
     └─────────────┴──────────────────────────────────┘

     **⚠️ Note:** Backend grants DENTAL_ASSISTANT read/create access to billing,
     but the UX spec (Part 2.2 §4.5 sidebar table) hides billing from assistants.
     This is a backend-vs-UX conflict. The backend is authoritative — if DENTAL_ASSISTANT
     can access billing, the frontend must respect that even if the sidebar hides the
     module. Consider whether to show or hide based on product decision.
```

### 6.3 Receipt Lifecycle

```
                        RECEIPT LIFECYCLE

     ┌─────────────────────────────────────────────────────────────┐
     │  GENERATED                                                  │
     │  • Created after payment is completed and allocated         │
     │  • POST /billing/receipts with payment_id                  │
     │  • Permanent sequential number (RCT-00001)                 │
     │  • IMMUTABLE — no edits allowed                            │
     │  • Can be regenerated (re-printed) via POST /regenerate    │
     └────────────────────┬────────────────────────────────────────┘
                          │
              POST /billing/receipts/{id}/regenerate
              (re-produces the document, no financial change)
                          │
                          ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  REGENERATED (same record, new audit entry)                 │
     │  • Document re-produced for patient                        │
     │  • Audit log records regeneration event                    │
     └─────────────────────────────────────────────────────────────┘
```

---

## 7. API Contract

### 6.1 Authentication Endpoints

| Endpoint | Backend Exists | Method | Request | Response | Lovable Build |
|----------|---------------|--------|---------|----------|---------------|
| `/auth/login` | ✅ | POST | `username` (email), `password` (form-encoded) | `{ access_token, token_type }` | ✅ Build — see login flow in §4 |
| `/auth/register` | ✅ | POST | `{ full_name, email, password }` | `{ message }` | ✅ Build |
| `/auth/me` | ✅ | GET | (Bearer token) | `{ id, full_name, email, status, role_id, role }` | ✅ Build |
| `/auth/users/pending` | ✅ | GET | (Admin only) | `[{ id, full_name, email, status }]` | ✅ Build |
| `/auth/users/{id}/approve` | ✅ | PATCH | `{ role_id }` | `{ message }` | ✅ Build |
| `/auth/users/{id}/deactivate` | ✅ | PATCH | — | `{ message }` | ✅ Build |
| `/auth/refresh` | ❌ | POST | — | — | 🚫 Do NOT build |
| `/auth/forgot-password` | ❌ | POST | — | — | 🚫 Do NOT build endpoint call |
| `/auth/reset-password` | ❌ | POST | — | — | 🚫 Do NOT build endpoint call |

### 6.2 User Management Endpoints

| Endpoint | Backend Exists | Method | Request | Response |
|----------|---------------|--------|---------|----------|
| `/users` | ✅ | GET | `?search=&role_id=&status=&page=&page_size=` | `{ items, total, page, page_size }` |
| `/users/{id}` | ✅ | GET | — | `{ id, full_name, email, status, ... }` |
| `/users/{id}/role` | ✅ | PATCH | `{ role_id }` | `{ user_id, message }` |
| `/users/{id}/activate` | ✅ | PATCH | — | `{ user_id, message }` |
| `/users/{id}/deactivate` | ✅ | PATCH | — | `{ user_id, message }` |

### 6.3 Patient Endpoints

| Endpoint | Method | Roles | Pagination |
|----------|--------|-------|------------|
| `POST /patients` | POST | ADMIN, RECEPTIONIST | — |
| `GET /patients` | GET | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `?page=&page_size=&search=&is_active=` |
| `GET /patients/{id}` | GET | ADMIN, RECEPTIONIST, DOCTOR_ROLES | — |
| `PATCH /patients/{id}` | PATCH | ADMIN, RECEPTIONIST | — |
| `PATCH /patients/{id}/activate` | PATCH | ADMIN | — |
| `PATCH /patients/{id}/deactivate` | PATCH | ADMIN | — |
| `GET /patients/{id}/profile` | GET | ADMIN, RECEPTIONIST, DOCTOR_ROLES | — |

### 6.4 Generic Error Response

```typescript
// All error responses follow this shape:
{
  "detail": {
    "error": {
      "code": string,       // Machine-readable error code (e.g., "INVALID_CREDENTIALS")
      "message": string,    // Human-readable description
      "details": object | null  // Optional validation field errors
    }
  }
}

// Validation errors (422):
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    }
  ]
}
```

---

## 7. State Management Contract

### 7.1 Zustand Stores

#### Auth Store (persisted)

```typescript
interface AuthState {
  user: User | null;        // Populated by GET /auth/me — NOT from login response
  token: string | null;     // access_token from POST /auth/login
  isAuthenticated: boolean;
  isLoading: boolean;       // true during initial session check

  login: (token: string) => void;           // Store token only
  setUser: (user: User) => void;            // After GET /auth/me
  logout: () => void;
  setLoading: (loading: boolean) => void;
}
```

**Critical:** `login()` stores ONLY the token. `setUser()` is called separately after `GET /auth/me`.

#### Persistence

```typescript
persist(authStore, {
  name: 'denscare-auth',
  partialize: (state) => ({ token: state.token }),  // Only persist token
  // User object is re-fetched on every app mount via GET /auth/me
})
```

**Current security note:** The token is stored in localStorage (via Zustand persist). This is acceptable for MVP. Future migration plan: migrate to httpOnly cookies when refresh tokens are implemented.

#### Sidebar Store (persisted)

```typescript
interface SidebarState {
  isCollapsed: boolean;
  activeModule: string | null;
  pinnedModules: string[];
  recentModules: string[];
  // Actions...
}
```

### 7.2 TanStack Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

---

## 8. ID Type Contract

### 8.1 Entity ID Types

**WARNING:** Do NOT assume all entities use UUID. Verify before building.

| Entity | ID Type | Format | Example |
|--------|---------|--------|---------|
| **User** | `INTEGER` | Auto-increment | `1`, `42` |
| **Role** | `INTEGER` | Auto-increment | `1`, `2` |
| **Patient** | `UUID` | v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **Doctor** | `UUID` | v4 | — |
| **DoctorSchedule** | `UUID` | v4 | — |
| **Specialization** | `INTEGER` | Auto-increment | — |
| **Appointment** | `UUID` | v4 | — |
| **PatientRecord** | `UUID` | v4 | — |
| **TreatmentPlan** | `UUID` | v4 | — |
| **TreatmentPlanItem** | `UUID` | v4 | — |
| **TreatmentPlanVersion** | `UUID` | v4 | — |
| **TreatmentPlanApproval** | `UUID` | v4 | — |
| **Procedure** | `INTEGER` | Auto-increment | — |
| **Invoice** | `UUID` | v4 | — |
| **InvoiceItem** | `UUID` | v4 | — |
| **Payment** | `UUID` | v4 | — |
| **Receipt** | `UUID` | v4 | — |
| **CreditNote** | `UUID` | v4 | — |
| **PatientCredit** | `UUID` | v4 | — |

### 8.2 Foreign Key Relationships

| FK Column | Source Entity | Target Entity | Target Type |
|-----------|--------------|---------------|-------------|
| `user_id` | Doctor | User | INTEGER |
| `patient_id` | Appointment, TreatmentPlan, Invoice | Patient | UUID |
| `doctor_id` | TreatmentPlan | Doctor | UUID |
| `dentist_id` | Appointment | User | INTEGER |
| `created_by`, `updated_by` | All entities | User | INTEGER |

---

## 9. RBAC Contract

### 9.1 Roles (from `backend/app/core/constants.py`)

```typescript
// Frozen — do not modify
const ROLES = {
  ADMIN: 'ADMIN',
  CHIEF_DOCTOR: 'CHIEF_DOCTOR',
  GENERAL_DOCTOR: 'GENERAL_DOCTOR',
  SPECIALIST_DOCTOR: 'SPECIALIST_DOCTOR',
  CONSULTING_DOCTOR: 'CONSULTING_DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  DENTAL_ASSISTANT: 'DENTAL_ASSISTANT',
} as const;

const DOCTOR_ROLES = [
  ROLES.CHIEF_DOCTOR,
  ROLES.GENERAL_DOCTOR,
  ROLES.SPECIALIST_DOCTOR,
  ROLES.CONSULTING_DOCTOR,
] as const;
```

**Note:** `ADMIN` and `CHIEF_DOCTOR` both pass the `require_admin()` check. All 7 roles are seeded in the database.

### 9.2 Sidebar Navigation Visibility

| Module | ADMIN | CHIEF_DOCTOR | GENERAL_DOCTOR | SPECIALIST | CONSULTING | RECEPTIONIST | ASSISTANT |
|--------|-------|-------------|----------------|------------|------------|--------------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Patients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Appointments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Doctors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Procedures Catalog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit Log (future) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Billing | ✅ | ✅ (read) | ✅ (own pts) | ✅ (own pts) | ✅ (own pts) | ✅ (payment) | ❌ |
| Reports (future) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Settings (future) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |

### 9.3 Route Protection Rules

| Route Pattern | Allowed Roles | Notes |
|--------------|---------------|-------|
| `/admin/*` | ADMIN only | All admin sub-routes |
| `/patients/*` | ADMIN, RECEPTIONIST, DOCTOR_ROLES | All patient operations |
| `/patients/register` | ADMIN, RECEPTIONIST | Create patient |
| `/appointments/*` | ADMIN, RECEPTIONIST, DOCTOR_ROLES | |
| `/treatment-plans/*` | ADMIN, DOCTOR_ROLES | RECEPTIONIST can view |
| `/procedures/*` | ADMIN, CHIEF_DOCTOR | Other roles can view |
| `/` (dashboard) | All authenticated | Role-specific redirect |

### 9.4 API Permission Patterns (Backend)

```python
# Backend uses:
require_admin()          # ADMIN or CHIEF_DOCTOR
require_roles([...])     # Explicit role list

# Examples:
# POST /patients → require_roles([ADMIN, RECEPTIONIST])
# GET /patients → require_roles([ADMIN, RECEPTIONIST, *DOCTOR_ROLES])
# PATCH /patients/{id}/activate → require_roles([ADMIN])
```

---

## 10. Validation Contract

### 10.1 User Registration

| Field | Backend Rule | Frontend Must Match |
|-------|-------------|---------------------|
| `full_name` | Required, 2-100 chars | ✅ — min 2, max 100 |
| `email` | Required, valid email, normalized to lowercase | ✅ — validate email format, lowercase before send |
| `password` | Required, 8-128 chars, must contain: uppercase, lowercase, digit, special char | ✅ — real-time strength indicator |

**Password validation** (from backend `UserRegister.validate_password_complexity`):
- At least 1 uppercase letter (`[A-Z]`)
- At least 1 lowercase letter (`[a-z]`)
- At least 1 digit (`\d`)
- At least 1 special character (`[^a-zA-Z0-9]`)
- Minimum 8 characters
- Maximum 128 characters

### 10.2 Patient Registration

| Field | Backend Rule | Frontend Must Match |
|-------|-------------|---------------------|
| `first_name` | Required, 2-100 chars, alphabetic only | ✅ — min 2, max 100 |
| `last_name` | Required, 2-100 chars, alphabetic only | ✅ |
| `middle_name` | Optional, max 100 chars | ✅ |
| `date_of_birth` | Required, not future, >= 1900 | ✅ |
| `gender` | Required, enum: `male`, `female`, `other` | ✅ — dropdown |
| `primary_contact_number` | Required, 10-15 chars, pattern `^\+?[0-9]{10,15}$` | ✅ — numeric input |
| `emergency_contact_number` | Optional, same pattern as primary | ✅ |
| `email` | Optional, valid email | ✅ |
| `address` | Optional, max 500 chars | ✅ |
| `remarks` | Optional, max 1000 chars | ✅ |

### 10.3 Text Normalization Rules (Backend)

| Field | Normalization |
|-------|---------------|
| `email` | Strip whitespace → lowercase |
| `full_name` | Strip → collapse internal whitespace |
| `first_name`, `last_name`, `middle_name` | Strip → only alpha, spaces, hyphens, apostrophes |
| `primary_contact_number` | Strip → remove spaces and hyphens |
| `address`, `remarks` | Strip whitespace |

---

## 11. Error Handling Contract

### 11.1 HTTP Status Codes

| Status | Backend Meaning | Frontend Behavior |
|--------|-----------------|-------------------|
| **400** | Bad request (e.g., invalid state transition, user already active) | Show inline error or toast with server message |
| **401** | Unauthorized — missing/invalid/expired token | Clear auth store → redirect `/auth/login` |
| **403** | Forbidden — insufficient role, account inactive | Show 403 page with "Go to Dashboard" button |
| **404** | Resource not found | Show inline "Not found" message or toast |
| **409** | Conflict (e.g., email already registered, duplicate patient) | Show inline error below the relevant field |
| **422** | Validation error — field-level errors | Parse `detail` array → map to form field errors |
| **500** | Internal server error | Show toast: "An unexpected error occurred. Please try again." |

### 11.2 Auth-Specific Error Handling

| Error Scenario | HTTP Status | Backend Response | Frontend Action |
|---------------|-------------|------------------|-----------------|
| Invalid credentials | 401 | `InvalidCredentials` | Inline: "Invalid email or password" |
| Account pending | 403 | `InactiveAccount` | Banner: "Your account is pending approval" |
| Account inactive | 403 | `InactiveAccount` | Banner: "Your account has been deactivated" |
| Email already registered | 409 | `EmailAlreadyRegistered` | Inline: "An account with this email already exists" |
| Weak password | 422 | Validation error | Inline per field |
| Network error | — | — | Toast: "Unable to connect. Please check your internet." |

### 11.3 Global Error Handling Strategy

```
API Response
    │
    ├── 401 → logout() + redirect /auth/login (via Axios interceptor)
    │
    ├── 403 → show 403 page or disable the action
    │
    ├── 422 → map to form field errors (React Hook Form setError)
    │
    ├── 4xx → show toast with server message
    │
    ├── 5xx → show generic error toast
    │
    └── Network → show offline banner + retry button
```

---

## 12. Loading & Empty States

### 12.1 Loading States

| Scenario | Component | Behavior |
|----------|-----------|----------|
| App initial load | `<FullPageSkeleton />` | Full-page skeleton while checking session |
| Route change (lazy load) | `<PageSkeleton />` | Per-page skeleton with Suspense |
| List loading | `<Skeleton>` rows in table | 5 skeleton rows matching table layout |
| Detail loading | `<Skeleton>` for card | Card-shaped skeleton blocks |
| Form submission | Button spinner + disabled inputs | Spinner on submit button |
| Mutation in progress | Button spinner | No double-submit |

### 12.2 Empty States

| Scenario | Title | Description | Action |
|----------|-------|-------------|--------|
| No patients found | "No patients found" | "Register your first patient to get started." | [➕ Register Patient] |
| No appointments today | "No appointments today" | "It looks like today is quiet." | [📅 View Calendar] |
| No search results | "No results found" | "Try adjusting your search query." | — |
| No notifications | "All caught up!" | "You have no unread notifications." | — |
| No treatment plans | "No treatment plans" | "Create your first treatment plan." | [➕ Create Plan] |

### 12.3 Error States

| Scenario | Component | Action |
|----------|-----------|--------|
| List load failed | Error banner + retry | [🔄 Retry] |
| Detail load failed | Error card | [🔄 Retry] or [← Go Back] |
| Network offline | `<OfflineBanner />` | Persistent banner at top |
| Mutation failed | Toast notification | Dismiss |

---

## 13. Enum Contract

### 13.1 User Status (from `backend/app/core/constants.py`)

```typescript
const USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;
```

### 13.2 Gender (from `backend/app/core/constants.py`)

```typescript
const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const;
```

### 13.3 Appointment Status (from `backend/app/modules/appointments/enums.py`)

```typescript
const APPOINTMENT_STATUS = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  IN_TREATMENT: 'In Treatment',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
} as const;
```

**Note:** These are PascalCase strings with spaces — match exactly when rendering.

### 13.4 Appointment Type

```typescript
const APPOINTMENT_TYPE = {
  CONSULTATION: 'Consultation',
  FOLLOW_UP: 'Follow-Up',
  EMERGENCY: 'Emergency',
  PROCEDURE: 'Procedure',
  REVIEW: 'Review',
  OTHER: 'Other',
} as const;
```

### 13.5 Invoice Status (from `backend/app/modules/billing/enums.py`)

```typescript
const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  VOID: 'void',
} as const;
```

### 13.6 Payment Status

```typescript
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  REVERSED: 'reversed',
  VOID: 'void',
} as const;
```

### 13.7 Payment Method

```typescript
const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
  INSURANCE: 'insurance',
  WALLET: 'wallet',
} as const;
```

### 13.8 Treatment Plan Status (from `backend/app/modules/treatment/enums.py`)

```typescript
const TREATMENT_PLAN_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  PROPOSED: 'proposed',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
```

### 13.9 Treatment Plan Item Status

```typescript
const TREATMENT_PLAN_ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DEFERRED: 'deferred',
} as const;
```

### 13.10 Patient Acknowledgment Status

```typescript
const PATIENT_ACKNOWLEDGMENT = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
} as const;
```

### 13.11 Procedure Category

```typescript
const PROCEDURE_CATEGORY = {
  DIAGNOSTIC: 'diagnostic',
  PREVENTIVE: 'preventive',
  RESTORATIVE: 'restorative',
  ENDODONTIC: 'endodontic',
  PERIODONTIC: 'periodontic',
  PROSTHODONTIC: 'prosthodontic',
  ORAL_SURGERY: 'oral_surgery',
  ORTHODONTIC: 'orthodontic',
  COSMETIC: 'cosmetic',
  IMPLANT: 'implant',
  OTHER: 'other',
} as const;
```

### 13.12 Billing Document Types

```typescript
const DOCUMENT_TYPE = {
  INVOICE: 'invoice',
  RECEIPT: 'receipt',
  CREDIT_NOTE: 'credit_note',
  PAYMENT: 'payment',
  REFUND: 'refund',
} as const;
```

### 13.13 Currency Code

```typescript
const CURRENCY_CODE = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  INR: 'INR',
} as const;
```

### 13.14 Credit Note Status (from `backend/app/modules/billing/enums.py`)

```typescript
const CREDIT_NOTE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  APPLIED: 'applied',
  VOID: 'void',
  EXPIRED: 'expired',
} as const;
```

### 13.15 Refund Status

```typescript
const REFUND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const;
```

### 13.16 Receipt Status

```typescript
const RECEIPT_STATUS = {
  GENERATED: 'generated',
  CANCELLED: 'cancelled',
} as const;
```

### 13.17 Payment Allocation Type

```typescript
const PAYMENT_ALLOCATION_TYPE = {
  PAYMENT: 'payment',
  REFUND: 'refund',
} as const;
```

### 13.18 Document Number Prefixes

| Document Type | Prefix | Example |
|---------------|--------|---------|
| Invoice | `INV-` | `INV-00001` |
| Receipt | `RCT-` | `RCT-00001` |
| Credit Note | `CN-` | `CN-00001` |
| Payment | `PAY-` | `PAY-00001` |
| Refund | `RFD-` | `RFD-00001` |

### 13.19 Entity Not in Backend

The following field was listed as an example in the original spec but does **NOT** exist in the backend:
- **Blood Group** — No blood group field exists on any model. Do NOT build.

---

## 14. Pagination & Filtering Contract

### 14.1 Standard Pagination Pattern

All list endpoints follow the same pattern:

**Request Query Params:**
| Param | Type | Default | Range |
|-------|------|---------|-------|
| `page` | integer | 1 | >= 1 |
| `page_size` | integer | 20 | 1-100 |

**Response Shape:**
```typescript
{
  items: T[],
  total: number,      // Total matching records
  page: number,       // Current page
  page_size: number,  // Items per page
}
```

### 14.2 List Endpoints That Support Search

| Endpoint | Search Field | Extra Filters |
|----------|-------------|---------------|
| `GET /patients` | `?search=` | `?is_active=` |
| `GET /users` | `?search=` | `?role_id=&status=` |
| `GET /appointments` | — | `?date=&doctor_id=&status=` |
| `GET /doctors` | `?search=` | `?is_active=&specialization_id=` |
| `GET /treatment-plans` | — | `?patient_id=&doctor_id=&status=` |

---

## 15. Do Not Invent APIs/DTOs — Strict Rules

### 15.1 Prohibited API Calls

The following API endpoints do **NOT** exist in the backend. Do NOT generate code that calls them:

```
❌ POST /auth/refresh              — No refresh token endpoint
❌ POST /auth/forgot-password      — No forgot password endpoint
❌ POST /auth/reset-password       — No reset password endpoint
❌ POST /auth/logout               — Logout is client-side only
❌ POST /auth/change-password      — No dedicated endpoint; use user update
❌ GET  /auth/users                — No user list on auth module; use /users
❌ POST /patients/{id}/upload      — No file upload endpoint exists
❌ GET  /billing/reports           — Reports module not implemented
❌ GET  /inventory/*               — Inventory module not implemented
❌ GET  /laboratory/*              — Laboratory module not implemented
```

### 15.2 Prohibited DTO/Response Fields

Do NOT assume the following fields exist in API responses:

```
❌ refresh_token in login response          — Backend does not return it
❌ user object in login response            — Backend returns { access_token, token_type } only
❌ blood_group on Patient model             — Field does not exist
❌ permissions[] array on User model        — RBAC is role-based, not permission-list-based
❌ avatar_url on User model                 — Field does not exist
❌ force_password_change on User model      — Field does not exist
❌ is_online on Doctor model                — Field does not exist
❌ specialization_names[] on Doctor list    — Must fetch separately
```

### 15.3 Prohibited Assumptions

| Assumption | Reality |
|------------|---------|
| All IDs are UUID | ❌ User = INTEGER, Role = INTEGER, Procedure = INTEGER, Specialization = INTEGER |
| Login accepts JSON body | ❌ Login uses form-encoded (`OAuth2PasswordRequestForm`) |
| Login returns user info | ❌ Login returns `{ access_token, token_type }` only. Call `GET /auth/me` |
| User has `role.name` as string | ✅ Correct. Role name is stored as string (`"ADMIN"`, `"GENERAL_DOCTOR"`, etc.) |
| User has `role_id` as integer | ✅ Correct. Role FK is integer |
| Pagination is cursor-based | ❌ All backend pagination is page-based (`?page=&page_size=`) |
| Billing IDs are UUID | ✅ Correct. Invoice, Payment, Receipt all use UUID |
| Appointment statuses are lowercase | ❌ Values are PascalCase with spaces: `"Scheduled"`, `"Checked In"`, etc. |

---

## 16. Production Readiness Checklist

### Pre-Build Verification

- [ ] **Routes verified** — All routes use `/auth/*` prefix consistently
- [ ] **APIs verified** — All 145+ backend endpoints documented in Part 2.6
- [ ] **DTOs verified** — Login returns `{ access_token, token_type }` only
- [ ] **Validation verified** — All field rules match backend (password, patient fields, etc.)
- [ ] **RBAC verified** — All 7 roles match `backend/app/core/constants.py`
- [ ] **ID types verified** — User = INTEGER, Patient = UUID, Procedure = INTEGER, etc.
- [ ] **Auth flow verified** — Login → store token → `GET /auth/me` → hydrate state
- [ ] **Error handling verified** — 401→logout, 403→403 page, 422→field errors
- [ ] **Loading states defined** — Skeleton patterns for all screen types
- [ ] **Empty states defined** — Messages + actions for all list types
- [ ] **Future features isolated** — Forgot/Reset password = placeholder UI only
- [ ] **Enums verified** — All enum values match backend exactly

---

## 18. AI Execution Guide

### 18.1 Prompt Strategy for Lovable.dev

When sending this document to Lovable.dev, use the following prompt template:

```
You are building the DensCare dental clinic management frontend.

Read the authoritative specification at `frontend/docs/UI-Build-Readiness-Report.md`.

CRITICAL RULES:
1. Backend is the source of truth — if anything contradicts, the backend wins.
2. Login uses form-encoded body (NOT JSON), returns { access_token, token_type } only.
3. Call GET /auth/me AFTER login to get user profile.
4. No refresh tokens exist — handle 401 by clearing session and redirecting to login.
5. User IDs are INTEGER. Patient/Doctor/Appointment IDs are UUID. Check each entity.
6. Appointment statuses are PascalCase with spaces: "Scheduled", "Checked In", etc.
7. All other enums are lowercase.
8. Routes use /auth/* prefix for auth pages.
9. Do NOT build any feature marked as 🚫 Deferred in §3.2.
10. Forgot/Reset Password pages are placeholder UI only — no API calls.
11. Build in phases per §17.2.
12. Use the exact enum values from §13 in status badges and dropdowns.

Build Phase 1 first: Auth (Login, Register), App Shell, Sidebar, RBAC.
```

### 18.2 Strict Implementation Rules for AI Code Generators

| Rule | Description | Violation Penalty |
|------|-------------|-------------------|
| **R-001** | Never call an API endpoint not listed in this document's endpoint tables | UI will 404/422 on every request |
| **R-002** | Never assume login accepts JSON — always use `FormData` or URL-encoded body | Backend silently returns 422 |
| **R-003** | Never expect `user` in login response — call `GET /auth/me` separately | Auth state will be null |
| **R-004** | Never build Forgot Password API call — UI placeholder only | No backend to handle it |
| **R-005** | Never build token refresh logic — redirect to login on 401 | Dead code that never works |
| **R-006** | Never hardcode route paths — use the frozen route tree in §5 | Routes will mismatch |
| **R-007** | Never assume all IDs are UUID — verify each entity in §8 | Foreign key lookups will fail |
| **R-008** | Never invent enum values — use the exact values from §13 | Status badges will mismatch |
| **R-009** | Never invent pagination — use page/page_size pattern from §14 | List endpoints will 422 |
| **R-010** | Never show features to unauthorized roles — enforce RBAC from §9 | Data leaks |
| **R-011** | Never store user info without calling `GET /auth/me` | User data will be stale/missing |
| **R-012** | Never use cursor-based pagination; always page-based `(?page=&page_size=)` | API doesn't support it |

### 18.3 Build Validation Checklist (Post-Build)

After each build phase, validate:

- [ ] **Login works** — form-encoded POST returns token, `GET /auth/me` returns user
- [ ] **Register works** — POST creates pending user, shows success message
- [ ] **Auth errors** — wrong password shows inline error; inactive account shows banner
- [ ] **Session expiry** — wait 30+ min OR manually expire token → redirect to login
- [ ] **RBAC** — log in as each role → correct sidebar/navigation/actions visible
- [ ] **ID types** — submitting patient forms works (UUID), submitting user forms works (INTEGER)
- [ ] **Enums** — status badges match API response values exactly
- [ ] **Pagination** — lists accept `?page=&page_size=` and render correctly
- [ ] **Empty states** — each list view shows correct empty state when no data
- [ ] **Error handling** — network failure shows toast; 403 shows forbidden page
- [ ] **Forgot/Reset** — placeholder pages render without calling any API

### 18.4 Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Login sends JSON instead of form-encoded | Most AI code generators default to JSON | Hardcode `Content-Type: application/x-www-form-urlencoded` |
| Login expects `user` in response | Common auth pattern (JWT + user) | Call `GET /auth/me` as separate step |
| Token refresh on 401 | Standard pattern in SPAs | NOT implemented — redirect to login |
| Appointment status `scheduled` instead of `Scheduled` | Most enums are lowercase | Check §13.3 — these are PascalCase |
| Patient ID treated as integer | Most ID fields are integers | Check §8 — Patient uses UUID |
| Forgot password calls API | Standard feature | Placeholder only — no API |

### 18.5 Lovable.dev-Specific Instructions

When using Lovable.dev:

1. **Upload this document** as context before starting
2. **Pin the prompt template from §18.1** as the system prompt
3. **Build in phases** — start with Phase 1 (§17.2) and validate at each phase
4. **Use the `features/auth`, `features/patients` folder structure** from Part 2.6
5. **Do not use shadcn/ui's server actions** — this is a standard REST API
6. **Use Zustand for global state** (auth, sidebar), not Redux or Context
7. **Use TanStack Query for API calls** (useQuery, useMutation), not fetch-on-render
8. **Validate forms client-side** with Zod schemas matching §10 validation rules
9. **Reference the component patterns** from Part 2.6 §11 (DataTable, PageHeader, etc.)
10. **Set `VITE_API_URL` to `http://127.0.0.1:8000`** for local development

---

## 19. Mandatory Rules for Lovable.dev

### 19.1 Golden Rules

1. **Backend is authoritative.** If a UX spec (Part 2.2) contradicts the backend implementation, the backend wins.
2. **Do NOT generate UI for endpoints that do not exist.** No Forgot Password API call, no Reset Password API call, no Token Refresh.
3. **Do NOT invent API payloads.** Every request/response shape is defined in this document or in the backend code.
4. **Do NOT invent routes.** The frozen route tree in Section 5 is the only valid set of routes.
5. **Do NOT assume refresh tokens.** They do not exist in the backend.
6. **Do NOT assume all IDs are UUID.** User = INTEGER, Procedure = INTEGER, Patient = UUID. Verify each entity.
7. **Follow backend validation exactly.** Password rules, field lengths, and regex patterns must match the backend Pydantic schemas.
8. **Respect RBAC visibility rules.** Sidebar items, routes, and actions must be filtered by role.
9. **Keep the modular architecture.** Feature folders (`features/auth`, `features/patients`, etc.) must be maintained.
10. **Mark deferred features as placeholder UI only** — never as fully functional.

### 19.2 Build Order (Recommended)

| Phase | Modules | Rationale |
|-------|---------|-----------|
| **Phase 1** | Auth (Login, Register), App Shell, Sidebar, RBAC | Foundation — everything depends on auth |
| **Phase 2** | Dashboard (all roles), Patient List/Register/Profile | Core clinical workflow |
| **Phase 3** | Appointments, Doctors | Scheduling and doctor management |
| **Phase 4** | Treatment Plans, Procedures Catalog | Clinical planning |
| **Phase 5** | Patient Records, Prescriptions | Clinical documentation |
| **Phase 6** | Billing (Invoices, Payments, Receipts, Credit Notes) | Financial operations |

### 19.3 Prohibited Patterns

```markdown
❌ DO NOT build:  POST /auth/refresh
❌ DO NOT build:  POST /auth/forgot-password
❌ DO NOT build:  POST /auth/reset-password
❌ DO NOT build:  POST /auth/logout
❌ DO NOT build:  Force password change screen
❌ DO NOT build:  Inventory module
❌ DO NOT build:  Laboratory module
❌ DO NOT build:  Patient Portal
❌ DO NOT build:  ACCOUNTANT role UI
❌ DO NOT build:  Token storage in httpOnly cookies (Zustand persist is fine for MVP)
❌ DO NOT build:  Cursor-based pagination
❌ DO NOT build:  GraphQL endpoints (this is a REST API)
❌ DO NOT build:  WebSocket connections (no real-time module exists)
❌ DO NOT build:  File upload for patient documents (no upload endpoint)
```

---

## Appendices

### Appendix A: Resolved Inconsistency Matrix

| ID | Severity | Status | Section |
|----|----------|--------|---------|
| I-01 | 🔴 Critical | Resolved | §2 |
| I-02 | 🔴 Critical | Resolved | §2 |
| I-03 | 🔴 Critical | Resolved | §4 |
| I-04 | 🔴 Critical | Resolved | §4 |
| I-05 | 🟡 High | Resolved | §3.2 |
| I-06 | 🟡 High | Resolved | §3.2 |
| I-07 | 🟡 High | Resolved | §3.2 |
| I-08 | 🟡 Medium | Resolved | §5 |
| I-09 | 🟡 Medium | Resolved | §7 |
| I-10 | 🟢 Low | Resolved | §3.1 |

### Appendix B: Frontend Scope Matrix

See Section 3 — Frontend Scope Freeze for complete Implement Now vs Future Features breakdown.

### Appendix C: How to Use This Document

**For Lovable.dev:**
1. Upload this entire document as context
2. Use the prompt template in §18.1
3. Follow the build order in §19.2
4. Validate against the checklist in §18.3
5. Refer to the AI Execution Guide in §18 for strict rules

**For Human Developers:**
1. Start with the Route Contract (§5) to understand page structure
2. Read the Authentication Contract (§4) and Validation Contract (§10) for form logic
3. Reference the API Contract (§7) and Billing Workflows (§6) for endpoint details
4. Use the Enum Contract (§13) for all status/dropdown values
5. Follow the RBAC Contract (§9) for permission gating

---

**End of UI Build Readiness Report**

*This document is the single source of truth for Lovable.dev. All contradictions between Parts 2.2, 2.6, and the Cross-Document Dependency Map have been resolved in favor of the backend implementation.*
