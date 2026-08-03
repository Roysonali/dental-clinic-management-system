# Phase 6: Security & RBAC — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only permissions required for Treatment Plan, Item, Version, Approval, and Procedure management.

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

Treatment Plan does NOT handle login, registration, password reset, or token refresh.

---

## 2. Role Definitions

Roles are defined in `app/core/constants.py` and seeded in the database. The Treatment Plan module interacts with these roles:

| Role | Constant | Can Create Plans? | Can Manage Procedures? |
|---|---|---|---|
| ADMIN | `ROLE_ADMIN` | Yes (all operations) | Yes |
| CHIEF_DOCTOR | `ROLE_CHIEF_DOCTOR` | Yes (all operations) | Yes |
| GENERAL_DOCTOR | `ROLE_GENERAL_DOCTOR` | Yes (own plans) | No |
| SPECIALIST_DOCTOR | `ROLE_SPECIALIST_DOCTOR` | Yes (own plans) | No |
| CONSULTING_DOCTOR | `ROLE_CONSULTING_DOCTOR` | Yes (own plans) | No |
| RECEPTIONIST | `ROLE_RECEPTIONIST` | View only | No |
| DENTAL_ASSISTANT | `ROLE_DENTAL_ASSISTANT` | View only | No |

---

## 3. Permission Matrix

### 3.1 Treatment Plan Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Create Plan | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| View Plan (any) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Own Plan | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Update Plan (any) | ✅ | ✅ | — | — | — | — | — |
| Update Own Plan | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Delete Draft (any) | ✅ | ✅ | — | — | — | — | — |
| Delete Own Draft | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Transition Status (any) | ✅ | ✅ | — | — | — | — | — |
| Transition Own Plan | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Deactivate Plan | ✅ | ✅ | — | — | — | — | — |
| Reactivate Plan | ✅ | ✅ | — | — | — | — | — |

### 3.2 Treatment Plan Item Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Add Item (any) | ✅ | ✅ | — | — | — | — | — |
| Add Item (own plan) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Update Item (any) | ✅ | ✅ | — | — | — | — | — |
| Update Item (own plan) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Remove Item (any) | ✅ | ✅ | — | — | — | — | — |
| Remove Item (own plan) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Update Item Status (any) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| View Items | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.3 Version Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| View Versions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.4 Approval Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Record Doctor Approval | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Record Patient Ack. | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| View Approval | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.5 Procedure Permissions

| Operation | Admin | Chief Doctor | General | Specialist | Consulting | Receptionist | Assistant |
|---|---|---|---|---|---|---|---|
| Create Procedure | ✅ | ✅ | — | — | — | — | — |
| Update Procedure | ✅ | ✅ | — | — | — | — | — |
| View Procedures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Access Control Implementation

### 4.1 Dependency Pattern

Following the existing DensCare pattern:

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

# Admin/Chief operations (manage procedures, deactivate plans)
require_roles([ROLE_ADMIN, ROLE_CHIEF_DOCTOR])

# Clinical roles (read access — browse plans and items)
CLINICAL_ROLES = [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_RECEPTIONIST, *DOCTOR_ROLES]
require_roles(CLINICAL_ROLES)

# Doctor roles (create and manage own plans)
DOCTOR_ROLES_LIST = list(DOCTOR_ROLES)
require_roles(DOCTOR_ROLES_LIST)

# Admin/Chief + Doctor roles for item management and status transitions
require_roles([ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES])
```

### 4.2 Owner Check Pattern

For endpoints where doctors manage their own plans, a two-step auth is used:

1. `require_roles(...)` — checks role membership
2. `doctor_owner_check(plan_id, current_user)` — checks if the plan belongs to the current user's doctor profile

```python
def plan_owner_or_admin(
    plan_id: UUID,
    current_user: User = Depends(require_roles(
        [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES],
    )),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> User:
    """Return current_user if admin/chief or the plan's owning doctor."""
    if current_user.role.name in {ROLE_ADMIN, ROLE_CHIEF_DOCTOR}:
        return current_user
    plan = service.get_plan(plan_id)
    # Verify the plan's doctor_id matches the current user's doctor profile
    doctor = doctor_service.get_by_user_id(current_user.id)
    if not doctor or plan.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SELF_SERVICE_NOT_ALLOWED",
        )
    return current_user
```

---

## 5. Data Classification

| Data Category | Classification | Access Restriction | Write Audited |
|---|---|---|---|
| Plan metadata (code, status) | Internal | All clinical roles | Yes |
| Clinical notes/observations | Sensitive | Doctor (owner), Admin, Chief Doctor | Yes |
| Item costs and discounts | Sensitive | Doctor, Admin, Chief Doctor | Yes |
| Patient acknowledgment | Sensitive | Doctor, Admin, Chief Doctor | Yes |
| Procedure catalog | Public (within system) | All authenticated | Yes |
| Version snapshots | Internal | All clinical roles | Immutable |

---

## 6. Security Considerations

### 6.1 Layered Security Model

| Layer | Check | Enforcement |
|---|---|---|
| 1 — Authentication | Valid JWT + active user | `get_current_user` (FastAPI dependency) |
| 2 — Role authorization | User has required role | `require_roles()` (FastAPI dependency) |
| 3 — Ownership | User owns the plan (or is admin/chief) | `plan_owner_or_admin()` (FastAPI dependency) |
| 4 — Field-level validation | Request body is valid + extra fields rejected | Pydantic `extra="forbid"` + validators |
| 5 — State machine validation | Status transition is valid | Service + Validator layer |
| 6 — Database constraints | FK integrity, unique constraints, CHECK constraints | PostgreSQL + SQLAlchemy |

### 6.2 Hardening Measures

| Concern | Mitigation |
|---|---|
| Unauthenticated access | All endpoints protected by `get_current_user`. Inactive users rejected even with valid JWTs. |
| Role escalation | `require_roles()` checked on every request. Role checks run before business logic. |
| Data exposure | Field-level access restrictions enforced by router auth. Response schemas include only authorized fields. |
| Mass assignment | `extra="forbid"` on all Pydantic request schemas — unknown fields rejected with 422. |
| SQL injection | SQLAlchemy ORM with parameterized queries. No raw SQL in application code. |
| Resource enumeration | UUID primary keys for all entities, making ID guessing infeasible. |
| Error disclosure | Auth failures return generic messages. Domain errors return specific messages for debugging. |
| State machine integrity | Invalid transitions rejected at service layer before any persistence occurs. |
| Version immutability | Version snapshots are never modified after creation — enforced by service layer. |
| Logging | All auth failures logged at WARNING level with user ID, role, and path. |

---

## 7. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [00-module-overview.md](00-module-overview.md) (position in DensCare) |
| **Related** | [16-router-design.md](16-router-design.md) (auth dependencies), [07-validation-rules.md](07-validation-rules.md) (access control rules) |
| **Depends On** | Existing Auth module (`get_current_user`), RBAC module (`require_roles`), DensCare role constants |
| **Used By** | [16-router-design.md](16-router-design.md), [17-testing-strategy.md](17-testing-strategy.md) |
| **Next Reading** | [07-validation-rules.md](07-validation-rules.md) |
