from datetime import datetime
from datetime import timedelta
from datetime import timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt.

    Args:
        password: The raw password string.

    Returns:
        The bcrypt hash string suitable for storage.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Verify a plain-text password against its stored bcrypt hash.

    Args:
        plain_password: The raw password to check.
        hashed_password: The bcrypt hash from the database.

    Returns:
        ``True`` if the password matches the hash, ``False`` otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict[str, object],
) -> str:
    """Create a signed JWT access token.

    The token includes the original claims from ``data`` plus standard
    JWT claims ``exp`` (expiration) and ``iat`` (issued at). The
    expiration is calculated from the configured
    ``ACCESS_TOKEN_EXPIRE_MINUTES``.

    Args:
        data: Claims to embed in the token (typically ``{"sub": email}``).

    Returns:
        The encoded JWT string.
    """
    to_encode = data.copy()

    now = datetime.now(timezone.utc)

    expire = now + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
        }
    )

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

    return encoded_jwt