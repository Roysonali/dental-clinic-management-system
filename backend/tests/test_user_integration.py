"""
Comprehensive integration tests for the User Management Module.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database.session import get_db
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import router as users_router
from app.modules.auth.models import User, Role
from app.core.constants import USER_STATUS_ACTIVE, USER_STATUS_INACTIVE, USER_STATUS_PENDING
from app.core.security import hash_password, create_access_token
from app.core.exception_handlers import register_exception_handlers

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    User.__table__.create(bind=engine, checkfirst=True)
    Role.__table__.create(bind=engine, checkfirst=True)
    s = TestingSessionLocal()
    yield s
    s.rollback(); s.close()
    User.__table__.drop(bind=engine, checkfirst=True)
    Role.__table__.drop(bind=engine, checkfirst=True)


@pytest.fixture
def app(db):
    application = FastAPI(title="Test")
    application.include_router(auth_router)
    application.include_router(users_router)
    register_exception_handlers(application)
    application.dependency_overrides[get_db] = lambda: db
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def seed_roles(db):
    from app.core.constants import (
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    )
    names = [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
             ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
             ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT]
    for i, n in enumerate(names, 1):
        db.add(Role(id=i, name=n))
    db.commit()


@pytest.fixture
def admin_user(db, seed_roles):
    r = db.query(Role).filter(Role.name == "ADMIN").first()
    u = User(full_name="Admin", email="admin@ex.com", password_hash=hash_password("Admin@P1"),
             status=USER_STATUS_ACTIVE, is_active=True, role_id=r.id)
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})


@pytest.fixture
def auth_client(client, admin_token):
    client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return client

@pytest.fixture
def second_admin(db, seed_roles):
    r = db.query(Role).filter(Role.name == "ADMIN").first()
    u = User(full_name="Admin2", email="admin2@ex.com", password_hash=hash_password("Adm2@P1"),
             status=USER_STATUS_ACTIVE, is_active=True, role_id=r.id)
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def target_user(db, seed_roles):
    r = db.query(Role).filter(Role.name == "RECEPTIONIST").first()
    u = User(full_name="Target", email="target@ex.com", password_hash=hash_password("Tgt@P1"),
             status=USER_STATUS_ACTIVE, is_active=True, role_id=r.id)
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def pending_user(db):
    u = User(full_name="Pending", email="pend@ex.com", password_hash=hash_password("P@ss1"),
             status=USER_STATUS_PENDING, is_active=False)
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def inactive_user(db):
    u = User(full_name="Inactive", email="inact@ex.com", password_hash=hash_password("I@ss1"),
             status=USER_STATUS_INACTIVE, is_active=False)
    db.add(u); db.commit(); db.refresh(u)
    return u


class TestAuth:
    def test_no_token_401(self, client):
        assert client.get("/users").status_code == 401
    def test_invalid_token_401(self, client):
        assert client.get("/users", headers={"Authorization": "Bearer bad"}).status_code == 401
    def test_non_admin_403(self, client, target_user):
        t = create_access_token({"sub": "target@ex.com"})
        r = client.get("/users", headers={"Authorization": f"Bearer {t}"}).status_code
        assert r == 403


class TestList:
    def test_success(self, auth_client):
        r = auth_client.get("/users")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d and "page" in d
    def test_pagination(self, auth_client):
        r = auth_client.get("/users?page=1&page_size=5")
        assert r.status_code == 200
        assert r.json()["page_size"] == 5
    def test_search(self, auth_client, target_user):
        r = auth_client.get("/users?search=Target")
        assert r.status_code == 200
        assert r.json()["total"] >= 1
    def test_empty_search(self, auth_client):
        assert auth_client.get("/users?search=NoSuchUser").json()["total"] == 0


class TestGetDetails:
    def test_success(self, auth_client, admin_user):
        r = auth_client.get(f"/users/{admin_user.id}")
        assert r.status_code == 200
        assert r.json()["email"] == "admin@ex.com"
    def test_audit_fields(self, auth_client, admin_user):
        r = auth_client.get(f"/users/{admin_user.id}")
        for field in ["created_at", "updated_at", "created_by", "updated_by"]:
            assert field in r.json()
    def test_not_found(self, auth_client):
        assert auth_client.get("/users/9999").status_code == 404


class TestRoleChange:
    def test_success(self, auth_client, target_user):
        assert auth_client.patch(f"/users/{target_user.id}/role", json={"role_id": 1}).status_code == 200
    def test_self_blocked(self, auth_client, admin_user):
        assert auth_client.patch(f"/users/{admin_user.id}/role", json={"role_id": 3}).status_code == 400
    def test_not_found(self, auth_client):
        assert auth_client.patch("/users/9999/role", json={"role_id": 1}).status_code == 404
    def test_role_not_found(self, auth_client, target_user):
        assert auth_client.patch(f"/users/{target_user.id}/role", json={"role_id": 999}).status_code == 404
    def test_invalid_role_id(self, auth_client, target_user):
        assert auth_client.patch(f"/users/{target_user.id}/role", json={"role_id": 0}).status_code == 422


class TestActivate:
    def test_pending(self, auth_client, pending_user):
        assert auth_client.patch(f"/users/{pending_user.id}/activate").status_code == 200
    def test_inactive(self, auth_client, inactive_user):
        assert auth_client.patch(f"/users/{inactive_user.id}/activate").status_code == 200
    def test_already_active(self, auth_client, target_user):
        assert auth_client.patch(f"/users/{target_user.id}/activate").status_code == 400
    def test_self_blocked(self, auth_client, admin_user):
        assert auth_client.patch(f"/users/{admin_user.id}/activate").status_code == 400
    def test_not_found(self, auth_client):
        assert auth_client.patch("/users/9999/activate").status_code == 404


class TestDeactivate:
    def test_success(self, auth_client, target_user):
        assert auth_client.patch(f"/users/{target_user.id}/deactivate").status_code == 200
    def test_already_inactive(self, auth_client, inactive_user):
        assert auth_client.patch(f"/users/{inactive_user.id}/deactivate").status_code == 400
    def test_self_blocked(self, auth_client, admin_user, second_admin):
        assert auth_client.patch(f"/users/{admin_user.id}/deactivate").status_code == 400
    def test_not_found(self, auth_client):
        assert auth_client.patch("/users/9999/deactivate").status_code == 404
    def test_updates_updated_by(self, auth_client, target_user, db):
        auth_client.patch(f"/users/{target_user.id}/deactivate")
        db.refresh(target_user)
        assert target_user.updated_by is not None


class TestAuthDeactivate:
    def test_self_blocked(self, client, admin_user, admin_token):
        c = client
        c.headers.update({"Authorization": f"Bearer {admin_token}"})
        assert c.patch(f"/auth/users/{admin_user.id}/deactivate").status_code == 400
    def test_deactivate_non_self_admin_success(self, client, admin_user, second_admin, admin_token, db):
        """Verify we can deactivate a non-self admin (multiple admins exist)."""
        c = client
        c.headers.update({"Authorization": f"Bearer {admin_token}"})
        # With 2 admins active, deactivating second_admin should succeed
        r = c.patch(f"/auth/users/{second_admin.id}/deactivate")
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.json()}"
        db.refresh(second_admin)
        assert second_admin.is_active is False
        assert second_admin.updated_by == admin_user.id
    def test_updated_by_populated(self, client, admin_user, second_admin, admin_token, db):
        c = client
        c.headers.update({"Authorization": f"Bearer {admin_token}"})
        c.patch(f"/auth/users/{second_admin.id}/deactivate")
        db.refresh(second_admin)
        assert second_admin.updated_by == admin_user.id


class TestExceptions:
    def test_user_exception_format(self, auth_client):
        r = auth_client.get("/users/9999")
        assert r.status_code == 404
        d = r.json()
        assert d["success"] is False and "message" in d and "details" in d
    def test_validation_format(self, auth_client):
        r = auth_client.patch("/users/1/role", json={"role_id": -1})
        assert r.status_code == 422
        assert r.json()["success"] is False
