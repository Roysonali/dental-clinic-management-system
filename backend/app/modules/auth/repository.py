from typing import Optional
from sqlalchemy.orm import Session

from app.modules.auth.models import User, Role


def create_user(
    db: Session,
    user: User
) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)

    return user

def get_user_by_email(
    db: Session,
    email: str
) -> Optional[User]:
    return (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

def get_pending_users(
    db: Session
) -> list[User]:
    return (
        db.query(User)
        .filter(User.status == "pending")
        .all()
    )

def get_user_by_id(
    db: Session,
    user_id: int
) -> Optional[User]:
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

def get_role_by_id(
    db: Session,
    role_id: int
):
    return (
        db.query(Role)
        .filter(Role.id == role_id)
        .first()
    )