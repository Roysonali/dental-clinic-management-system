"""CreditNoteValidator — aggregate business validation for Credit Notes.

Responsibilities
----------------
* **Credit note lifecycle**: existence, amount validation, remaining balance,
  expiry, void, apply.
* **Patient ownership**: credit note belongs to the specified patient.
* **Status transitions**: delegating to the state machine.
* **Immutability after issue**: credit notes in ISSUED or later cannot be
  modified.
* **Apply validation**: can only apply credit notes that are ISSUED and not
  expired/void.

Design
------
* **Read-only repositories**: ``CreditNoteRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_credit_note_transition`` in ``state_machine.py``.
* **FinancialValidator delegation**: monetary validations are forwarded to
  ``FinancialValidator``.
* **Approved exceptions only**: raises ``CreditNoteNotFound``,
  ``InvalidCreditNoteStatusTransition``, ``CreditNoteNotApplicable``,
  ``CreditNoteValidationFailed``, and other billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = CreditNoteValidator(credit_note_repo, financial_validator)

    # Before applying a credit note
    credit_note = validator.validate_credit_note_exists(credit_note_id)
    validator.validate_applicable(credit_note)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from app.modules.billing.constants import (
    CREDIT_NOTE_NUMBER_MAX_LENGTH,
    CREDIT_NOTE_REASON_MAX_LENGTH,
)
from app.modules.billing.enums import CreditNoteStatus
from app.modules.billing.exceptions import (
    CreditNoteNotApplicable,
    CreditNoteNotFound,
    CreditNoteValidationFailed,
    InvalidCreditNoteStatusTransition,
    NegativeAmountNotAllowed,
)
from app.modules.billing.models import CreditNote
from app.modules.billing.validators.financial_validator import FinancialValidator
from app.modules.billing.validators.protocols import (
    CreditNoteRepositoryProtocol,
    PatientRepositoryProtocol,
)
from app.modules.billing.validators.state_machine import (
    is_editable_state,
    is_terminal_state,
    validate_credit_note_transition,
)


class CreditNoteValidator:
    """Aggregate business rule validator for the Credit Note module.

    Args:
        credit_note_repo: Read-only ``CreditNoteRepositoryProtocol`` for
            credit note existence, uniqueness, and lookups.
        financial_validator: ``FinancialValidator`` instance for monetary
            validations.
        patient_repo: Optional ``PatientRepositoryProtocol`` for patient
            existence checks (Sprint 12A FK hardening).
    """

    def __init__(
        self,
        credit_note_repo: CreditNoteRepositoryProtocol,
        financial_validator: FinancialValidator,
        patient_repo: PatientRepositoryProtocol | None = None,
    ) -> None:
        self._credit_note_repo = credit_note_repo
        self._financial = financial_validator
        self._patient_repo = patient_repo

    # ==================================================================
    # Credit note lifecycle
    # ==================================================================

    def validate_credit_note_exists(self, credit_note_id: UUID) -> CreditNote:
        """Fetch a credit note by id and raise ``CreditNoteNotFound`` if missing.

        Returns the loaded credit note so the service can reuse it.
        """
        credit_note = self._credit_note_repo.get_by_id(credit_note_id)
        if credit_note is None:
            raise CreditNoteNotFound(credit_note_id)
        return credit_note

    def validate_status_transition(
        self,
        credit_note: CreditNote,
        new_status: CreditNoteStatus | str,
    ) -> None:
        """Validate that ``credit_note`` may transition to ``new_status``.

        Args:
            credit_note: The credit note entity.
            new_status: The requested target status.

        Raises:
            InvalidCreditNoteStatusTransition: If the transition is not allowed.
        """
        validate_credit_note_transition(
            current_status=credit_note.status,
            new_status=new_status,
        )

    def validate_editable(self, credit_note: CreditNote) -> None:
        """Validate that ``credit_note`` may be edited.

        Only credit notes in ``DRAFT`` status may be edited.

        Raises:
            CreditNoteValidationFailed: If the credit note is not in DRAFT.
        """
        if not is_editable_state(credit_note.status, aggregate="credit_note"):
            raise CreditNoteValidationFailed(
                f"Credit note {credit_note.id} is not editable in status "
                f"'{credit_note.status.value if isinstance(credit_note.status, CreditNoteStatus) else credit_note.status}'.",
                details={
                    "credit_note_id": str(credit_note.id),
                    "current_status": credit_note.status.value
                    if isinstance(credit_note.status, CreditNoteStatus)
                    else str(credit_note.status),
                },
            )

    def validate_immutable_after_issue(self, credit_note: CreditNote) -> None:
        """Ensure the credit note has reached an immutable state after issuance.

        This validator succeeds only when the credit note is already immutable.
        It is used as a guard before workflows that require the credit note
        to be in a non-editable state (issued, applied, void, or expired).

        Per business rule FI-CN-003, credit notes are immutable after issuance.

        Raises:
            CreditNoteValidationFailed:
                If the credit note is still editable (e.g. DRAFT).
        """
        if is_editable_state(credit_note.status, aggregate="credit_note"):
            raise CreditNoteValidationFailed(
                f"Credit note {credit_note.id} is immutable after issuance.",
                details={"credit_note_id": str(credit_note.id)},
            )

    # ==================================================================
    # Amount validators
    # ==================================================================

    def validate_amount_positive(
        self,
        value: object,
        *,
        field: str = "amount",
    ) -> Decimal:
        """Validate that the credit note amount is positive.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` amount.

        Raises:
            NegativeAmountNotAllowed: If ``value`` is not positive.
        """
        return self._financial.validate_positive_amount(value, field=field)

    def validate_remaining_balance(
        self,
        remaining: object,
        original: object,
    ) -> Decimal:
        """Validate that remaining balance is within ``[0, original]``.

        Args:
            remaining: The remaining amount.
            original: The original amount.

        Returns:
            The validated, quantized :class:`Decimal` remaining amount.

        Raises:
            NegativeAmountNotAllowed: If ``remaining`` is negative.
        """
        return self._financial.validate_remaining_amount(remaining, original)

    # ==================================================================
    # Expiry
    # ==================================================================

    def validate_not_expired(self, credit_note: CreditNote) -> None:
        """Validate that ``credit_note`` has not expired.

        Args:
            credit_note: The credit note to validate.

        Raises:
            CreditNoteNotApplicable: If the credit note has expired.
        """
        if credit_note.expiry_date is not None:
            today = date.today()
            if credit_note.expiry_date < today:
                raise CreditNoteNotApplicable(
                    details={
                        "credit_note_id": str(credit_note.id),
                        "expiry_date": str(credit_note.expiry_date),
                    }
                )

    def validate_expiry_date(
        self,
        expiry_date: date | None,
        issue_date: date | None = None,
    ) -> None:
        """Validate that ``expiry_date`` is after ``issue_date`` if both provided.

        Args:
            expiry_date: The expiry date to validate.
            issue_date: Optional issue date for range validation.

        Raises:
            CreditNoteValidationFailed: If the expiry date is invalid.
        """
        if expiry_date is None:
            return
        if not isinstance(expiry_date, date):
            raise CreditNoteValidationFailed(
                f"Expiry date must be a date, got {type(expiry_date).__name__!r}",
                details={"expiry_date": str(expiry_date)},
            )
        if issue_date is not None and expiry_date <= issue_date:
            raise CreditNoteValidationFailed(
                f"Expiry date ({expiry_date}) must be after issue date ({issue_date})",
                details={
                    "issue_date": str(issue_date),
                    "expiry_date": str(expiry_date),
                },
            )

    # ==================================================================
    # Void
    # ==================================================================

    def validate_voidable(self, credit_note: CreditNote) -> None:
        """Validate that a credit note may be voided.

        Void is allowed from DRAFT and ISSUED.

        Raises:
            InvalidCreditNoteStatusTransition: If the credit note is in a
                terminal state.
            CreditNoteValidationFailed: If ``void_reason`` is missing or blank.
        """
        if is_terminal_state(credit_note.status, aggregate="credit_note"):
            raise InvalidCreditNoteStatusTransition(
                from_status=credit_note.status.value
                if isinstance(credit_note.status, CreditNoteStatus)
                else str(credit_note.status),
                to_status=CreditNoteStatus.VOID.value,
                details={
                    "credit_note_id": str(credit_note.id),
                    "current_status": credit_note.status.value
                    if isinstance(credit_note.status, CreditNoteStatus)
                    else str(credit_note.status),
                },
            )

        if not credit_note.void_reason or not str(credit_note.void_reason).strip():
            raise CreditNoteValidationFailed(
                "void_reason is required when voiding a credit note",
                details={"credit_note_id": str(credit_note.id)},
            )

    # ==================================================================
    # Apply validation
    # ==================================================================

    def validate_applicable(self, credit_note: CreditNote) -> None:
        """Validate that ``credit_note`` may be applied to an invoice.

        Checks:
        1. Status is ISSUED.
        2. Not expired.
        3. Not void.
        4. Remaining balance > 0.

        Raises:
            CreditNoteNotApplicable: If the credit note cannot be applied.
        """
        current = (
            credit_note.status
            if isinstance(credit_note.status, CreditNoteStatus)
            else CreditNoteStatus(credit_note.status)
        )

        if current != CreditNoteStatus.ISSUED:
            raise CreditNoteNotApplicable(
                details={
                    "credit_note_id": str(credit_note.id),
                    "current_status": current.value,
                    "reason": "Credit note must be in ISSUED status to apply",
                }
            )

        self.validate_not_expired(credit_note)

        if credit_note.remaining_balance <= Decimal("0"):
            raise CreditNoteNotApplicable(
                details={
                    "credit_note_id": str(credit_note.id),
                    "remaining_balance": str(credit_note.remaining_balance),
                    "reason": "No remaining balance to apply",
                }
            )

    # ==================================================================
    # Numbering
    # ==================================================================

    def validate_credit_note_number_unique(
        self,
        credit_note_number: str,
        exclude_credit_note_id: UUID | None = None,
    ) -> None:
        """Validate that ``credit_note_number`` is unique across all credit notes.

        Concurrency Note:
        Service layer must perform uniqueness validation inside a transaction
        using optimistic locking or SELECT FOR UPDATE where appropriate.
        Validators remain pure.

        Args:
            credit_note_number: The credit note number to check.
            exclude_credit_note_id: Optional credit note id to exclude (for updates).

        Raises:
            CreditNoteValidationFailed: If another credit note already has this number.
        """
        existing = self._credit_note_repo.get_by_credit_note_number(
            credit_note_number
        )
        if existing is not None and existing.id != exclude_credit_note_id:
            raise CreditNoteValidationFailed(
                f"Credit note number '{credit_note_number}' has already been used",
                details={
                    "credit_note_number": credit_note_number,
                    "existing_credit_note_id": str(existing.id),
                },
            )

    def validate_credit_note_number_format(self, credit_note_number: str) -> None:
        """Validate that ``credit_note_number`` is within max length and non-empty.

        Raises:
            CreditNoteValidationFailed: If the number is invalid.
        """
        if not isinstance(credit_note_number, str) or not credit_note_number.strip():
            raise CreditNoteValidationFailed(
                "Credit note number is required",
                details={"credit_note_number": credit_note_number},
            )

        credit_note_number = credit_note_number.strip()
        if len(credit_note_number) > CREDIT_NOTE_NUMBER_MAX_LENGTH:
            raise CreditNoteValidationFailed(
                f"Credit note number must be at most {CREDIT_NOTE_NUMBER_MAX_LENGTH} "
                f"characters. Got {len(credit_note_number)}.",
                details={
                    "credit_note_number": credit_note_number,
                    "length": len(credit_note_number),
                    "max_length": CREDIT_NOTE_NUMBER_MAX_LENGTH,
                },
            )

    # ==================================================================
    # Patient ownership
    # ==================================================================

    def validate_patient_ownership(
        self,
        credit_note: CreditNote,
        patient_id: UUID,
    ) -> None:
        """Validate that ``credit_note`` belongs to ``patient_id``.

        Raises:
            CreditNoteValidationFailed: If the credit note does not belong to the
                specified patient.
        """
        if credit_note.patient_id != patient_id:
            raise CreditNoteValidationFailed(
                f"Credit note {credit_note.id} does not belong to patient {patient_id}",
                details={
                    "credit_note_id": str(credit_note.id),
                    "credit_note_patient_id": str(credit_note.patient_id),
                    "expected_patient_id": str(patient_id),
                },
            )

    # ==================================================================
    # Reason validation
    # ==================================================================

    def validate_reason(self, reason: object) -> str:
        """Validate that a credit note reason is non-empty and within max length.

        Args:
            reason: The reason string to validate.

        Returns:
            The validated, stripped reason string.

        Raises:
            CreditNoteValidationFailed: If the reason is invalid.
        """
        if not isinstance(reason, str) or not reason.strip():
            raise CreditNoteValidationFailed(
                "Credit note reason is required",
                details={"reason": str(reason)},
            )
        reason = reason.strip()
        if len(reason) > CREDIT_NOTE_REASON_MAX_LENGTH:
            raise CreditNoteValidationFailed(
                f"Credit note reason must be at most {CREDIT_NOTE_REASON_MAX_LENGTH} "
                f"characters. Got {len(reason)}.",
                details={
                    "reason": reason,
                    "length": len(reason),
                    "max_length": CREDIT_NOTE_REASON_MAX_LENGTH,
                },
            )
        return reason

    # ==================================================================
    # Foreign-key existence validation (Sprint 12A)
    # ==================================================================

    def validate_patient_exists(self, patient_id: UUID) -> None:
        """Validate that a patient with the given id exists.

        Raises ``PatientNotFound`` (404) if the patient does not exist.
        Uses ``PatientRepositoryProtocol`` for the lookup — no persistence
        or transaction management.

        Raises:
            PatientNotFound: If ``patient_id`` does not resolve to an existing
                patient record.
        """
        if self._patient_repo is None:
            raise RuntimeError(
                "PatientRepositoryProtocol is required for patient existence "
                "validation but was not provided to CreditNoteValidator"
            )
        if not self._patient_repo.exists(patient_id):
            from app.modules.patients.exceptions import PatientNotFound
            raise PatientNotFound()


__all__ = ["CreditNoteValidator"]
