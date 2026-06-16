from fastapi import Depends
from fastapi import HTTPException

from app.modules.auth.models import User

from app.dependencies.auth import (
    get_current_user
)


def require_admin(
    current_user: User = Depends(
        get_current_user
    )
):
    admin_roles = [
        "Administrative Officer",
        "Chief Doctor"
    ]

    if (
        not current_user.role
        or current_user.role.name not in admin_roles
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user