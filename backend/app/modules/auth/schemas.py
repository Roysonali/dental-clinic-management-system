import re

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import EmailStr
from pydantic import Field
from pydantic import field_validator


def validate_password_complexity(value: str) -> str:
    """Enforce the project-wide password policy.

    Applies to every endpoint that sets a password (registration and
    password reset) so the policy is enforced identically everywhere:
    8–128 characters plus at least one uppercase letter, one lowercase
    letter, one digit, and one special (non-alphanumeric) character.

    Args:
        value: The plain-text password.

    Returns:
        The validated password unchanged.

    Raises:
        ValueError: If any policy requirement is not met.
    """
    if not re.search(r"[A-Z]", value):
        raise ValueError(
            "Password must contain at least one uppercase letter"
        )
    if not re.search(r"[a-z]", value):
        raise ValueError(
            "Password must contain at least one lowercase letter"
        )
    if not re.search(r"\d", value):
        raise ValueError(
            "Password must contain at least one digit"
        )
    if not re.search(r"[^a-zA-Z0-9]", value):
        raise ValueError(
            "Password must contain at least one special character"
        )
    return value


class UserRegister(BaseModel):
    """Request schema for new user registration."""

    model_config = ConfigDict(
        extra="forbid",
    )

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        title="Full Name",
        description="User's full display name (2–100 characters).",
        examples=["Juan Dela Cruz"],
    )

    email: EmailStr = Field(
        ...,
        title="Email Address",
        description="Valid email address used for login.",
        examples=["juan@example.com"],
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        title="Password",
        description=(
            "8–128 characters. Must contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character."
        ),
        examples=["Secure@Pass1"],
    )

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        """Strip leading/trailing whitespace and collapse internal whitespace."""
        return " ".join(value.strip().split())

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase and strip surrounding whitespace."""
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_complexity_field(cls, value: str) -> str:
        """Enforce password strength: upper, lower, digit, and special char."""
        return validate_password_complexity(value)


class RegisterResponse(BaseModel):
    """Response returned after a successful registration request."""

    model_config = ConfigDict(frozen=True)

    message: str = Field(
        ...,
        title="Response Message",
        description="Human-readable confirmation message.",
        examples=["Registration submitted. Waiting for admin approval."],
    )


class UserApprovalRequest(BaseModel):
    """Request payload for approving a pending user."""

    model_config = ConfigDict(extra="forbid")

    role_id: int = Field(
        ...,
        title="Role ID",
        description="Numeric identifier of the role to assign.",
        ge=1,
        examples=[1],
    )


class UserApprovalResponse(BaseModel):
    """Response returned after approving or deactivating a user."""

    model_config = ConfigDict(frozen=True)

    message: str = Field(
        ...,
        title="Response Message",
        description="Human-readable confirmation message.",
        examples=["User approved successfully."],
    )


class PendingUserResponse(BaseModel):
    """Summary of a pending user visible to admins."""

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    id: int = Field(
        ...,
        title="User ID",
        description="Unique numeric identifier of the user.",
        examples=[1],
    )
    full_name: str = Field(
        ...,
        title="Full Name",
        description="User's full display name.",
        examples=["Juan Dela Cruz"],
    )
    email: EmailStr = Field(
        ...,
        title="Email Address",
        description="User's email address.",
        examples=["juan@example.com"],
    )
    status: str = Field(
        ...,
        title="Account Status",
        description="Current account lifecycle status.",
        examples=["pending"],
    )


class ForgotPasswordRequest(BaseModel):
    """Request schema for requesting a password reset."""

    model_config = ConfigDict(
        extra="forbid",
    )

    email: EmailStr = Field(
        ...,
        max_length=255,
        title="Email Address",
        description="Registered email address to send reset instructions to.",
        examples=["juan@example.com"],
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase and strip surrounding whitespace."""
        return value.strip().lower()


class ForgotPasswordResponse(BaseModel):
    """Generic response for a password-reset request.

    Deliberately identical whether or not the account exists — the API must
    not reveal account existence (anti-enumeration).
    """

    model_config = ConfigDict(frozen=True)

    message: str = Field(
        ...,
        title="Response Message",
        description=(
            "Generic confirmation message that does not reveal whether "
            "the account exists."
        ),
        examples=[
            "If an account exists for this email address, you will receive password reset instructions."
        ],
    )


class ResetPasswordRequest(BaseModel):
    """Request schema for completing a password reset."""

    model_config = ConfigDict(
        extra="forbid",
    )

    token: str = Field(
        ...,
        min_length=16,
        max_length=256,
        title="Reset Token",
        description="The secure reset token received in the reset email.",
        examples=["abc123..."],
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        title="New Password",
        description=(
            "8–128 characters. Must contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character."
        ),
        examples=["Secure@Pass1"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password_complexity(cls, value: str) -> str:
        """Enforce the same password policy as registration."""
        return validate_password_complexity(value)


class ResetPasswordResponse(BaseModel):
    """Response returned after a successful password reset."""

    model_config = ConfigDict(frozen=True)

    message: str = Field(
        ...,
        title="Response Message",
        description="Human-readable confirmation message.",
        examples=["Your password has been reset successfully."],
    )


class LoginResponse(BaseModel):
    """Response containing a JWT access token after successful authentication."""

    model_config = ConfigDict(frozen=True)

    access_token: str = Field(
        ...,
        title="Access Token",
        description="JWT access token for authenticated requests.",
        examples=["eyJhbGciOiJIUzI1NiIs..."],
    )
    refresh_token: str = Field(
        ...,
        title="Refresh Token",
        description="JWT refresh token for obtaining new access tokens.",
        examples=["eyJhbGciOiJIUzI1NiIs..."],
    )
    token_type: str = Field(
        ...,
        title="Token Type",
        description="Type of the token (always 'bearer').",
        examples=["bearer"],
    )


class RefreshRequest(BaseModel):
    """Request schema for refreshing an access token."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(
        ...,
        title="Refresh Token",
        description="The refresh token obtained during login.",
        examples=["eyJhbGciOiJIUzI1NiIs..."],
    )


class RefreshResponse(BaseModel):
    """Response containing a new access token after refresh."""

    model_config = ConfigDict(frozen=True)

    access_token: str = Field(
        ...,
        title="Access Token",
        description="New JWT access token for authenticated requests.",
        examples=["eyJhbGciOiJIUzI1NiIs..."],
    )
    token_type: str = Field(
        ...,
        title="Token Type",
        description="Type of the token (always 'bearer').",
        examples=["bearer"],
    )


class CurrentUserResponse(BaseModel):
    """Profile information for the currently authenticated user."""

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    id: int = Field(
        ...,
        title="User ID",
        description="Unique numeric identifier of the user.",
        examples=[1],
    )
    full_name: str = Field(
        ...,
        title="Full Name",
        description="User's full display name.",
        examples=["Juan Dela Cruz"],
    )
    email: EmailStr = Field(
        ...,
        title="Email Address",
        description="User's email address.",
        examples=["juan@example.com"],
    )
    status: str = Field(
        ...,
        title="Account Status",
        description="Current account lifecycle status.",
        examples=["active"],
    )
