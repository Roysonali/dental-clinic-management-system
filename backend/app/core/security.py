import uuid

from datetime import datetime
from datetime import timedelta
from datetime import timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings


# Maximum clock skew (in seconds) tolerated when validating ``iat`` claims.
# This allows for minor time differences between token-issuing and
# token-consuming servers without rejecting valid tokens.
_MAX_CLOCK_SKEW_SECONDS: int = 30


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

    The token includes::

    * The original claims from ``data``
    * ``exp`` (expiration) — from ``ACCESS_TOKEN_EXPIRE_MINUTES``
    * ``iat`` (issued at) — current UTC time
    * ``jti`` (JWT ID) — a unique hex string for token identification
    * ``token_type`` — set to ``"access"`` for forward compatibility

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
            "jti": uuid.uuid4().hex,
            "token_type": "access",
        }
    )

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

    return encoded_jwt


def decode_access_token(
    token: str,
) -> dict[str, object]:
    """Decode and validate a JWT access token.

    Verifies the signature, expiration (``exp``), and issued-at
    (``iat``) claims. Rejects tokens whose ``token_type`` is not
    ``"access"`` and tokens issued in the future (beyond the
    configured clock skew).

    Args:
        token: The raw JWT string.

    Returns:
        The decoded payload as a dict.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.JWTError: For any other decode or validation failure.
    """
    options = {
        "verify_exp": True,
        "verify_iat": True,
        "require": ["exp", "iat"],
        "leeway": _MAX_CLOCK_SKEW_SECONDS,
    }

    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        options=options,
    )

    # If a token_type claim is present it must be "access".
    # Tokens generated before this check existed simply lack the
    # claim, which is harmless — they are still valid access tokens.
    token_type: str | None = payload.get("token_type")

    if token_type is not None and token_type != "access":
        raise jwt.JWTError(
            f"Unexpected token_type: {token_type!r}"
        )

    return payload  # type: ignore[return-value]