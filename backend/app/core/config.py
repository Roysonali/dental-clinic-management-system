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

        if errors:
            raise EnvironmentError(
                "Missing or invalid configuration:\n"
                + "\n".join(f"  - {err}" for err in errors)
            )


settings = Settings()