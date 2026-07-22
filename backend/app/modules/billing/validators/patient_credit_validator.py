"""PatientCreditValidator — aggregate business validation for Patient Credits.

Responsibilities
----------------
* **Credit lifecycle**: existence, remaining amount validation.
* **Expiry validation**: credit has not expired.
* **Patient ownership**: credit belongs to the specified patient.
* **Credit application**: validate that a credit can be applied.
* **Source validation**: credit originates from a valid source.
* **Future transfer validation**: ensure credit is not being transferred to
  another patient (if required by BRD).

Design
------
* **Read-only repositories**: ``PatientCreditRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **FinancialValidator delegation**: monetary validations are forwarded to
  ``FinancialValidator``.
* **Approved exceptions only**: raises ``PatientCreditNotFound``,
  ``PatientCreditValidationFailed``, and other billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = PatientCreditValidator(patient_credit_repo, financial_validator)

    # Before applying a patient credit
    credit = validator.validate_credit_exists(credit_id)
    validator.validate_remaining_amount(credit, application_amount)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from app.modules.billing.exceptions import (
    BillingNotFoundError,
    PatientCreditNotFound,
    PatientCreditValidationFailed,
)
from app.modules.billing.models import PatientCredit
from app.modules.billing.validators.financial_validator import FinancialValidator
from app.modules.billing.validators.protocols import PatientCreditRepositoryProtocol


class PatientCreditValidator:
    """Aggregate business rule validator for the Patient Credit module.

    Args:
        patient_credit_repo: Read-only ``PatientCreditRepositoryProtocol`` for
            patient credit existence, patient lookups, and source lookups.
        financial_validator: ``FinancialValidator`` instance for monetary
            validations.
    """

    def __init__(
        self,
        patient_credit_repo: PatientCreditRepositoryProtocol,
        financial_validator: FinancialValidator,
    ) -> None:
        self._patient_credit_repo = patient_credit_repo
        self._financial = financial_validator

    # ==================================================================
    # Credit lifecycle
    # ==================================================================

    def validate_credit_exists(self, patient_credit_id: UUID) -> PatientCredit:
        """Fetch a patient credit by id and raise ``PatientCreditNotFound`` if missing.

        Returns the loaded patient credit so the service can reuse it.
        """
        credit = self._patient_credit_repo.get_by_id(patient_credit_id)
        if credit is None:
            raise PatientCreditNotFound(patient_credit_id)
        return credit

    # ==================================================================
    # Amount validators
    # ==================================================================

    def validate_remaining_amount(
        self,
        credit: PatientCredit,
        application_amount: object,
    ) -> Decimal:
        """Validate that ``application_amount`` does not exceed remaining credit.

        Args:
            credit: The patient credit entity.
            application_amount: The amount to validate.

        Returns:
            The validated, quantized :class:`Decimal` application amount.

        Raises:
            NegativeAmountNotAllowed: If ``application_amount`` is negative.
            PatientCreditValidationFailed: If ``application_amount`` exceeds remaining.
        """
        app = self._financial.validate_positive_amount(
            application_amount, field="application_amount"
        )
        if app > credit.remaining_amount:
            raise PatientCreditValidationFailed(
                f"Credit application ({app}) exceeds remaining balance ({credit.remaining_amount})",
                details={
                    "credit_id": str(credit.id),
                    "remaining": str(credit.remaining_amount),
                    "application": str(app),
                },
            )
        return app

    # ==================================================================
    # Expiry
    # ==================================================================

    def validate_not_expired(self, credit: PatientCredit) -> None:
        """Validate that ``credit`` has not expired.

        Args:
            credit: The patient credit to validate.

        Raises:
            PatientCreditValidationFailed: If the credit has expired.
        """
        if credit.expiry_date is not None:
            today = date.today()
            if credit.expiry_date < today:
                raise PatientCreditValidationFailed(
                    f"Patient credit {credit.id} has expired",
                    details={
                        "credit_id": str(credit.id),
                        "expiry_date": str(credit.expiry_date),
                    },
                )

    def validate_expiry_date(
        self,
        expiry_date: date | None,
        created_date: date | None = None,
    ) -> None:
        """Validate that ``expiry_date`` is valid.

        Args:
            expiry_date: The expiry date to validate.
            created_date: Optional creation date for range validation.

        Raises:
            PatientCreditValidationFailed: If the expiry date is invalid.
        """
        if expiry_date is None:
            return
        if not isinstance(expiry_date, date):
            raise PatientCreditValidationFailed(
                f"Expiry date must be a date, got {type(expiry_date).__name__!r}",
                details={"expiry_date": str(expiry_date)},
            )
        if created_date is not None and expiry_date <= created_date:
            raise PatientCreditValidationFailed(
                f"Expiry date ({expiry_date}) must be after creation date ({created_date})",
                details={
                    "created_date": str(created_date),
                    "expiry_date": str(expiry_date),
                },
            )

    # ==================================================================
    # Patient ownership
    # ==================================================================

    def validate_patient_ownership(
        self,
        credit: PatientCredit,
        patient_id: UUID,
    ) -> None:
        """Validate that ``credit`` belongs to ``patient_id``.

        Raises:
            PatientCreditValidationFailed: If the credit does not belong to the
                specified patient.
        """
        if credit.patient_id != patient_id:
            raise PatientCreditValidationFailed(
                f"Patient credit {credit.id} does not belong to patient {patient_id}",
                details={
                    "credit_id": str(credit.id),
                    "credit_patient_id": str(credit.patient_id),
                    "expected_patient_id": str(patient_id),
                },
            )

    # ==================================================================
    # Source validation
    # ==================================================================

    def validate_has_source(self, credit: PatientCredit) -> None:
        """Validate that ``credit`` has a valid source.

        Patient credits must originate from either a payment allocation or
        a credit note.

        Raises:
            PatientCreditValidationFailed: If the credit has no source.
        """
        if credit.source_allocation_id is None and credit.source_credit_note_id is None:
            raise PatientCreditValidationFailed(
                f"Patient credit {credit.id} has no source allocation or credit note",
                details={"credit_id": str(credit.id)},
            )

    def validate_source_type(
        self,
        credit: PatientCredit,
        expected_source: str,
    ) -> None:
        """Validate that ``credit`` originates from the expected source type.

        Args:
            credit: The patient credit entity.
            expected_source: One of ``"allocation"`` or ``"credit_note"``.

        Raises:
            PatientCreditValidationFailed: If the source type does not match.
        """
        if expected_source == "allocation" and credit.source_allocation_id is None:
            raise PatientCreditValidationFailed(
                f"Patient credit {credit.id} does not originate from a payment allocation",
                details={"credit_id": str(credit.id), "expected_source": expected_source},
            )
        if expected_source == "credit_note" and credit.source_credit_note_id is None:
            raise PatientCreditValidationFailed(
                f"Patient credit {credit.id} does not originate from a credit note",
                details={"credit_id": str(credit.id), "expected_source": expected_source},
            )

    # ==================================================================
    # Credit application
    # ==================================================================

    def validate_credit_application(
        self,
        credit: PatientCredit,
        application_amount: object,
    ) -> Decimal:
        """Validate that a credit may be applied for the given amount.

        Checks:
        1. Application amount is positive.
        2. Application amount does not exceed remaining balance.
        3. Credit has not expired.

        Args:
            credit: The patient credit entity.
            application_amount: The amount to validate.

        Returns:
            The validated, quantized :class:`Decimal` application amount.

        Raises:
            NegativeAmountNotAllowed: If ``application_amount`` is negative.
            PatientCreditValidationFailed: If ``application_amount`` exceeds remaining
                or the credit has expired.
        """
        self.validate_not_expired(credit)
        return self.validate_remaining_amount(credit, application_amount)

    # ==================================================================
    # Future transfer validation
    # ==================================================================

    def validate_no_future_transfer(
        self,
        credit: PatientCredit,
        target_patient_id: UUID,
    ) -> None:
        """Validate that a credit is not being transferred to another patient.

        Per current business rules, patient credits cannot be transferred
        between patients. This guard prevents cross-patient application
        at the validator level; the service layer must still enforce
        ownership at the aggregate boundary.

        Args:
            credit: The patient credit entity.
            target_patient_id: The target patient id.

        Raises:
            PatientCreditValidationFailed: If the credit is being transferred to a
                different patient.
        """
        if credit.patient_id != target_patient_id:
            raise PatientCreditValidationFailed(
                f"Patient credit {credit.id} cannot be transferred to another patient",
                details={
                    "credit_id": str(credit.id),
                    "source_patient_id": str(credit.patient_id),
                    "target_patient_id": str(target_patient_id),
                },
            )


__all__ = ["PatientCreditValidator"]
