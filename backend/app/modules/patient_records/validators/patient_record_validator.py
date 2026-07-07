from __future__ import annotations

from typing import TYPE_CHECKING, Optional
from uuid import UUID

from app.modules.patient_records.exceptions import PatientRecordBusinessRule

if TYPE_CHECKING:
    from app.modules.patient_records.models import PatientRecord


class PatientRecordValidator:
    """Pure business validation for patient record operations.

    Every method is a ``@staticmethod`` — no database access, no
    side effects, no state.  These validators are safe to call from
    any service without worrying about transaction or session state.

    Raises:
        PatientRecordBusinessRule: On every violation.
    """

    # ==================================================================
    # Existence
    # ==================================================================

    @staticmethod
    def assert_exists(
        record: Optional["PatientRecord"],
        *,
        record_id: Optional[UUID] = None,
    ) -> None:
        """Raise if the record is ``None`` (not found).

        Args:
            record: The loaded ORM instance (or ``None``).
            record_id: Optional UUID included in the error message
                for traceability.

        Raises:
            PatientRecordBusinessRule: If ``record`` is ``None``.
        """
        if record is not None:
            return

        identifier = f"id={record_id!r}" if record_id is not None else "unknown"
        raise PatientRecordBusinessRule(
            message=f"Patient record {identifier} does not exist",
            details={"record_id": str(record_id) if record_id else None},
        )

    # ==================================================================
    # Deleted guard
    # ==================================================================

    @staticmethod
    def assert_not_deleted(record: "PatientRecord") -> None:
        """Raise if the patient record is soft-deleted.

        Soft-deleted records are hidden from default queries and must
        not be modified.  Call ``get_by_id(include_deleted=True)`` or
        ``get_by_id_or_raise(include_deleted=True)`` to load them.

        Args:
            record: The loaded ``PatientRecord`` ORM instance.

        Raises:
            PatientRecordBusinessRule: If ``record.is_deleted`` is
                ``True``.
        """
        if not record.is_deleted:
            return

        raise PatientRecordBusinessRule(
            message=(
                f"Patient record {record.id} is deleted and "
                f"cannot be modified"
            ),
            details={"record_id": str(record.id)},
        )

    # ==================================================================
    # Finalized guard
    # ==================================================================

    @staticmethod
    def assert_not_finalized(record: "PatientRecord") -> None:
        """Raise if the patient record is finalized (immutable).

        Once a record is finalized its clinical data becomes immutable.
        Further updates, status changes, or deletions are rejected.

        Args:
            record: The loaded ``PatientRecord`` ORM instance.

        Raises:
            PatientRecordBusinessRule: If ``record.is_finalized`` is
                ``True``.
        """
        if not record.is_finalized:
            return

        raise PatientRecordBusinessRule(
            message=(
                f"Patient record {record.id} is finalized and "
                f"cannot be modified"
            ),
            details={"record_id": str(record.id)},
        )

    # ==================================================================
    # Combined guard (modifiable check)
    # ==================================================================

    @staticmethod
    def assert_modifiable(record: "PatientRecord") -> None:
        """Combined check: record must not be deleted **or** finalized.

        This is the most common guard — child entities (diagnoses,
        prescriptions, attachments, follow-ups) must never be created,
        updated, or deleted when the parent record is immutable.

        Args:
            record: The parent ``PatientRecord`` ORM instance.

        Raises:
            PatientRecordBusinessRule: If the record is deleted or
                finalized.
        """
        PatientRecordValidator.assert_not_deleted(record)
        PatientRecordValidator.assert_not_finalized(record)
