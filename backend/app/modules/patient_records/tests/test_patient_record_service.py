"""
Unit tests for PatientRecordService.

Covers all CRUD operations:
- create (success, duplicate, validation failure)
- get (existing, missing, deleted)
- update (success, finalized, deleted)
- status (update, invalid transition)
- finalize (success, double finalize, deleted)
- delete (success, already deleted, finalized protection)

Verifies:
- Audit creation
- Rollback handling
- Repository interaction
- Exception propagation
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from conftest import _make_patient_record_orm
from app.modules.patient_records.services import PatientRecordService
from app.modules.patient_records.exceptions import (
    PatientRecordNotFound,
    PatientRecordBusinessRule,
    PatientRecordConflict,
)
from app.modules.patient_records.schemas.patient_record_schema import (
    PatientRecordCreate,
    PatientRecordUpdate,
)
from app.modules.patient_records.enums import RecordStatus


# ======================================================================
# CREATE
# ======================================================================


class TestCreatePatientRecord:
    """Covers: successful create (with and without appointment), duplicate appointment, validation failure."""

    def test_success_with_appointment(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.patient_repo = MagicMock()
        svc.appointment_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm()
        svc.patient_repo.get_by_id.return_value = MagicMock()
        svc.appointment_repo.get_by_id.return_value = MagicMock()
        svc.record_repo.get_by_appointment.return_value = None
        svc.record_repo.create_patient_record.return_value = record

        payload = PatientRecordCreate(patient_id=uuid4(), appointment_id=uuid4())
        result = svc.create_patient_record(payload, actor_id=1)

        assert result.id == record.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_success_without_appointment(self):
        """Records can be created without an appointment (walk-in, historical, etc.)."""
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.patient_repo = MagicMock()
        svc.appointment_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(appointment_id=None)
        svc.patient_repo.get_by_id.return_value = MagicMock()
        svc.record_repo.create_patient_record.return_value = record

        payload = PatientRecordCreate(patient_id=uuid4())
        result = svc.create_patient_record(payload, actor_id=1)

        assert result.id == record.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
        # No appointment validation should have occurred
        svc.appointment_repo.get_by_id.assert_not_called()
        svc.record_repo.get_by_appointment.assert_not_called()

    def test_success_with_explicit_null_appointment(self):
        """Explicitly sending appointment_id=null should also work."""
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.patient_repo = MagicMock()
        svc.appointment_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(appointment_id=None)
        svc.patient_repo.get_by_id.return_value = MagicMock()
        svc.record_repo.create_patient_record.return_value = record

        payload = PatientRecordCreate(patient_id=uuid4(), appointment_id=None)
        result = svc.create_patient_record(payload, actor_id=1)

        assert result.id == record.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_duplicate_appointment_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.patient_repo = MagicMock()
        svc.appointment_repo = MagicMock()

        svc.patient_repo.get_by_id.return_value = MagicMock()
        svc.appointment_repo.get_by_id.return_value = MagicMock()
        # Simulate existing record for this appointment
        svc.record_repo.get_by_appointment.return_value = _make_patient_record_orm()

        payload = PatientRecordCreate(patient_id=uuid4(), appointment_id=uuid4())

        with pytest.raises(PatientRecordConflict, match="already exists"):
            svc.create_patient_record(payload, actor_id=1)

        db.rollback.assert_called_once()

    def test_missing_patient_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.patient_repo = MagicMock()

        # Patient does not exist
        svc.patient_repo.get_by_id.return_value = None

        payload = PatientRecordCreate(patient_id=uuid4(), appointment_id=uuid4())

        with pytest.raises(PatientRecordBusinessRule, match="does not exist"):
            svc.create_patient_record(payload, actor_id=1)

        db.rollback.assert_called_once()

    def test_missing_appointment_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.patient_repo = MagicMock()
        svc.appointment_repo = MagicMock()

        svc.patient_repo.get_by_id.return_value = MagicMock()
        svc.appointment_repo.get_by_id.return_value = None

        payload = PatientRecordCreate(patient_id=uuid4(), appointment_id=uuid4())

        with pytest.raises(PatientRecordBusinessRule, match="does not exist"):
            svc.create_patient_record(payload, actor_id=1)

        db.rollback.assert_called_once()


# ======================================================================
# GET
# ======================================================================


class TestGetPatientRecord:
    """Covers: get existing, get missing, get deleted."""

    def test_get_existing(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm()
        svc.record_repo.get_by_id.return_value = record

        result = svc.get_record(record.id)
        assert result is not None
        assert result.id == record.id
        svc.record_repo.get_by_id.assert_called_once_with(
            record.id, include_deleted=False
        )

    def test_get_missing(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id.return_value = None

        result = svc.get_record(uuid4())
        assert result is None

    def test_get_missing_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id_or_raise.side_effect = PatientRecordNotFound(
            record_id=uuid4()
        )

        with pytest.raises(PatientRecordNotFound):
            svc.get_record_or_raise(uuid4())

    def test_get_deleted_hidden_by_default(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id.return_value = None  # deleted records hidden

        result = svc.get_record(uuid4())
        assert result is None

    def test_get_deleted_with_include_deleted(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=True)
        svc.record_repo.get_by_id.return_value = record

        result = svc.get_record(record.id, include_deleted=True)
        assert result is not None
        assert result.is_deleted is True


# ======================================================================
# UPDATE
# ======================================================================


class TestUpdatePatientRecord:
    """Covers: successful update, finalized record, deleted record."""

    def test_success(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.record_repo.update_record.return_value = record

        payload = PatientRecordUpdate(chief_complaint="Updated complaint")
        result = svc.update_record(record.id, payload, actor_id=1)

        assert result.id == record.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_update_finalized_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        payload = PatientRecordUpdate(chief_complaint="Updated")
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.update_record(record.id, payload, actor_id=1)

        db.rollback.assert_called_once()

    def test_update_deleted_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        payload = PatientRecordUpdate(chief_complaint="Updated")
        with pytest.raises(PatientRecordBusinessRule, match="deleted"):
            svc.update_record(record.id, payload, actor_id=1)

        db.rollback.assert_called_once()

    def test_update_missing_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id_or_raise.side_effect = PatientRecordNotFound(
            record_id=uuid4()
        )

        payload = PatientRecordUpdate(chief_complaint="Updated")
        with pytest.raises(PatientRecordNotFound):
            svc.update_record(uuid4(), payload, actor_id=1)

        db.rollback.assert_called_once()


# ======================================================================
# STATUS
# ======================================================================


class TestUpdateStatus:
    """Covers: update status, invalid transition."""

    def test_success(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(status=RecordStatus.DRAFT)
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.record_repo.update_status.return_value = record

        result = svc.update_status(record.id, RecordStatus.IN_PROGRESS, actor_id=1)

        assert result.id == record.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_finalized_record_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.update_status(record.id, RecordStatus.IN_PROGRESS, actor_id=1)

        db.rollback.assert_called_once()

    def test_deleted_record_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="deleted"):
            svc.update_status(record.id, RecordStatus.IN_PROGRESS, actor_id=1)

        db.rollback.assert_called_once()


# ======================================================================
# FINALIZE
# ======================================================================


class TestFinalizePatientRecord:
    """Covers: successful finalize, double finalize, deleted record."""

    def test_success(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(is_finalized=False)
        svc.record_repo.get_by_id_or_raise.return_value = record
        finalized = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.finalize_record.return_value = finalized

        result = svc.finalize_record(record.id, actor_id=1)

        assert result.is_finalized is True
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_double_finalize_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="already finalized"):
            svc.finalize_record(record.id, actor_id=1)

        db.rollback.assert_called_once()

    def test_finalize_deleted_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=True, is_finalized=False)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="deleted"):
            svc.finalize_record(record.id, actor_id=1)

        db.rollback.assert_called_once()

    def test_finalize_missing_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id_or_raise.side_effect = PatientRecordNotFound(
            record_id=uuid4()
        )

        with pytest.raises(PatientRecordNotFound):
            svc.finalize_record(uuid4(), actor_id=1)

        db.rollback.assert_called_once()


# ======================================================================
# DELETE
# ======================================================================


class TestDeletePatientRecord:
    """Covers: successful delete, already deleted (idempotent), finalized
    delete protection."""

    def test_success(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=False, is_finalized=False)
        svc.record_repo.get_by_id_or_raise.return_value = record

        svc.delete_record(record.id, actor_id=1)

        svc.record_repo.soft_delete.assert_called_once()
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_already_deleted_idempotent(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()
        svc.audit_repo = MagicMock()

        record = _make_patient_record_orm(is_deleted=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        svc.delete_record(record.id, actor_id=1)

        # No further operations for already-deleted records
        svc.record_repo.soft_delete.assert_not_called()
        svc.audit_repo.create.assert_not_called()

    def test_finalized_delete_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        record = _make_patient_record_orm(is_finalized=True, is_deleted=False)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.delete_record(record.id, actor_id=1)

        db.rollback.assert_called_once()

    def test_delete_missing_raises(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.get_by_id_or_raise.side_effect = PatientRecordNotFound(
            record_id=uuid4()
        )

        with pytest.raises(PatientRecordNotFound):
            svc.delete_record(uuid4(), actor_id=1)

        db.rollback.assert_called_once()


# ======================================================================
# LIST / COUNT
# ======================================================================


class TestListPatientRecords:
    """Covers: list with pagination and filters."""

    def test_list_with_pagination(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        records = [_make_patient_record_orm() for _ in range(3)]
        svc.record_repo.list_records.return_value = (records, 10)

        items, total = svc.list_records(page=1, page_size=20)

        assert len(items) == 3
        assert total == 10
        svc.record_repo.list_records.assert_called_once_with(
            page=1, page_size=20, status=None,
            is_finalized=None, patient_id=None, search=None,
        )

    def test_list_with_filters(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.list_records.return_value = ([], 0)

        svc.list_records(
            page=1, page_size=10,
            status=RecordStatus.DRAFT,
            is_finalized=False,
            patient_id=uuid4(),
            search="pain",
        )

        svc.record_repo.list_records.assert_called_once()

    def test_count(self):
        db = MagicMock()
        svc = PatientRecordService(db)
        svc.record_repo = MagicMock()

        svc.record_repo.count.return_value = 5

        result = svc.count_records()

        assert result == 5
        svc.record_repo.count.assert_called_once_with(
            status=None, is_finalized=None, patient_id=None,
        )
