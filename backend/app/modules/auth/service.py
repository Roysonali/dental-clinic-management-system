import logging
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import USER_STATUS_ACTIVE
from app.core.constants import USER_STATUS_INACTIVE
from app.core.constants import USER_STATUS_PENDING
from app.core.email import email_service
from app.core.security import create_access_token
from app.core.security import create_refresh_token as create_refresh_token_jwt
from app.core.security import generate_password_reset_token
from app.core.security import hash_password
from app.core.security import hash_password_reset_token
from app.core.security import hash_token
from app.core.security import verify_password
from app.modules.auth.exceptions import (
    ApprovalFailed,
    DeactivationFailed,
    EmailAlreadyRegistered,
    InactiveAccount,
    InvalidCredentials,
    InvalidRefreshToken,
    InvalidResetToken,
    PasswordResetFailed,
    PasswordResetRequestFailed,
    RegistrationFailed,
    RoleNotFound,
    UserAlreadyActive,
    UserAlreadyInactive,
    UserNotFound,
)

from app.modules.users.repository import count_admin_users

from app.modules.users.exceptions import LastAdminCannotBeModified
from app.modules.auth.models import PasswordResetToken
from app.modules.auth.models import RefreshToken
from app.modules.auth.models import User
from app.modules.auth.repository import create_password_reset_token
from app.modules.auth.repository import create_refresh_token
from app.modules.auth.repository import create_user
from app.modules.auth.repository import get_password_reset_token_by_hash
from app.modules.auth.repository import get_pending_users
from app.modules.auth.repository import get_refresh_token_by_hash
from app.modules.auth.repository import get_role_by_id
from app.modules.auth.repository import get_user_by_email
from app.modules.auth.repository import get_user_by_id
from app.modules.auth.repository import mark_password_reset_token_used
from app.modules.auth.repository import revoke_all_user_refresh_tokens
from app.modules.auth.repository import revoke_user_password_reset_tokens
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
        EmailAlreadyRegistered: If the email is already registered.
        RegistrationFailed: If an unexpected error occurs.
    """
    try:
        existing_user = get_user_by_email(db, user_data.email)

        if existing_user:
            logger.warning(
                "Duplicate registration attempt: email=%s",
                user_data.email,
            )
            raise EmailAlreadyRegistered()

        hashed_password = hash_password(user_data.password)

        user = User(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hashed_password,
            status=USER_STATUS_PENDING,
            is_active=False,
        )

        created_user = create_user(db, user)

        db.commit()

        logger.info(
            "User registered: id=%s, email=%s",
            created_user.id,
            created_user.email,
        )

        return created_user

    except EmailAlreadyRegistered:
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user registration: email=%s",
            user_data.email,
        )
        raise RegistrationFailed()


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
    approved_by: int | None = None,
) -> User:
    """Approve a pending user by assigning a role and activating the account.

    Populates both ``created_by`` and ``updated_by`` audit fields with
    the approving admin's user ID.

    Args:
        db: Active database session.
        user_id: Numeric ID of the user to approve.
        role_id: Numeric ID of the role to assign.
        approved_by: The admin user ID performing the approval.
            Sets ``created_by`` (if null) and ``updated_by`` on the user.

    Returns:
        The updated User ORM instance.

    Raises:
        UserNotFound: If no user exists with the given ID.
        UserAlreadyActive: If the user is already active.
        RoleNotFound: If no role exists with the given ID.
        ApprovalFailed: If an unexpected error occurs.
    """
    try:
        user = get_user_by_id(db, user_id)

        if not user:
            logger.warning(
                "User not found for approval: user_id=%s",
                user_id,
            )
            raise UserNotFound()

        if user.is_active:
            logger.warning(
                "User already active: user_id=%s, status=%s",
                user_id,
                user.status,
            )
            raise UserAlreadyActive()

        role = get_role_by_id(db, role_id)

        if not role:
            logger.warning(
                "Role not found for approval: role_id=%s",
                role_id,
            )
            raise RoleNotFound()

        user.role_id = role.id
        user.status = USER_STATUS_ACTIVE
        user.is_active = True

        # ── Audit trail ──────────────────────────────────────────────
        # Record who approved this user. created_by is only set on the
        # first approval; subsequent approvals via the user module will
        # update updated_by but leave created_by intact.
        if approved_by is not None:
            if user.created_by is None:
                user.created_by = approved_by
            user.updated_by = approved_by

        db.commit()
        db.refresh(user)

        logger.info(
            "User approved: id=%s, role=%s, approved_by=%s",
            user.id,
            role.name,
            approved_by,
        )

        return user

    except (UserNotFound, UserAlreadyActive, RoleNotFound):
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user approval: user_id=%s, role_id=%s",
            user_id,
            role_id,
        )
        raise ApprovalFailed()


def deactivate_user(
    db: Session,
    user_id: int,
    deactivated_by: int | None = None,
) -> User:
    """Deactivate a user by setting status to 'inactive'.

    Includes last-admin protection — the sole remaining admin cannot
    be deactivated. Populates ``updated_by`` for audit trail.

    .. note::

        Self-deactivation is checked at the route level (see
        :func:`~app.modules.auth.routes.deactivate_user_route`).

    Args:
        db: Active database session.
        user_id: Numeric ID of the user to deactivate.
        deactivated_by: The admin user ID performing the deactivation.
            Sets ``updated_by`` on the user for audit trail.

    Returns:
        The updated User ORM instance.

    Raises:
        UserNotFound: If no user exists with the given ID.
        UserAlreadyInactive: If the user is already inactive.
        LastAdminCannotBeModified: If deactivating the sole remaining admin.
        DeactivationFailed: If an unexpected error occurs.
    """
    try:
        user = get_user_by_id(db, user_id)

        if not user:
            logger.warning(
                "User not found for deactivation: user_id=%s",
                user_id,
            )
            raise UserNotFound()

        if user.status == USER_STATUS_INACTIVE:
            logger.warning(
                "User already inactive: user_id=%s",
                user_id,
            )
            raise UserAlreadyInactive()

        # ── Last-admin protection ────────────────────────────────────
        if user.role is not None and user.role.name in ("ADMIN", "CHIEF_DOCTOR"):
            if count_admin_users(db) <= 1:
                logger.warning(
                    "Blocked deactivation: would remove last admin (user_id=%s)",
                    user_id,
                )
                raise LastAdminCannotBeModified()

        user.status = USER_STATUS_INACTIVE
        user.is_active = False

        if deactivated_by is not None:
            user.updated_by = deactivated_by

        db.commit()
        db.refresh(user)

        logger.info(
            "User deactivated: id=%s, deactivated_by=%s",
            user.id,
            deactivated_by,
        )

        return user

    except (UserNotFound, UserAlreadyInactive, LastAdminCannotBeModified):
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during user deactivation: user_id=%s",
            user_id,
        )
        raise DeactivationFailed()


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> tuple[str, str]:
    """Authenticate a user by email and password.

    Normalizes the email to lowercase so that login is case-insensitive,
    then validates credentials. Returns a signed JWT access token and
    refresh token on success.

    Args:
        db: Active database session.
        email: User's email address (case-insensitive).
        password: Raw (unhashed) password.

    Returns:
        A tuple of (access_token, refresh_token) strings.

    Raises:
        InvalidCredentials: If the email or password is incorrect.
        InactiveAccount: If the account is not active.
    """
    normalized_email = email.strip().lower()

    user = get_user_by_email(db, normalized_email)

    if not user:
        logger.warning(
            "Login attempt for unknown email: %s",
            normalized_email,
        )
        raise InvalidCredentials()

    if not verify_password(password, user.password_hash):
        logger.warning(
            "Failed login (bad password): email=%s",
            normalized_email,
        )
        raise InvalidCredentials()

    if not user.is_active:
        logger.warning(
            "Login attempt on inactive account: email=%s, status=%s",
            normalized_email,
            user.status,
        )
        raise InactiveAccount()

    user.last_login_at = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token_jwt({"sub": user.email})

    # Store refresh token hash in database
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES,
    )

    try:
        db_refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
        create_refresh_token(db, db_refresh_token)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to store refresh token: email=%s",
            normalized_email,
        )
        raise

    logger.info(
        "User authenticated: email=%s, last_login=%s",
        normalized_email,
        user.last_login_at,
    )

    return access_token, refresh_token


def refresh_access_token(
    db: Session,
    refresh_token: str,
) -> str:
    """Refresh an access token using a valid refresh token.

    Validates the refresh token, checks it hasn't been revoked or expired,
    then issues a new access token.

    Args:
        db: Active database session.
        refresh_token: The raw refresh token string.

    Returns:
        A new JWT access token string.

    Raises:
        InvalidRefreshToken: If the token is invalid, expired, or revoked.
    """
    try:
        from app.core.security import decode_refresh_token
        payload = decode_refresh_token(refresh_token)
    except Exception:
        logger.warning("Invalid refresh token format")
        raise InvalidRefreshToken()

    email: str | None = payload.get("sub")
    jti: str | None = payload.get("jti")

    if email is None or jti is None:
        logger.warning("Refresh token missing required claims")
        raise InvalidRefreshToken()

    token_hash = hash_token(refresh_token)
    db_token = get_refresh_token_by_hash(db, token_hash)

    if db_token is None:
        logger.warning(
            "Refresh token not found in database: email=%s",
            email,
        )
        raise InvalidRefreshToken()

    if db_token.revoked_at is not None:
        logger.warning(
            "Refresh token has been revoked: email=%s",
            email,
        )
        raise InvalidRefreshToken()

    # Check expiration
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc):
        logger.warning(
            "Refresh token has expired: email=%s",
            email,
        )
        raise InvalidRefreshToken()

    # Verify the user still exists and is active
    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        logger.warning(
            "Refresh token user not found or inactive: email=%s",
            email,
        )
        raise InvalidRefreshToken()

    # Issue new access token
    new_access_token = create_access_token({"sub": user.email})

    logger.info(
        "Access token refreshed: email=%s",
        email,
    )

    return new_access_token


def request_password_reset(
    db: Session,
    email: str,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Start the password-recovery flow for an email address.

    Anti-enumeration contract: the caller must return the SAME generic
    response whether or not the account exists. When the account exists a
    single-use, expiring reset token is created and the reset link is
    handed to the email service; when it does not, nothing is created and
    no email is sent — but the public behaviour is indistinguishable.

    Revocation semantics: requesting a new reset revokes all of the user's
    outstanding (unused, unrevoked) tokens, so older links stop working.

    Args:
        db: Active database session.
        email: The email address as entered by the user (case-insensitive).
        background_tasks: Optional FastAPI background tasks. When provided,
            the reset email is dispatched after the HTTP response is sent
            (so the request never waits on SMTP — this keeps the response
            time uniform and removes the SMTP round-trip as an
            account-enumeration timing signal). When omitted (e.g. direct
            service calls), delivery happens synchronously.

    Raises:
        PasswordResetRequestFailed: On an unexpected database error
            (surfaced as a generic 500 — never account-specific).
    """
    normalized_email = email.strip().lower()

    user = get_user_by_email(db, normalized_email)

    if user is None:
        logger.warning(
            "Password reset requested for unknown email: %s",
            normalized_email,
        )
        return

    raw_token = generate_password_reset_token()
    token_hash = hash_password_reset_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    try:
        revoke_user_password_reset_tokens(db, user.id, now)
        create_password_reset_token(
            db,
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            ),
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during password reset request: user_id=%s",
            user.id,
        )
        raise PasswordResetRequestFailed()

    # The reset link must be built from the configured frontend base URL —
    # never a hardcoded origin. The raw token travels only inside this link.
    reset_url = (
        f"{settings.FRONTEND_BASE_URL.rstrip('/')}"
        f"/auth/reset-password?token={raw_token}"
    )

    if background_tasks is not None:
        background_tasks.add_task(
            email_service.send_password_reset_email,
            user.email,
            reset_url,
        )
    else:
        email_service.send_password_reset_email(user.email, reset_url)

    logger.info(
        "Password reset requested: user_id=%s, email_delivery_attempted=%s",
        user.id,
        email_service.is_configured,
    )


def reset_password(
    db: Session,
    token: str,
    new_password: str,
) -> User:
    """Complete a password reset using a valid reset token.

    The presented token is hashed and matched against stored digests; the
    raw token is never compared, stored, or logged. A token is accepted
    only when it exists, is unexpired, unused, unrevoked, and belongs to an
    active account. Successful resets mark the token used (single use) and
    replace the stored password hash.

    Sessions are NOT invalidated server-side: the architecture uses
    stateless JWT access tokens with no session table or blacklist, so an
    already-issued JWT remains valid until its natural expiry (30 min).
    Requiring a fresh login after the reset is the documented behaviour.

    Args:
        db: Active database session.
        token: The raw reset token from the email link.
        new_password: The new plain-text password (validated by schema).

    Returns:
        The updated User ORM instance.

    Raises:
        InvalidResetToken: If the token is missing, expired, already used,
            revoked, or the account is disabled (generic message).
        PasswordResetFailed: On an unexpected database error.
    """
    token_hash = hash_password_reset_token(token)
    now = datetime.now(timezone.utc)

    try:
        pwd_token = get_password_reset_token_by_hash(db, token_hash)

        if pwd_token is None:
            raise InvalidResetToken()

        if pwd_token.used_at is not None or pwd_token.revoked_at is not None:
            raise InvalidResetToken()

        # SQLite stores naive datetimes; Postgres returns timezone-aware.
        # Normalize so the comparison works on both backends.
        expires_at = pwd_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= now:
            raise InvalidResetToken()

        user = get_user_by_id(db, pwd_token.user_id)

        # Disabled (inactive/pending) accounts cannot reset — possession of
        # a token must not be able to reactivate or alter a locked account.
        if user is None or not user.is_active:
            raise InvalidResetToken()

        user.password_hash = hash_password(new_password)
        mark_password_reset_token_used(db, pwd_token, now)
        db.commit()

        logger.info(
            "Password reset completed: user_id=%s",
            user.id,
        )

        return user

    except InvalidResetToken:
        raise

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected error during password reset",
        )
        raise PasswordResetFailed()