from typing import Sequence

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.core.constants import ROLE_ADMIN


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:

    if not current_user.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not assigned"
        )

    if current_user.role.name != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


def require_roles(
    allowed_roles: Sequence[str]
):
    def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        
        print("ROLE NAME =", current_user.role.name)
        print("ALLOWED =", allowed_roles)
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role not assigned"
            )

        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        return current_user

    return role_checker

