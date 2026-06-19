import logging

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.core.constants import ROLE_ADMIN
from app.core.constants import ROLE_CHIEF_DOCTOR
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User


logger = logging.getLogger(__name__)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user holds an administrative role.

    Admin roles are defined in :mod:`app.core.constants` as
    ``ROLE_ADMIN`` and ``ROLE_CHIEF_DOCTOR``.

    Args:
        current_user: The authenticated user injected by the auth dependency.

    Returns:
        The current user if they have an admin role.

    Raises:
        HTTPException 403: If the user has no assigned role or their role
            is not an admin role.
    """
    admin_roles = [ROLE_ADMIN, ROLE_CHIEF_DOCTOR]

    if not current_user.role:
        logger.warning(
            "Forbidden access: user_id=%s has no role assigned",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    if current_user.role.name not in admin_roles:
        logger.warning(
            "Forbidden access: user_id=%s, role=%s, required=%s",
            current_user.id,
            current_user.role.name,
            admin_roles,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user