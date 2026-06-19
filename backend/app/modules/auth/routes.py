from typing import List

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.dependencies import require_admin
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    CurrentUserResponse,
    LoginResponse,
    PendingUserResponse,
    RegisterResponse,
    UserApprovalRequest,
    UserApprovalResponse,
    UserRegister,
)
from app.modules.auth.service import (
    approve_user,
    authenticate_user,
    deactivate_user,
    fetch_pending_users,
    register_user,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register User",
    description=(
        "Submit a new registration request. The account is created with "
        "'pending' status and must be approved by an admin before it "
        "can be used. Returns a confirmation message."
    ),
    response_description="Registration confirmation message.",
)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    register_user(db, user_data)

    return {
        "message": "Registration submitted. Waiting for admin approval.",
    }


@router.get(
    "/users/pending",
    response_model=List[PendingUserResponse],
    status_code=status.HTTP_200_OK,
    summary="List Pending Users",
    description=(
        "Retrieve all users whose accounts are in 'pending' status "
        "and await admin approval. Requires admin role."
    ),
    response_description="List of pending user accounts.",
)
def get_pending_users_route(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> List[PendingUserResponse]:
    return fetch_pending_users(db)


@router.patch(
    "/users/{user_id}/approve",
    response_model=UserApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve User",
    description=(
        "Approve a pending user by assigning a role. The user's status "
        "changes to 'active' and they can log in. Requires admin role."
    ),
    response_description="Approval confirmation message.",
)
def approve_user_route(
    user_id: int,
    approval_data: UserApprovalRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserApprovalResponse:
    approve_user(db, user_id, approval_data.role_id)

    return {
        "message": "User approved successfully.",
    }


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate User",
    description=(
        "Deactivate a user's account. The user's status changes to "
        "'inactive' and they can no longer log in. Requires admin role."
    ),
    response_description="Deactivation confirmation message.",
)
def deactivate_user_route(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserApprovalResponse:
    deactivate_user(db, user_id)

    return {
        "message": "User deactivated successfully.",
    }


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Login",
    description=(
        "Authenticate with email and password. Returns a JWT access token "
        "that must be included in subsequent requests via the "
        "Authorization header as 'Bearer <token>'."
    ),
    response_description="JWT access token and token type.",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    access_token = authenticate_user(
        db,
        form_data.username,
        form_data.password,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User",
    description=(
        "Return the profile information of the currently authenticated "
        "user based on the JWT token in the Authorization header."
    ),
    response_description="Current user profile details.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    return current_user
