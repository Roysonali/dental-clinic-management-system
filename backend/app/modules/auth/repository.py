import logging

from typing import Optional

from sqlalchemy.orm import Session

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
    """Look up a user by their email address (case-sensitive).

    Args:
        db: Active database session.
        email: The email to search for.

    Returns:
        The matching User, or None if not found.
    """
    return (
        db.query(User)
        .filter(User.email == email)
        .first()
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
    return (
        db.query(User)
        .filter(User.status == "pending")
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
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
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
    return (
        db.query(Role)
        .filter(Role.id == role_id)
        .first()
    )
