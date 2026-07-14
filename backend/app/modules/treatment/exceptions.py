"""Treatment Plan Module — Domain exception hierarchy.

Every domain error raised by the Treatment Plan service/validator layers
inherits from :class:`TreatmentPlanException`. Each concrete subclass carries a
stable ``code`` (used by clients and the global exception handler in
``app.core.exception_handlers``) and a human-readable ``message``.

Exceptions are grouped by nature through intermediate base classes
(``*Error``) that document intent and make the hierarchy maintainable. The
intermediate bases never carry HTTP semantics and are never raised directly —
HTTP status mapping stays in :mod:`app.core.exception_handlers`.

Per the layered architecture, exceptions are raised by the **service** and
**validator** layers and mapped to HTTP status codes at the edge, never
inside routers.
"""

from __future__ import annotations

from typing import Any


class TreatmentPlanException(Exception):
    """Base exception for all Treatment Plan domain errors."""

    code: str = "TREATMENT_PLAN_ERROR"
    default_message: str = "Treatment plan operation failed"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: Any = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to the standard DensCare error envelope."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class TreatmentPlanNotFoundError(TreatmentPlanException):
    """Base for not-found domain errors (mapped to HTTP 404)."""


class TreatmentPlanConflictError(TreatmentPlanException):
    """Base for conflict / invalid-operation errors (mapped to HTTP 409)."""


class TreatmentPlanValidationError(TreatmentPlanException):
    """Base for input / validation errors (mapped to HTTP 422)."""


# ==========================================================
# Not found (404)
# ==========================================================
class PlanNotFound(TreatmentPlanNotFoundError):
    """Raised when a treatment plan id does not resolve to a record."""

    code = "PLAN_NOT_FOUND"
    default_message = "Treatment plan not found"

    def __init__(self, plan_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Treatment plan not found: {plan_id}",
            details=details or {"plan_id": str(plan_id)},
        )


class ItemNotFound(TreatmentPlanNotFoundError):
    """Raised when a treatment plan item id does not resolve to a record."""

    code = "ITEM_NOT_FOUND"
    default_message = "Treatment plan item not found"

    def __init__(self, item_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Treatment plan item not found: {item_id}",
            details=details or {"item_id": str(item_id)},
        )


class ProcedureNotFound(TreatmentPlanNotFoundError):
    """Raised when a procedure id does not resolve to a catalog entry."""

    code = "PROCEDURE_NOT_FOUND"
    default_message = "Procedure not found"

    def __init__(self, procedure_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Procedure not found: {procedure_id}",
            details=details or {"procedure_id": str(procedure_id)},
        )


class VersionNotFound(TreatmentPlanNotFoundError):
    """Raised when a plan version id does not resolve to a record."""

    code = "VERSION_NOT_FOUND"
    default_message = "Plan version not found"

    def __init__(self, version_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Plan version not found: {version_id}",
            details=details or {"version_id": str(version_id)},
        )


class ApprovalNotFound(TreatmentPlanNotFoundError):
    """Raised when no approval record exists for a plan."""

    code = "APPROVAL_NOT_FOUND"
    default_message = "Approval record not found for this plan"

    def __init__(self, plan_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Approval record not found for plan {plan_id}",
            details=details or {"plan_id": str(plan_id)},
        )


# ==========================================================
# Conflicts / invalid operations (409)
# ==========================================================
class DuplicatePlanDetected(TreatmentPlanConflictError):
    """Raised when a generated plan code collides (should be rare)."""

    code = "DUPLICATE_PLAN"
    default_message = "A treatment plan with this code already exists"


class DuplicateItemSequence(TreatmentPlanConflictError):
    """Raised when an item sequence number is already used within a plan."""

    code = "DUPLICATE_ITEM_SEQUENCE"
    default_message = "An item with this sequence number already exists"

    def __init__(self, plan_id: Any, sequence: int, *, details: Any = None) -> None:
        super().__init__(
            f"An item with sequence {sequence} already exists in plan {plan_id}",
            details=details or {"plan_id": str(plan_id), "sequence": sequence},
        )


class DuplicateProcedureDetected(TreatmentPlanConflictError):
    """Raised when a procedure code already exists in the catalog."""

    code = "DUPLICATE_PROCEDURE"
    default_message = "A procedure with this code already exists"

    def __init__(self, code_value: str, *, details: Any = None) -> None:
        super().__init__(
            f"A procedure with code '{code_value}' already exists",
            details=details or {"code": code_value},
        )


class InvalidPlanOperation(TreatmentPlanConflictError):
    """Raised for an operation that is not permitted in the current context."""

    code = "INVALID_PLAN_OPERATION"
    default_message = "Invalid treatment plan operation"


class PlanNotEditable(TreatmentPlanConflictError):
    """Raised when a plan in a non-editable status is modified directly."""

    code = "PLAN_NOT_EDITABLE"
    default_message = "Treatment plan is not editable in its current status"

    def __init__(self, plan_id: Any, status: str, *, details: Any = None) -> None:
        super().__init__(
            f"Treatment plan {plan_id} is not editable in status '{status}'",
            details=details or {"plan_id": str(plan_id), "status": status},
        )


class EmptyPlanTransition(TreatmentPlanConflictError):
    """Raised when a status transition requires at least one item."""

    code = "EMPTY_PLAN_TRANSITION"
    default_message = "Cannot change status: plan has no items"

    def __init__(self, plan_id: Any, *, details: Any = None) -> None:
        super().__init__(
            "Cannot change status: plan has no items",
            details=details or {"plan_id": str(plan_id)},
        )


class PlanNotDeletable(TreatmentPlanConflictError):
    """Raised when deletion is attempted on a non-draft plan."""

    code = "PLAN_NOT_DELETABLE"
    default_message = "Only draft plans can be deleted"

    def __init__(self, plan_id: Any, status: str, *, details: Any = None) -> None:
        super().__init__(
            f"Only draft plans can be deleted (current status: '{status}')",
            details=details or {"plan_id": str(plan_id), "status": status},
        )


class InvalidItemStatusTransition(TreatmentPlanConflictError):
    """Raised for an illegal item status transition."""

    code = "INVALID_ITEM_STATUS_TRANSITION"
    default_message = "Invalid item status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid item status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class VersionImmutable(TreatmentPlanConflictError):
    """Raised when a version snapshot is mutated after creation."""

    code = "VERSION_IMMUTABLE"
    default_message = "Version snapshots cannot be modified"

    def __init__(self, version_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Version snapshot {version_id} is immutable",
            details=details or {"version_id": str(version_id)},
        )


class PlanAlreadyApproved(TreatmentPlanConflictError):
    """Raised when a doctor attempts to approve an already-approved plan."""

    code = "PLAN_ALREADY_APPROVED"
    default_message = "Doctor has already approved this plan"

    def __init__(self, plan_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Plan {plan_id} has already been approved",
            details=details or {"plan_id": str(plan_id)},
        )


class PatientAcknowledgmentExists(TreatmentPlanConflictError):
    """Raised when a patient acknowledgment is recorded more than once."""

    code = "PATIENT_ACKNOWLEDGMENT_EXISTS"
    default_message = "Patient acknowledgment already recorded for this plan"

    def __init__(self, plan_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Patient acknowledgment already recorded for plan {plan_id}",
            details=details or {"plan_id": str(plan_id)},
        )


# ==========================================================
# Validation (422)
# ==========================================================
class PlanValidationFailed(TreatmentPlanValidationError):
    """Raised when plan-level validation (payload/business) fails."""

    code = "PLAN_VALIDATION_FAILED"
    default_message = "Treatment plan validation failed"


class InvalidToothNumber(TreatmentPlanValidationError):
    """Raised when a tooth number is outside the valid FDI ranges."""

    code = "INVALID_TOOTH_NUMBER"
    default_message = "Invalid tooth number"

    def __init__(self, tooth_number: int, *, details: Any = None) -> None:
        super().__init__(
            "Invalid tooth number: must be in FDI range (11-48, 51-85)",
            details=details or {"tooth_number": tooth_number},
        )


class InvalidDateRange(TreatmentPlanValidationError):
    """Raised when valid_from is after valid_to."""

    code = "INVALID_DATE_RANGE"
    default_message = "Valid From must precede Valid To"

    def __init__(
        self, valid_from: Any, valid_to: Any, *, details: Any = None
    ) -> None:
        super().__init__(
            "valid_from must precede valid_to",
            details=details or {"valid_from": str(valid_from), "valid_to": str(valid_to)},
        )


# ==========================================================
# System / infrastructure (500)
# ==========================================================
class PlanCreationFailed(TreatmentPlanException):
    """Raised when plan persistence fails for a non-business reason."""

    code = "PLAN_CREATION_FAILED"
    default_message = "Failed to create treatment plan"


class PlanUpdateFailed(TreatmentPlanException):
    """Raised when plan update persistence fails for a non-business reason."""

    code = "PLAN_UPDATE_FAILED"
    default_message = "Failed to update treatment plan"
