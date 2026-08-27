from typing import Any


class AuthException(Exception):
    """Base exception for all authentication/authorization errors."""

    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)

    def to_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class InvalidCredentials(AuthException):
    """Raised when the email or password is incorrect."""

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_CREDENTIALS",
            message="Invalid email or password",
        )


class InactiveAccount(AuthException):
    """Raised when an inactive user attempts to log in."""

    def __init__(self) -> None:
        super().__init__(
            code="INACTIVE_ACCOUNT",
            message="Account is inactive",
        )


class EmailAlreadyRegistered(AuthException):
    """Raised when a registration attempt uses an existing email."""

    def __init__(self) -> None:
        super().__init__(
            code="EMAIL_ALREADY_REGISTERED",
            message="Email already registered",
        )


class UserNotFound(AuthException):
    """Raised when a user lookup by ID fails."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_NOT_FOUND",
            message="User not found",
        )


class UserAlreadyActive(AuthException):
    """Raised when trying to approve a user who is already active."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_ALREADY_ACTIVE",
            message="User is already active",
        )


class UserAlreadyInactive(AuthException):
    """Raised when trying to deactivate a user who is already inactive."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_ALREADY_INACTIVE",
            message="User is already inactive",
        )


class RoleNotFound(AuthException):
    """Raised when a role lookup by ID fails."""

    def __init__(self) -> None:
        super().__init__(
            code="ROLE_NOT_FOUND",
            message="Role not found",
        )


class RegistrationFailed(AuthException):
    """Raised when an unexpected error occurs during registration."""

    def __init__(self) -> None:
        super().__init__(
            code="REGISTRATION_FAILED",
            message="Registration failed. Please try again later.",
        )


class ApprovalFailed(AuthException):
    """Raised when an unexpected error occurs during user approval."""

    def __init__(self) -> None:
        super().__init__(
            code="APPROVAL_FAILED",
            message="Approval failed. Please try again later.",
        )


class DeactivationFailed(AuthException):
    """Raised when an unexpected error occurs during user deactivation."""

    def __init__(self) -> None:
        super().__init__(
            code="DEACTIVATION_FAILED",
            message="Deactivation failed. Please try again later.",
        )


class InvalidResetToken(AuthException):
    """Raised when a password-reset token is missing, malformed, expired,
    already used, revoked, or otherwise unusable.

    The message is intentionally generic — it must never reveal whether the
    token existed, which account it belonged to, or why it was rejected.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_RESET_TOKEN",
            message="This password reset link is invalid or has expired.",
        )


class PasswordResetRequestFailed(AuthException):
    """Raised when an unexpected error occurs while requesting a reset.

    Surfaced as a generic 500; the forgot-password endpoint must keep its
    generic response to avoid account enumeration.
    """

    def __init__(self) -> None:
        super().__init__(
            code="PASSWORD_RESET_REQUEST_FAILED",
            message="Unable to process the request. Please try again later.",
        )


class PasswordResetFailed(AuthException):
    """Raised when an unexpected error occurs while resetting a password."""

    def __init__(self) -> None:
        super().__init__(
            code="PASSWORD_RESET_FAILED",
            message="Password reset failed. Please try again later.",
        )


class InvalidRefreshToken(AuthException):
    """Raised when a refresh token is missing, expired, revoked, or invalid."""

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_REFRESH_TOKEN",
            message="Invalid or expired refresh token",
        )
