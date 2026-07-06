"""
Unit tests for PrescriptionService.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError
from conftest import _make_patient_record_orm, _make_prescription_orm
from app.modules.patient_records.services import PrescriptionService
from app.modules.patient_records.exceptions import PatientRecordBusinessRule
from app.modules.patient_records.schemas.prescription_schema import PrescriptionCreate, PrescriptionItemCreate


def make_prescription_create(items_count=1):
    items = [PrescriptionItemCreate(medicine_name="Amoxicillin", dosage="500mg", frequency="TDS", duration="5 days") for _ in range(items_count)]
    return PrescriptionCreate(items=items)


class TestCreatePrescription:
    def test_success(self):
        db = MagicMock(); svc = PrescriptionService(db)
        svc.prescription_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        record = _make_patient_record_orm()
        prescription = _make_prescription_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.prescription_repo.create.return_value = prescription
        payload = make_prescription_create()
        result = svc.create_prescription(record.id, prescribed_by=1, payload=payload, actor_id=1)
        assert result.id == prescription.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_no_items_raises(self):
        db = MagicMock(); svc = PrescriptionService(db)
        svc.record_repo = MagicMock()
        svc.prescription_repo = MagicMock()
        svc.audit_repo = MagicMock()
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        # Pydantic validates min_length=1 on items before reaching service
        with pytest.raises((ValidationError, PatientRecordBusinessRule)):
            svc.create_prescription(record.id, prescribed_by=1, payload=PrescriptionCreate(items=[]), actor_id=1)

    def test_finalized_record_raises(self):
        db = MagicMock(); svc = PrescriptionService(db)
        svc.record_repo = MagicMock()
        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record
        payload = make_prescription_create()
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.create_prescription(record.id, prescribed_by=1, payload=payload, actor_id=1)


class TestFinalizePrescription:
    def test_success(self):
        db = MagicMock(); svc = PrescriptionService(db)
        svc.prescription_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        prescription = _make_prescription_orm()
        record = _make_patient_record_orm()
        svc.prescription_repo.get_by_id_or_raise.return_value = prescription
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.prescription_repo.finalize.return_value = prescription
        result = svc.finalize_prescription(prescription.id, actor_id=1)
        assert result.id == prescription.id
        db.commit.assert_called_once()


class TestDeletePrescription:
    def test_success(self):
        db = MagicMock(); svc = PrescriptionService(db)
        svc.prescription_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        prescription = _make_prescription_orm(is_deleted=False)
        record = _make_patient_record_orm()
        svc.prescription_repo.get_by_id_or_raise.return_value = prescription
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.delete_prescription(prescription.id, actor_id=1)
        svc.prescription_repo.soft_delete.assert_called_once()
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
