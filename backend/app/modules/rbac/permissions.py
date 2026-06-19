import logging

from typing import Sequence

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.core.constants import ROLE_ADMIN


logger = logging.getLogger(__name__)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to have the ``ROLE_ADMIN`` role."""

    if not current_user.role:
        logger.warning(
            "Forbidden access: user_id=%s has no role assigned",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not assigned",
        )

    if current_user.role.name != ROLE_ADMIN:
        logger.warning(
            "Forbidden access: user_id=%s, role=%s, required=%s",
            current_user.id,
            current_user.role.name,
            ROLE_ADMIN,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def require_roles(
    allowed_roles: Sequence[str],
):
    """Factory that returns a dependency requiring one of the given roles.

    Usage::

        @router.get("/patients")
        def list_patients(
            _: User = Depends(require_roles(["ADMIN", "RECEPTIONIST"])),
        ):
            ...

    Args:
        allowed_roles: Sequence of role names that are permitted.

    Returns:
        A FastAPI dependency callable that checks the current user's role.
    """

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if not current_user.role:
            logger.warning(
                "Role check failed: user_id=%s has no role assigned",
                current_user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role not assigned",
            )

        if current_user.role.name not in allowed_roles:
            logger.warning(
                "Role check failed: user_id=%s, role=%s, allowed=%s",
                current_user.id,
                current_user.role.name,
                allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user


    return role_checker

    return role_checker
 
