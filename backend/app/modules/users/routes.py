from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status

from sqlalchemy.orm import Session

from app.database.session import get_db

from app.modules.auth.models import User

from app.modules.rbac.permissions import (
    require_admin
)

from app.modules.users.schemas import (
    UserListResponse,
    UserDetailResponse,
    ChangeRoleRequest,
    UserActionResponse
)

from app.modules.users.service import (
    get_users_service,
    get_user_details_service,
    change_user_role_service,
    activate_user_service,
    deactivate_user_service
)


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get(
    "",
    response_model=UserListResponse
)
def get_users(
    search: str | None = None,
    role_id: int | None = None,
    status: str | None = None,

    page: int = Query(
        default=1,
        ge=1
    ),

    page_size: int = Query(
        default=10,
        ge=1,
        le=100
    ),

    db: Session = Depends(get_db),

    current_admin: User = Depends(
        require_admin
    )
):
    return get_users_service(
        db=db,
        search=search,
        role_id=role_id,
        status=status,
        page=page,
        page_size=page_size
    )

@router.get(
    "/{user_id}",
    response_model=UserDetailResponse
)
def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return get_user_details_service(
        db=db,
        user_id=user_id
    )

@router.patch(
    "/{user_id}/role",
    response_model=UserActionResponse
)
def change_user_role(
    user_id: int,
    role_data: ChangeRoleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role"
        )
    return change_user_role_service(
        db=db,
        user_id=user_id,
        role_id=role_data.role_id
    )

@router.patch(
    "/{user_id}/activate",
    response_model=UserActionResponse
)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return activate_user_service(
        db=db,
        user_id=user_id
    )

@router.patch(
    "/{user_id}/deactivate",
    response_model=UserActionResponse
)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )
    return deactivate_user_service(
        db=db,
        user_id=user_id
    )