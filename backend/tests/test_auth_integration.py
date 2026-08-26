"""Integration tests for the Authentication module API endpoints."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.modules.auth.models import User
from app.core.constants import USER_STATUS_PENDING, USER_STATUS_ACTIVE, USER_STATUS_INACTIVE
from app.core.security import create_access_token


def test_register_success(client, db):
    payload = {"full_name": "New User", "email": "new@example.com", "password": "Strong@Pass1"}
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 201
    u = db.query(User).filter(User.email == "new@example.com").first()
    assert u is not None and u.status == USER_STATUS_PENDING and not u.is_active


def test_register_duplicate(client, pending_user):
    r = client.post("/auth/register", json={"full_name": "Another User", "email": "pending@example.com", "password": "Strong@Pass1"})
    assert r.status_code == 409


def test_register_weak_password(client):
    r = client.post("/auth/register", json={"full_name": "Weak User", "email": "w@example.com", "password": "short"})
    assert r.status_code == 422


def test_login_success(client, active_user):
    r = client.post("/auth/login", data={"username": "active@example.com", "password": "Active@Pass1"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert "refresh_token" in r.json()
    assert r.json()["token_type"] == "bearer"


def test_login_updates_last_login_at(client, active_user, db):
    assert active_user.last_login_at is None
    client.post("/auth/login", data={"username": "active@example.com", "password": "Active@Pass1"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    db.refresh(active_user)
    assert active_user.last_login_at is not None


def test_login_invalid_credentials(client, active_user):
    r = client.post("/auth/login", data={"username": "active@example.com", "password": "WrongPass1"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post("/auth/login", data={"username": "x@example.com", "password": "X"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 401


def test_login_inactive_user(client, inactive_user):
    r = client.post("/auth/login", data={"username": "inactive@example.com", "password": "Inactive@Pass1"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 403


def test_login_pending_user(client, pending_user):
    r = client.post("/auth/login", data={"username": "pending@example.com", "password": "Pending@Pass1"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 403


def test_me_authenticated(client, active_token):
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {active_token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "active@example.com"


def test_me_no_token(client):
    assert client.get("/auth/me").status_code == 401


def test_me_invalid_token(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert r.status_code == 401


def test_me_inactive_user_rejected(client, inactive_user):
    t = create_access_token({"sub": "inactive@example.com"})
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 401


def test_pending_as_admin(auth_client, pending_user):
    r = auth_client.get("/auth/users/pending")
    assert r.status_code == 200
    assert any(u["email"] == "pending@example.com" for u in r.json())


def test_pending_no_auth(client):
    assert client.get("/auth/users/pending").status_code == 401


def test_pending_non_admin(client, active_token):
    r = client.get("/auth/users/pending", headers={"Authorization": f"Bearer {active_token}"})
    assert r.status_code == 403


def test_approve_success(auth_client, db, seed_roles):
    u = User(full_name="Approve Me", email="app@example.com", password_hash="hash123", status=USER_STATUS_PENDING, is_active=False)
    db.add(u); db.commit(); db.refresh(u)
    r = auth_client.patch(f"/auth/users/{u.id}/approve", json={"role_id": 1})
    assert r.status_code == 200
    db.refresh(u); assert u.is_active and u.status == USER_STATUS_ACTIVE


def test_approve_not_found(auth_client):
    r = auth_client.patch("/auth/users/9999/approve", json={"role_id": 1})
    assert r.status_code == 404


def test_approve_non_admin(client, active_token):
    r = client.patch("/auth/users/1/approve", json={"role_id": 1}, headers={"Authorization": f"Bearer {active_token}"})
    assert r.status_code == 403


def test_deactivate_success(auth_client, db):
    u = User(full_name="Deact Me", email="deact@example.com", password_hash="hash123", status=USER_STATUS_ACTIVE, is_active=True)
    db.add(u); db.commit(); db.refresh(u)
    r = auth_client.patch(f"/auth/users/{u.id}/deactivate")
    assert r.status_code == 200
    db.refresh(u); assert not u.is_active and u.status == USER_STATUS_INACTIVE


def test_deactivate_not_found(auth_client):
    r = auth_client.patch("/auth/users/9999/deactivate")
    assert r.status_code == 404


def test_deactivate_non_admin(client, active_token):
    r = client.patch("/auth/users/1/deactivate", headers={"Authorization": f"Bearer {active_token}"})
    assert r.status_code == 403


def test_auth_exception_format(client):
    r = client.post("/auth/login", data={"username": "nobody@example.com", "password": "X"}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 401
    d = r.json()
    assert d["success"] is False and "message" in d and "details" in d


def test_validation_error_format(client):
    r = client.post("/auth/register", json={"full_name": "", "email": "bad", "password": "short"})
    assert r.status_code == 422
    assert r.json()["success"] is False
