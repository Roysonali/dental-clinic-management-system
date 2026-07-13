"""
Patient Record RBAC Permissions
================================

Domain-specific RBAC helpers for the patient records module.  Each
helper wraps the generic ``require_roles`` checker with a role list
that is appropriate for the operation type.

Naming convention
-----------------
``require_patient_record_<action>()``  — patient record CRUD operations.
``require_audit_read()``               — read-only audit trail access
                                         (admin level).

All helpers carry full OpenAPI docs metadata and can be used with
``Depends()`` in any router endpoint.
"""

from typing import Sequence

from fastapi import Depends

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.rbac.permissions import (
    require_admin as _require_admin,
    require_roles as _require_roles,
)


# ------------------------------------------------------------------
# Role lists — single source of truth
# ------------------------------------------------------------------

#: Roles allowed to read patient records and child entities.
_PATIENT_RECORD_READ_ROLES: Sequence[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]

#: Roles allowed to create / update patient records and child entities.
_PATIENT_RECORD_WRITE_ROLES: Sequence[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]

#: Roles allowed to change record status or finalise records.
_PATIENT_RECORD_STATUS_ROLES: Sequence[str] = [
    ROLE_ADMIN,
    *DOCTOR_ROLES,
]

#: Roles allowed to soft-delete patient records.
_PATIENT_RECORD_DELETE_ROLES: Sequence[str] = [
    ROLE_ADMIN,
]


# ------------------------------------------------------------------
# Dependency callables
# ------------------------------------------------------------------


def require_patient_record_read(
    current_user: User = Depends(
        _require_roles(_PATIENT_RECORD_READ_ROLES),
    ),
) -> User:
    """Require read-level access to patient records.

    Grants access to ADMIN, RECEPTIONIST, and all DOCTOR roles.
    """
    return current_user


def require_patient_record_write(
    current_user: User = Depends(
        _require_roles(_PATIENT_RECORD_WRITE_ROLES),
    ),
) -> User:
    """Require write-level access to patient records.

    Grants access to ADMIN, RECEPTIONIST, and all DOCTOR roles.
    Used for creating, updating, and soft-deleting child entities
    (diagnoses, prescriptions, attachments, follow-ups).
    """
    return current_user


def require_patient_record_delete(
    current_user: User = Depends(
        _require_roles(_PATIENT_RECORD_DELETE_ROLES),
    ),
) -> User:
    """Require delete-level access to patient records.

    Restricted to ADMIN only.  Used for soft-deleting patient records.
    """
    return current_user


def require_patient_record_status_change(
    current_user: User = Depends(
        _require_roles(_PATIENT_RECORD_STATUS_ROLES),
    ),
) -> User:
    """Require status-change access to patient records.

    Grants access to ADMIN and all DOCTOR roles.  Used for
    transitioning record status and finalising records.
    """
    return current_user


def require_audit_read(
    current_user: User = Depends(_require_admin),
) -> User:
    """Require admin-level access to read audit logs.

    Restricted to ADMIN and CHIEF_DOCTOR.  Audit logs contain
    sensitive action history that should not be visible to
    general staff.
    """
    return current_user
