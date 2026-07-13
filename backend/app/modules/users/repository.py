from collections.abc import Sequence

from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.modules.auth.models import User, Role


def get_users(
    db: Session,
    search: str | None = None,
    role_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 10,
) -> tuple[Sequence[User], int]:
    """
    Retrieve a paginated, filterable list of users with total count.

    Args:
        db: Active database session.
        search: Optional search term for full_name or email (case-insensitive).
        role_id: Optional role ID filter.
        status: Optional lifecycle status filter (pending/active/inactive).
        skip: Number of records to skip (for pagination).
        limit: Maximum number of records to return.

    Returns:
        A tuple of (list of User instances with role eager-loaded, total count).
    """
    # Build reusable filter conditions
    filters: list = []

    if search:
        filters.append(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    if role_id is not None:
        filters.append(User.role_id == role_id)

    if status is not None:
        filters.append(User.status == status)

    # --------------------------------------------------
    # Count query — separate from the data query so that
    # PostgreSQL can use a simple index-only scan without
    # the overhead of eager-loading relationships.
    # --------------------------------------------------
    count_stmt = select(func.count()).select_from(User)

    if filters:
        count_stmt = count_stmt.where(*filters)

    total: int = db.execute(count_stmt).scalar() or 0

    # --------------------------------------------------
    # Data query — use selectinload to avoid the
    # cartesian-product problem that joinedload causes
    # when combined with limit/offset.
    # --------------------------------------------------
    stmt = (
        select(User)
        .options(selectinload(User.role))
        .order_by(User.id.desc())
        .offset(skip)
        .limit(limit)
    )

    if filters:
        stmt = stmt.where(*filters)

    users: Sequence[User] = (
        db.execute(stmt)
        .scalars()
        .all()
    )

    return users, total


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    """
    Look up a user by primary key with their role eager-loaded.

    Args:
        db: Active database session.
        user_id: The user's numeric ID.

    Returns:
        The matching User (with role loaded), or None if not found.
    """
    stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )

    return db.execute(stmt).scalar_one_or_none()


def count_admin_users(
    db: Session,
) -> int:
    """
    Count users with admin-level roles (ADMIN or CHIEF_DOCTOR).

    Uses a JOIN with the roles table to filter by role name rather
    than hardcoding role IDs, which could change across environments.

    Args:
        db: Active database session.

    Returns:
        The total number of users whose role name is ADMIN or CHIEF_DOCTOR.
    """
    stmt = (
        select(func.count())
        .select_from(User)
        .join(User.role)
        .where(
            Role.name.in_([
                "ADMIN",
                "CHIEF_DOCTOR",
            ])
        )
    )

    return db.execute(stmt).scalar() or 0


def update_user_role(
    db: Session,
    user: User,
    role_id: int,
    updated_by: int | None = None,
):
    """Update a user's role and return the refreshed instance.

    .. note::

        Flushes but does **not** commit — the service layer owns
        the transaction lifecycle.

    Args:
        db: Active database session.
        user: The User ORM instance to update.
        role_id: New role ID to assign.
        updated_by: The user ID of the admin performing the change.
            Records the audit trail entry for this mutation.

    Returns:
        The updated User with the new role_id applied.
    """
    user.role_id = role_id

    if updated_by is not None:
        user.updated_by = updated_by

    db.flush()
    db.refresh(user)

    return user


def update_user_status(
    db: Session,
    user: User,
    status: str,
    is_active: bool,
    updated_by: int | None = None,
):
    """Update a user's status flags and return the refreshed instance.

    .. note::

        Flushes but does **not** commit — the service layer owns
        the transaction lifecycle.

    Args:
        db: Active database session.
        user: The User ORM instance to update.
        status: New lifecycle status (active/inactive/pending).
        is_active: New active flag.
        updated_by: The user ID of the admin performing the change.
            Records the audit trail entry for this mutation.

    Returns:
        The updated User with the new status applied.
    """
    user.status = status
    user.is_active = is_active

    if updated_by is not None:
        user.updated_by = updated_by

    db.flush()
    db.refresh(user)

    return user