import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from unittest.mock import MagicMock, patch
from app.modules.auth.service import register_user, authenticate_user, approve_user, deactivate_user, fetch_pending_users
from app.modules.auth.exceptions import EmailAlreadyRegistered, InvalidCredentials, InactiveAccount, UserNotFound, UserAlreadyActive, UserAlreadyInactive, RoleNotFound, RegistrationFailed, ApprovalFailed, DeactivationFailed
from app.modules.auth.schemas import UserRegister
from app.core.constants import USER_STATUS_PENDING, USER_STATUS_ACTIVE, USER_STATUS_INACTIVE

# make_reg,helper
def _make_reg(full_name="Test User", email="test@example.com", password="Test@Pass1"):
    return UserRegister(full_name=full_name, email=email, password=password)


def _make_user(user_id=1, full_name="Test", email="test@example.com",
               status=USER_STATUS_PENDING, is_active=False,
               role_id=None, role=None, password_hash=None):
    u = MagicMock()
    u.id = user_id
    u.full_name = full_name
    u.email = email
    u.status = status
    u.is_active = is_active
    u.role_id = role_id
    u.role = role
    u.last_login_at = None
    u.password_hash = password_hash or "$2b$12$fakehash"
    return u

def _make_role(role_id=1, name="Administrative Officer"):
    r = MagicMock()
    r.id = role_id
    r.name = name
    return r

class TestRegisterUser:
    def test_successful(self):
        db = MagicMock(); data = _make_reg()
        with patch("app.modules.auth.service.get_user_by_email",return_value=None), patch("app.modules.auth.service.hash_password",return_value="hpwd"), patch("app.modules.auth.service.create_user") as mc:
            exp = _make_user(email=data.email,status=USER_STATUS_PENDING,is_active=False)
            mc.return_value = exp
            result = register_user(db, data)
        assert result is exp and result.status==USER_STATUS_PENDING and not result.is_active
        mc.assert_called_once()
    def test_duplicate_email(self):
        db = MagicMock(); data = _make_reg()
        with patch("app.modules.auth.service.get_user_by_email",return_value=_make_user(email=data.email)):
            with pytest.raises(EmailAlreadyRegistered): register_user(db, data)
    def test_unexpected_error_rollback(self):
        db = MagicMock(); data = _make_reg()
        with patch("app.modules.auth.service.get_user_by_email",return_value=None), patch("app.modules.auth.service.hash_password",return_value="hpwd"), patch("app.modules.auth.service.create_user",side_effect=Exception("err")):
            with pytest.raises(RegistrationFailed): register_user(db, data)
        db.rollback.assert_called_once()

class TestAuthenticateUser:
    def test_successful_login(self):
        db = MagicMock()
        u = _make_user(email="t@t.com", status=USER_STATUS_ACTIVE, is_active=True)
        with (
            patch("app.modules.auth.service.get_user_by_email", return_value=u),
            patch("app.modules.auth.service.verify_password", return_value=True),
            patch("app.modules.auth.service.create_access_token", return_value="jwt"),
            patch("app.modules.auth.service.create_refresh_token_jwt", return_value="refresh_jwt"),
            patch("app.modules.auth.service.hash_token", return_value="hash"),
            patch("app.modules.auth.service.create_refresh_token") as mcr,
        ):
            result = authenticate_user(db, "t@t.com", "P1")
        assert isinstance(result, tuple) and len(result) == 2
        access_token, refresh_token = result
        assert access_token == "jwt" and refresh_token == "refresh_jwt"
        assert u.last_login_at is not None
        db.commit.assert_called_once()
        mcr.assert_called_once()

    def test_unknown_email(self):
        db = MagicMock()
        with patch("app.modules.auth.service.get_user_by_email", return_value=None):
            with pytest.raises(InvalidCredentials):
                authenticate_user(db, "u@t.com", "P1")

    def test_wrong_password(self):
        db = MagicMock()
        u = _make_user(email="t@t.com", status=USER_STATUS_ACTIVE, is_active=True)
        with (
            patch("app.modules.auth.service.get_user_by_email", return_value=u),
            patch("app.modules.auth.service.verify_password", return_value=False),
        ):
            with pytest.raises(InvalidCredentials):
                authenticate_user(db, "t@t.com", "W")

    def test_inactive_account(self):
        db = MagicMock()
        u = _make_user(email="i@t.com", status=USER_STATUS_INACTIVE, is_active=False)
        with (
            patch("app.modules.auth.service.get_user_by_email", return_value=u),
            patch("app.modules.auth.service.verify_password", return_value=True),
        ):
            with pytest.raises(InactiveAccount):
                authenticate_user(db, "i@t.com", "P1")

    def test_case_insensitive_email(self):
        db = MagicMock()
        u = _make_user(email="test@example.com", status=USER_STATUS_ACTIVE, is_active=True)
        with (
            patch("app.modules.auth.service.get_user_by_email", return_value=u) as mg,
            patch("app.modules.auth.service.verify_password", return_value=True),
            patch("app.modules.auth.service.create_access_token", return_value="t"),
            patch("app.modules.auth.service.create_refresh_token_jwt", return_value="r"),
            patch("app.modules.auth.service.hash_token", return_value="h"),
            patch("app.modules.auth.service.create_refresh_token"),
        ):
            authenticate_user(db, "TEST@EXAMPLE.COM", "P1")
        assert mg.call_args[0][1] == "test@example.com"

class TestApproveUser:
    def test_successful(self):
        db = MagicMock(); u = _make_user(user_id=1,status=USER_STATUS_PENDING,is_active=False)
        r = _make_role(role_id=2,name="General Doctor")
        with patch("app.modules.auth.service.get_user_by_id",return_value=u), patch("app.modules.auth.service.get_role_by_id",return_value=r):
            result = approve_user(db, 1, 2)
        assert result.is_active and result.status==USER_STATUS_ACTIVE and result.role_id==2
        db.commit.assert_called_once()
    def test_user_not_found(self):
        db = MagicMock()
        with patch("app.modules.auth.service.get_user_by_id",return_value=None):
            with pytest.raises(UserNotFound): approve_user(db, 999, 1)
    def test_already_active(self):
        db = MagicMock()
        u = _make_user(user_id=1,status=USER_STATUS_ACTIVE,is_active=True)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u):
            with pytest.raises(UserAlreadyActive): approve_user(db, 1, 1)
    def test_role_not_found(self):
        db = MagicMock()
        u = _make_user(user_id=1,status=USER_STATUS_PENDING,is_active=False)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u), patch("app.modules.auth.service.get_role_by_id",return_value=None):
            with pytest.raises(RoleNotFound): approve_user(db, 1, 999)
    def test_error_rollback(self):
        db = MagicMock(); db.commit.side_effect = Exception("err")
        u = _make_user(user_id=1,status=USER_STATUS_PENDING,is_active=False)
        r = _make_role(role_id=2)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u), patch("app.modules.auth.service.get_role_by_id",return_value=r):
            with pytest.raises(ApprovalFailed): approve_user(db, 1, 2)
        db.rollback.assert_called_once()

class TestDeactivateUser:
    def test_successful(self):
        db = MagicMock()
        u = _make_user(user_id=1,status=USER_STATUS_ACTIVE,is_active=True)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u):
            result = deactivate_user(db, 1)
        assert not result.is_active and result.status==USER_STATUS_INACTIVE
        db.commit.assert_called_once()
    def test_user_not_found(self):
        db = MagicMock()
        with patch("app.modules.auth.service.get_user_by_id",return_value=None):
            with pytest.raises(UserNotFound): deactivate_user(db, 999)
    def test_already_inactive(self):
        db = MagicMock()
        u = _make_user(user_id=1,status=USER_STATUS_INACTIVE,is_active=False)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u):
            with pytest.raises(UserAlreadyInactive): deactivate_user(db, 1)
    def test_error_rollback(self):
        db = MagicMock(); db.commit.side_effect = Exception("err")
        u = _make_user(user_id=1,status=USER_STATUS_ACTIVE,is_active=True)
        with patch("app.modules.auth.service.get_user_by_id",return_value=u):
            with pytest.raises(DeactivationFailed): deactivate_user(db, 1)
        db.rollback.assert_called_once()

class TestFetchPendingUsers:
    def test_returns_list(self):
        db = MagicMock()
        exp = [_make_user(user_id=1,email="u1@t.com",status=USER_STATUS_PENDING), _make_user(user_id=2,email="u2@t.com",status=USER_STATUS_PENDING)]
        with patch("app.modules.auth.service.get_pending_users",return_value=exp):
            result = fetch_pending_users(db)
        assert result == exp and len(result) == 2
