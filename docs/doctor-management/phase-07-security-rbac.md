# Phase 7: Security & RBAC — Doctor Management Module

> **Status:** PASS| **Target Quality Score:** 9.8/10
> **MVP Scope:** Only permissions required for Doctor Profile, Specialization, and Schedule management.

---

## 1. Authentication

The module uses the existing DensCare authentication infrastructure — no new auth logic is introduced.

| Mechanism | Detail |
|---|---|
| Protocol | OAuth2 with Password Bearer |
| Token | JWT (signed with config secret, includes `sub`=email, `exp`, `iat`, `jti`) |
| Header | `Authorization: Bearer <token>` |
| Expiry | Configurable (default 60 minutes) |
| Dependency | `get_current_user` from `app.dependencies.auth` |
| Active check | `get_current_user` verifies `user.is_active` — inactive users are rejected even with valid tokens |

Doctor Management does NOT handle login, registration, password reset, or token refresh.

---

## 2. Role Definitions

Roles are defined in `app/core/constants.py` and seeded in the database. The Doctor Management module interacts with these roles:

| Role | Constant | Can Have DoctorProfile? |
|---|---|---|
| ADMIN | `ROLE_ADMIN` | No (admin is not a clinician) |
| CHIEF_DOCTOR | `ROLE_CHIEF_DOCTOR` | Yes |
| GENERAL_DOCTOR | `ROLE_GENERAL_DOCTOR` | Yes |
| SPECIALIST_DOCTOR | `ROLE_SPECIALIST_DOCTOR` | Yes |
| CONSULTING_DOCTOR | `ROLE_CONSULTING_DOCTOR` | Yes |
| RECEPTIONIST | `ROLE_RECEPTIONIST` | No |
| DENTAL_ASSISTANT | `ROLE_DENTAL_ASSISTANT` | No |

**Constraint:** Only users with roles in `DOCTOR_ROLES = (CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR)` can have a DoctorProfile.

---

## 3. Permission Matrix

### 3.1 Doctor Profile Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Create Profile | ✅ | ✅ | — | — | — | — | — |
| View Profile (any) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| View Own Profile | — | ✅ | ✅ | ✅ | ✅ | — | — |
| Update All Fields | ✅ | ✅ | — | — | — | — | — |
| Update Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Update Own Availability | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Toggle Own Leave | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Deactivate Profile | ✅ | ✅ | — | — | — | — | — |
| Reactivate Profile | ✅ | ✅ | — | — | — | — | — |
| Search/List Doctors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |

### 3.2 Specialization Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Create Specialization | ✅ | ✅ | — | — | — | — | — |
| Assign to Doctor | ✅ | ✅ | — | — | — | — | — |
| Remove from Doctor | ✅ | ✅ | — | — | — | — | — |
| Set Primary | ✅ | ✅ | — | — | — | — | — |
| View Specializations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.3 Schedule Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| View Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| View Any Schedule | ✅ | — | — | — | — | — | — |
| Create Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Create Any Schedule | ✅ | ✅ | — | — | — | — | — |
| Update Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Delete Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |

---

## 4. Access Control Implementation

Doctor Management follows the existing DensCare exception hierarchy pattern (`app/modules/patients/exceptions.py`, `app/modules/auth/exceptions.py`): a base `DoctorException` with `code`, `message`, and `details` fields, registered in `app/core/exception_handlers.py`. Exception codes align with the Phase 5 error code table.

### 4.1 Dependency Pattern

Following the existing DensCare pattern (`app/modules/rbac/permissions.py`):

```python
from app.core.constants import (
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_RECEPTIONIST,
    DOCTOR_ROLES,
)
from app.modules.rbac.permissions import require_roles

# Admin/Chief Doctor operations (create profile, update all fields, deactivate)
require_roles([ROLE_ADMIN, ROLE_CHIEF_DOCTOR])

# Clinical roles (read access — browse doctors and specializations)
CLINICAL_ROLES = [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_RECEPTIONIST, *DOCTOR_ROLES]
require_roles(CLINICAL_ROLES)

# Self-service (doctor managing own data)
# Implemented as: require_roles(DOCTOR_ROLES) + owner check
```

### 4.2 Self-Service Owner Check

For endpoints where doctors can manage their own data (schedule, availability, leave toggle), a two-step auth is used:

1. `require_roles(...)` — checks role membership (e.g., `DOCTOR_ROLES`)
2. `owner_check(doctor_id, current_user)` — checks if the doctor profile belongs to the current user

```python
def doctor_owner_or_admin(
    doctor_id: UUID,
    current_user: User = Depends(require_roles(
        [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES],
    )),
) -> User:
    """Return current_user if admin/chief or the profile owner."""
    if current_user.role.name in {ROLE_ADMIN, ROLE_CHIEF_DOCTOR}:
        return current_user
    # Check if the doctor profile's user_id matches current user
    doctor = doctor_service.get_doctor(doctor_id)
    if doctor.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SELF_SERVICE_NOT_ALLOWED",
        )
    return current_user
```

> **Critical ordering note:** The role list includes `ROLE_ADMIN` and `ROLE_CHIEF_DOCTOR` because `require_roles()` runs BEFORE the owner-check body. If the list only contained `DOCTOR_ROLES`, Admin users would be rejected at the role check stage and never reach the admin-bypass logic.

This dependency is used in endpoints where `require_roles(...)` alone is insufficient because the endpoint must be accessible to both admins (who can operate on any profile) and the profile owner (who can only operate on their own). The pattern matches the existing DensCare approach of chaining dependencies.

**Cross Reference:** Phase 5 §2.4 Self-Service vs Admin-Only Fields table

---

## 5. Data Classification

| Data Category | Classification | Access Restriction | Write Audited |
|---|---|---|---|---|
| Doctor basic info (name, code) | Public (within system) | All clinical roles | Yes |
| Contact info (phone, email) | Internal | Admin, Chief Doctor, Doctor (self) | Yes |
| Professional info (qualification, registration) | Internal | Admin, Chief Doctor, Doctor (self) | Yes |
| Financial info (consultation fee) | Sensitive | Admin, Chief Doctor | Yes |
| Schedule data | Internal | Admin, Doctor (self) | Yes |
| Availability status | Public (within system) | All clinical roles | Yes |

> **Note:** Per Phase 1 FR-6, ALL mutations are audited (created_by, updated_by, created_at, updated_at). The "Write Audited" column indicates whether the data category is subject to this audit requirement — which applies universally.
>
> **Response visibility:** The access restriction column applies primarily to **write** operations. For **read** operations, any authenticated role authorized for an endpoint receives the full response schema for that endpoint (e.g., a Receptionist browsing doctors sees the same `DoctorResponse` as an Admin). Field-level restrictions in Phase 5 §2.4 only gate **write** access via `PATCH /doctors/{id}`. Read responses are uniform across authorized roles — there are no per-role response field filters in the MVP.

---

## 6. Security Considerations

### 6.1 Layered Security Model

The module applies five layers of security validation on every request:

| Layer | Check | Enforcement | 
|---|---|---|
| 1 — Authentication | Valid JWT + active user | `get_current_user` (FastAPI dependency) |
| 2 — Role authorization | User has required role | `require_roles()` (FastAPI dependency) |
| 3 — Ownership | User owns the resource (or is admin) | `doctor_owner_or_admin()` (FastAPI dependency) |
| 4 — Field-level validation | Request body is valid + extra fields rejected | Pydantic `extra="forbid"` + validators |
| 5 — Database constraints | FK integrity, unique constraints, CHECK constraints | PostgreSQL + SQLAlchemy |

Each layer is independent — failure at any layer rejects the request before the next layer runs.

### 6.2 Hardening Measures

| Concern | Mitigation |
|---|---|
| Unauthenticated access | All endpoints protected by `get_current_user`. Inactive user accounts are rejected even with valid JWTs. |
| Role escalation | `require_roles()` checked on every request. Role checks run before business logic. |
| Data exposure | Field-level access restrictions enforced by router auth (self-service vs admin-only fields per Phase 5 §2.4). Response schemas use `ConfigDict(from_attributes=True)`. |
| Mass assignment | `extra="forbid"` on all Pydantic request schemas — unknown fields are rejected with 422. |
| SQL injection | SQLAlchemy ORM with parameterized queries. No raw SQL in application code. |
| Resource enumeration | DoctorProfile and DoctorSchedule use UUID primary keys (not sequential integers), making ID guessing infeasible. Specialization uses integer PK (master table, low-risk). |
| Error disclosure | Auth failures (401/403) return generic messages ("Could not validate credentials", "Insufficient permissions") — not the specific reason for denial. Domain errors (404, 409) return specific messages for debugging. |
| Logging | All auth failures logged at WARNING level with user ID, role, and path — matching existing DensCare pattern (`exception_handlers.py`). |
| Row-Level Security | Not used. Authorization is enforced at the application layer only. This is consistent with the existing DensCare architecture. |
| Security headers | Deferred to infrastructure layer (reverse proxy / API gateway). Not an application concern. |
| Rate limiting | Future — not in MVP scope (infrastructure concern). |

---

## 7. Permissions Explicitly Excluded from MVP

The following security features are deferred to future phases (see Phase 18):

| Feature | Reason |
|---|---|
| Credential CRUD permissions | Credential management not in MVP |
| Leave approval permissions | Leave approval workflow not in MVP |
| Commission/Finance permissions | Commission management not in MVP |
| Performance dashboard permissions | Analytics not in MVP |
| Multi-clinic admin permissions | Multi-clinic not in MVP |
| Audit log viewer permissions | Advanced audit not in MVP |
| Department admin permissions | Department management not in MVP |
