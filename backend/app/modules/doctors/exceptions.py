from typing import Any


class DoctorException(Exception):
    """Base exception for all Doctor Management Module errors.

    Every exception carries:
    * ``code`` — machine-readable error code (e.g. ``DOCTOR_NOT_FOUND``)
    * ``message`` — human-readable description
    * ``details`` — optional payload with additional context
    """

    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
    ):
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


class DoctorNotFound(DoctorException):
    """Raised when a doctor ID is not found in the database."""

    def __init__(self):
        super().__init__(
            code="DOCTOR_NOT_FOUND",
            message="Doctor does not exist",
        )


class DuplicateDoctorDetected(DoctorException):
    """Raised when a duplicate doctor_code or user_id is detected."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="DUPLICATE_DOCTOR",
            message="Possible duplicate doctor detected",
            details=details,
        )


class DoctorCreationFailed(DoctorException):
    """Raised when doctor creation fails unexpectedly."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="DOCTOR_CREATION_FAILED",
            message="Doctor creation failed",
            details=details,
        )


class DoctorUpdateFailed(DoctorException):
    """Raised when doctor update fails unexpectedly."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="DOCTOR_UPDATE_FAILED",
            message="Doctor update failed",
            details=details,
        )


class DoctorValidationFailed(DoctorException):
    """Raised when schema or business validation fails."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="DOCTOR_VALIDATION_FAILED",
            message="Doctor validation failed",
            details=details,
        )


class InvalidDoctorOperation(DoctorException):
    """Raised for invalid state transitions (e.g. deactivate already inactive)."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="INVALID_DOCTOR_OPERATION",
            message="Invalid doctor operation",
            details=details,
        )


class NotADoctorUser(DoctorException):
    """Raised when the linked User does not have a DOCTOR-family role."""

    def __init__(self):
        super().__init__(
            code="NOT_A_DOCTOR_USER",
            message="User does not have a doctor role",
        )


class DoctorUserNotFound(DoctorException):
    """Raised when a referenced User ID does not exist in the system."""

    def __init__(self):
        super().__init__(
            code="USER_NOT_FOUND",
            message="Referenced user does not exist",
        )


class ScheduleOverlap(DoctorException):
    """Raised when a schedule slot overlaps with an existing slot."""

    def __init__(self, details: Any = None):
        super().__init__(
            code="SCHEDULE_OVERLAP",
            message="Schedule slot overlaps with an existing slot",
            details=details,
        )


class SpecializationNotFound(DoctorException):
    """Raised when a specialization ID is not found."""

    def __init__(self):
        super().__init__(
            code="SPECIALIZATION_NOT_FOUND",
            message="Specialization does not exist",
        )


class PrimarySpecializationRequired(DoctorException):
    """Raised when at least one primary specialization is required but missing."""

    def __init__(self):
        super().__init__(
            code="PRIMARY_SPECIALIZATION_REQUIRED",
            message="At least one primary specialization is required",
        )


class SelfServiceNotAllowed(DoctorException):
    """Raised when a doctor attempts to modify a restricted field on their own profile."""

    def __init__(self):
        super().__init__(
            code="SELF_SERVICE_NOT_ALLOWED",
            message="Self-service modification of this field is not allowed",
        )
