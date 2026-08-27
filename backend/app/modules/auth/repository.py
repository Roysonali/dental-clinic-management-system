from __future__ import annotations

import logging

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Load
from sqlalchemy.orm import Session

from app.modules.auth.models import PasswordResetToken
from app.modules.auth.models import RefreshToken
from app.modules.auth.models import Role
from app.modules.auth.models import User


logger = logging.getLogger(__name__)


def create_user(
    db: Session,
    user: User,
) -> User:
    """Stage a new user record and return the refreshed instance.

    .. note::

        This method flushes but does **not** commit the transaction.
        The caller (service layer) owns the commit lifecycle.

    Args:
        db: Active database session.
        user: Unsaved User ORM instance.

    Returns:
        The persisted User with an assigned id.
    """
    db.add(user)
    db.flush()
    db.refresh(user)

    logger.info(
        "User created: id=%s, email=%s",
        user.id,
        user.email,
    )

    return user


def get_user_by_email(
    db: Session,
    email: str,
    *,
    load_options: Optional[list[Load]] = None,
) -> Optional[User]:
    """Look up a user by their email address.

    By default this is a simple equality lookup with **no** eager
    loading. Callers that need the ``role`` relationship (or other
    relationships) should pass the relevant loader strategies via
    the ``load_options`` keyword argument.

    Example::

        from sqlalchemy.orm import selectinload

        user = get_user_by_email(
            db,
            email,
            load_options=[selectinload(User.role)],
        )

    Args:
        db: Active database session.
        email: The email to search for (case-sensitive).
        load_options: Optional list of SQLAlchemy loader options
            (e.g. ``selectinload()``, ``joinedload()``) to apply.

    Returns:
        The matching User, or None if not found.
    """
    stmt = (
        select(User)
        .where(User.email == email)
    )

    if load_options:
        stmt = stmt.options(*load_options)

    return (
        db.execute(stmt)
        .scalar_one_or_none()
    )


def get_pending_users(
    db: Session,
) -> list[User]:
    """Retrieve all users whose account status is 'pending'.

    Args:
        db: Active database session.

    Returns:
        List of pending User instances.
    """
    stmt = (
        select(User)
        .where(User.status == "pending")
    )

    return (
        db.execute(stmt)
        .scalars()
        .all()
    )


def get_user_by_id(
    db: Session,
    user_id: int,
) -> Optional[User]:
    """Look up a user by their primary key.

    Args:
        db: Active database session.
        user_id: The user's numeric ID.

    Returns:
        The matching User, or None if not found.
    """
    stmt = (
        select(User)
        .where(User.id == user_id)
    )

    return (
        db.execute(stmt)
        .scalar_one_or_none()
    )


def create_password_reset_token(
    db: Session,
    pwd_token: PasswordResetToken,
) -> PasswordResetToken:
    """Stage a new password-reset token record.

    .. note::

        Flushes but does **not** commit — the service layer owns the
        transaction lifecycle.

    Args:
        db: Active database session.
        pwd_token: Unsaved PasswordResetToken ORM instance.

    Returns:
        The persisted PasswordResetToken with an assigned id.
    """
    db.add(pwd_token)
    db.flush()
    db.refresh(pwd_token)
    return pwd_token


def get_password_reset_token_by_hash(
    db: Session,
    token_hash: str,
) -> Optional[PasswordResetToken]:
    """Look up a password-reset token by its SHA-256 digest.

    Args:
        db: Active database session.
        token_hash: Hex digest of the raw reset token.

    Returns:
        The matching PasswordResetToken, or None if not found.
    """
    stmt = (
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
    )

    return (
        db.execute(stmt)
        .scalar_one_or_none()
    )


def revoke_user_password_reset_tokens(
    db: Session,
    user_id: int,
    revoked_at: datetime,
) -> None:
    """Revoke all outstanding (unused, unrevoked) reset tokens for a user.

    Called when a new reset is requested so older reset links stop working.
    Only persistence — the service decides when revocation happens.

    Args:
        db: Active database session.
        user_id: The user whose tokens should be revoked.
        revoked_at: Timestamp to record as the revocation time.
    """
    stmt = (
        select(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.revoked_at.is_(None),
        )
    )

    tokens = db.execute(stmt).scalars().all()

    for token in tokens:
        token.revoked_at = revoked_at


def mark_password_reset_token_used(
    db: Session,
    pwd_token: PasswordResetToken,
    used_at: datetime,
) -> None:
    """Mark a password-reset token as consumed (single use).

    Args:
        db: Active database session.
        pwd_token: The token to mark as used.
        used_at: Timestamp of the successful reset.
    """
    pwd_token.used_at = used_at


def get_role_by_id(
    db: Session,
    role_id: int,
) -> Optional[Role]:
    """Look up a role by its primary key.

    Args:
        db: Active database session.
        role_id: The role's numeric ID.

    Returns:
        The matching Role, or None if not found.
    """
    stmt = (
        select(Role)
        .where(Role.id == role_id)
    )

    return (
        db.execute(stmt)
        .scalar_one_or_none()
    )


def create_refresh_token(
    db: Session,
    refresh_token: RefreshToken,
) -> RefreshToken:
    """Stage a new refresh token record.

    .. note::

        Flushes but does **not** commit — the service layer owns the
        transaction lifecycle.

    Args:
        db: Active database session.
        refresh_token: Unsaved RefreshToken ORM instance.

    Returns:
        The persisted RefreshToken with an assigned id.
    """
    db.add(refresh_token)
    db.flush()
    db.refresh(refresh_token)
    return refresh_token


def get_refresh_token_by_hash(
    db: Session,
    token_hash: str,
) -> Optional[RefreshToken]:
    """Look up a refresh token by its SHA-256 digest.

    Args:
        db: Active database session.
        token_hash: Hex digest of the raw refresh token.

    Returns:
        The matching RefreshToken, or None if not found.
    """
    stmt = (
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
    )

    return (
        db.execute(stmt)
        .scalar_one_or_none()
    )


def revoke_refresh_token(
    db: Session,
    refresh_token: RefreshToken,
    revoked_at: "datetime",
) -> None:
    """Mark a single refresh token as revoked.

    Args:
        db: Active database session.
        refresh_token: The token to revoke.
        revoked_at: Timestamp to record as the revocation time.
    """
    refresh_token.revoked_at = revoked_at


def revoke_all_user_refresh_tokens(
    db: Session,
    user_id: int,
    revoked_at: "datetime",
) -> None:
    """Revoke all outstanding (unrevoked) refresh tokens for a user.

    Called on logout to invalidate all sessions.

    Args:
        db: Active database session.
        user_id: The user whose tokens should be revoked.
        revoked_at: Timestamp to record as the revocation time.
    """
    stmt = (
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )

    tokens = db.execute(stmt).scalars().all()

    for token in tokens:
        token.revoked_at = revoked_at
