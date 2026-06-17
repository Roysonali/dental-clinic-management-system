from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.modules.auth.models import User, Role


def get_users(
    db: Session,
    search: str | None = None,
    role_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 10
) -> tuple[list[User], int]:

    query = (
        db.query(User)
        .options(
            joinedload(User.role)
        )
    )

    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )

    if role_id:
        query = query.filter(
            User.role_id == role_id
        )

    if status:
        query = query.filter(
            User.status == status
        )

    total = query.count()

    users = (
        query
        .order_by(User.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return users, total

def get_user_by_id(
    db: Session,
    user_id: int
):
    return (
        db.query(User)
        .options(
            joinedload(User.role)
        )
        .filter(
            User.id == user_id
        )
        .first()
    )

def get_role_by_id(
    db: Session,
    role_id: int
):
    return (
        db.query(Role)
        .filter(
            Role.id == role_id
        )
        .first()
    )

def update_user_role(
    db: Session,
    user: User,
    role_id: int
):
    user.role_id = role_id

    db.commit()

    db.refresh(user)

    return user

def update_user_status(
    db: Session,
    user: User,
    status: str,
    is_active: bool
):
    user.status = status
    user.is_active = is_active

    db.commit()

    db.refresh(user)

    return user