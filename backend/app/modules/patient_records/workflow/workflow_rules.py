"""
Workflow Rules
==============

Healthcare domain rules that must be satisfied before any workflow
operation (create, update, delete, transition, finalize) is committed.

Validation categories
---------------------
1. **Existence** — patient, appointment, and record must exist.
2. **Record state** — record must not be deleted or finalized.
3. **Ownership** — child entities must belong to the correct parent record.
4. **Transition prerequisites** — domain-specific rules for state changes.

Each rule is a ``@staticmethod`` that accepts ORM instances (not IDs)
so that callers have already loaded the entities and can pass them in.
No database session is required by this class — the caller is
responsible for loading entities before calling these validators.

Usage
-----
    WorkflowRules.assert_patient_exists(patient)         # already loaded
    WorkflowRules.assert_record_ownership(record, patient_id)
    WorkflowRules.assert_diagnosis_ownership(diagnosis, patient_record_id)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.modules.patient_records.exceptions import PatientRecordBusinessRule

if TYPE_CHECKING:
    from uuid import UUID

    from app.modules.patient_records.models import (
        PatientRecord,
        PatientRecordDiagnosis,
        PatientRecordPrescription,
        PatientRecordAttachment,
        PatientRecordFollowup,
    )
    from app.modules.patient_records.enums import RecordStatus

    # External entities loaded by the caller and passed as ORM instances.
    from app.modules.patients.models import Patient
    from app.modules.appointments.models import Appointment


# ---------------------------------------------------------------------------
# Reusable error builder
# ---------------------------------------------------------------------------


def _business_rule(
    message: str,
    details: dict[str, Any] | None = None,
) -> PatientRecordBusinessRule:
    """Shorthand for raising a business rule violation."""
    return PatientRecordBusinessRule(message=message, details=details)


# ======================================================================
# 1. EXISTENCE RULES
# ======================================================================


class WorkflowRules:
    """Stateless healthcare workflow rule validators.

    Every method is a ``@staticmethod`` — no side effects, no database
    access.  Callers must load entities before invoking these rules.
    """

    # ------------------------------------------------------------------
    # 1a. Patient existence
    # ------------------------------------------------------------------

    @staticmethod
    def assert_patient_exists(
        patient: "Patient | None",
        *,
        patient_id: "UUID | None" = None,
    ) -> None:
        """Raise if the patient ORM instance is ``None`` (does not exist).

        Args:
            patient: The loaded ``Patient`` ORM instance, or ``None``.
            patient_id: Optional UUID for detailed error messaging.

        Raises:
            PatientRecordBusinessRule: If ``patient`` is ``None``.
        """
        if patient is not None:
            return

        identifier = f"id={patient_id!r}" if patient_id is not None else "unknown"
        raise _business_rule(
            message=f"Patient {identifier} does not exist",
            details={"patient_id": str(patient_id) if patient_id else None},
        )

    # ------------------------------------------------------------------
    # 1b. Appointment existence
    # ------------------------------------------------------------------

    @staticmethod
    def assert_appointment_exists(
        appointment: "Appointment | None",
        *,
        appointment_id: "UUID | None" = None,
    ) -> None:
        """Raise if the appointment ORM instance is ``None`` (does not exist).

        Args:
            appointment: The loaded ``Appointment`` ORM instance, or ``None``.
            appointment_id: Optional UUID for detailed error messaging.

        Raises:
            PatientRecordBusinessRule: If ``appointment`` is ``None``.
        """
        if appointment is not None:
            return

        identifier = f"id={appointment_id!r}" if appointment_id is not None else "unknown"
        raise _business_rule(
            message=f"Appointment {identifier} does not exist",
            details={"appointment_id": str(appointment_id) if appointment_id else None},
        )

    # ------------------------------------------------------------------
    # 1c. Patient record existence
    # ------------------------------------------------------------------

    @staticmethod
    def assert_record_exists(
        record: "PatientRecord | None",
        *,
        record_id: "UUID | None" = None,
    ) -> None:
        """Raise if the patient record ORM instance is ``None``.

        Args:
            record: The loaded ``PatientRecord`` ORM instance, or ``None``.
            record_id: Optional UUID for detailed error messaging.

        Raises:
            PatientRecordBusinessRule: If ``record`` is ``None``.
        """
        if record is not None:
            return

        identifier = f"id={record_id!r}" if record_id is not None else "unknown"
        raise _business_rule(
            message=f"Patient record {identifier} does not exist",
            details={"record_id": str(record_id) if record_id else None},
        )

    # ==================================================================
    # 2. RECORD STATE GUARDS
    # ==================================================================

    @staticmethod
    def assert_record_not_deleted(record: "PatientRecord") -> None:
        """Raise if the patient record is soft-deleted.

        Soft-deleted records are hidden from default queries and
        must not be modified or transitioned.

        Raises:
            PatientRecordBusinessRule: If ``record.is_deleted`` is ``True``.
        """
        if record.is_deleted:
            raise _business_rule(
                message=(
                    f"Patient record {record.id} is deleted and "
                    f"cannot be modified"
                ),
                details={"record_id": str(record.id)},
            )

    @staticmethod
    def assert_record_not_finalized(record: "PatientRecord") -> None:
        """Raise if the patient record is finalized (immutable).

        Finalized records cannot be modified, transitioned, or deleted.

        Raises:
            PatientRecordBusinessRule: If ``record.is_finalized`` is ``True``.
        """
        if record.is_finalized:
            raise _business_rule(
                message=(
                    f"Patient record {record.id} is finalized and "
                    f"cannot be modified"
                ),
                details={"record_id": str(record.id)},
            )

    @staticmethod
    def assert_record_modifiable(record: "PatientRecord") -> None:
        """Combined guard: not deleted **and** not finalized.

        This is the most common guard — call this before any mutation
        on the record or its child entities.

        Raises:
            PatientRecordBusinessRule: If deleted or finalized.
        """
        WorkflowRules.assert_record_not_deleted(record)
        WorkflowRules.assert_record_not_finalized(record)

    # ==================================================================
    # 3. OWNERSHIP VALIDATION
    # ==================================================================

    @staticmethod
    def assert_record_ownership(
        record: "PatientRecord",
        expected_patient_id: "UUID",
    ) -> None:
        """Raise if the record does not belong to the expected patient.

        Args:
            record: The loaded ``PatientRecord`` ORM instance.
            expected_patient_id: The ``patient_id`` that should own
                this record.

        Raises:
            PatientRecordBusinessRule: If ``record.patient_id``
                does not match ``expected_patient_id``.
        """
        if record.patient_id == expected_patient_id:
            return

        raise _business_rule(
            message=(
                f"Patient record {record.id} does not belong to "
                f"patient {expected_patient_id} "
                f"(actual patient: {record.patient_id})"
            ),
            details={
                "record_id": str(record.id),
                "expected_patient_id": str(expected_patient_id),
                "actual_patient_id": str(record.patient_id),
            },
        )

    # ------------------------------------------------------------------
    # 3a. Diagnosis ownership
    # ------------------------------------------------------------------

    @staticmethod
    def assert_diagnosis_ownership(
        diagnosis: "PatientRecordDiagnosis",
        expected_record_id: "UUID",
    ) -> None:
        """Raise if the diagnosis does not belong to the expected record.

        Raises:
            PatientRecordBusinessRule: If ``diagnosis.patient_record_id``
                does not match ``expected_record_id``.
        """
        if diagnosis.patient_record_id == expected_record_id:
            return

        raise _business_rule(
            message=(
                f"Diagnosis {diagnosis.id} does not belong to "
                f"patient record {expected_record_id} "
                f"(actual record: {diagnosis.patient_record_id})"
            ),
            details={
                "diagnosis_id": str(diagnosis.id),
                "expected_record_id": str(expected_record_id),
                "actual_record_id": str(diagnosis.patient_record_id),
            },
        )

    # ------------------------------------------------------------------
    # 3b. Prescription ownership
    # ------------------------------------------------------------------

    @staticmethod
    def assert_prescription_ownership(
        prescription: "PatientRecordPrescription",
        expected_record_id: "UUID",
    ) -> None:
        """Raise if the prescription does not belong to the expected record.

        Raises:
            PatientRecordBusinessRule: If ``prescription.patient_record_id``
                does not match ``expected_record_id``.
        """
        if prescription.patient_record_id == expected_record_id:
            return

        raise _business_rule(
            message=(
                f"Prescription {prescription.id} does not belong to "
                f"patient record {expected_record_id} "
                f"(actual record: {prescription.patient_record_id})"
            ),
            details={
                "prescription_id": str(prescription.id),
                "expected_record_id": str(expected_record_id),
                "actual_record_id": str(prescription.patient_record_id),
            },
        )

    # ------------------------------------------------------------------
    # 3c. Attachment ownership
    # ------------------------------------------------------------------

    @staticmethod
    def assert_attachment_ownership(
        attachment: "PatientRecordAttachment",
        expected_record_id: "UUID",
    ) -> None:
        """Raise if the attachment does not belong to the expected record.

        Raises:
            PatientRecordBusinessRule: If ``attachment.patient_record_id``
                does not match ``expected_record_id``.
        """
        if attachment.patient_record_id == expected_record_id:
            return

        raise _business_rule(
            message=(
                f"Attachment {attachment.id} does not belong to "
                f"patient record {expected_record_id} "
                f"(actual record: {attachment.patient_record_id})"
            ),
            details={
                "attachment_id": str(attachment.id),
                "expected_record_id": str(expected_record_id),
                "actual_record_id": str(attachment.patient_record_id),
            },
        )

    # ------------------------------------------------------------------
    # 3d. Follow-up ownership
    # ------------------------------------------------------------------

    @staticmethod
    def assert_followup_ownership(
        followup: "PatientRecordFollowup",
        expected_record_id: "UUID",
    ) -> None:
        """Raise if the follow-up does not belong to the expected record.

        Raises:
            PatientRecordBusinessRule: If ``followup.patient_record_id``
                does not match ``expected_record_id``.
        """
        if followup.patient_record_id == expected_record_id:
            return

        raise _business_rule(
            message=(
                f"Follow-up {followup.id} does not belong to "
                f"patient record {expected_record_id} "
                f"(actual record: {followup.patient_record_id})"
            ),
            details={
                "followup_id": str(followup.id),
                "expected_record_id": str(expected_record_id),
                "actual_record_id": str(followup.patient_record_id),
            },
        )

    # ==================================================================
    # 4. TRANSITION-SPECIFIC BUSINESS RULES
    # ==================================================================

    @staticmethod
    def assert_can_submit_for_review(
        record: "PatientRecord",
        target: "RecordStatus",
    ) -> None:
        """Validate that the record is ready for clinical review.

        Business rules:
        * Chief complaint must be filled (minimum clinical data).

        Raises:
            PatientRecordBusinessRule: If the record lacks required
                clinical data.
        """
        from app.modules.patient_records.enums import RecordStatus

        if target != RecordStatus.UNDER_REVIEW:
            return

        if not record.chief_complaint:
            raise _business_rule(
                message=(
                    f"Patient record {record.id} cannot be submitted for "
                    f"review without a chief complaint"
                ),
                details={"record_id": str(record.id)},
            )

    @staticmethod
    def assert_can_finalize(
        record: "PatientRecord",
        target: "RecordStatus",
    ) -> None:
        """Validate that the record can be finalized.

        Business rules:
        * Record status must be COMPLETED.
        * Record must not already be finalized.

        Raises:
            PatientRecordBusinessRule: If finalization preconditions
                are not met.
        """
        from app.modules.patient_records.enums import RecordStatus

        if target != RecordStatus.FINALIZED:
            return

        if record.is_finalized:
            raise _business_rule(
                message=f"Patient record {record.id} is already finalized",
                details={"record_id": str(record.id)},
            )

        if record.status != RecordStatus.COMPLETED:
            raise _business_rule(
                message=(
                    f"Patient record {record.id} must be in COMPLETED "
                    f"status before finalization (current: {record.status.value})"
                ),
                details={
                    "record_id": str(record.id),
                    "current_status": record.status.value,
                },
            )

    @staticmethod
    def assert_can_reopen(
        record: "PatientRecord",
        target: "RecordStatus",
    ) -> None:
        """Validate that the record can be reopened.

        Business rules:
        * Only COMPLETED records can be reopened (not FINALIZED).
        * FINALIZED records are terminal and cannot be reopened.

        Raises:
            PatientRecordBusinessRule: If the record cannot be reopened.
        """
        from app.modules.patient_records.enums import RecordStatus

        if target != RecordStatus.IN_PROGRESS:
            return

        if record.status != RecordStatus.COMPLETED:
            return  # not a reopen — no additional rules needed

        if record.is_finalized:
            raise _business_rule(
                message=(
                    f"Patient record {record.id} is finalized and "
                    f"cannot be reopened"
                ),
                details={"record_id": str(record.id)},
            )
