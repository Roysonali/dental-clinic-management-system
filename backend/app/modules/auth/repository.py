import logging

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.modules.auth.models import Role
from app.modules.auth.models import User


logger = logging.getLogger(__name__)


def create_user(
    db: Session,
    user: User,
) -> User:
    """Persist a new user record and return the refreshed ORM instance.

    Args:
        db: Active database session.
        user: Unsaved User ORM instance.

    Returns:
        The persisted User with an assigned id.
    """
    db.add(user)
    db.commit()
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
) -> Optional[User]:
    """Look up a user by their email address.

    Eager-loads the ``role`` relationship to avoid an N+1 query
    when the caller accesses ``user.role`` (e.g. RBAC dependencies).

    Args:
        db: Active database session.
        email: The email to search for (case-sensitive).

    Returns:
        The matching User (with role loaded), or None if not found.
    """
    stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.email == email)
    )

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
