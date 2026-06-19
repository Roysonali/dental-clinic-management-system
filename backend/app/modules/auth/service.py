import logging

from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from app.core.constants import USER_STATUS_ACTIVE
from app.core.constants import USER_STATUS_INACTIVE
from app.core.constants import USER_STATUS_PENDING
from app.core.security import create_access_token
from app.core.security import hash_password
from app.core.security import verify_password
from app.modules.auth.models import User
from app.modules.auth.repository import create_user
from app.modules.auth.repository import get_pending_users
from app.modules.auth.repository import get_role_by_id
from app.modules.auth.repository import get_user_by_email
from app.modules.auth.repository import get_user_by_id
from app.modules.auth.schemas import UserRegister


logger = logging.getLogger(__name__)


def register_user(
    db: Session,
    user_data: UserRegister,
) -> User:
    """Register a new user with pending status.

    Checks for duplicate emails, hashes the password, and creates
    a user record with ``status="pending"`` and ``is_active=False``.

    Args:
        db: Active database session.
        user_data: Validated registration payload.

    Returns:
        The newly created User ORM instance.

    Raises:
        HTTPException 409: If the email is already registered.
    """
    try:
        existing_user = get_user_by_email(db, user_data.email)

        if existing_user:
            logger.warning(
                "Duplicate registration attempt: email=%s",
                user_data.email,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        hashed_password = hash_password(user_data.password)

        user = User(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hashed_password,
            status=USER_STATUS_PENDING,
            is_active=False,
        )

        created_user = create_user(db, user)

        logger.info(
            "User registered: id=%s, email=%s",
            created_user.id,
            created_user.email,
        )

        return created_user

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user registration: email=%s",
            user_data.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later.",
        )


def fetch_pending_users(
    db: Session,
) -> list[User]:
    """Return all users whose account is still pending approval.

    Args:
        db: Active database session.

    Returns:
        List of pending User instances.
    """
    return get_pending_users(db)


def approve_user(
    db: Session,
    user_id: int,
    role_id: int,
) -> User:
    """Approve a pending user by assigning a role and activating the account.

    Args:
        db: Active database session.
        user_id: Numeric ID of the user to approve.
        role_id: Numeric ID of the role to assign.

    Returns:
        The updated User ORM instance.

    Raises:
        HTTPException 404: If the user or role is not found.
        HTTPException 400: If the user is already active.
    """
    try:
        user = get_user_by_id(db, user_id)

        if not user:
            logger.warning(
                "User not found for approval: user_id=%s",
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if user.is_active:
            logger.warning(
                "User already active: user_id=%s, status=%s",
                user_id,
                user.status,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already active",
            )

        role = get_role_by_id(db, role_id)

        if not role:
            logger.warning(
                "Role not found for approval: role_id=%s",
                role_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found",
            )

        user.role_id = role.id
        user.status = USER_STATUS_ACTIVE
        user.is_active = True

        db.commit()
        db.refresh(user)

        logger.info(
            "User approved: id=%s, role=%s",
            user.id,
            role.name,
        )

        return user

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user approval: user_id=%s, role_id=%s",
            user_id,
            role_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Approval failed. Please try again later.",
        )


def deactivate_user(
    db: Session,
    user_id: int,
) -> User:
    """Deactivate a user by setting status to 'inactive'.

    Args:
        db: Active database session.
        user_id: Numeric ID of the user to deactivate.

    Returns:
        The updated User ORM instance.

    Raises:
        HTTPException 404: If the user is not found.
        HTTPException 400: If the user is already inactive.
    """
    try:
        user = get_user_by_id(db, user_id)

        if not user:
            logger.warning(
                "User not found for deactivation: user_id=%s",
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if user.status == USER_STATUS_INACTIVE:
            logger.warning(
                "User already inactive: user_id=%s",
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already inactive",
            )

        user.status = USER_STATUS_INACTIVE
        user.is_active = False

        db.commit()
        db.refresh(user)

        logger.info(
            "User deactivated: id=%s",
            user.id,
        )

        return user

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user deactivation: user_id=%s",
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Deactivation failed. Please try again later.",
        )


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> str:
    """Authenticate a user by email and password.

    Normalizes the email to lowercase so that login is case-insensitive,
    then validates credentials. Returns a signed JWT access token on success.

    Args:
        db: Active database session.
        email: User's email address (case-insensitive).
        password: Raw (unhashed) password.

    Returns:
        A JWT access token string.

    Raises:
        HTTPException 401: If credentials are invalid.
        HTTPException 403: If the account is inactive.
    """
    normalized_email = email.strip().lower()

    user = get_user_by_email(db, normalized_email)

    if not user:
        logger.warning(
            "Login attempt for unknown email: %s",
            normalized_email,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(password, user.password_hash):
        logger.warning(
            "Failed login (bad password): email=%s",
            normalized_email,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        logger.warning(
            "Login attempt on inactive account: email=%s, status=%s",
            normalized_email,
            user.status,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token({"sub": user.email})

    logger.info(
        "User authenticated: email=%s",
        normalized_email,
    )

    return access_token