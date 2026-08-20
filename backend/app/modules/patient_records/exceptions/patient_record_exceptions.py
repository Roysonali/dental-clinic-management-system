from __future__ import annotations

from typing import Any


class PatientRecordException(Exception):
    """Base exception for all patient record module errors.

    Every repository and service method in the patient records
    module should raise a subclass of this exception so that
    ``core/exception_handlers.py`` can catch and map them to
    the appropriate HTTP status codes consistently.

    Attributes:
        code: Machine-readable error code (e.g. ``PATIENT_RECORD_NOT_FOUND``).
        message: Human-readable description of the error.
        details: Optional payload with additional context (validation errors,
            conflicting record IDs, etc.).
    """

    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


# ==================================================================
# PatientRecord exceptions
# ==================================================================


class PatientRecordNotFound(PatientRecordException):
    """Raised when a patient record lookup by ID (or other unique
    identifier) returns no result.

    This is the most common exception in the repository layer.
    Every ``get_by_id``, ``get_by_appointment``, or similar lookup
    should raise this when the record does not exist or has been
    soft-deleted.
    """

    def __init__(
        self,
        record_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={record_id!r}" if record_id is not None else "unknown"
        super().__init__(
            code="PATIENT_RECORD_NOT_FOUND",
            message=f"Patient record {identifier} not found",
            details=details,
        )


class PatientRecordConflict(PatientRecordException):
    """Raised when a conflicting patient record already exists.

    For example, attempting to create a second record for the same
    appointment (appointment_id has a unique constraint).
    """

    def __init__(
        self,
        message: str = "Patient record conflict",
        details: Any = None,
    ) -> None:
        super().__init__(
            code="PATIENT_RECORD_CONFLICT",
            message=message,
            details=details,
        )


# ==================================================================
# Diagnosis exceptions
# ==================================================================


class DiagnosisNotFound(PatientRecordException):
    """Raised when a diagnosis lookup by ID returns no result."""

    def __init__(
        self,
        diagnosis_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={diagnosis_id!r}" if diagnosis_id is not None else "unknown"
        super().__init__(
            code="DIAGNOSIS_NOT_FOUND",
            message=f"Diagnosis {identifier} not found",
            details=details,
        )


# ==================================================================
# Prescription exceptions
# ==================================================================


class PrescriptionNotFound(PatientRecordException):
    """Raised when a prescription lookup by ID returns no result."""

    def __init__(
        self,
        prescription_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={prescription_id!r}" if prescription_id is not None else "unknown"
        super().__init__(
            code="PRESCRIPTION_NOT_FOUND",
            message=f"Prescription {identifier} not found",
            details=details,
        )


class PrescriptionItemNotFound(PatientRecordException):
    """Raised when a prescription item lookup by ID returns no result."""

    def __init__(
        self,
        item_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={item_id!r}" if item_id is not None else "unknown"
        super().__init__(
            code="PRESCRIPTION_ITEM_NOT_FOUND",
            message=f"Prescription item {identifier} not found",
            details=details,
        )


# ==================================================================
# Attachment exceptions
# ==================================================================


class AttachmentNotFound(PatientRecordException):
    """Raised when an attachment lookup by ID returns no result."""

    def __init__(
        self,
        attachment_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={attachment_id!r}" if attachment_id is not None else "unknown"
        super().__init__(
            code="ATTACHMENT_NOT_FOUND",
            message=f"Attachment {identifier} not found",
            details=details,
        )


# ==================================================================
# Follow-up exceptions
# ==================================================================


class FollowupNotFound(PatientRecordException):
    """Raised when a follow-up lookup by ID returns no result."""

    def __init__(
        self,
        followup_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={followup_id!r}" if followup_id is not None else "unknown"
        super().__init__(
            code="FOLLOWUP_NOT_FOUND",
            message=f"Follow-up {identifier} not found",
            details=details,
        )


# ==================================================================
# Attachment download exceptions
# ==================================================================


class AttachmentDownloadError(PatientRecordException):
    """Raised when an attachment's stored file cannot be served.

    Covers both legacy metadata-only rows (no ``storage_key``) and rows
    whose stored object is missing from the storage backend.  Mapped to
    HTTP 404 by the global exception handler.
    """

    def __init__(
        self,
        attachment_id: Any | None = None,
        details: Any = None,
    ) -> None:
        identifier = f"id={attachment_id!r}" if attachment_id is not None else "unknown"
        super().__init__(
            code="ATTACHMENT_DOWNLOAD_ERROR",
            message=f"Attachment file for {identifier} is not available",
            details=details,
        )


# ==================================================================
# Business rule exceptions
# ==================================================================


class PatientRecordBusinessRule(PatientRecordException):
    """Raised when a business rule prevents an operation.

    Examples:
    * Attempting to modify a finalized record.
    * Attempting to modify a soft-deleted record.
    * Attempting to finalize an already-finalized record.
    * Referring to a non-existent patient or appointment.

    This is a service-layer exception that carries a descriptive
    ``message`` and optional ``details`` for the API response.
    """

    def __init__(
        self,
        message: str = "Operation violates a business rule",
        details: Any = None,
    ) -> None:
        super().__init__(
            code="PATIENT_RECORD_BUSINESS_RULE",
            message=message,
            details=details,
        )
