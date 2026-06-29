"""
Comprehensive unit tests for the User Management Module.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from pydantic import ValidationError
from app.modules.users.exceptions import (
    ActivationFailed, DeactivationFailed, LastAdminCannotBeModified,
    RoleChangeFailed, RoleNotFound, SelfActivationNotAllowed,
    SelfDeactivationNotAllowed, SelfRoleChangeNotAllowed,
    UserAlreadyActive, UserAlreadyInactive, UserException, UserNotFound,
)
from app.modules.users.schemas import (
    ChangeRoleRequest, UserActionResponse, UserDetailResponse,
    UserListItem, UserListResponse, UserListQueryParams,
)
from app.modules.users.service import (
    get_users_service, get_user_details_service,
    change_user_role_service, activate_user_service,
    deactivate_user_service, _is_admin_user, _is_last_admin,
)


def _make_role(role_id=1, name="ADMIN"):
    r = MagicMock()
    r.id = role_id
    r.name = name
    return r


def _make_user(user_id=1, full_name="Test", email="test@ex.com",
               status="active", is_active=True, role=None,
               role_id=None, created_by=None, updated_by=None):
    u = MagicMock()
    u.id = user_id
    u.full_name = full_name
    u.email = email
    u.status = status
    u.is_active = is_active
    u.role = role
    u.role_id = role_id or (role.id if role else None)
    u.created_by = created_by
    u.updated_by = updated_by
    u.last_login_at = None
    u.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)
    u.updated_at = datetime(2025, 6, 1, tzinfo=timezone.utc)
    return u


class TestChangeRoleRequest:
    def test_valid_role_id(self):
        req = ChangeRoleRequest(role_id=2)
        assert req.role_id == 2
    def test_role_id_must_be_positive(self):
        with pytest.raises(ValidationError):
            ChangeRoleRequest(role_id=0)
        with pytest.raises(ValidationError):
            ChangeRoleRequest(role_id=-1)


class TestUserActionResponse:
    def test_valid_response(self):
        resp = UserActionResponse(user_id=1, message="OK")
        assert resp.user_id == 1
        assert resp.message == "OK"


class TestUserDetailResponse:
    def test_includes_created_by(self):
        resp = UserDetailResponse(
            id=1, full_name="T", email="t@t.com",
            status="active", is_active=True,
            role_id=1, role_name="ADMIN",
            created_by=2,
            created_at=datetime(2025,1,1,tzinfo=timezone.utc),
            updated_at=datetime(2025,6,1,tzinfo=timezone.utc),
        )
        assert resp.created_by == 2
    def test_created_by_nullable(self):
        resp = UserDetailResponse(
            id=1, full_name="T", email="t@t.com",
            status="pending", is_active=False,
        )
        assert resp.created_by is None


class TestUserListQueryParams:
    def test_defaults(self):
        p = UserListQueryParams()
        assert p.page == 1
        assert p.page_size == 10
    def test_custom(self):
        p = UserListQueryParams(search="john", role_id=2, status="active", page=2, page_size=25)
        assert p.search == "john"
        assert p.role_id == 2
        assert p.status == "active"
        assert p.page == 2
        assert p.page_size == 25


class TestHelperFunctions:
    def test_is_admin_user_with_admin_role(self):
        assert _is_admin_user(_make_user(role=_make_role(name="ADMIN")))
    def test_is_admin_user_with_chief_doctor(self):
        assert _is_admin_user(_make_user(role=_make_role(name="CHIEF_DOCTOR")))
    def test_is_admin_user_with_non_admin(self):
        assert not _is_admin_user(_make_user(role=_make_role(name="RECEPTIONIST")))
    def test_is_admin_user_no_role(self):
        assert not _is_admin_user(_make_user(role=None))
    def test_is_last_admin_true(self):
        db = MagicMock()
        with patch("app.modules.users.service.count_admin_users", return_value=1):
            assert _is_last_admin(db, _make_user(role=_make_role(name="ADMIN")))
    def test_is_last_admin_false(self):
        db = MagicMock()
        with patch("app.modules.users.service.count_admin_users", return_value=3):
            assert not _is_last_admin(db, _make_user(role=_make_role(name="ADMIN")))
    def test_is_last_admin_non_admin(self):
        db = MagicMock()
        assert not _is_last_admin(db, _make_user(role=_make_role(name="RECEPTIONIST")))


class TestGetUsersService:
    def test_paginated_list(self):
        db = MagicMock()
        users = [_make_user(user_id=i) for i in range(1, 4)]
        with patch("app.modules.users.service.get_users", return_value=(users, 25)):
            result = get_users_service(db, page=1, page_size=10)
        assert result.total == 25
        assert len(result.items) == 3
        assert result.page == 1
        assert result.page_size == 10
    def test_empty(self):
        with patch("app.modules.users.service.get_users", return_value=([], 0)):
            result = get_users_service(MagicMock())
        assert result.total == 0
    def test_passes_filters(self):
        db = MagicMock()
        with patch("app.modules.users.service.get_users", return_value=([], 0)) as m:
            get_users_service(db, search="john", role_id=2, status="active", page=2, page_size=25)
        m.assert_called_once_with(db=db, search="john", role_id=2, status="active", skip=25, limit=25)
    def test_skip_calculation(self):
        db = MagicMock()
        with patch("app.modules.users.service.get_users", return_value=([], 0)) as m:
            get_users_service(db, page=3, page_size=20)
        m.assert_called_once_with(db=db, search=None, role_id=None, status=None, skip=40, limit=20)


class TestGetUserDetails:
    def test_found(self):
        user = _make_user(user_id=5, full_name="Alice", role=_make_role(name="ADMIN"), created_by=1)
        with patch("app.modules.users.service.get_user_by_id", return_value=user):
            result = get_user_details_service(MagicMock(), 5)
        assert result.id == 5
        assert result.full_name == "Alice"
        assert result.role_name == "ADMIN"
        assert result.created_by == 1
    def test_not_found(self):
        with patch("app.modules.users.service.get_user_by_id", return_value=None):
            with pytest.raises(UserNotFound):
                get_user_details_service(MagicMock(), 999)
    def test_audit_fields(self):
        user = _make_user(created_by=2, updated_by=3)
        with patch("app.modules.users.service.get_user_by_id", return_value=user):
            result = get_user_details_service(MagicMock(), 1)
        assert result.created_by == 2
        assert result.updated_by == 3


class TestChangeRole:
    def test_success(self):
        db = MagicMock()
        user = _make_user(role=_make_role(name="ADMIN"))
        role = _make_role(name="DENTIST")
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service.get_role_by_id", return_value=role),
            patch("app.modules.users.service._is_admin_user", return_value=False),
            patch("app.modules.users.service.update_user_role") as mu,
        ):
            result = change_user_role_service(db, 1, 2, updated_by=3)
        assert result.user_id == 1
        mu.assert_called_once_with(db=db, user=user, role_id=2, updated_by=3)
        db.commit.assert_called_once()
    def test_user_not_found(self):
        db = MagicMock()
        with patch("app.modules.users.service.get_user_by_id", return_value=None):
            with pytest.raises(UserNotFound):
                change_user_role_service(db, 999, 1)
        db.rollback.assert_called_once()
    def test_role_not_found(self):
        db = MagicMock()
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=_make_user()),
            patch("app.modules.users.service.get_role_by_id", return_value=None),
        ):
            with pytest.raises(RoleNotFound):
                change_user_role_service(db, 1, 999)
        db.rollback.assert_called_once()
    def test_last_admin(self):
        db = MagicMock()
        user = _make_user(role=_make_role(name="ADMIN"))
        role = _make_role(name="RECEPTIONIST")
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service.get_role_by_id", return_value=role),
            patch("app.modules.users.service._is_admin_user", return_value=True),
            patch("app.modules.users.service._is_last_admin", return_value=True),
        ):
            with pytest.raises(LastAdminCannotBeModified):
                change_user_role_service(db, 1, 2)
        db.rollback.assert_called_once()
    def test_unexpected_error(self):
        db = MagicMock()
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=_make_user()),
            patch("app.modules.users.service.get_role_by_id", side_effect=Exception("err")),
        ):
            with pytest.raises(RoleChangeFailed):
                change_user_role_service(db, 1, 2)
        db.rollback.assert_called_once()


class TestActivate:
    def test_success(self):
        db = MagicMock()
        user = _make_user(is_active=False, status="inactive")
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service.update_user_status") as mu,
        ):
            result = activate_user_service(db, 1, updated_by=2)
        assert "activated" in result.message
        mu.assert_called_once_with(db=db, user=user, status="active", is_active=True, updated_by=2)
        db.commit.assert_called_once()
    def test_already_active(self):
        with patch("app.modules.users.service.get_user_by_id", return_value=_make_user(is_active=True)):
            with pytest.raises(UserAlreadyActive):
                activate_user_service(MagicMock(), 1)
    def test_not_found(self):
        db = MagicMock()
        with patch("app.modules.users.service.get_user_by_id", return_value=None):
            with pytest.raises(UserNotFound):
                activate_user_service(db, 999)
        db.rollback.assert_called_once()
    def test_error_rollback(self):
        db = MagicMock()
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=_make_user(is_active=False)),
            patch("app.modules.users.service.update_user_status", side_effect=Exception("err")),
        ):
            with pytest.raises(ActivationFailed):
                activate_user_service(db, 1)
        db.rollback.assert_called_once()


class TestDeactivate:
    def test_success(self):
        db = MagicMock()
        user = _make_user(is_active=True)
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service._is_last_admin", return_value=False),
            patch("app.modules.users.service.update_user_status") as mu,
        ):
            result = deactivate_user_service(db, 1, updated_by=3)
        assert "deactivated" in result.message
        mu.assert_called_once_with(db=db, user=user, status="inactive", is_active=False, updated_by=3)
        db.commit.assert_called_once()
    def test_already_inactive(self):
        with patch("app.modules.users.service.get_user_by_id", return_value=_make_user(is_active=False)):
            with pytest.raises(UserAlreadyInactive):
                deactivate_user_service(MagicMock(), 1)
    def test_not_found(self):
        db = MagicMock()
        with patch("app.modules.users.service.get_user_by_id", return_value=None):
            with pytest.raises(UserNotFound):
                deactivate_user_service(db, 999)
        db.rollback.assert_called_once()
    def test_last_admin_blocked(self):
        db = MagicMock()
        user = _make_user(is_active=True)
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service._is_last_admin", return_value=True),
        ):
            with pytest.raises(LastAdminCannotBeModified):
                deactivate_user_service(db, 1)
        db.rollback.assert_called_once()
    def test_error_rollback(self):
        db = MagicMock()
        user = _make_user(is_active=True)
        with (
            patch("app.modules.users.service.get_user_by_id", return_value=user),
            patch("app.modules.users.service._is_last_admin", return_value=False),
            patch("app.modules.users.service.update_user_status", side_effect=Exception("err")),
        ):
            with pytest.raises(DeactivationFailed):
                deactivate_user_service(db, 1)
        db.rollback.assert_called_once()


class TestUserExceptions:
    def test_basic_exceptions(self):
        assert UserNotFound().code == "USER_NOT_FOUND"
        assert UserAlreadyActive().code == "USER_ALREADY_ACTIVE"
        assert UserAlreadyInactive().code == "USER_ALREADY_INACTIVE"
        assert RoleNotFound().code == "ROLE_NOT_FOUND"
        assert LastAdminCannotBeModified().code == "LAST_ADMIN_CANNOT_BE_MODIFIED"
        assert SelfRoleChangeNotAllowed().code == "SELF_ROLE_CHANGE_NOT_ALLOWED"
        assert SelfDeactivationNotAllowed().code == "SELF_DEACTIVATION_NOT_ALLOWED"
        assert SelfActivationNotAllowed().code == "SELF_ACTIVATION_NOT_ALLOWED"
        assert RoleChangeFailed().code == "ROLE_CHANGE_FAILED"
        assert ActivationFailed().code == "ACTIVATION_FAILED"
        assert DeactivationFailed().code == "DEACTIVATION_FAILED"
    def test_hierarchy(self):
        for cls in [UserNotFound, UserAlreadyActive, UserAlreadyInactive,
                    RoleNotFound, RoleChangeFailed, ActivationFailed,
                    DeactivationFailed, SelfRoleChangeNotAllowed,
                    SelfDeactivationNotAllowed, SelfActivationNotAllowed,
                    LastAdminCannotBeModified]:
            assert issubclass(cls, UserException)
    def test_to_dict(self):
        d = UserNotFound().to_dict()
        assert "error" in d
        assert d["error"]["code"] == "USER_NOT_FOUND"
