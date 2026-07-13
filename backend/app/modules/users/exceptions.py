"""
User management domain exceptions.

Follows the same pattern as :mod:`app.modules.auth.exceptions`
and :mod:`app.modules.patients.exceptions` so that all domain
errors are caught by a centralized exception handler and returned
as structured ``{"success": False, "message": ..., "details": ...}``
responses.
"""

from typing import Any


class UserException(Exception):
    """Base exception for all user management errors."""

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


class UserNotFound(UserException):
    """Raised when a user lookup by ID fails."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_NOT_FOUND",
            message="User not found",
        )


class UserAlreadyActive(UserException):
    """Raised when trying to activate an already active user."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_ALREADY_ACTIVE",
            message="User is already active",
        )


class UserAlreadyInactive(UserException):
    """Raised when trying to deactivate an already inactive user."""

    def __init__(self) -> None:
        super().__init__(
            code="USER_ALREADY_INACTIVE",
            message="User is already inactive",
        )


class RoleNotFound(UserException):
    """Raised when a role lookup by ID fails."""

    def __init__(self) -> None:
        super().__init__(
            code="ROLE_NOT_FOUND",
            message="Role not found",
        )


class RoleChangeFailed(UserException):
    """Raised when an unexpected error occurs during role change."""

    def __init__(self) -> None:
        super().__init__(
            code="ROLE_CHANGE_FAILED",
            message="Role change failed. Please try again later.",
        )


class ActivationFailed(UserException):
    """Raised when an unexpected error occurs during activation."""

    def __init__(self) -> None:
        super().__init__(
            code="ACTIVATION_FAILED",
            message="Activation failed. Please try again later.",
        )


class DeactivationFailed(UserException):
    """Raised when an unexpected error occurs during deactivation."""

    def __init__(self) -> None:
        super().__init__(
            code="DEACTIVATION_FAILED",
            message="Deactivation failed. Please try again later.",
        )


class SelfRoleChangeNotAllowed(UserException):
    """Raised when an admin tries to change their own role."""

    def __init__(self) -> None:
        super().__init__(
            code="SELF_ROLE_CHANGE_NOT_ALLOWED",
            message="You cannot change your own role",
        )


class SelfDeactivationNotAllowed(UserException):
    """Raised when an admin tries to deactivate their own account."""

    def __init__(self) -> None:
        super().__init__(
            code="SELF_DEACTIVATION_NOT_ALLOWED",
            message="You cannot deactivate your own account",
        )


class SelfActivationNotAllowed(UserException):
    """Raised when an admin tries to activate their own account."""

    def __init__(self) -> None:
        super().__init__(
            code="SELF_ACTIVATION_NOT_ALLOWED",
            message="You cannot activate your own account",
        )


class LastAdminCannotBeModified(UserException):
    """Raised when an operation would leave the system with no admins."""

    def __init__(self) -> None:
        super().__init__(
            code="LAST_ADMIN_CANNOT_BE_MODIFIED",
            message="Cannot modify the last remaining admin account",
        )
