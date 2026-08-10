"""Unit + integration tests for the Forgot / Reset Password flow.

Covers the security contract:
- anti-enumeration on forgot-password (identical responses)
- cryptographically secure, hashed-at-rest, single-use, expiring tokens
- invalid/expired/used/revoked tokens rejected
- password policy enforcement
- old password invalidated, new password usable for login
- no raw token, password, or hash ever exposed
"""

import sys
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from pathlib import Path
from unittest.mock import MagicMock
from unittest.mock import patch
from urllib.parse import parse_qs
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from app.modules.auth.exceptions import InvalidResetToken
from app.modules.auth.models import PasswordResetToken
from app.modules.auth.service import (
    request_password_reset,
    reset_password,
)
from app.core.constants import USER_STATUS_ACTIVE
from app.core.security import (
    hash_password,
    hash_password_reset_token,
    verify_password,
)


GENERIC_FORGOT_MESSAGE = (
    "If an account exists for this email address, "
    "you will receive password reset instructions."
)

# Raw token must satisfy ResetPasswordRequest.token (min_length=16).
VALID_RAW_TOKEN = "testtoken1234567890"
NEW_PASSWORD = "NewSecure@Pass1"


def _make_token(
    db,
    user,
    raw_token: str = VALID_RAW_TOKEN,
    *,
    expires_in_minutes: int = 30,
    used_at=None,
    revoked_at=None,
) -> PasswordResetToken:
    """Create a PasswordResetToken row directly in the test database."""
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes),
        used_at=used_at,
        revoked_at=revoked_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def _extract_token_from_email(mock_email) -> str:
    """Pull the raw token out of the reset URL captured on the email mock."""
    args = mock_email.send_password_reset_email.call_args[0]
    reset_url = args[1]
    query = parse_qs(urlparse(reset_url).query)
    return query["token"][0]


# ══════════════════════════════════════════════════════════════════════
# Forgot Password — integration
# ══════════════════════════════════════════════════════════════════════

class TestForgotPasswordIntegration:
    def test_existing_email_returns_generic_message_and_creates_token(
        self, client, db, active_user
    ):
        with patch("app.modules.auth.service.email_service") as mock_email:
            r = client.post(
                "/auth/forgot-password",
                json={"email": "active@example.com"},
            )

        assert r.status_code == 200
        assert r.json()["message"] == GENERIC_FORGOT_MESSAGE

        tokens = (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == active_user.id)
            .all()
        )
        assert len(tokens) == 1
        # Only a 64-char hex digest is stored — never the raw token.
        assert len(tokens[0].token_hash) == 64
        assert tokens[0].token_hash != VALID_RAW_TOKEN
        assert tokens[0].used_at is None
        assert tokens[0].revoked_at is None

        mock_email.send_password_reset_email.assert_called_once()
        raw = _extract_token_from_email(mock_email)
        # The emailed token hashes to the stored digest.
        assert hash_password_reset_token(raw) == tokens[0].token_hash

    def test_unknown_email_returns_same_generic_message_no_token(
        self, client, db
    ):
        with patch("app.modules.auth.service.email_service") as mock_email:
            r = client.post(
                "/auth/forgot-password",
                json={"email": "nobody@example.com"},
            )

        assert r.status_code == 200
        assert r.json()["message"] == GENERIC_FORGOT_MESSAGE
        assert db.query(PasswordResetToken).count() == 0
        mock_email.send_password_reset_email.assert_not_called()

    def test_enumeration_protection_identical_responses(self, client, active_user):
        with patch("app.modules.auth.service.email_service"):
            existing = client.post(
                "/auth/forgot-password",
                json={"email": "active@example.com"},
            )
        with patch("app.modules.auth.service.email_service"):
            unknown = client.post(
                "/auth/forgot-password",
                json={"email": "does-not-exist@example.com"},
            )

        assert existing.status_code == unknown.status_code == 200
        assert existing.json() == unknown.json()

    def test_email_is_case_insensitive(self, client, db, active_user):
        with patch("app.modules.auth.service.email_service"):
            r = client.post(
                "/auth/forgot-password",
                json={"email": "  ACTIVE@EXAMPLE.COM "},
            )
        assert r.status_code == 200
        assert (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == active_user.id)
            .count()
            == 1
        )

    def test_invalid_email_returns_422(self, client):
        r = client.post("/auth/forgot-password", json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_missing_email_returns_422(self, client):
        r = client.post("/auth/forgot-password", json={})
        assert r.status_code == 422

    def test_public_endpoint_no_auth_required(self, client):
        # No Authorization header anywhere in this test.
        r = client.post(
            "/auth/forgot-password",
            json={"email": "someone@example.com"},
        )
        assert r.status_code == 200

    def test_new_request_revokes_previous_token(self, client, db, active_user):
        with patch("app.modules.auth.service.email_service"):
            client.post(
                "/auth/forgot-password",
                json={"email": "active@example.com"},
            )
            first = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == active_user.id)
                .one()
            )
            client.post(
                "/auth/forgot-password",
                json={"email": "active@example.com"},
            )
            second = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == active_user.id)
                .order_by(PasswordResetToken.id.desc())
                .first()
            )

        assert second.id != first.id
        db.refresh(first)
        assert first.revoked_at is not None
        assert second.revoked_at is None


# ══════════════════════════════════════════════════════════════════════
# Reset Password — integration
# ══════════════════════════════════════════════════════════════════════

class TestResetPasswordIntegration:
    def test_successful_reset_changes_password_and_marks_token_used(
        self, client, db, active_user
    ):
        old_hash = active_user.password_hash
        token = _make_token(db, active_user)

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )

        assert r.status_code == 200
        assert r.json()["message"] == "Your password has been reset successfully."

        db.refresh(active_user)
        assert active_user.password_hash != old_hash
        assert verify_password(NEW_PASSWORD, active_user.password_hash)
        assert not verify_password("Active@Pass1", active_user.password_hash)

        db.refresh(token)
        assert token.used_at is not None

    def test_user_can_login_with_new_password_and_old_password_fails(
        self, client, db, active_user
    ):
        _make_token(db, active_user)

        client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )

        old_login = client.post(
            "/auth/login",
            data={
                "username": "active@example.com",
                "password": "Active@Pass1",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/auth/login",
            data={
                "username": "active@example.com",
                "password": NEW_PASSWORD,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert new_login.status_code == 200
        assert "access_token" in new_login.json()

    def test_invalid_token_rejected(self, client, active_user):
        r = client.post(
            "/auth/reset-password",
            json={"token": "garbagegarbagegarbagegarbage", "new_password": NEW_PASSWORD},
        )
        assert r.status_code == 400
        assert r.json()["success"] is False
        assert "invalid or has expired" in r.json()["message"]

    def test_expired_token_rejected(self, client, db, active_user):
        _make_token(db, active_user, expires_in_minutes=-5)

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        assert r.status_code == 400

    def test_used_token_cannot_be_reused(self, client, db, active_user):
        _make_token(db, active_user)

        first = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        assert first.status_code == 200

        second = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": "Another@Pass1"},
        )
        assert second.status_code == 400

        # The second (valid-strength) password must NOT have been applied.
        db.refresh(active_user)
        assert verify_password(NEW_PASSWORD, active_user.password_hash)

    def test_revoked_token_rejected(self, client, db, active_user):
        _make_token(
            db,
            active_user,
            revoked_at=datetime.now(timezone.utc),
        )

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        assert r.status_code == 400

    def test_missing_token_returns_422(self, client):
        r = client.post(
            "/auth/reset-password",
            json={"new_password": NEW_PASSWORD},
        )
        assert r.status_code == 422

    def test_weak_password_rejected_with_valid_token(self, client, db, active_user):
        _make_token(db, active_user)

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": "short"},
        )
        assert r.status_code == 422

        # Password complexity rules (no digit / special char) are also 422.
        r2 = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": "NoDigitsHere!"},
        )
        assert r2.status_code == 422

    def test_reset_for_inactive_user_rejected(self, client, db, inactive_user):
        _make_token(db, inactive_user)

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        assert r.status_code == 400

    def test_public_endpoint_no_auth_required(self, client):
        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        # No JWT sent; a non-existent token simply yields the generic 400 —
        # never a 401 asking for authentication.
        assert r.status_code == 400

    def test_error_response_does_not_leak_token_or_hash(self, client, db, active_user):
        _make_token(db, active_user)

        r = client.post(
            "/auth/reset-password",
            json={"token": VALID_RAW_TOKEN, "new_password": NEW_PASSWORD},
        )
        body = r.json()
        assert VALID_RAW_TOKEN not in str(body)
        assert hash_password_reset_token(VALID_RAW_TOKEN) not in str(body)


# ══════════════════════════════════════════════════════════════════════
# Service — unit tests
# ══════════════════════════════════════════════════════════════════════

def _make_user(user_id=1, email="u@example.com", is_active=True):
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.is_active = is_active
    user.password_hash = "old-hash"
    return user


class TestRequestPasswordResetService:
    def test_creates_token_commits_and_sends_email(self):
        db = MagicMock()
        user = _make_user()
        with patch(
            "app.modules.auth.service.get_user_by_email",
            return_value=user,
        ), patch(
            "app.modules.auth.service.generate_password_reset_token",
            return_value=VALID_RAW_TOKEN,
        ), patch(
            "app.modules.auth.service.hash_password_reset_token",
            return_value="h" * 64,
        ), patch(
            "app.modules.auth.service.revoke_user_password_reset_tokens",
        ) as mock_revoke, patch(
            "app.modules.auth.service.create_password_reset_token",
        ) as mock_create, patch(
            "app.modules.auth.service.email_service",
        ) as mock_email:
            request_password_reset(db, "u@example.com")

        db.commit.assert_called_once()
        mock_revoke.assert_called_once()
        created = mock_create.call_args[0][1]
        assert created.user_id == user.id
        assert created.token_hash == "h" * 64

        email_args = mock_email.send_password_reset_email.call_args[0]
        assert email_args[0] == user.email
        # The link points at the reset route and carries the raw token.
        reset_url = email_args[1]
        assert reset_url.startswith("http://localhost:5173/auth/reset-password?token=")
        assert parse_qs(urlparse(reset_url).query)["token"] == [VALID_RAW_TOKEN]

    def test_unknown_email_creates_nothing(self):
        db = MagicMock()
        with patch(
            "app.modules.auth.service.get_user_by_email",
            return_value=None,
        ), patch(
            "app.modules.auth.service.create_password_reset_token",
        ) as mock_create, patch(
            "app.modules.auth.service.email_service",
        ) as mock_email:
            request_password_reset(db, "nobody@example.com")

        mock_create.assert_not_called()
        db.commit.assert_not_called()
        mock_email.send_password_reset_email.assert_not_called()

    def test_rollback_on_error_raises_request_failed(self):
        from app.modules.auth.exceptions import PasswordResetRequestFailed

        db = MagicMock()
        db.commit.side_effect = Exception("db down")
        user = _make_user()
        with patch(
            "app.modules.auth.service.get_user_by_email",
            return_value=user,
        ), patch(
            "app.modules.auth.service.revoke_user_password_reset_tokens",
        ), patch(
            "app.modules.auth.service.create_password_reset_token",
        ):
            with pytest.raises(PasswordResetRequestFailed):
                request_password_reset(db, "u@example.com")

        db.rollback.assert_called_once()


class TestResetPasswordService:
    def test_success_updates_hash_and_marks_used(self):
        db = MagicMock()
        user = _make_user()
        token = MagicMock()
        token.used_at = None
        token.revoked_at = None
        token.expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        token.user_id = 1

        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=token,
        ), patch(
            "app.modules.auth.service.get_user_by_id",
            return_value=user,
        ), patch(
            "app.modules.auth.service.hash_password",
            return_value="new-hash",
        ) as mock_hash, patch(
            "app.modules.auth.service.mark_password_reset_token_used",
        ) as mock_used:
            result = reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)

        assert result is user
        assert user.password_hash == "new-hash"
        mock_hash.assert_called_once_with(NEW_PASSWORD)
        mock_used.assert_called_once()
        db.commit.assert_called_once()

    def test_unknown_token_raises_invalid(self):
        db = MagicMock()
        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=None,
        ):
            with pytest.raises(InvalidResetToken):
                reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)

    def test_used_token_raises_invalid(self):
        db = MagicMock()
        token = MagicMock()
        token.used_at = datetime.now(timezone.utc)
        token.revoked_at = None
        token.expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=token,
        ):
            with pytest.raises(InvalidResetToken):
                reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)

    def test_revoked_token_raises_invalid(self):
        db = MagicMock()
        token = MagicMock()
        token.used_at = None
        token.revoked_at = datetime.now(timezone.utc)
        token.expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=token,
        ):
            with pytest.raises(InvalidResetToken):
                reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)

    def test_expired_token_raises_invalid(self):
        db = MagicMock()
        token = MagicMock()
        token.used_at = None
        token.revoked_at = None
        token.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=token,
        ):
            with pytest.raises(InvalidResetToken):
                reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)

    def test_inactive_user_raises_invalid(self):
        db = MagicMock()
        token = MagicMock()
        token.used_at = None
        token.revoked_at = None
        token.expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        token.user_id = 1
        with patch(
            "app.modules.auth.service.get_password_reset_token_by_hash",
            return_value=token,
        ), patch(
            "app.modules.auth.service.get_user_by_id",
            return_value=_make_user(is_active=False),
        ):
            with pytest.raises(InvalidResetToken):
                reset_password(db, VALID_RAW_TOKEN, NEW_PASSWORD)
