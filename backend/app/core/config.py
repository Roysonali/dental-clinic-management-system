import os

from dotenv import load_dotenv

load_dotenv()

# Only HMAC-SHA variants are allowed. The ``none`` algorithm would disable
# signature verification entirely — it is explicitly excluded here.
_ALLOWED_JWT_ALGORITHMS: frozenset[str] = frozenset({
    "HS256",
    "HS384",
    "HS512",
})

# NIST SP 800-131A recommends a minimum 112-bit security strength for HMAC.
# HS256 uses 256-bit keys, so 32 bytes (256 bits) is the recommended minimum.
_JWT_SECRET_MIN_LENGTH: int = 32


class Settings:
    """Application configuration loaded from environment variables.

    All required values are validated at import time. If a required
    variable is missing, invalid, or insecure, an ``EnvironmentError``
    is raised immediately so the application fails fast.
    """

    # ── Database ──────────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # ── JWT ────────────────────────────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # ── Password recovery ───────────────────────────────────────────────
    # Base URL of the frontend application used to build password-reset
    # links. The localhost default is for local development only — a
    # production deployment MUST set FRONTEND_BASE_URL to the real origin
    # (e.g. https://app.denscare.clinic).
    FRONTEND_BASE_URL: str = os.getenv(
        "FRONTEND_BASE_URL",
        "http://localhost:5173",
    )

    # Reset tokens expire after this many minutes. 30 is the documented
    # default — short enough to limit a leaked token's usefulness, long
    # enough for a typical user to finish the flow.
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30")
    )

    # ── Email delivery (optional) ───────────────────────────────────────
    # No provider credentials are hardcoded. When SMTP_HOST is empty the
    # email service falls back to logging-only behaviour (see
    # app/core/email.py). All values are read from the environment.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    # STARTTLS (port 587) by default; implicit TLS (port 465) when
    # SMTP_USE_SSL=true. Both are off for plain-text local test servers.
    SMTP_USE_TLS: bool = (
        os.getenv("SMTP_USE_TLS", "true").strip().lower() != "false"
    )
    SMTP_USE_SSL: bool = (
        os.getenv("SMTP_USE_SSL", "false").strip().lower() == "true"
    )

    # Development-only: when TRUE and SMTP is not configured, the email
    # service logs the full reset link (which contains the raw token) so
    # local developers can click it. Defaults to FALSE — production must
    # never enable this.
    EMAIL_LOG_RESET_LINKS: bool = (
        os.getenv("EMAIL_LOG_RESET_LINKS", "false").strip().lower() == "true"
    )

    # ── File attachments ─────────────────────────────────────────────
    # Base directory where uploaded patient-record attachment files are
    # stored (local filesystem backend). The directory is created lazily
    # on first write. Production deployments may point this at a mounted
    # volume; swapping to an object store later only requires a new
    # ``StorageBackend`` implementation — domain logic is unaffected.
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

    # Maximum accepted attachment file size in MB. Configurable so the
    # limit lives in settings, never hardcoded in business logic.
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))

    def __init__(self) -> None:
        """Validate that all required configuration values are present."""
        errors: list[str] = []

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is not set")

        if not self.JWT_SECRET:
            errors.append("JWT_SECRET is not set")

        if len(self.JWT_SECRET) < _JWT_SECRET_MIN_LENGTH:
            errors.append(
                f"JWT_SECRET must be at least {_JWT_SECRET_MIN_LENGTH} "
                f"characters long (got {len(self.JWT_SECRET)})"
            )

        if not self.JWT_ALGORITHM:
            errors.append("JWT_ALGORITHM is not set")

        if self.JWT_ALGORITHM not in _ALLOWED_JWT_ALGORITHMS:
            errors.append(
                f"JWT_ALGORITHM={self.JWT_ALGORITHM!r} is not allowed. "
                f"Must be one of: {", ".join(sorted(_ALLOWED_JWT_ALGORITHMS))}"
            )

        if self.ACCESS_TOKEN_EXPIRE_MINUTES < 1:
            errors.append(
                "ACCESS_TOKEN_EXPIRE_MINUTES must be >= 1"
            )

        if self.REFRESH_TOKEN_EXPIRE_MINUTES < 1:
            errors.append(
                "REFRESH_TOKEN_EXPIRE_MINUTES must be >= 1"
            )

        if self.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES < 1:
            errors.append(
                "PASSWORD_RESET_TOKEN_EXPIRE_MINUTES must be >= 1"
            )

        if self.SMTP_PORT < 1 or self.SMTP_PORT > 65535:
            errors.append(
                "SMTP_PORT must be a valid TCP port (1-65535)"
            )

        if self.MAX_UPLOAD_SIZE_MB < 1:
            errors.append(
                "MAX_UPLOAD_SIZE_MB must be >= 1"
            )

        if errors:
            raise EnvironmentError(
                "Missing or invalid configuration:\n"
                + "\n".join(f"  - {err}" for err in errors)
            )


settings = Settings()