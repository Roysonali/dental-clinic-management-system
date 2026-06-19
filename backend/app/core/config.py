import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application configuration loaded from environment variables.

    All required variables are validated at import time. If a required
    variable is missing or has an invalid value, an ``EnvironmentError``
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

        if not self.JWT_ALGORITHM:
            errors.append("JWT_ALGORITHM is not set")

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