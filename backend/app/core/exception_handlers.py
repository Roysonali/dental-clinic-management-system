import logging

from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.modules.auth.exceptions import (
    ApprovalFailed,
    AuthException,
    DeactivationFailed,
    EmailAlreadyRegistered,
    InactiveAccount,
    InvalidCredentials,
    RegistrationFailed,
    RoleNotFound,
    UserAlreadyActive,
    UserAlreadyInactive,
    UserNotFound,
)
from app.modules.patients.exceptions import (
    DuplicatePatientDetected,
    InvalidPatientOperation,
    PatientCreationFailed,
    PatientException,
    PatientNotFound,
    PatientUpdateFailed,
    PatientValidationFailed,
)


logger = logging.getLogger(__name__)


def _error_response(
    message: str,
    details: object = None,
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
) -> JSONResponse:
    """Build a consistent JSON error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "details": details,
        },
    )


_AUTH_EXCEPTION_MAP: dict[type[AuthException], int] = {
    InvalidCredentials: status.HTTP_401_UNAUTHORIZED,
    InactiveAccount: status.HTTP_403_FORBIDDEN,
    EmailAlreadyRegistered: status.HTTP_409_CONFLICT,
    UserNotFound: status.HTTP_404_NOT_FOUND,
    UserAlreadyActive: status.HTTP_400_BAD_REQUEST,
    UserAlreadyInactive: status.HTTP_400_BAD_REQUEST,
    RoleNotFound: status.HTTP_404_NOT_FOUND,
    RegistrationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ApprovalFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DeactivationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
}

_PATIENT_EXCEPTION_MAP: dict[type[PatientException], int] = {
    PatientNotFound: status.HTTP_404_NOT_FOUND,
    DuplicatePatientDetected: status.HTTP_409_CONFLICT,
    InvalidPatientOperation: status.HTTP_400_BAD_REQUEST,
    PatientValidationFailed: status.HTTP_422_UNPROCESSABLE_CONTENT,
    PatientCreationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    PatientUpdateFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


async def auth_exception_handler(
    request: Request,
    exc: AuthException,
) -> JSONResponse:
    """Handle any AuthException subclass and map it to the correct HTTP status."""
    http_status = _AUTH_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "Auth exception handled: code=%s, status=%d, path=%s",
        exc.code,
        http_status,
        request.url.path,
    )
    return _error_response(
        message=exc.message,
        details=exc.details,
        status_code=http_status,
    )


async def patient_exception_handler(
    request: Request,
    exc: PatientException,
) -> JSONResponse:
    """Handle any PatientException subclass and map it to the correct HTTP status."""
    http_status = _PATIENT_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "Patient exception handled: code=%s, status=%d, path=%s",
        exc.code,
        http_status,
        request.url.path,
    )
    return _error_response(
        message=exc.message,
        details=exc.details,
        status_code=http_status,
    )


async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Handle standard FastAPI HTTPExceptions (401, 403, 404, etc.)."""
    logger.warning(
        "HTTP exception handled: status=%d, path=%s, detail=%s",
        exc.status_code,
        request.url.path,
        exc.detail,
    )
    return _error_response(
        message=str(exc.detail),
        details=None,
        status_code=exc.status_code,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic validation errors with a clean, structured response."""
    errors = exc.errors()
    logger.warning(
        "Validation error: path=%s, errors=%s",
        request.url.path,
        errors,
    )
    return _error_response(
        message="Request validation failed",
        details=errors,
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catch any unhandled exception and return a safe 500 without a stack trace."""
    logger.exception(
        "Unhandled exception: path=%s, method=%s",
        request.url.path,
        request.method,
    )
    return _error_response(
        message="An unexpected error occurred",
        details=None,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def register_exception_handlers(app) -> None:
    """Register all exception handlers on the given FastAPI application."""
    app.add_exception_handler(
        AuthException,
        auth_exception_handler,
    )
    app.add_exception_handler(
        PatientException,
        patient_exception_handler,
    )
    app.add_exception_handler(
        HTTPException,
        http_exception_handler,
    )
    app.add_exception_handler(
        RequestValidationError,
        validation_exception_handler,
    )
    app.add_exception_handler(
        Exception,
        unhandled_exception_handler,
    )
