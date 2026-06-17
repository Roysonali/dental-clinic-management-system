from sqlalchemy.orm import Session
from fastapi import HTTPException
from fastapi import status
from app.modules.users.repository import (
    get_users, get_user_by_id,
    get_role_by_id,
    update_user_role,
    update_user_status

)

from app.modules.users.schemas import (
    UserListItem,
    UserListResponse,
    UserDetailResponse,
    UserActionResponse
)


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
            role_name=user.role.name if user.role else None
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

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
        )
    )

def change_user_role_service(
    db: Session,
    user_id: int,
    role_id: int
) -> UserActionResponse:

    user = get_user_by_id(
        db=db,
        user_id=user_id
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    role = get_role_by_id(
        db=db,
        role_id=role_id
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    update_user_role(
        db=db,
        user=user,
        role_id=role_id
    )

    return UserActionResponse(
        message="Role updated successfully"
    )

def activate_user_service(
    db: Session,
    user_id: int
) -> UserActionResponse:

    user = get_user_by_id(
        db=db,
        user_id=user_id
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already active"
        )

    update_user_status(
        db=db,
        user=user,
        status=USER_STATUS_ACTIVE,
        is_active=True
    )

    return UserActionResponse(
        message="User activated successfully"
    )

def deactivate_user_service(
    db: Session,
    user_id: int
) -> UserActionResponse:

    user = get_user_by_id(
        db=db,
        user_id=user_id
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already inactive"
        )

    update_user_status(
        db=db,
        user=user,
        status=USER_STATUS_INACTIVE,
        is_active=False
    )

    return UserActionResponse(
        message="User deactivated successfully"
    )