from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password

from app.modules.auth.models import User
from app.modules.auth.schemas import UserRegister

from app.modules.auth.repository import (
    get_user_by_email,
    create_user,
    get_pending_users,
    get_user_by_id,
    get_role_by_id
)
from app.core.security import (
    verify_password,
    create_access_token
)

def register_user(
    db: Session,
    user_data: UserRegister
) -> User:

    existing_user = get_user_by_email(
        db,
        user_data.email
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = hash_password(
        user_data.password
    )

    user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=hashed_password,
        status="pending",
        is_active=False
    )

    created_user = create_user(
        db,
        user
    )

    return created_user


def fetch_pending_users(
    db: Session
):
    return get_pending_users(db)


def approve_user(
    db: Session,
    user_id: int,
    role_id: int
):
    user = get_user_by_id(
        db,
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    role = get_role_by_id(
        db,
        role_id
    )

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found"
        )

    user.role_id = role.id
    user.status = "active"
    user.is_active = True

    db.commit()
    db.refresh(user)

    return user


def deactivate_user(
    db: Session,
    user_id: int
):
    user = get_user_by_id(
        db,
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.status = "inactive"
    user.is_active = False

    db.commit()
    db.refresh(user)

    return user

def authenticate_user(
    db: Session,
    email: str,
    password: str
):
    user = get_user_by_email(
        db,
        email
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.status != "active":
        raise HTTPException(
            status_code=403,
            detail="Account is inactive"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive"
        )

    access_token = create_access_token(
        {
            "sub": user.email
        }
    )

    return access_token