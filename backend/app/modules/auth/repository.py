from __future__ import annotations

import logging

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Load
from sqlalchemy.orm import Session

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
