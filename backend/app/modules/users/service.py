from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.auth.repository import get_role_by_id

from app.modules.users.repository import (
    get_users,
    get_user_by_id,
    count_admin_users,
    update_user_role,
    update_user_status,
)

from app.modules.users.exceptions import (
    ActivationFailed,
    DeactivationFailed,
    LastAdminCannotBeModified,
    RoleChangeFailed,
    RoleNotFound,
    UserAlreadyActive,
    UserAlreadyInactive,
    UserNotFound,
)

from app.core.constants import (
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    USER_STATUS_ACTIVE,
    USER_STATUS_INACTIVE,
)

from app.modules.users.schemas import (
    UserListItem,
    UserListResponse,
    UserDetailResponse,
    UserActionResponse,
)


logger = logging.getLogger(__name__)

# Admin role names used for last-admin protection.
# These must match the role constants seeded in the database.
_ADMIN_ROLE_NAMES: frozenset[str] = frozenset({ROLE_ADMIN, ROLE_CHIEF_DOCTOR})


# ==========================================================
# Helpers
# ==========================================================


def _is_admin_user(user: User) -> bool:
    """Check whether the given user has an admin-level role."""
    return user.role is not None and user.role.name in _ADMIN_ROLE_NAMES


def _is_last_admin(db: Session, user: User) -> bool:
    """Check whether the given user is the sole remaining admin."""
    if not _is_admin_user(user):
        return False
    return count_admin_users(db) <= 1



def get_users_service(
    db: Session,
    search: str | None = None,
    role_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 10
) -> UserListResponse:

    skip = (page - 1) * page_size

    users, total = get_users(
        db=db,
        search=search,
        role_id=role_id,
        status=status,
        skip=skip,
        limit=page_size
    )

    items = [
        UserListItem(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            status=user.status,
            is_active=user.is_active,
            role_id=user.role_id,
            role_name=user.role.name if user.role else None,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
        )
        for user in users
    ]

    return UserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

def get_user_details_service(
    db: Session,
    user_id: int
) -> UserDetailResponse:

    user = get_user_by_id(
        db=db,
        user_id=user_id
    )

    if not user:
        raise UserNotFound()

    return UserDetailResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        status=user.status,
        is_active=user.is_active,
        role_id=user.role_id,
        role_name=(
            user.role.name
            if user.role
            else None
        ),        last_login_at=user.last_login_at,
        created_by=user.created_by,
        created_at=user.created_at,
        updated_at=user.updated_at,
        updated_by=user.updated_by,
    )


def change_user_role_service(
    db: Session,
    user_id: int,
    role_id: int,
    updated_by: int | None = None,
) -> UserActionResponse:

    try:
        user = get_user_by_id(
            db=db,
            user_id=user_id
        )

        if user is None:
            raise UserNotFound()

        role = get_role_by_id(
            db=db,
            role_id=role_id
        )

        if role is None:
            raise RoleNotFound()

        # ── Last-admin protection ──────────────────────────────────
        # If the target user currently holds an admin role and the new
        # role is not an admin role, verify there is at least one other
        # admin to prevent locking everyone out of the system.
        if (
            _is_admin_user(user)
            and role.name not in _ADMIN_ROLE_NAMES
            and _is_last_admin(db, user)
        ):
            logger.warning(
                "Blocked role change: would remove last admin (user_id=%s)",
                user_id,
            )
            raise LastAdminCannotBeModified()

        update_user_role(
            db=db,
            user=user,
            role_id=role_id,
            updated_by=updated_by,
        )

        db.commit()

        return UserActionResponse(
            user_id=user.id,
            message="Role updated successfully",
        )

    except (UserNotFound, RoleNotFound, LastAdminCannotBeModified):
        db.rollback()
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during role change: user_id=%s, role_id=%s",
            user_id,
            role_id,
        )
        raise RoleChangeFailed()


def activate_user_service(
    db: Session,
    user_id: int,
    updated_by: int | None = None,
) -> UserActionResponse:

    try:
        user = get_user_by_id(
            db=db,
            user_id=user_id
        )

        if user is None:
            raise UserNotFound()

        if user.is_active:
            raise UserAlreadyActive()

        update_user_status(
            db=db,
            user=user,
            status=USER_STATUS_ACTIVE,
            is_active=True,
            updated_by=updated_by,
        )

        db.commit()

        return UserActionResponse(
            user_id=user.id,
            message="User activated successfully",
        )

    except (UserNotFound, UserAlreadyActive):
        db.rollback()
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user activation: user_id=%s",
            user_id,
        )
        raise ActivationFailed()


def deactivate_user_service(
    db: Session,
    user_id: int,
    updated_by: int | None = None,
) -> UserActionResponse:

    try:
        user = get_user_by_id(
            db=db,
            user_id=user_id
        )

        if user is None:
            raise UserNotFound()

        if not user.is_active:
            raise UserAlreadyInactive()

        # ── Last-admin protection ──────────────────────────────────
        # Prevent deactivation of the sole remaining admin.
        if _is_last_admin(db, user):
            logger.warning(
                "Blocked deactivation: would remove last admin (user_id=%s)",
                user_id,
            )
            raise LastAdminCannotBeModified()

        update_user_status(
            db=db,
            user=user,
            status=USER_STATUS_INACTIVE,
            is_active=False,
            updated_by=updated_by,
        )

        db.commit()

        return UserActionResponse(
            user_id=user.id,
            message="User deactivated successfully",
        )

    except (UserNotFound, UserAlreadyInactive, LastAdminCannotBeModified):
        db.rollback()
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user deactivation: user_id=%s",
            user_id,
        )
        raise DeactivationFailed()