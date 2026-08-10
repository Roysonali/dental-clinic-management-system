"""
Test fixtures for the Authentication module.

Provides:
- SQLite in-memory database (only users/roles tables)
- FastAPI TestClient with overridden DB dependency
- Seed roles + test users with @example.com emails
"""

import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite3"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.database.session import get_db
from app.modules.auth.routes import router as auth_router
from app.modules.auth.models import User, Role, PasswordResetToken
from app.core.constants import USER_STATUS_ACTIVE, USER_STATUS_INACTIVE, USER_STATUS_PENDING, ROLE_ADMIN
from app.core.security import hash_password, create_access_token
from app.core.exception_handlers import register_exception_handlers


# Use StaticPool so all sessions share the same in-memory SQLite connection.
# Without this, each session gets a separate private in-memory database and
# tables created by one session are invisible to another.
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def app():
    """Create a FastAPI app with the auth router and fresh DB per test."""
    # Create tables in a new session for each app instantiation
    User.__table__.create(bind=engine, checkfirst=True)
    Role.__table__.create(bind=engine, checkfirst=True)
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)

    application = FastAPI(title="DensCare Test")
    application.include_router(auth_router)
    register_exception_handlers(application)

    def _get_test_db():
        db_session = TestingSessionLocal()
        try:
            yield db_session
        finally:
            db_session.close()

    application.dependency_overrides[get_db] = _get_test_db
    return application


@pytest.fixture(scope="function")
def db():
    """Provide a DB session for direct queries in tests.

    Creates the User, Role, and PasswordResetToken tables fresh, yields a
    session, then tears down the tables so each test starts clean.
    """
    User.__table__.create(bind=engine, checkfirst=True)
    Role.__table__.create(bind=engine, checkfirst=True)
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        PasswordResetToken.__table__.drop(bind=engine, checkfirst=True)
        User.__table__.drop(bind=engine, checkfirst=True)
        Role.__table__.drop(bind=engine, checkfirst=True)


@pytest.fixture(scope="function")
def client(app: FastAPI):
    return TestClient(app)


@pytest.fixture(scope="function")
def seed_roles(db: Session):
    """Seed roles using the constant names that RBAC checks expect."""
    from app.core.constants import (
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    )
    names = [
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    ]
    roles = []
    for i, name in enumerate(names, 1):
        role = Role(id=i, name=name)
        db.add(role)
    db.commit()
    for r in db.query(Role).all():
        roles.append(r)
    return roles


@pytest.fixture(scope="function")
def admin_user(db: Session, seed_roles):
    admin_role = db.query(Role).filter(Role.name == ROLE_ADMIN).first()
    user = User(
        full_name="Admin User", email="admin@example.com",
        password_hash=hash_password("Admin@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True, role_id=admin_role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def pending_user(db: Session):
    user = User(
        full_name="Pending User", email="pending@example.com",
        password_hash=hash_password("Pending@Pass1"),
        status=USER_STATUS_PENDING, is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def active_user(db: Session):
    user = User(
        full_name="Active User", email="active@example.com",
        password_hash=hash_password("Active@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def inactive_user(db: Session):
    user = User(
        full_name="Inactive User", email="inactive@example.com",
        password_hash=hash_password("Inactive@Pass1"),
        status=USER_STATUS_INACTIVE, is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})


@pytest.fixture(scope="function")
def active_token(active_user):
    return create_access_token({"sub": active_user.email})


@pytest.fixture(scope="function")
def auth_client(client, admin_token):
    client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return client
