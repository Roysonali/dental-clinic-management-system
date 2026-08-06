# Sprint 11B — Phase 1E: User Editing — Backend Contract Review

> **Date:** 2026-08-06
> **Type:** Independent backend contract review (no frontend implementation)
> **Method:** Every claim below is verified against the actual backend source in `backend/app` — not API documentation. Source references are given per claim (`file:line`-style paths). Companion to `User-Module-Backend-Contract-Review.md` (Sprint 11B Add User); this document supersedes the Edit-User conclusions with endpoint-level detail.
>
> **Verdict up front:** the backend does **NOT** support editing user identity/profile fields. There is no `PATCH /users/{id}`, no `PUT /users/{id}`, no profile-update, password-change or email-change endpoint anywhere in the application. The only user-record mutations that exist are **role assignment**, **status transitions (activate/deactivate)** and **approval** — all of which the frontend has already implemented (Phase 1A role dialog, status dialog, pending-approval UI, Phase 1D Add User).

---

## 1. Executive Summary

**Does the backend support editing users?**

- **Profile editing (full_name, email, password): NO.** Verified: the `users` module exposes exactly five endpoints — list, detail, role-change, activate, deactivate (`backend/app/modules/users/routes.py`). The `auth` module exposes six — register, pending-list, approve, deactivate, login, me (`backend/app/modules/auth/routes.py`). **No endpoint accepts `full_name`, `email` or `password` as an update.** The only place these fields are written is account creation (`POST /auth/register`) — and even there `email` and `full_name` are never updated after creation.
- **What IS editable (verified):**
  | Attribute | How | Endpoint |
  |---|---|---|
  | `role_id` | Admin assigns/replaces role | `PATCH /users/{user_id}/role` or `PATCH /auth/users/{user_id}/approve` (pending only) |
  | `status` | activate / deactivate | `PATCH /users/{user_id}/activate` · `PATCH /users/{user_id}/deactivate` · `PATCH /auth/users/{user_id}/deactivate` |
  | `is_active` | side-effect of every status/approve mutation | (same endpoints) |
- **Immutable via the API (verified):** `full_name`, `email`, `password_hash`, `id`, `created_by`, `created_at`. `updated_by`/`updated_at`/`last_login_at` are server-managed and never client-settable.

**Is the functionality production-ready?**
The mutation surface that *does* exist (role/status/approval) is production-ready: domain exceptions with centralized handlers, transaction boundaries owned by services, `updated_by` audit columns, last-admin protection, self-operation guards, and a stable error envelope. It is simply **not** a general "Edit User" capability.

---

## 2. Endpoint Inventory

All user-related endpoints registered in `backend/main.py` (`app.include_router(auth_router)`, `app.include_router(users_router)`). All paths relative to `/`.

| # | Method | Endpoint | Purpose | Auth | Permission | Request body | Response | Status codes |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/register` | Create account (pending) | **None (public)** | — | `UserRegister` | `RegisterResponse` (201) | 201, 409, 422 |
| 2 | GET | `/auth/users/pending` | List pending approvals | JWT | ADMIN / CHIEF_DOCTOR | — | `List[PendingUserResponse]` | 200, 401, 403 |
| 3 | PATCH | `/auth/users/{user_id}/approve` | Approve + assign role | JWT | ADMIN / CHIEF_DOCTOR | `UserApprovalRequest` | `UserApprovalResponse` | 200, 400, 401, 403, 404, 422 |
| 4 | PATCH | `/auth/users/{user_id}/deactivate` | Deactivate (status-based) | JWT | ADMIN / CHIEF_DOCTOR | — | `UserApprovalResponse` | 200, 400, 401, 403, 404⁽ᵃ⁾ |
| 5 | POST | `/auth/login` | Login (OAuth2 form) | **None** | — | `OAuth2PasswordRequestForm` | `LoginResponse` | 200, 401, 403, 422 |
| 6 | GET | `/auth/me` | Current user profile | JWT | any authenticated | — | `CurrentUserResponse` | 200, 401 |
| 7 | GET | `/users` | List users (filter/paginate) | JWT | ADMIN / CHIEF_DOCTOR | — (query) | `UserListResponse` | 200, 401, 403 |
| 8 | GET | `/users/{user_id}` | User detail | JWT | ADMIN / CHIEF_DOCTOR | — | `UserDetailResponse` | 200, 401, 403, 404 |
| 9 | PATCH | `/users/{user_id}/role` | Change role | JWT | ADMIN / CHIEF_DOCTOR | `ChangeRoleRequest` | `UserActionResponse` | 200, 400, 401, 403, 404, 409, 422 |
| 10 | PATCH | `/users/{user_id}/activate` | Activate | JWT | ADMIN / CHIEF_DOCTOR | — | `UserActionResponse` | 200, 400, 401, 403, 404 |
| 11 | PATCH | `/users/{user_id}/deactivate` | Deactivate (is_active-based) | JWT | ADMIN / CHIEF_DOCTOR | — | `UserActionResponse` | 200, 400, 401, 403, 404, 409 |

**Editing-relevant endpoints are #3, #4, #9, #10, #11 only.** Path `user_id` in the users module is validated by the route signature (`user_id: int`); the auth module additionally documents `ge=1`.

⁽ᵃ⁾ 409 is technically reachable on #4: `auth/service.py::deactivate_user` embeds its own last-admin guard (`LastAdminCannotBeModified` → 409 via the users exception handler), though in practice the self-deactivation check and the inactive-status check make it unreachable. #10 (activate) has **no** last-admin guard, so 409 does not apply there.

**Non-editing endpoints referenced for completeness:** #1 (create), #2 (read), #5/#6 (auth/identity), #7/#8 (read).

---

## 3. Request / Response Schemas

All schemas in `backend/app/modules/auth/schemas.py` and `backend/app/modules/users/schemas.py`.

### 3.1 `UserRegister` (POST /auth/register — the ONLY user-creation schema)

| Field | Type | Required | Constraints / validators | Notes |
|---|---|---|---|---|
| `full_name` | str | yes | `min_length=2`, `max_length=100`; validator `normalize_full_name` strips + collapses internal whitespace (`" ".join(value.strip().split())`) | **Written only at creation. Never updatable.** |
| `email` | `EmailStr` | yes | Pydantic email validation; validator `normalize_email` → `value.strip().lower()` | **Unique (`users.email` UNIQUE constraint). Written only at creation.** |
| `password` | str | yes | `min_length=8`, `max_length=128`; validator `validate_password_complexity` requires ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special (`[^a-zA-Z0-9]`) | **Only ever hashed into `password_hash` at creation. No change-password path.** |
| `model_config` | — | — | `extra="forbid"` | Unknown fields → 422. |

### 3.2 Update-family schemas (complete set — there are only two)

**`ChangeRoleRequest`** (`users/schemas.py`) — PATCH `/users/{user_id}/role`
```python
class ChangeRoleRequest(BaseModel):
    role_id: int = Field(gt=0)
```
- `role_id`: required int, `gt=0`. No `extra` config → **extra fields are silently ignored** (Pydantic v2 default `ignore`). Note this is *less* strict than `UserRegister`/`UserApprovalRequest` (`extra="forbid"`).

**`UserApprovalRequest`** (`auth/schemas.py`) — PATCH `/auth/users/{user_id}/approve`
```python
class UserApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_id: int = Field(..., ge=1)
```
- `role_id`: required int, `ge=1`, `extra="forbid"`.

**There is NO update schema for `full_name`, `email`, or `password` — no `UserUpdate`, no `ProfileUpdate`, no `ChangePassword` schema exists in either module.**

### 3.3 Read/response schemas (immutable, for the Edit-User display)

- `CurrentUserResponse` (`auth/schemas.py`): `{id, full_name, email, status}` — **no role, no timestamps**. `from_attributes`, `frozen`.
- `PendingUserResponse` (`auth/schemas.py`): `{id, full_name, email, status}`.
- `UserListItem` (`users/schemas.py`): `{id, full_name, email, status, is_active, role_id|null, role_name|null, last_login_at|null, created_at|null}`.
- `UserDetailResponse` (`users/schemas.py`): adds `{created_by|null, updated_at|null, updated_by|null}`.
- `UserActionResponse` (`users/schemas.py`): `{user_id, message}`.
- `UserApprovalResponse` (`auth/schemas.py`): `{message}`.
- `LoginResponse` (`auth/schemas.py`): `{access_token, token_type:"bearer"}`.

### 3.4 Create vs Update vs Approve vs Profile — differences

| Aspect | Create (register) | Update (role) | Approve | Profile update |
|---|---|---|---|---|
| Exists? | ✅ | ✅ | ✅ | ❌ **does not exist** |
| `full_name` | write, normalized | n/a | n/a | ❌ |
| `email` | write, normalized, unique-checked | n/a | n/a | ❌ |
| `password` | write, hashed | n/a | n/a | ❌ |
| `role_id` | never in payload | `gt=0` | `ge=1` | ❌ |
| `status` | fixed `pending` | n/a | → `active` | ❌ |
| `extra` | forbid | ignore (silent) | forbid | n/a |

---

## 4. Business Rules (verified)

1. **Immutable identity.** `full_name`, `email`, `password_hash` are set exactly once at registration and never mutated by any endpoint (`auth/service.py::register_user` is the sole writer; `users/repository.py` offers only `update_user_role` and `update_user_status`).
2. **Email uniqueness** is enforced at registration by a service-level lookup (`get_user_by_email` → `EmailAlreadyRegistered`, 409) **and** a DB UNIQUE constraint on `users.email`. There is no re-check anywhere else because no email-update path exists.
3. **Status lifecycle.** Valid states `pending | active | inactive` (DB `CheckConstraint ck_users_status_valid` in `auth/models.py`). Verified transitions:
   - `pending → active`: `approve` (assigns role) or `activate` (no role change).
   - `pending → inactive`: `PATCH /auth/users/{id}/deactivate` (status-based check allows it).
   - `active → inactive`: both deactivate endpoints.
   - `inactive → active`: `activate`.
   - Blocked: approve on already-active (400 `UserAlreadyActive`); activate on already-active (400); users-module deactivate on `is_active=False` (400 `UserAlreadyInactive` — **pending users included**, because `is_active=False`); auth-module deactivate on status `inactive` (400).
   - ⚠ **Quirk (verified):** `activate` on a pending user activates it **without assigning a role** (`users/service.py::activate_user_service` does not touch `role_id`). Such a user is active with `role_id=NULL` and will get **403 "Role not assigned"** on every `require_admin`/`require_roles` check.
4. **Self-operation guards (route level, users module).** Admin cannot change their own role, activate themselves, or deactivate themselves → 400 `SELF_*_NOT_ALLOWED` (`users/routes.py`). The auth-module deactivate route also blocks self-deactivation.
5. **Last-admin protection (409 `LAST_ADMIN_CANNOT_BE_MODIFIED`).** Both `change_user_role_service` (admin→non-admin when target is the last admin) and `deactivate_user_service` (`users/service.py`) block mutations that would leave zero admins. Admin roles = `{ADMIN, CHIEF_DOCTOR}` (`_ADMIN_ROLE_NAMES`, matching `constants.py`). `count_admin_users` counts by **role name**, not id (`users/repository.py`).
6. **Role existence** is validated against the `roles` table → 404 `ROLE_NOT_FOUND` if absent.
7. **Approval semantics.** `approve_user` sets `role_id`, `status=active`, `is_active=True`; sets `created_by` (only if null — i.e., the first approver) and `updated_by`. Re-approving an active user is blocked (400).
8. **Audit trail** = column-level only: every users-module mutation writes `updated_by = current_admin.id`; approve also writes `created_by`; `updated_at` is a server-side `onupdate=func.now()`. **There is no user-audit log table or event stream.**
9. **Concurrency** = last-write-wins. No version column, no ETag/If-Match, no optimistic locking on `users`.
10. **Activation does not require a role; approval requires one** (verified — `UserApprovalRequest.role_id` is required; `activate` takes no body).

---

## 5. RBAC Review (verified from `rbac/permissions.py`, `dependencies/auth.py`)

**Access model:** every mutating/list/detail user endpoint depends on `require_admin` → `require_roles(["ADMIN", "CHIEF_DOCTOR"])` → 403 otherwise. `require_admin` uses a **frozenset of role names** `{ADMIN, CHIEF_DOCTOR}`; a user with `role=NULL` gets 403 `"Role not assigned"`.

| Actor → Action | Verified result |
|---|---|
| ADMIN edits ADMIN | Only role/status via the mutation endpoints; **self-ops blocked (400)**; last-admin protected (409); no profile editing exists for anyone |
| ADMIN edits RECEPTIONIST / DOCTOR / any non-admin | Role change + activate/deactivate allowed (subject to status/role rules) |
| CHIEF_DOCTOR | Same as ADMIN — it is a member of `require_admin` |
| RECEPTIONIST edits anyone | **403** — not in `require_admin` |
| DOCTOR (general/specialist/consulting) edits anyone | **403** |
| DENTAL_ASSISTANT edits anyone | **403** |
| User edits themselves | No self-edit endpoint exists at all. `GET /auth/me` is the only self endpoint (read-only, no `role` field). |
| Anonymous | 401 on all JWT-protected endpoints; register/login are public |

**Authentication (`get_current_user`):** JWT `sub` = email → DB lookup → **must be `is_active=True`**, otherwise 401 `"Could not validate credentials"` (pending and inactive users are hard-blocked from every API call). Tokens: HS256/384/512, 30-minute expiry, `iat`/`exp`/`jti` claims (`core/security.py`).

---

## 6. Validation Review (per editable field)

| Field | Endpoint | Rules (backend) | Frontend mirror (existing) |
|---|---|---|---|
| `role_id` | `/users/{id}/role` | int `gt=0`; role must exist (404) | `roleAssignmentSchema` (`utils/userFormSchema.ts`) — `^\d+$` and `>= ROLE_ID_MIN` |
| `role_id` | `/auth/users/{id}/approve` | int `ge=1`; role must exist (404) | `userCreateSchema.role_id` reuses `roleAssignmentSchema` |
| (status actions) | activate/deactivate | no body; target must exist and be in a valid pre-state (400) | `UserStatusDialog` flows |
| **`full_name` / `email` / `password`** | **—** | **No validation exists because no update endpoint exists.** The only validators are on `UserRegister` (creation): 2–100 chars normalized; `EmailStr` + lowercase; 8–128 + upper/lower/digit/special. | Register/Add-User forms only |

Cross-field validation: none in the update family (single-field payloads). Uniqueness: DB-level only, enforced at creation.

---

## 7. Error Handling

Envelope (verified in `core/exception_handlers.py::_error_response`): `{"success": false, "message": str, "details": <obj|null>}`. **Domain error codes (e.g. `USER_NOT_FOUND`) exist on exception objects but are NOT serialized** — the frontend must branch on HTTP status and `message` (this matches `parseApiError` today).

| Status | Meaning | Trigger (verified) | Frontend strategy (existing) |
|---|---|---|---|
| 400 | Invalid operation | already active/inactive; self role/activate/deactivate | banner via `parseApiError().message`; keep dialog open |
| 401 | Bad/expired token; **user not active** | `get_current_user` failures (`"Could not validate credentials"`) | `parseApiError` `kind='auth'` → session-expired redirect (existing) |
| 403 | Not an admin / no role | `require_roles` (`"Role not assigned"`, `"Insufficient permissions"`); login on inactive account | `kind='forbidden'` → "insufficient permissions" state (existing) |
| 404 | User or role not found | `UserNotFound`, `RoleNotFound` | `kind='not-found'` |
| 409 | Duplicate email (register) / last-admin (role change, deactivate) | `EmailAlreadyRegistered`, `LastAdminCannotBeModified` | conflict banner; **disable last-admin destructive actions** |
| 422 | Request validation | Pydantic `RequestValidationError`; `details` = array of `{loc, msg, type}` (sanitized) | `fieldErrors` → inline field errors (existing) |
| 500 | Unexpected domain failure / unhandled | `*Failed` exceptions, generic handler | generic error banner |

422 `details` shape (verified): `[{"loc": ["body","role_id"], "msg": "...", "type": "..."}, ...]` — `parseApiError` already converts these to `{field: msg}`.

---

## 8. Repository & Service Flow (update pipeline)

**Role change** (`change_user_role_service`):
```
Router (users/routes.py) ─ self-check ─> Service ─> get_user_by_id (404)
                                                  ─> get_role_by_id (404)
                                                  ─> last-admin check (409)
                                                  ─> repository.update_user_role (flush, sets role_id + updated_by)
                                                  ─> db.commit()   (service-owned)
                                                  ─> UserActionResponse{user_id, message:"Role updated successfully"}
```
Rollback: on known exceptions → `db.rollback()` then re-raise; unexpected → rollback + `RoleChangeFailed` (500). Transaction boundary = the service; repository only flushes.

**Activate / Deactivate (users module)**: same shape; `update_user_status(status, is_active, updated_by)`; deactivate adds last-admin guard. Commit per request; **no cross-entity side effects** (no cascade, no notification, no audit-table write).

**Approve (auth module)**: `approve_user` — user 404 → already-active 400 → role 404 → set `role_id/status/is_active` → `created_by` (if null) + `updated_by` → commit + refresh.

**Side effects of every mutation:** `updated_at` (server `onupdate`), `updated_by` (admin id), `is_active` (status endpoints), `last_login_at` (login only). **No other services observe user mutations.**

---

## 9. Frontend Contract (exact)

### 9.1 Editable fields (what an Edit-User surface may touch — all already implemented)
- `role_id` — via `PATCH /users/{user_id}/role` `{role_id: int > 0}` → `UserActionResponse`.
- `status` — via `PATCH /users/{user_id}/activate` (no body) and `PATCH /users/{user_id}/deactivate` (no body).
- `status` (pending) + `role_id` — via `PATCH /auth/users/{user_id}/approve` `{role_id: int >= 1}`.

### 9.2 Read-only / never-editable fields
`full_name`, `email`, `password` (and `password_hash`), `id`, `created_by`, `created_at`, `updated_at`, `updated_by`, `last_login_at`, `is_active` (client-set only via the status endpoints). **The frontend must not render edit controls for any of these.**

### 9.3 Required / optional
- Role change: `role_id` **required** (integer > 0). No other fields.
- Activate/deactivate/approve: no fields (activate/deactivate) or `role_id` required (approve).

### 9.4 Form validation (exact mirror)
- `role_id`: positive integer; existing `roleAssignmentSchema` (`utils/userFormSchema.ts`) already matches.
- No other client-side validation is possible because no other fields are editable.

### 9.5 Error mapping
Use the existing `parseApiError` (`services/apiError.ts`) exclusively: `message` for banners, `fieldErrors` for inline 422s, `kind` for auth/forbidden/not-found branching. **No new error parsing.**

---

## 10. UI Recommendations (grounded in verified behavior)

Since the entire editable surface already ships (role dialog, status dialog, pending-approval UI), recommendations below cover any *consolidation* the team may want; none require new endpoints.

- **No Edit-User drawer/modal for profile fields — do not build one.** There is nothing to submit; the backend would 404/422 on any profile payload.
- **Role change UI**: keep the current dialog. Preserve backend behaviors: disable changing your own role (backend 400s anyway), and surface 409 `LAST_ADMIN_CANNOT_BE_MODIFIED` clearly (e.g., pre-disable "demote the last admin" based on directory state is *not* reliable — count is a server-side truth; rely on the 409 banner).
- **Status UI**: keep deactivate/activate confirmation flows; use `optimistic` refetch (the codebase standard) — mutation responses carry no state, refetch `['users']` after success (already the pattern via `useUserMutations`).
- **Cache invalidation (verified pattern):** invalidate `['users']` after role/activate/deactivate; invalidate `['auth','pending-users']` after approve/deactivate-from-pending. (Already implemented.)
- **Loading behavior:** disable submit while in flight; the backend has no async job semantics — a 200 response means the row is committed.
- **Success handling:** use the `message` string from `UserActionResponse`/`UserApprovalResponse` verbatim; backend copy differs slightly between modules (`"Role updated successfully"` vs `"User approved successfully."`).
- **Optimistic updates:** not recommended for role/status (409/400 outcomes are common and not locally predictable).

---

## 11. Risks

| # | Risk | Severity | Verified detail |
|---|---|---|---|
| 1 | **No profile editing at all** — Phase 1E as originally scoped cannot ship | 🔴 Critical | No endpoint accepts `full_name`/`email`/`password` updates |
| 2 | `activate` on pending user yields active-without-role account (then 403 on all admin APIs) | 🟠 High | `users/service.py::activate_user_service` never sets `role_id` |
| 3 | Asymmetric deactivate semantics between modules (status-based vs `is_active`-based) | 🟡 Medium | `auth` deactivate allows pending→inactive; `users` deactivate 400s on pending |
| 4 | No `GET /roles` endpoint — role ids resolved from seed order (`ROLE_IDS` constants) | 🟠 High | No roles router exists anywhere (`grep` across modules) |
| 5 | Domain error codes not serialized | 🟡 Medium | Frontend must branch on status + message |
| 6 | Last-write-wins concurrency (no versioning) | 🟡 Medium | Two admins editing role/status concurrently — last commit wins silently |
| 7 | `ChangeRoleRequest` silently ignores extra fields (no `extra="forbid"`) | 🟢 Low | Payload typos won't 422 |
| 8 | No user-audit log table (only `updated_by`/`updated_at` columns) | 🟡 Medium | No history of who changed what, when |
| 9 | No password reset/change → admins cannot remediate compromised accounts | 🟠 High | Verified absent |
| 10 | `GET /auth/me` lacks `role` — the frontend infers role from `/users` data | 🟢 Low | `CurrentUserResponse` = `{id, full_name, email, status}` |

---

## 12. Gap Analysis (backend capability vs. expected enterprise User Editing)

| Expected capability | Backend status (verified) | Gap |
|---|---|---|
| Edit `full_name` | ❌ none | Full |
| Edit `email` (with uniqueness) | ❌ none | Full |
| Change password / admin reset / forgot-password | ❌ none (login-only password handling) | Full |
| Role editing | ✅ `PATCH /users/{id}/role` | None (shipped Phase 1A) |
| Activate / deactivate | ✅ two endpoints | None (shipped) |
| Approve pending users | ✅ `PATCH /auth/users/{id}/approve` | None (shipped Phase 1D) |
| Profile editing (avatar, phone, dob, etc.) | ❌ none; such fields do not exist on `users` | Full |
| Role history / audit history | ❌ no audit table; only `updated_by`/`updated_at` columns | Full |
| Bulk edit | ❌ none | Full |
| User self-service (change own password/name) | ❌ none | Full |

Per the task constraints, **none of these gaps are recommended for implementation in this sprint** — they are documented for the roadmap (backend work required first).

---

## 13. Frontend Implementation Recommendation

**Option C — Backend does not support Edit User (profile editing). Do not implement.**

- The backend's *entire* user-mutation surface — role change, activate/deactivate, approval — is **already implemented in the frontend** (Phase 1A role dialog, status dialogs, pending-approval UI, Phase 1D Add User). There is **no remaining backend-supported user-editing feature to build**.
- Phase 1E should be **closed as "already covered by shipped endpoints"** for role/status/approval, and **deferred** for profile editing (full_name/email/password) until a backend `UserUpdate` + `ChangePassword` contract exists.
- **Do not** build an Edit-User drawer, form, schema, service, or hook that implies `PATCH /users/{id}` — it does not exist and would fail every request.

**Recommended next actions:** (1) record this limitation in the sprint board; (2) if profile editing is a priority, raise a backend task for `PATCH /users/{user_id}` (name/email, uniqueness re-check) and `POST /auth/change-password` before any frontend Phase 1E work; (3) until then, treat the shipped role/status/approval UI as the complete Phase 1E deliverable.

---

## Appendix A — Source map (file → claims)

| File | What it verifies |
|---|---|
| `backend/app/modules/auth/routes.py` | All `/auth` endpoints, deps, self-check on deactivate |
| `backend/app/modules/auth/service.py` | register/approve/deactivate/login logic, audit columns, exceptions |
| `backend/app/modules/auth/schemas.py` | `UserRegister`, `UserApprovalRequest`, response schemas, validators |
| `backend/app/modules/auth/repository.py` | user/role lookups, `create_user` |
| `backend/app/modules/auth/models.py` | `users`/`roles` tables, status CheckConstraint, unique email |
| `backend/app/modules/auth/exceptions.py` | auth domain codes/messages |
| `backend/app/modules/users/routes.py` | list/detail/role/activate/deactivate + self-guards |
| `backend/app/modules/users/service.py` | role/status service logic, last-admin protection |
| `backend/app/modules/users/schemas.py` | `ChangeRoleRequest`, read models |
| `backend/app/modules/users/repository.py` | `update_user_role`, `update_user_status`, `count_admin_users` |
| `backend/app/modules/users/exceptions.py` | users domain codes/messages |
| `backend/app/modules/rbac/permissions.py` | `require_admin` = {ADMIN, CHIEF_DOCTOR} |
| `backend/app/dependencies/auth.py` | JWT→user, active-only enforcement (401) |
| `backend/app/core/exception_handlers.py` | `{success,message,details}` envelope, status maps, 422 sanitization |
| `backend/app/core/constants.py` | role names, statuses |
| `backend/app/core/security.py` | bcrypt + JWT (HS256, 30-min) |
| `backend/app/core/config.py` | JWT validation settings |
| `backend/app/database/seed_roles.py` | seeded role names (order = `ROLE_IDS` dependency) |
| `backend/main.py` | router registration — complete endpoint set |
| `backend/alembic/versions/*users*` | column-level DB truth (unique email, status, audit cols) |
| `backend/app/modules/doctors/**` | doctor module reads `user.full_name` but never writes users |
