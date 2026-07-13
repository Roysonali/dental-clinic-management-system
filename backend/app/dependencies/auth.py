import logging

from jose import ExpiredSignatureError
from jose import JWTError

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.core.security import decode_access_token
from app.database.session import get_db
from app.modules.auth.models import User
from app.modules.auth.repository import get_user_by_email


logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode the JWT token and return the authenticated user.

    Extracts the ``sub`` claim (email) from the JWT, looks up the
    corresponding user in the database, and returns the ORM instance.

    Args:
        token: Raw JWT string from the ``Authorization`` header.
        db: Active database session.

    Returns:
        The authenticated User ORM instance.

    Raises:
        HTTPException 401: If the token is invalid, expired, malformed,
            or the referenced user no longer exists.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)

        email: str | None = payload.get("sub")

        if email is None:
            logger.warning(
                "JWT missing 'sub' claim: token_prefix=%s...",
                token[:10],
            )
            raise credentials_exception

    except ExpiredSignatureError:
        logger.warning(
            "JWT expired: token_prefix=%s...",
            token[:10],
        )
        raise credentials_exception

    except JWTError:
        logger.warning(
            "JWT decode failed (malformed/invalid): token_prefix=%s...",
            token[:10],
        )
        raise credentials_exception

    user = get_user_by_email(
        db,
        email,
        load_options=[selectinload(User.role)],
    )

    if not user:
        logger.warning(
            "Authenticated user not found in DB: email=%s",
            email,
        )
        raise credentials_exception

    if not user.is_active:
        logger.warning(
            "Inactive user attempted API access: email=%s, status=%s",
            email,
            user.status,
        )
        raise credentials_exception

    logger.debug(
        "Authenticated user: id=%s, email=%s",
        user.id,
        user.email,
    )

    return user