from typing import List

from fastapi import APIRouter
from fastapi import BackgroundTasks
from fastapi import Depends
from fastapi import Path
from fastapi import status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.rbac.permissions import require_admin

from app.modules.users.exceptions import SelfDeactivationNotAllowed
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    CurrentUserResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginResponse,
    PendingUserResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserApprovalRequest,
    UserApprovalResponse,
    UserRegister,
)
from app.modules.auth.service import (
    approve_user,
    authenticate_user,
    deactivate_user,
    fetch_pending_users,
    refresh_access_token,
    register_user,
    request_password_reset,
    reset_password,
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
    responses={
        status.HTTP_409_CONFLICT: {
            "description": "Email already registered",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Validation error (e.g. weak password, invalid email)",
        },
    },
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
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid JWT token",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Admin role required",
        },
    },
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
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "User is already active",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid JWT token",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Admin role required",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "User or role not found",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Validation error (e.g. invalid role_id)",
        },
    },
)
def approve_user_route(
    approval_data: UserApprovalRequest,
    user_id: int = Path(
        ...,
        ge=1,
        title="User ID",
        description="Numeric identifier of the user to approve",
    ),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserApprovalResponse:
    approve_user(
        db,
        user_id,
        approval_data.role_id,
        approved_by=current_admin.id,
    )

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
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "User is already inactive",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid JWT token",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Admin role required",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "User not found",
        },
    },
)
def deactivate_user_route(
    user_id: int = Path(
        ...,
        ge=1,
        title="User ID",
        description="Numeric identifier of the user to deactivate",
    ),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserApprovalResponse:
    if current_admin.id == user_id:
        raise SelfDeactivationNotAllowed()

    deactivate_user(
        db,
        user_id,
        deactivated_by=current_admin.id,
    )

    return {
        "message": "User deactivated successfully.",
    }


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Request Password Reset",
    description=(
        "Request password-reset instructions for an email address. This "
        "endpoint is public (no JWT required). The response is generic "
        "and identical whether or not the account exists, so the API does "
        "not reveal account registration status (anti-enumeration)."
    ),
    response_description="Generic confirmation message.",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Validation error (e.g. invalid or missing email)",
        },
    },
)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    request_password_reset(db, payload.email, background_tasks)

    return {
        "message": (
            "If an account exists for this email address, "
            "you will receive password reset instructions."
        ),
    }


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset Password",
    description=(
        "Complete a password reset using the secure token from the reset "
        "email. This endpoint is public (no JWT required); the token itself "
        "is the credential. Invalid, expired, already-used, or revoked "
        "tokens are rejected with a generic message."
    ),
    response_description="Reset confirmation message.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Reset token is invalid, expired, or already used",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Validation error (e.g. weak password, missing token)",
        },
    },
)
def reset_password_route(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    reset_password(db, payload.token, payload.new_password)

    return {
        "message": "Your password has been reset successfully.",
    }


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Login",
    description=(
        "Authenticate with email and password. Returns a JWT access token "
        "and a refresh token. The access token must be included in "
        "subsequent requests via the Authorization header as "
        "'Bearer <token>'."
    ),
    response_description="JWT access token, refresh token, and token type.",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Invalid email or password",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Account is inactive or deactivated",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Validation error (e.g. missing fields)",
        },
    },
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    access_token, refresh_token = authenticate_user(
        db,
        form_data.username,
        form_data.password,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
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
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid JWT token",
        },
    },
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    return current_user


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description=(
        "Obtain a new access token using a valid refresh token. "
        "The refresh token must have been issued during login and must "
        "not be expired or revoked."
    ),
    response_description="New access token and token type.",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Invalid, expired, or revoked refresh token",
        },
    },
)
def refresh_token(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
) -> RefreshResponse:
    new_access_token = refresh_access_token(db, payload.refresh_token)

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }
