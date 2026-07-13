"""Doctor Management Module — API authorization dependencies.

Thin FastAPI dependencies that enforce *ownership* on top of the existing
role-based checks. These live at the API edge (authorization, not business
logic): they decide *whether* the caller may reach an endpoint, never *what*
the endpoint does.

Rule (per the module RBAC spec):
- Admin / Receptionist may read any doctor (list + profile + schedules).
- A doctor may read only their own profile / schedules.

FastAPI injects the path parameters (``doctor_id`` / ``user_id``) into these
dependencies automatically, exactly as it does for the endpoint handlers.
"""

from __future__ import annotations

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.constants import (
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.modules.doctors.services.doctor_service import DoctorService


# Roles permitted to read any doctor record.
_FULL_READ_ROLES: frozenset[str] = frozenset({ROLE_ADMIN, ROLE_RECEPTIONIST})


def _is_full_read(user: User) -> bool:
    """Return True if the user may read any doctor record."""
    return bool(user.role and user.role.name in _FULL_READ_ROLES)


def require_doctor_self_or_full_read(
    doctor_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Allow full-read roles; otherwise restrict the caller to their own doctor.

    Doctors may only access their own profile / schedules. A non-owner (or a
    missing record) results in 403/404. The lookup reuses the Service layer —
    the router never touches a repository directly.
    """
    if _is_full_read(current_user):
        return current_user
    doctor = DoctorService(db).get_doctor_by_id(doctor_id)
    if doctor.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only access your own doctor profile.",
        )
    return current_user


def require_user_self_or_full_read(
    user_id: int,
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow full-read roles; otherwise restrict the caller to their own user."""
    if _is_full_read(current_user):
        return current_user
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only access your own doctor profile.",
        )
    return current_user
