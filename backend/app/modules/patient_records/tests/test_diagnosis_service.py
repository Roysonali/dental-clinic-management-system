"""
Unit tests for DiagnosisService.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from conftest import _make_patient_record_orm, _make_diagnosis_orm
from app.modules.patient_records.services import DiagnosisService
from app.modules.patient_records.exceptions import PatientRecordBusinessRule, DiagnosisNotFound
from app.modules.patient_records.enums import DiagnosisType
from app.modules.patient_records.schemas.diagnosis_schema import DiagnosisCreate, DiagnosisUpdate


class TestCreateDiagnosis:
    def test_success(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.diagnosis_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        record = _make_patient_record_orm()
        diagnosis = _make_diagnosis_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.diagnosis_repo.create.return_value = diagnosis
        payload = DiagnosisCreate(diagnosis_name="Caries", diagnosis_type=DiagnosisType.CONFIRMED)
        result = svc.create_diagnosis(record.id, payload, actor_id=1)
        assert result.id == diagnosis.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_finalized_record_raises(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.record_repo = MagicMock()
        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record
        payload = DiagnosisCreate(diagnosis_name="Caries", diagnosis_type=DiagnosisType.CONFIRMED)
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.create_diagnosis(record.id, payload, actor_id=1)


class TestUpdateDiagnosis:
    def test_success(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.diagnosis_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        diagnosis = _make_diagnosis_orm()
        record = _make_patient_record_orm()
        svc.diagnosis_repo.get_by_id_or_raise.return_value = diagnosis
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.diagnosis_repo.update.return_value = diagnosis
        payload = DiagnosisUpdate(notes="Updated notes")
        result = svc.update_diagnosis(diagnosis.id, payload, actor_id=1)
        assert result.id == diagnosis.id
        db.commit.assert_called_once()

    def test_not_found_raises(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.diagnosis_repo = MagicMock()
        svc.diagnosis_repo.get_by_id_or_raise.side_effect = DiagnosisNotFound(diagnosis_id=uuid4())
        payload = DiagnosisUpdate(notes="Updated")
        with pytest.raises(DiagnosisNotFound):
            svc.update_diagnosis(uuid4(), payload, actor_id=1)


class TestDeleteDiagnosis:
    def test_soft_delete_success(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.diagnosis_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        diagnosis = _make_diagnosis_orm(is_deleted=False)
        record = _make_patient_record_orm()
        svc.diagnosis_repo.get_by_id_or_raise.return_value = diagnosis
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.delete_diagnosis(diagnosis.id, actor_id=1)
        svc.diagnosis_repo.soft_delete.assert_called_once()
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_already_deleted_idempotent(self):
        db = MagicMock(); svc = DiagnosisService(db)
        svc.diagnosis_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        diagnosis = _make_diagnosis_orm(is_deleted=True)
        record = _make_patient_record_orm()
        svc.diagnosis_repo.get_by_id_or_raise.return_value = diagnosis
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.delete_diagnosis(diagnosis.id, actor_id=1)
        svc.diagnosis_repo.soft_delete.assert_not_called()
