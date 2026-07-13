import logging
from datetime import datetime
from datetime import timezone

from sqlalchemy.orm import Session

from app.core.constants import USER_STATUS_ACTIVE
from app.core.constants import USER_STATUS_INACTIVE
from app.core.constants import USER_STATUS_PENDING
from app.core.security import create_access_token
from app.core.security import hash_password
from app.core.security import verify_password
from app.modules.auth.exceptions import (
    ApprovalFailed,
    DeactivationFailed,
    EmailAlreadyRegistered,
    InactiveAccount,
    InvalidCredentials,
    RegistrationFailed,
    RoleNotFound,
    UserAlreadyActive,
    UserAlreadyInactive,
    UserNotFound,
)

from app.modules.users.repository import count_admin_users

from app.modules.users.exceptions import LastAdminCannotBeModified
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
    db.commit()

    access_token = create_access_token({"sub": user.email})

    logger.info(
        "User authenticated: email=%s, last_login=%s",
        normalized_email,
        user.last_login_at,
    )

    return access_token