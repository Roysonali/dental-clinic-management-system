from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.database.session import get_db

from app.modules.auth.schemas import (
    UserRegister,
    RegisterResponse
)

from app.modules.auth.service import (
    register_user,
    authenticate_user
)
from typing import List

from app.modules.auth.service import (
    fetch_pending_users,
    approve_user,
    deactivate_user
)
from app.modules.auth.schemas import (
    LoginResponse,
    CurrentUserResponse,
    UserApprovalResponse,
    UserApprovalRequest,
    PendingUserResponse
)

from app.dependencies.auth import (
    get_current_user
)

from app.modules.auth.dependencies import (
    require_admin
)

from app.modules.auth.models import User
from fastapi.security import OAuth2PasswordRequestForm



router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    response_model=RegisterResponse
)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    register_user(
        db,
        user_data
    )

    return {
        "message":
        "Registration submitted. Waiting for admin approval."
    }

@router.get(
    "/users/pending",
    response_model=List[PendingUserResponse]
)
def get_pending_users_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return fetch_pending_users(db)


@router.patch(
    "/users/{user_id}/approve",
    response_model=UserApprovalResponse
)
def approve_user_route(
    user_id: int,
    approval_data: UserApprovalRequest,
    db: Session = Depends(get_db),
    current_user:User = Depends(require_admin)
):
    approve_user(
        db,
        user_id,
        approval_data.role_id
    )

    return {
        "message":
        "User approved successfully."
    }


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserApprovalResponse
)
def deactivate_user_route(
    user_id: int,
    db: Session = Depends(get_db),
    current_user : User = Depends(require_admin)
):
    deactivate_user(
        db,
        user_id
    )

    return {
        "message":
        "User deactivated successfully."
    }


@router.post(
    "/login",
    response_model=LoginResponse
)
def login(
    form_data:  OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    access_token = authenticate_user(
        db,
        form_data.username,
        form_data.password
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get(
    "/me",
    response_model=CurrentUserResponse
)
def get_me(
    current_user: User = Depends(
        get_current_user
    )
):
    return current_user