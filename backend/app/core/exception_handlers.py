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
from app.modules.patient_records.exceptions import (
    AttachmentNotFound as PatientRecordAttachmentNotFound,
    DiagnosisNotFound as PatientRecordDiagnosisNotFound,
    FollowupNotFound as PatientRecordFollowupNotFound,
    PatientRecordBusinessRule,
    PatientRecordConflict,
    PatientRecordException,
    PatientRecordNotFound,
    PrescriptionItemNotFound,
    PrescriptionNotFound as PatientRecordPrescriptionNotFound,
)
from app.modules.doctors.exceptions import (
    DoctorException,
    DoctorNotFound as DoctorNotFoundEx,
    DuplicateDoctorDetected as DuplicateDoctorDetectedEx,
    DoctorValidationFailed as DoctorValidationFailedEx,
    InvalidDoctorOperation as InvalidDoctorOperationEx,
    NotADoctorUser as NotADoctorUserEx,
    DoctorUserNotFound as DoctorUserNotFoundEx,
    ScheduleNotFound as ScheduleNotFoundEx,
    SpecializationNotFound as SpecializationNotFoundEx,
    SpecializationValidationFailed as SpecializationValidationFailedEx,
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

from app.modules.treatment.exceptions import (
    ApprovalNotFound as TreatmentPlanApprovalNotFound,
    DuplicateItemSequence as TreatmentPlanDuplicateItemSequence,
    DuplicatePlanDetected as TreatmentPlanDuplicatePlanDetected,
    DuplicateProcedureDetected as TreatmentPlanDuplicateProcedureDetected,
    EmptyPlanTransition as TreatmentPlanEmptyPlanTransition,
    InvalidDateRange as TreatmentPlanInvalidDateRange,
    InvalidItemStatusTransition as TreatmentPlanInvalidItemStatusTransition,
    InvalidPlanOperation as TreatmentPlanInvalidPlanOperation,
    InvalidToothNumber as TreatmentPlanInvalidToothNumber,
    ItemNotFound as TreatmentPlanItemNotFound,
    PatientAcknowledgmentExists as TreatmentPlanPatientAcknowledgmentExists,
    PlanAlreadyApproved as TreatmentPlanAlreadyApproved,
    PlanCreationFailed as TreatmentPlanCreationFailed,
    PlanNotDeletable as TreatmentPlanNotDeletable,
    PlanNotFound as TreatmentPlanNotFound,
    PlanNotEditable as TreatmentPlanNotEditable,
    PlanUpdateFailed as TreatmentPlanUpdateFailed,
    PlanValidationFailed as TreatmentPlanValidationFailed,
    ProcedureNotFound as TreatmentPlanProcedureNotFound,
    TreatmentPlanException,
    VersionImmutable as TreatmentPlanVersionImmutable,
    VersionNotFound as TreatmentPlanVersionNotFound,
)

from app.modules.users.exceptions import (
    ActivationFailed,
    DeactivationFailed,
    LastAdminCannotBeModified,
    RoleChangeFailed,
    RoleNotFound as UserRoleNotFound,
    SelfActivationNotAllowed,
    SelfDeactivationNotAllowed,
    SelfRoleChangeNotAllowed,
    UserAlreadyActive as UserAlreadyActiveException,
    UserAlreadyInactive as UserAlreadyInactiveException,
    UserException,
    UserNotFound as UserNotFoundException,
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

_USER_EXCEPTION_MAP: dict[type[UserException], int] = {
    UserNotFoundException: status.HTTP_404_NOT_FOUND,
    UserAlreadyActiveException: status.HTTP_400_BAD_REQUEST,
    UserAlreadyInactiveException: status.HTTP_400_BAD_REQUEST,
    UserRoleNotFound: status.HTTP_404_NOT_FOUND,
    SelfRoleChangeNotAllowed: status.HTTP_400_BAD_REQUEST,
    SelfDeactivationNotAllowed: status.HTTP_400_BAD_REQUEST,
    SelfActivationNotAllowed: status.HTTP_400_BAD_REQUEST,
    LastAdminCannotBeModified: status.HTTP_409_CONFLICT,
    RoleChangeFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ActivationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DeactivationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
}

_DOCTOR_EXCEPTION_MAP: dict[type[DoctorException], int] = {
    DoctorNotFoundEx: status.HTTP_404_NOT_FOUND,
    DoctorUserNotFoundEx: status.HTTP_404_NOT_FOUND,
    ScheduleNotFoundEx: status.HTTP_404_NOT_FOUND,
    SpecializationNotFoundEx: status.HTTP_404_NOT_FOUND,
    DuplicateDoctorDetectedEx: status.HTTP_409_CONFLICT,
    DoctorValidationFailedEx: status.HTTP_422_UNPROCESSABLE_CONTENT,
    SpecializationValidationFailedEx: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidDoctorOperationEx: status.HTTP_400_BAD_REQUEST,
    NotADoctorUserEx: status.HTTP_400_BAD_REQUEST,
}

_PATIENT_EXCEPTION_MAP: dict[type[PatientException], int] = {
    PatientNotFound: status.HTTP_404_NOT_FOUND,
    DuplicatePatientDetected: status.HTTP_409_CONFLICT,
    InvalidPatientOperation: status.HTTP_400_BAD_REQUEST,
    PatientValidationFailed: status.HTTP_422_UNPROCESSABLE_CONTENT,
    PatientCreationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    PatientUpdateFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
}

_TREATMENT_PLAN_EXCEPTION_MAP: dict[type[TreatmentPlanException], int] = {
    TreatmentPlanNotFound: status.HTTP_404_NOT_FOUND,
    TreatmentPlanDuplicatePlanDetected: status.HTTP_409_CONFLICT,
    TreatmentPlanCreationFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    TreatmentPlanUpdateFailed: status.HTTP_500_INTERNAL_SERVER_ERROR,
    TreatmentPlanValidationFailed: status.HTTP_422_UNPROCESSABLE_CONTENT,
    TreatmentPlanInvalidPlanOperation: status.HTTP_409_CONFLICT,
    TreatmentPlanNotEditable: status.HTTP_409_CONFLICT,
    TreatmentPlanEmptyPlanTransition: status.HTTP_409_CONFLICT,
    TreatmentPlanNotDeletable: status.HTTP_409_CONFLICT,
    TreatmentPlanItemNotFound: status.HTTP_404_NOT_FOUND,
    TreatmentPlanDuplicateItemSequence: status.HTTP_409_CONFLICT,
    TreatmentPlanInvalidItemStatusTransition: status.HTTP_409_CONFLICT,
    TreatmentPlanProcedureNotFound: status.HTTP_404_NOT_FOUND,
    TreatmentPlanDuplicateProcedureDetected: status.HTTP_409_CONFLICT,
    TreatmentPlanInvalidToothNumber: status.HTTP_422_UNPROCESSABLE_CONTENT,
    TreatmentPlanInvalidDateRange: status.HTTP_422_UNPROCESSABLE_CONTENT,
    TreatmentPlanVersionNotFound: status.HTTP_404_NOT_FOUND,
    TreatmentPlanVersionImmutable: status.HTTP_409_CONFLICT,
    TreatmentPlanApprovalNotFound: status.HTTP_404_NOT_FOUND,
    TreatmentPlanAlreadyApproved: status.HTTP_409_CONFLICT,
    TreatmentPlanPatientAcknowledgmentExists: status.HTTP_409_CONFLICT,
}

_PATIENT_RECORD_EXCEPTION_MAP: dict[type[PatientRecordException], int] = {
    PatientRecordNotFound: status.HTTP_404_NOT_FOUND,
    PatientRecordConflict: status.HTTP_409_CONFLICT,
    PatientRecordBusinessRule: status.HTTP_400_BAD_REQUEST,
    PatientRecordDiagnosisNotFound: status.HTTP_404_NOT_FOUND,
    PatientRecordPrescriptionNotFound: status.HTTP_404_NOT_FOUND,
    PrescriptionItemNotFound: status.HTTP_404_NOT_FOUND,
    PatientRecordAttachmentNotFound: status.HTTP_404_NOT_FOUND,
    PatientRecordFollowupNotFound: status.HTTP_404_NOT_FOUND,
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


async def user_exception_handler(
    request: Request,
    exc: UserException,
) -> JSONResponse:
    """Handle any UserException subclass and map it to the correct HTTP status."""
    http_status = _USER_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "User exception handled: code=%s, status=%d, path=%s",
        exc.code,
        http_status,
        request.url.path,
    )
    return _error_response(
        message=exc.message,
        details=exc.details,
        status_code=http_status,
    )


async def doctor_exception_handler(
    request: Request,
    exc: DoctorException,
) -> JSONResponse:
    """Handle any DoctorException subclass and map it to the correct HTTP status.

    Mapping:
    * NotFound exceptions → 404
    * Duplicate/Conflict → 409
    * Validation failures → 422
    * Invalid operations → 400
    * Everything else → 500
    """
    http_status = _DOCTOR_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "Doctor exception handled: code=%s, status=%d, path=%s",
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


async def treatment_plan_exception_handler(
    request: Request,
    exc: TreatmentPlanException,
) -> JSONResponse:
    """Handle any TreatmentPlanException subclass and map it to the correct HTTP status."""
    http_status = _TREATMENT_PLAN_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "TreatmentPlan exception handled: code=%s, status=%d, path=%s",
        exc.code,
        http_status,
        request.url.path,
    )
    return _error_response(
        message=exc.message,
        details=exc.details,
        status_code=http_status,
    )


async def patient_record_exception_handler(
    request: Request,
    exc: PatientRecordException,
) -> JSONResponse:
    """Handle any PatientRecordException subclass and map it to the correct HTTP status.

    Covers:
    * PatientRecordNotFound → 404
    * PatientRecordConflict → 409
    * PatientRecordBusinessRule → 400
    * DiagnosisNotFound → 404
    * PrescriptionNotFound → 404
    * PrescriptionItemNotFound → 404
    * AttachmentNotFound → 404
    * FollowupNotFound → 404
    """
    http_status = _PATIENT_RECORD_EXCEPTION_MAP.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    logger.warning(
        "PatientRecord exception handled: code=%s, status=%d, path=%s",
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
    """Handle Pydantic validation errors with a clean, structured response.

    Sanitises Pydantic v2 error details to remove non-serialisable objects
    (e.g. ``ValueError`` instances in ``ctx``) that would cause a
    ``TypeError`` when ``JSONResponse`` serialises the response.
    """
    errors = exc.errors()
    # Sanitise: convert any non-serialisable objects in ctx to strings
    clean_errors: list[dict] = []
    for err in errors:
        clean = dict(err)
        ctx = clean.get("ctx")
        if isinstance(ctx, dict):
            clean["ctx"] = {
                k: str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v
                for k, v in ctx.items()
            }
        clean_errors.append(clean)
    logger.warning(
        "Validation error: path=%s, errors=%s",
        request.url.path,
        clean_errors,
    )
    return _error_response(
        message="Request validation failed",
        details=clean_errors,
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
        UserException,
        user_exception_handler,
    )
    app.add_exception_handler(
        DoctorException,
        doctor_exception_handler,
    )
    app.add_exception_handler(
        PatientException,
        patient_exception_handler,
    )
    app.add_exception_handler(
        TreatmentPlanException,
        treatment_plan_exception_handler,
    )
    app.add_exception_handler(
        PatientRecordException,
        patient_record_exception_handler,
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
