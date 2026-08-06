# User Module — Backend Contract Review (Sprint 11B)

> **Document type:** Mandatory backend contract review (Blocking Task)
> **Scope:** Backend User Management + Authentication modules — single source of truth for Sprint 11B frontend work (Phase 1D Create User, Phase 1E Edit User, Reset Password).
> **Status:** ✅ VERIFIED against actual backend implementation (not API docs)
> **Date:** 2026-08-06

---

## 0. Executive Summary (Read First)

This review was performed by reading the **actual backend source code** — routers, Pydantic schemas, service layer, repository layer, SQLAlchemy models, RBAC dependencies, JWT security, exception handlers, and role seeding. Every statement below is verified against a specific source file (see [Appendix A — Source Map](#appendix-a--source-map)).

### ❗ Three conclusions that change the Sprint 11B plan

| Sprint 11B Phase | Backend support | Verdict |
|---|---|---|
| **Phase 1D — Create User** | **NOT supported as specified.** There is **no admin create-user endpoint**. The only way a user record enters the system is **public self-registration** (`POST /auth/register`), which creates a `pending` account that must then be approved by an admin (`PATCH /auth/users/{id}/approve`). | **BLOCKED as specified.** The only backend-supported "create user" is a two-step register → approve flow. See [Section 3](#3-create-user-contract). |
| **Phase 1E — Edit User** | **NOT supported.** There is **no endpoint that edits `full_name`, `email`, or any profile field**. The only user-mutating endpoints are: change role, activate, deactivate, approve. | **BLOCKED.** The frontend must **not** invent an edit endpoint. See [Section 4](#4-edit-user-contract). |
| **Reset Password** | **NOT supported.** Zero occurrences of reset / forgot / change-password logic in `backend/app/`. Passwords are set exactly once, at registration, and can never be changed via any API. | **Do not implement.** See [Section 8](#8-reset-password). |

### What the backend DOES support (complete inventory)

| Area | Endpoints |
|---|---|
| Identity lifecycle (public) | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Admin approval workflow | `GET /auth/users/pending`, `PATCH /auth/users/{id}/approve` |
| Admin user directory | `GET /users`, `GET /users/{id}` |
| Admin user actions | `PATCH /users/{id}/role`, `PATCH /users/{id}/activate`, `PATCH /users/{id}/deactivate`, `PATCH /auth/users/{id}/deactivate` (legacy duplicate) |

> **Frontend team direction:** Most of the Sprint 11B UI work described in the task brief (create form, edit form, password reset) has **no backend contract to bind to**. The frontend already implements everything the backend supports (list, detail, role change, activate/deactivate, pending approval, register). The actionable Sprint 11B work is limited to **optionally exposing an admin "add user" flow that reuses the existing register + approve endpoints**, plus **closing the role-options gap** (no `GET /roles` endpoint). See [Section 13](#13-frontend-impact-analysis) and [Section 15](#15-recommendations).

---

## 1. Module Overview

### 1.1 Modules involved

User management is split across **two FastAPI modules** registered in `backend/main.py`:

| Module | Router file | Prefix | Tags | Responsibility |
|---|---|---|---|---|
| Authentication | `backend/app/modules/auth/routes.py` | `/auth` | `Authentication` | Registration, login, current user, pending list, approval, legacy deactivation |
| Users (admin) | `backend/app/modules/users/routes.py` | `/users` | `Users` | Admin user directory: list, detail, role change, activate, deactivate |

Both routers are mounted **without a version prefix** (e.g. no `/api/v1`). Full paths are exactly `/auth/...` and `/users/...`.

### 1.2 Authentication requirement

- **Scheme:** JWT Bearer token in the `Authorization: Bearer <token>` header.
- **Token endpoint:** `POST /auth/login` (declared via `OAuth2PasswordBearer(tokenUrl="/auth/login")` in `backend/app/dependencies/auth.py`).
- **Token shape** (`backend/app/core/security.py`):
  - Algorithm `HS256` (config `JWT_ALGORITHM`, default), secret from `JWT_SECRET` (min 32 chars).
  - Claims: `sub` = **user email**, `exp` (default `ACCESS_TOKEN_EXPIRE_MINUTES = 30`), `iat`, `jti`, `token_type = "access"`.
  - Tokens with `token_type` present but ≠ `"access"` are rejected.
- **`get_current_user`** dependency (`backend/app/dependencies/auth.py`):
  - Looks up the user **by `sub` email** (case-sensitive DB lookup — but email is normalized to lowercase at registration and login, so it matches).
  - **Rejects inactive users with 401** ("Could not validate credentials") — an active token becomes invalid immediately when an admin deactivates the account.
  - Expired / malformed tokens → 401.

### 1.3 Authorization model

- **Role-based access control (RBAC)** implemented in `backend/app/modules/rbac/permissions.py`.
- Admin-level roles (hard-coded): **`ADMIN`** and **`CHIEF_DOCTOR`** (frozenset `_ADMIN_ROLES`).
- `require_admin` → user must have an admin-level role, else **403** with `detail` either `"Role not assigned"` (no role) or `"Insufficient permissions"` (wrong role).
- A generic `require_roles([...])` factory exists for other modules; the user module uses only `require_admin`.
- **`GET /auth/me` does NOT return the user's role** (`CurrentUserResponse` has only `id, full_name, email, status`). Client-side RBAC gating from `/auth/me` is **impossible**; the frontend must rely on backend 403s (or derive role client-side only from data fetched elsewhere).

### 1.4 Request/response conventions

- **JSON bodies** for all mutating endpoints **except login**, which uses **`application/x-www-form-urlencoded`** (`OAuth2PasswordRequestForm`: `username` + `password`; email is the username).
- **Field naming:** snake_case everywhere.
- **Timestamps:** ISO 8601 UTC (`DateTime(timezone=True)` columns, serialized by FastAPI/Pydantic).
- **Error responses:** uniform envelope `{"success": false, "message": str, "details": ...}` for **all** errors (domain exceptions, `HTTPException`, 422 validation, and unhandled 500s). See [Section 11](#11-error-contract).
- **Strict schemas:** `UserRegister` and `UserApprovalRequest` use `extra="forbid"` — unknown fields → 422.
- **Audit trail:** `created_by` / `updated_by` foreign keys to `users.id` are populated server-side by admin actions (approval, role change, activate/deactivate). Clients never send them.

---

## 2. Endpoint Inventory

All endpoints verified from `backend/app/modules/auth/routes.py` and `backend/app/modules/users/routes.py`.

### 2.1 Authentication module (`/auth`)

| # | Method | Endpoint | Purpose | Auth | Permission |
|---|---|---|---|---|---|
| 1 | `POST` | `/auth/register` | Create a **pending** account (self-service or on-behalf) | None (public) | Public |
| 2 | `POST` | `/auth/login` | Authenticate (form-encoded) → JWT | None (public) | Public |
| 3 | `GET` | `/auth/me` | Current user profile `{id, full_name, email, status}` | Bearer | Any authenticated (incl. users with no role) |
| 4 | `GET` | `/auth/users/pending` | List pending users (unpaginated array) | Bearer | ADMIN, CHIEF_DOCTOR |
| 5 | `PATCH` | `/auth/users/{user_id}/approve` | Assign role + activate a pending user | Bearer | ADMIN, CHIEF_DOCTOR |
| 6 | `PATCH` | `/auth/users/{user_id}/deactivate` | Deactivate a user (legacy duplicate of #9) | Bearer | ADMIN, CHIEF_DOCTOR |

### 2.2 Users module (`/users`)

| # | Method | Endpoint | Purpose | Auth | Permission |
|---|---|---|---|---|---|
| 7 | `GET` | `/users` | Paginated, filterable user list | Bearer | ADMIN, CHIEF_DOCTOR |
| 8 | `GET` | `/users/{user_id}` | User detail | Bearer | ADMIN, CHIEF_DOCTOR |
| 9 | `PATCH` | `/users/{user_id}/role` | Change a user's role | Bearer | ADMIN, CHIEF_DOCTOR |
| 10 | `PATCH` | `/users/{user_id}/activate` | Activate a user | Bearer | ADMIN, CHIEF_DOCTOR |
| 11 | `PATCH` | `/users/{user_id}/deactivate` | Deactivate a user | Bearer | ADMIN, CHIEF_DOCTOR |

### 2.3 Endpoint detail table (schemas + statuses)

| # | Request schema | Response schema | Success status | Notable errors |
|---|---|---|---|---|
| 1 | `UserRegister` | `RegisterResponse {message}` | **201** | 409 duplicate email; 422 validation |
| 2 | `OAuth2PasswordRequestForm` (form) | `LoginResponse {access_token, token_type}` | **200** | 401 invalid credentials; 403 inactive account |
| 3 | — | `CurrentUserResponse` | **200** | 401 |
| 4 | — | `List[PendingUserResponse]` (bare array) | **200** | 401, 403 |
| 5 | `UserApprovalRequest {role_id}` | `UserApprovalResponse {message}` | **200** | 400 already active; 404 user/role; 422 |
| 6 | — | `UserApprovalResponse {message}` | **200** | 400 self/already-inactive; 404; 409 last admin |
| 7 | Query params (see §12) | `UserListResponse` | **200** | 401, 403, 422 (page/page_size bounds) |
| 8 | — | `UserDetailResponse` | **200** | 401, 403, 404 |
| 9 | `ChangeRoleRequest {role_id}` | `UserActionResponse {user_id, message}` | **200** | 400 self; 404 user/role; 409 last admin |
| 10 | — | `UserActionResponse` | **200** | 400 self/already-active; 404; 409 (n/a) |
| 11 | — | `UserActionResponse` | **200** | 400 self/already-inactive; 404; 409 last admin |

> **Endpoint responses that differ subtly:** `/auth/*` mutations return `{message: "..."}` with a trailing period (e.g. `"User approved successfully."`); `/users/*` actions return `{user_id, message}` **without** a trailing period (e.g. `"Role updated successfully"`). Both are only display strings — the frontend should prefer its own success toasts.

---

## 3. Create User Contract

### 3.1 Conclusive finding

> **There is NO admin "create user" endpoint in the backend.**
>
> Verified: the entire router inventory of the users module (`GET /users`, `GET /users/{id}`, `PATCH .../role|activate|deactivate`) and the auth module (register/login/me/pending/approve/deactivate) contains **no `POST /users` and no admin-credentialed creation endpoint**. The **only** way a `users` row is created is `POST /auth/register`, which is **public**, requires a **user-supplied password**, and produces a **`pending` / `is_active=false` account with `role_id = NULL`**.

### 3.2 The backend-supported "create user" flow (register → approve)

```
Step 1  POST /auth/register            {full_name, email, password}
        → 201 {message: "Registration submitted. Waiting for admin approval."}
Step 2  GET /auth/users/pending        (admin) → list of pending users
Step 3  PATCH /auth/users/{id}/approve {role_id}  (admin) → activates + assigns role
        → 200 {message: "User approved successfully."}
```

This is exactly what the frontend already implements (RegisterPage → PendingUsersPage → approve dialog). An admin cannot create an **active, role-assigned** user in a single call, and cannot create a user without a password.

### 3.3 `POST /auth/register` — request schema `UserRegister`

Schema source: `backend/app/modules/auth/schemas.py`. `extra="forbid"` (unknown fields → 422).

| Field | Type | Required | Nullable | Default | Validation | Backend transformation |
|---|---|---|---|---|---|---|
| `full_name` | `string` | ✅ | ❌ | — | `min_length=2`, `max_length=100` | **Normalized**: strip leading/trailing whitespace, collapse internal whitespace runs to single spaces (`" ".join(value.strip().split())`) |
| `email` | `string` (Pydantic `EmailStr`) | ✅ | ❌ | — | Must be a valid email per Pydantic `EmailStr` (requires `email-validator` semantics) | **Normalized**: `value.strip().lower()` — lowercase + trimmed. Also used as the login username; the same normalization runs at login |
| `password` | `string` | ✅ | ❌ | — | `min_length=8`, `max_length=128` + complexity (see §7.2) | **Hashed** server-side with **bcrypt** via `passlib` (`app/core/security.py`); raw password is never stored or returned |

**Frontend Zod mirror (Phase 1D if re-scoped):**

```ts
const registerUserSchema = z.object({
  full_name: z.string().min(2).max(100),                       // normalize on submit
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string()
    .min(8).max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one digit')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
});
```

> ⚠️ **Note on duplicate email:** the backend checks uniqueness in the **service layer** (`get_user_by_email` → raises `EmailAlreadyRegistered` → **409**), not in the schema. The frontend cannot pre-validate uniqueness — it must surface the 409 message. There is **no dedicated username field**; email is the identifier.

### 3.4 Register — response schema `RegisterResponse`

| Field | Type | Notes |
|---|---|---|
| `message` | `string` | `"Registration submitted. Waiting for admin approval."` — no user id is returned |

### 3.5 Approve — request schema `UserApprovalRequest`

| Field | Type | Required | Validation |
|---|---|---|---|
| `role_id` | `integer` | ✅ | `ge=1` (must be a positive integer) |

`extra="forbid"`. Response: `UserApprovalResponse {message: "User approved successfully."}`.

---

## 4. Edit User Contract

### 4.1 Conclusive finding

> **There is NO edit-user endpoint.** The backend exposes **no** `PATCH /users/{id}` (or any equivalent) that modifies `full_name`, `email`, `status`, or any other profile field. The users module's only mutations are `role`, `activate`, `deactivate`; the auth module's only mutation is `approve` (plus the legacy deactivate).

### 4.2 What is actually editable (verified)

| Field | Editable? | How |
|---|---|---|
| `role_id` / `role_name` | ✅ **Yes** | `PATCH /users/{id}/role` (admin) or `PATCH /auth/users/{id}/approve` (pending → active + role) |
| `status` / `is_active` | ✅ **Yes, but only via dedicated lifecycle endpoints** | `PATCH /users/{id}/activate` / `PATCH /users/{id}/deactivate` — **not** free-form editing |
| `full_name` | ❌ **No** (immutable after registration) | — |
| `email` | ❌ **No** (immutable after registration) | — |
| `password` | ❌ **No** (set once at registration; never changeable) | — |
| `id` | ❌ **No** (immutable primary key) | — |
| `last_login_at` | ❌ Computed (set by backend on each successful login) | — |
| `created_by`, `created_at` | ❌ Computed / audit | — |
| `updated_by`, `updated_at` | ❌ Computed / audit | — |

### 4.3 `PATCH /users/{user_id}/role` — request schema `ChangeRoleRequest`

| Field | Type | Required | Validation |
|---|---|---|---|
| `role_id` | `integer` | ✅ | `gt=0` (must be ≥ 1) |

Response: `UserActionResponse {user_id: int, message: "Role updated successfully"}`.

**Behavior (verified in `users/service.py` + `users/routes.py`):**
1. `current_admin.id == user_id` → **400** `SELF_ROLE_CHANGE_NOT_ALLOWED` ("You cannot change your own role").
2. Target user must exist → else **404** `USER_NOT_FOUND`.
3. Role must exist (`get_role_by_id`) → else **404** `ROLE_NOT_FOUND`.
4. **Last-admin protection:** if the target currently holds an admin role (`ADMIN`/`CHIEF_DOCTOR`), the new role is **not** admin-level, and `count_admin_users() <= 1` → **409** `LAST_ADMIN_CANNOT_BE_MODIFIED`.
5. On success sets `user.role_id` + `user.updated_by = current_admin.id`, commits, returns `{user_id, message}`.

> No-op writes are allowed by the backend (changing to the same role is a valid 200), but the existing frontend `isRoleUnchanged()` util skips them.

---

## 5. User Status Workflow

### 5.1 Status model (verified from `auth/models.py` + `core/constants.py`)

The `users` table has **two coupled status fields**:

| Column | Values | Notes |
|---|---|---|
| `status` | `pending` \| `active` \| `inactive` (DB `CheckConstraint` `ck_users_status_valid`) | Lifecycle state; default `"pending"` |
| `is_active` | `true` \| `false` (default `false`) | Login gate — `get_current_user` rejects `is_active=false` |

**Invariant maintained by the service layer:** `pending → is_active=false`, `active → is_active=true`, `inactive → is_active=false`.

### 5.2 Allowed transitions (verified)

```
                    PATCH /users/{id}/activate
   ┌────────────┐  (also activates pending users)   ┌────────────┐
   │  pending   │ ────────────────────────────────▶ │  active    │
   │ is_active=0│                                   │ is_active=1│
   └────────────┘                                   └─────┬──────┘
          │                                              │
          │ PATCH /auth/users/{id}/approve               │ PATCH /users/{id}/deactivate
          │ (role + activate)                            ▼ (also /auth/users/{id}/deactivate)
          ▼                                        ┌────────────┐
   (→ active, above)                               │  inactive  │
                                                   │ is_active=0│
                                                   └─────┬──────┘
                                                         │ PATCH /users/{id}/activate
                                                         └───────────────▶ active
```

- **pending → active:** `PATCH /auth/users/{id}/approve` (assigns role; requires role_id) **or** `PATCH /users/{id}/activate` (no role assignment — the user stays role-less).
- **active → inactive:** `PATCH /users/{id}/deactivate` or `PATCH /auth/users/{id}/deactivate`.
- **inactive → active:** `PATCH /users/{id}/activate`.
- **No hard delete** — there is no `DELETE /users/{id}` anywhere. Deactivation is the soft-delete mechanism.
- **Idempotency guards:** activating an `is_active=true` user → **400** `USER_ALREADY_ACTIVE`; deactivating an inactive user → **400** `USER_ALREADY_INACTIVE`. (Note: the auth-module deactivate checks `status == "inactive"`; the users-module deactivate checks `is_active == false`. Both produce the same practical outcome.)

### 5.3 Business rules on transitions

| Rule | Endpoint(s) | Error |
|---|---|---|
| Admin cannot activate/deactivate **their own account** | `PATCH /users/{id}/activate\|deactivate`, `PATCH /auth/users/{id}/deactivate` | **400** `SELF_ACTIVATION_NOT_ALLOWED` / `SELF_DEACTIVATION_NOT_ALLOWED` |
| Cannot deactivate the **sole remaining admin** (ADMIN or CHIEF_DOCTOR) | deactivate endpoints | **409** `LAST_ADMIN_CANNOT_BE_MODIFIED` |
| Cannot demote the sole remaining admin via role change | `PATCH /users/{id}/role` | **409** `LAST_ADMIN_CANNOT_BE_MODIFIED` |
| Deactivated users are rejected at the API gate (token is effectively dead) | all authenticated endpoints | **401** |

---

## 6. Role Management

### 6.1 Role model

- Single table `roles` (`id`, `name` unique). **Single role per user** — `users.role_id` is one nullable FK (`ondelete="SET NULL"`). There is **no** user↔role join table; multi-role is not supported.
- **Default role: `NULL`** — a registered user has no role until an admin approves them.
- Roles are **seeded, not CRUD-managed** (`backend/app/database/seed_roles.py`); there is no role-management API.

### 6.2 Seeded roles (verified order in `seed_roles.py`)

| Position | Role constant | `name` stored | Typical seeded id* |
|---|---|---|---|
| 1 | `ROLE_ADMIN` | `ADMIN` | 1 |
| 2 | `ROLE_CHIEF_DOCTOR` | `CHIEF_DOCTOR` | 2 |
| 3 | `ROLE_GENERAL_DOCTOR` | `GENERAL_DOCTOR` | 3 |
| 4 | `ROLE_SPECIALIST_DOCTOR` | `SPECIALIST_DOCTOR` | 4 |
| 5 | `ROLE_CONSULTING_DOCTOR` | `CONSULTING_DOCTOR` | 5 |
| 6 | `ROLE_RECEPTIONIST` | `RECEPTIONIST` | 6 |
| 7 | `ROLE_DENTAL_ASSISTANT` | `DENTAL_ASSISTANT` | 7 |

\* **IDs are NOT guaranteed.** The seed script does not specify `id`; it inserts autoincrement rows "if absent". On a fresh database the ids are 1–7 in this order, but a reseeded/partially-populated database can shift them. **The backend provides NO `GET /roles` endpoint**, yet every role mutation requires a numeric `role_id`. The frontend hardcodes the mapping in `frontend/src/constants/roles.ts` (`ROLE_IDS`) — see [Risk R3](#r3---no-get-roles-endpoint).

### 6.3 Admin role set (verified)

- **`require_admin`** checks `role.name ∈ {ADMIN, CHIEF_DOCTOR}`.
- **Last-admin protection** (service layer) checks the same two names (`_ADMIN_ROLE_NAMES`).
- The frontend `constants/roles.ts` `ADMIN_ROLES = [ADMIN, CHIEF_DOCTOR]` mirrors this exactly — do not add/remove without a backend change.

### 6.4 Role assignment endpoints

| Operation | Endpoint | Body | Notes |
|---|---|---|---|
| Assign role at approval | `PATCH /auth/users/{id}/approve` | `{role_id}` | Only for non-active users; also flips to active |
| Change role later | `PATCH /users/{id}/role` | `{role_id}` | Admin only; self-change forbidden; last-admin demotion forbidden |

---

## 7. Password Workflow

### 7.1 During create

| Question | Verified answer |
|---|---|
| Is a password required to create an account? | ✅ **Yes, always required.** `UserRegister.password` is mandatory (`...`, no default). |
| Autogenerated / temporary password? | ❌ **No.** The password is always user-supplied (or admin-supplied at register time — but the backend can't tell the difference). |
| Invitation flow (email link, temp token, set-password-after-first-login)? | ❌ **No.** No invitation, no email sending, no "set password" endpoint, no first-login password change. |
| Can an admin create a user without a password? | ❌ **No.** |
| Can the password be changed later? | ❌ **No endpoint exists.** |

### 7.2 Password policy (verified — `UserRegister.password` + `validate_password_complexity`)

| Rule | Value |
|---|---|
| Minimum length | **8** characters |
| Maximum length | **128** characters |
| At least one uppercase letter | ✅ regex `[A-Z]` |
| At least one lowercase letter | ✅ regex `[a-z]` |
| At least one digit | ✅ regex `\d` |
| At least one special (non-alphanumeric) | ✅ regex `[^a-zA-Z0-9]` |
| Prohibited values | None (no deny-list, no username-derived rules, no sequential/space rules) |

⚠️ **Nuance:** Pydantic enforces `min_length`/`max_length` **before** the complexity validator, so a 200-char password fails with a length error even if complexity passes. The complexity regexes are "contains at least one" checks — no other constraints. The frontend RegisterForm schema must mirror all five rules exactly (it already does).

### 7.3 Password storage — frontend implications only

- Passwords are hashed with **bcrypt** (`passlib` `CryptContext`, `schemes=["bcrypt"]`) server-side at registration.
- The frontend must **never** hash, encrypt, or transform the password — send it as-is over HTTPS in the register body (and as the `password` field in the login form).
- The password never appears in any response; no password fields exist in any response schema.

---

## 8. Reset Password

### 8.1 Conclusive finding

> **Reset Password is not supported by the current backend implementation and must not be implemented in the frontend.**

**Verification:** a codebase-wide search across `backend/app/` for `reset`, `forgot`, and `change_password` returns **zero** matches in any router, schema, service, or model (the only `reset` match is an unrelated comment in the billing document-sequence model). There is:
- ❌ No `POST /auth/forgot-password`
- ❌ No `POST /auth/reset-password`
- ❌ No `PATCH /auth/change-password`
- ❌ No admin "reset password" / temporary-password endpoint
- ❌ No `password` field on any admin mutation schema (`ChangeRoleRequest`, `UserApprovalRequest`)

**Frontend status:** the existing `ForgotPasswordPage` (`/auth/forgot-password`) is correctly implemented as an informational page that directs users to contact their administrator — it makes **no API calls** and must stay that way. Do not add a password-reset form, service method, or route until the backend ships one.

---

## 9. Validation Rules

Every rule below is verified from backend schemas/routes. The frontend Zod schemas must mirror these exactly — **no additions, no relaxations**.

### 9.1 Field-level rules

| Field / Param | Where | Rule (verified) | Backend error |
|---|---|---|---|
| `full_name` | `UserRegister` | required; 2–100 chars; normalized (trim + collapse whitespace) | 422 |
| `email` | `UserRegister` | required; valid `EmailStr`; normalized lowercase | 422 |
| `email` uniqueness | service | must not already exist in `users` | **409** `EMAIL_ALREADY_REGISTERED` |
| `password` | `UserRegister` | required; 8–128; upper + lower + digit + special | 422 |
| `role_id` | `UserApprovalRequest` | required; `ge=1` | 422 |
| `role_id` | `ChangeRoleRequest` | required; `gt=0` | 422 |
| `role_id` existence | service | role must exist | **404** `ROLE_NOT_FOUND` |
| `user_id` (path) | auth module (#5, #6) | `ge=1` (`Path(..., ge=1)`) | 422 |
| `user_id` (path) | users module (#8–#11) | plain `int` — **no `ge` constraint**; `0`/negative hits the 404 path | 404 |
| `search` | `GET /users` | optional `str \| None`; substring `ilike` on `full_name` OR `email` (case-insensitive) | — |
| `role_id` | `GET /users` | optional `int \| None`; exact equality filter | — |
| `status` | `GET /users` | optional `str \| None`; exact equality filter. **No enum validation** — an unknown status returns an empty list (`total: 0`), **not** an error | — |
| `page` | `GET /users` | optional; `ge=1` (default `1`) | 422 |
| `page_size` | `GET /users` | optional; `ge=1`, `le=100` (default `10`) | 422 |
| Extra body fields | `UserRegister`, `UserApprovalRequest` | **rejected** (`extra="forbid"`) | 422 |

### 9.2 Rules the frontend must NOT invent

- No phone number field exists anywhere in the user schemas — do not add one.
- No username field — email is the identifier.
- No date-of-birth / gender / address on users (patients have their own module).
- No `GET /roles` — role options are derived from seeded constants (see R3).

---

## 10. RBAC Review

### 10.1 Permission matrix (verified)

| Operation | Endpoint | Allowed roles | Self-operation | Special guards |
|---|---|---|---|---|
| List users | `GET /users` | ADMIN, CHIEF_DOCTOR | n/a | — |
| View user detail | `GET /users/{id}` | ADMIN, CHIEF_DOCTOR | n/a | — |
| Create user | — | **Not possible** (only public `POST /auth/register` → pending) | n/a | — |
| Edit user | — | **Not possible** (no endpoint) | n/a | — |
| Approve / assign role + activate | `PATCH /auth/users/{id}/approve` | ADMIN, CHIEF_DOCTOR | n/a (target can't be active) | — |
| Change role | `PATCH /users/{id}/role` | ADMIN, CHIEF_DOCTOR | ❌ **400** `SELF_ROLE_CHANGE_NOT_ALLOWED` | Last-admin demotion → 409 |
| Activate | `PATCH /users/{id}/activate` | ADMIN, CHIEF_DOCTOR | ❌ **400** `SELF_ACTIVATION_NOT_ALLOWED` | Already active → 400 |
| Deactivate | `PATCH /users/{id}/deactivate` (+ legacy `/auth/.../deactivate`) | ADMIN, CHIEF_DOCTOR | ❌ **400** `SELF_DEACTIVATION_NOT_ALLOWED` | Already inactive → 400; last admin → 409 |
| Reset password | — | **Not possible** | — | — |
| Register | `POST /auth/register` | **public** | n/a | Duplicate email → 409 |
| Login | `POST /auth/login` | **public** (account must be active) | n/a | 401 invalid creds; 403 inactive |
| View own profile | `GET /auth/me` | any authenticated user (no role needed) | n/a | — |
| List pending | `GET /auth/users/pending` | ADMIN, CHIEF_DOCTOR | n/a | — |

### 10.2 Enforcement points (verified)

- **Route level:** `Depends(require_admin)` on every `/users/*` endpoint and on `/auth/users/pending`, `/auth/users/{id}/approve`, `/auth/users/{id}/deactivate`.
- **Service level (defense in depth):** last-admin protection in `users/service.py` and `auth/service.py`; self-operation checks in `users/routes.py` (role/activate/deactivate) and `auth/routes.py` (deactivate).
- **403 responses:** produced by `require_roles` as an `HTTPException` → global handler returns `{"success": false, "message": "Role not assigned" | "Insufficient permissions", "details": null}`.
- **No permission endpoint:** the backend exposes no permission-matrix API; the frontend cannot enumerate "what can I do" — it must react to 403s.

---

## 11. Error Contract

### 11.1 Envelope (verified — `backend/app/core/exception_handlers.py`)

**Every error response** — domain exceptions, `HTTPException`, Pydantic 422s, and unhandled 500s — has the exact shape:

```json
{
  "success": false,
  "message": "<human-readable string>",
  "details": <null | array | object>
}
```

- For **422 validation failures**, `details` is a **Pydantic v2 error array**: `[{"loc": ["body", "full_name"], "msg": "...", "type": "..."}]`. The frontend `parseApiError` already flattens these into a `fieldErrors: Record<string, string>` map keyed by the last `loc` segment.
- For all other errors, `details` is `null`.
- ⚠️ **Important:** the backend's exception classes define a `code` (e.g. `USER_NOT_FOUND`), but the global handlers serialize **only `message` + `details`** — **the error code is NOT present in the HTTP response body**. The frontend cannot branch on error codes; it must branch on **HTTP status** (and display `message`).

### 11.2 Status-code reference (verified mappings)

| Status | Meaning | `message` examples (exact strings) | Source |
|---|---|---|---|
| **400** | Invalid operation / self-operation / already-in-this-state | `"User is already active"`, `"User is already inactive"`, `"You cannot change your own role"`, `"You cannot deactivate your own account"`, `"You cannot activate your own account"` | users + auth exception maps |
| **401** | Missing/invalid/expired token; deactivated account hitting API; bad login credentials | `"Not authenticated"` (no token), `"Could not validate credentials"` (bad/expired token or inactive user), `"Invalid email or password"` (login) | `get_current_user` HTTPException; `INVALID_CREDENTIALS` |
| **403** | Authenticated but not permitted; inactive account at login | `"Role not assigned"`, `"Insufficient permissions"`, `"Account is inactive"` | `require_roles`; `INACTIVE_ACCOUNT` |
| **404** | Resource not found | `"User not found"`, `"Role not found"` | user/auth maps |
| **409** | Conflict | `"Email already registered"`, `"Cannot modify the last remaining admin account"` | auth + user maps |
| **422** | Validation failure (schema + query params) | `"Request validation failed"` + `details` array | `validation_exception_handler` |
| **500** | Unexpected server error | `"Role change failed. Please try again later."`, `"Activation failed. Please try again later."`, `"Deactivation failed. Please try again later."`, `"Registration failed. Please try again later."`, `"Approval failed. Please try again later."`, `"An unexpected error occurred"` | domain maps + `unhandled_exception_handler` |

### 11.3 Frontend handling implications (verified against existing infra)

- `frontend/src/services/api.ts`: axios instance, base URL `http://127.0.0.1:8000`, 15s timeout, attaches `Bearer` token, and treats **any 401 except on `/auth/login`** as session-expiry (fires the registered unauthorized handler → logout + redirect). Login-page 401s are surfaced to the form instead.
- `frontend/src/services/apiError.ts`: `parseApiError` classifies errors into `kind` (`auth`, `forbidden`, `not-found`, `validation`, `client`, `server`, `timeout`, `offline`, `backend`) and produces `{message, fieldErrors, status, kind}`. **Reuse this everywhere** — it already matches the envelope above exactly.
- Because the envelope is uniform, one error banner component + `apiErrorMessage()` is sufficient for all user-module mutations.

---

## 12. Pagination / Filtering / Search

### 12.1 `GET /users` (verified — `users/routes.py` + `users/repository.py`)

| Parameter | Type | Default | Rules | Semantics |
|---|---|---|---|---|
| `search` | `string` | `null` | — | **Case-insensitive substring** match (`ilike '%term%'`) on `full_name` **OR** `email` |
| `role_id` | `integer` | `null` | — | Exact `users.role_id == role_id` |
| `status` | `string` | `null` | — | Exact `users.status == status`. **No enum validation** — send only `pending` \| `active` \| `inactive`; anything else returns an empty result set |
| `page` | `integer` | `1` | `ge=1` | 1-based page |
| `page_size` | `integer` | `10` | `ge=1`, `le=100` | Rows per page |

- **Sorting:** **fixed `users.id DESC`** — there are **no sort parameters** and no sort API. Newest users first.
- **Response** `UserListResponse`:
  ```json
  {
    "items": [ /* UserListItem, see below */ ],
    "total": 42,      // count AFTER filters, BEFORE pagination
    "page": 1,        // echoes request
    "page_size": 10   // echoes request
  }
  ```
- `total` is the filtered count; **no** `pages`/`has_next` metadata — the frontend computes page count as `Math.ceil(total / page_size)` (already done in `UserListContainer`).

**`UserListItem`** (exact field set):

| Field | Type | Nullable |
|---|---|---|
| `id` | `integer` | ❌ |
| `full_name` | `string` | ❌ |
| `email` | `string` | ❌ |
| `status` | `string` | ❌ |
| `is_active` | `boolean` | ❌ |
| `role_id` | `integer` | ✅ (`null` = no role) |
| `role_name` | `string` | ✅ |
| `last_login_at` | `datetime` (ISO 8601 UTC) | ✅ |
| `created_at` | `datetime` | ✅ |

### 12.2 `GET /users/{user_id}` — `UserDetailResponse`

Adds `created_by`, `updated_at`, `updated_by` to the list item fields (all `int \| null` / `datetime \| null`). **No `role` object nesting** — the role is flattened to `role_id` + `role_name`.

### 12.3 `GET /auth/users/pending`

- **Unpaginated** bare array of `PendingUserResponse {id, full_name, email, status}` — no search/filter/sort parameters, no pagination envelope. Order is unspecified (DB row order).

---

## 13. Frontend Impact Analysis

### 13.1 Gap summary → what Phase 1D / 1E actually require

| Specified phase | Backend reality | Frontend decision required |
|---|---|---|
| Phase 1D Create User | No admin create endpoint | **Either** (a) ship an admin **"Add user"** flow that calls `POST /auth/register` (pending) then `PATCH /auth/users/{id}/approve` (role + activate) — fully backend-supported today; **or** (b) block the phase pending a new backend `POST /users` endpoint. Option (a) is recommended — see §15. |
| Phase 1E Edit User | No edit endpoint | **Blocked.** Do not build an edit form. The only "editing" surface today is the role dialog (already shipped). |
| Reset Password | Not supported | Already correctly handled by `ForgotPasswordPage` (informational). No work. |

### 13.2 Existing frontend code — **fully reusable** (verified present)

**Services** (`src/services/`)
- `userService.ts` — `list`, `get`, `changeRole`, `activate`, `deactivate` (mirrors `/users` exactly; docs note the missing create/update endpoints)
- `authService.ts` — `login`, `register`, `getMe`, `fetchPendingUsers`, `approveUser`, `deactivateUser`
- `api.ts` / `apiError.ts` — transport, 401 handling, `parseApiError` (envelope + field errors)

**Types & constants**
- `types/user.ts` — `UserListItem`, `UserListResponse`, `UserDetailResponse`, `ChangeRoleRequest`, `UserActionResponse`, `UserListParams`, `RoleFormValues`
- `types/auth.ts` — `RegisterRequest`, `RegisterResponse`, `UserApprovalRequest/Response`, `PendingUserResponse`, `CurrentUserResponse`, `UserStatus`
- `constants/user.ts` — page sizes, status filters/labels, `USER_ROLE_OPTIONS`, validation limits
- `constants/roles.ts` — `ROLES`, `ROLE_LABELS`, `ROLE_IDS`, `ADMIN_ROLES`, `isAdminRole`

**Validation / utils**
- `utils/userFormSchema.ts` — `roleAssignmentSchema` (mirrors `ChangeRoleRequest` `gt=0`)
- `utils/userFormUtils.ts` — `responseToRoleForm`, `roleFormToPayload`, `isRoleUnchanged`
- Registration validation already exists in the RegisterForm schema (mirrors the password policy)

**Hooks** (`src/hooks/users/`)
- `useUsers`, `useUser`, `useUsersSearch`, `useUserFilters`, `useUserMutations` (`useActivateUser`, `useDeactivateUser`, `useChangeUserRole`)

**Components / containers / pages**
- `components/users/` — `UserTable`, `UserToolbar`, `UserFilters`, `UserHeader`, `UserProfileCard`, `UserStatusCard`, `UserAccountCard`, `UserStatusDialog`, `UserRoleDialog`
- `components/users/containers/` — `UserListContainer`, `UserDetailsContainer`
- `components/admin/` — `PendingUsersContainer`
- `pages/users/` — `UserListPage`, `UserDetailsPage`; `pages/admin/PendingUsersPage`; `pages/auth/RegisterPage`, `LoginPage`, `ForgotPasswordPage`
- Generic library: `DataTable`, `Drawer`, `Modal`, `Pagination`, `SearchBar`, `EmptyState`, `Form/*` primitives, `StatusBadge`, `Toast`, `UserSearchSelect`

### 13.3 New frontend work required (if Phase 1D is re-scoped to "Add User")

| Category | Work | Notes |
|---|---|---|
| **Services** | 1 new method (optional convenience): `authService.registerForApproval(payload)` → thin wrapper over existing `register`; **no new endpoints to call** | Reuse existing `register` + `approveUser` |
| **Hooks** | Optional: `useRegisterUser()` + `useApproveUser()` React Query hooks, or reuse the auth-module hooks if present | Mutation invalidation should target `['users']` + `['pending']` keys (matches existing pattern) |
| **Types** | `AddUserFormValues` (UI form: `full_name`, `email`, `password`, `role_id`; `confirm_password` UI-only) | No new API types needed — reuses `RegisterRequest` + `UserApprovalRequest` |
| **Schemas** | `addUserSchema` — mirrors §3.3 Zod example (name/email/password) + role select mirroring `roleAssignmentSchema` | Must not relax backend rules |
| **Components** | `UserCreateDialog` (form + role select + validation) | Reuse `Modal`, `Form/*`, `Select`, `PasswordInput`, `USER_ROLE_OPTIONS` |
| **Containers** | `UserCreateContainer` wiring register → (optional auto-navigate to approve) → query invalidation | Follow `UserListContainer` patterns |
| **Pages** | None strictly required (can mount the dialog from `UserListPage`/toolbar) | — |
| **Tests** | Unit: schema edge cases (mirror backend rules); component tests for the dialog; container test mocking `register` + `approveUser` | Follow existing `*.test.tsx` conventions |

**Deliberately NOT created** (no backend contract): edit-user form, password-reset form, any `PUT/PATCH /users/{id}` service method.

---

## 14. Risks

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

| ID | Risk | Severity | Detail (verified) | Mitigation |
|---|---|---|---|---|
| R1 | **No admin create-user endpoint** | 🔴 | Phase 1D as specified cannot ship. Only public self-registration + admin approval exist. | Re-scope Phase 1D to the register→approve flow (§15). Do not invent `POST /users`. |
| R2 | **No edit-user endpoint** | 🔴 | Phase 1E cannot ship. `full_name`/`email` are immutable. | Hold Phase 1E; keep the role dialog as the only edit surface. |
| R3 | **No `GET /roles` endpoint; hardcoded `ROLE_IDS`** | 🟠 | Backend requires numeric `role_id` everywhere, but never serves the role list. `frontend/src/constants/roles.ts` hardcodes ids 1–7 from seed order. A reseeded/partially-populated DB shifts ids → approve/role-change silently fails (404 ROLE_NOT_FOUND) or assigns wrong roles. | Document as known limitation; centralize the mapping (already done); flag backend `GET /roles` as the only necessary backend addition (§15). |
| R4 | **No reset/change-password endpoint** | 🟠 | Users can never change passwords; deactivated users cannot self-recover. | Keep `ForgotPasswordPage` informational; do not build reset UI. |
| R5 | **`GET /auth/me` omits `role`** | 🟠 | Client cannot derive permissions from the profile endpoint; role-based UI gating must fall back to data from `/users` lists or backend 403s. | Route-guard by 403 handling (existing pattern); never assume role from `/auth/me`. |
| R6 | **Error codes stripped from responses** | 🟠 | Domain exceptions define codes (`USER_NOT_FOUND`, …) but the global handler serializes only `message` + `details`; frontend cannot match on codes. | Branch on HTTP status; display `message` verbatim; keep `parseApiError`. |
| R7 | **Duplicate endpoints for deactivation** | 🟡 | `/auth/users/{id}/deactivate` and `/users/{id}/deactivate` both exist with slightly different messages; both enforce self-deactivation; only the users variant returns `user_id`. | Standardize the frontend on `userService.deactivate`; keep `authService.deactivateUser` only if PendingUsersPage uses it. |
| R8 | **Status filter accepts any string** | 🟡 | Unknown `status` values silently return empty lists instead of 422 — a typo looks like "no users". | Constrain the frontend select to `pending`/`active`/`inactive` (already done via `USER_STATUS_FILTERS`). |
| R9 | **No pagination on pending list** | 🟡 | `GET /auth/users/pending` returns all pending users — fine today, unbounded at scale. | Accept for now; do not implement client-side pagination against a bare array. |
| R10 | **Deactivating a user kills their token immediately** | 🟡 | `get_current_user` rejects `is_active=false`; the frontend 401 handler will bounce them to login. | Expected behavior; the 401 → session-expiry path already handles it. |
| R11 | **No hard delete** | 🔵 | Users are never removed; deactivation is the only removal mechanism. | Do not offer a delete action in the UI. |
| R12 | **`UserListQueryParams` schema is dead code** | 🔵 | Defined in `schemas.py` but unused (the route uses individual `Query` params). | Ignore; do not model it in TS. |
| R13 | **`page`/`page_size` bounds** | 🔵 | `page_size` capped at 100; page ≥ 1. Passing 0/101 → 422. | Frontend constants already enforce (`USER_MAX_PAGE_SIZE = 100`). |

---

## 15. Recommendations

### 15.1 Blocking decisions (required before Phase 1D/1E implementation)

1. **Re-scope Phase 1D → "Add User" (register + approve).** The only backend-supported path to a new user is `POST /auth/register` (pending) followed by `PATCH /auth/users/{id}/approve` with a role. Build a single `UserCreateDialog` that submits the register payload, then either (a) auto-approves immediately with the chosen role, or (b) surfaces the pending queue for a separate approval step. (a) gives a true "create an active user" UX within the existing contract.
2. **Formally park Phase 1E.** There is no edit endpoint; building one requires a backend change. Until then, the role dialog remains the only edit surface. If product insists on editing `full_name`/`email`, file a backend requirement — **the frontend must not fake it**.
3. **Confirm reset password is out of scope.** Already reflected by `ForgotPasswordPage`; no further work.

### 15.2 The single necessary backend addition

- **`GET /roles`** (admin) returning `[{id, name}]` — closes Risk R3 and lets the frontend drop the hardcoded `ROLE_IDS` mapping. This is the **only** backend change this review recommends; everything else is frontend-side.

### 15.3 Frontend engineering recommendations

| Area | Recommendation |
|---|---|
| Architecture | Keep the container pattern: page = thin wrapper; container owns queries/mutations/dialogs; services stay endpoint-shaped; schemas are the single validation source. Follow `UserListContainer`/`UserDetailsContainer` exactly for the new Add-User container. |
| Reuse | Reuse `USER_ROLE_OPTIONS`, `USER_STATUS_FILTERS`, `parseApiError`, `DataTable`, `Modal` + `Form/*`, and `Pagination` — do not create parallel variants. |
| Validation | Centralize the register password rules in a shared `passwordSchema` (used by RegisterForm **and** the new Add-User dialog) so the §9.1 rules can never drift between surfaces. |
| Error handling | Surface `message` from `parseApiError` verbatim for mutations (the backend messages are user-ready). On 409 duplicate email, keep the dialog open with the inline error; on 401/403 use the existing interceptor + `apiErrorMessage`. |
| Consistency | Mirror backend naming in types (`full_name`, `role_id`, …) — the codebase already does; keep it that way. |
| Accessibility | Form dialogs must trap focus (existing `Modal`), announce errors via `role="alert"` (existing pattern in `UserRoleDialog`), and disable submit while pending (existing `Button loading` prop). |
| Maintainability | Add the documented limitation comments (R3/R6/R9) next to the constants and services that encode them, so future devs don't "fix" them into contract mismatches. |

---

## Appendix A — Source Map (verification evidence)

| Claim | Verified in |
|---|---|
| Auth endpoints + status codes | `backend/app/modules/auth/routes.py` (register 201, pending 200, approve 200, deactivate 200, login 200, me 200) |
| Users endpoints | `backend/app/modules/users/routes.py` (list/detail/role/activate/deactivate, all `require_admin`) |
| `UserRegister` fields + password policy | `backend/app/modules/auth/schemas.py` (`full_name` 2–100 + normalization, `email` `EmailStr` + lowercase, `password` 8–128 + upper/lower/digit/special) |
| `extra="forbid"` | `auth/schemas.py` (`UserRegister`, `UserApprovalRequest`) |
| Register → pending + duplicate-email 409 | `backend/app/modules/auth/service.py` (`register_user`) |
| Approve logic + audit fields | `backend/app/modules/auth/service.py` (`approve_user`: role_id + status active + created_by/updated_by) |
| No reset/change-password code | Search across `backend/app/**/*.py` for `reset|forgot|change_password` → no matches |
| No admin create/edit endpoint | Router inventories in `auth/routes.py`, `users/routes.py`, `main.py` (`include_router` list) |
| Status model + DB check constraint | `backend/app/modules/auth/models.py` (`User.status`, `is_active`, `ck_users_status_valid`) |
| Role seeding + no explicit ids | `backend/app/database/seed_roles.py` |
| Admin role set + 403s | `backend/app/modules/rbac/permissions.py` (`_ADMIN_ROLES`, `require_roles`) |
| JWT + token claims + bcrypt | `backend/app/core/security.py`; `backend/app/core/config.py` (`ACCESS_TOKEN_EXPIRE_MINUTES=30`) |
| `get_current_user` rejects inactive | `backend/app/dependencies/auth.py` |
| Error envelope + status maps | `backend/app/core/exception_handlers.py` (`_error_response`, `_AUTH_EXCEPTION_MAP`, `_USER_EXCEPTION_MAP`, `validation_exception_handler`) |
| List filters + fixed `id DESC` ordering | `backend/app/modules/users/repository.py` (`get_users`) |
| Last-admin protection | `backend/app/modules/users/service.py` (`_is_last_admin`, `change_user_role_service`, `deactivate_user_service`); `auth/service.py` (`deactivate_user`) |
| Self-operation guards | `users/routes.py` (role/activate/deactivate), `auth/routes.py` (deactivate) |
| User/user-list schemas | `backend/app/modules/users/schemas.py` |
| Existing frontend contract alignment | `frontend/src/types/user.ts`, `frontend/src/services/userService.ts`, `frontend/src/services/authService.ts`, `frontend/src/constants/roles.ts` |

---

*End of review. This document is the authoritative frontend contract for the User Management module and requires no backend source consultation for the scoped work.*
