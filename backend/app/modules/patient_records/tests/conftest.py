"""
Test fixtures for the Patient Records module.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
from datetime import date, datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from app.modules.patient_records.enums import RecordStatus, DiagnosisType, AttachmentType


def _make_patient_record_orm(record_id=None, patient_id=None, appointment_id=None, status=RecordStatus.DRAFT, chief_complaint=None, clinical_notes=None, doctor_remarks=None, treatment_recommendation=None, is_finalized=False, is_deleted=False, created_at=None, updated_at=None):
    p = MagicMock()
    p.id = record_id or uuid4()
    p.patient_id = patient_id or uuid4()
    p.appointment_id = appointment_id or uuid4()
    p.status = status
    p.chief_complaint = chief_complaint
    p.clinical_notes = clinical_notes
    p.doctor_remarks = doctor_remarks
    p.treatment_recommendation = treatment_recommendation
    p.systemic_diseases = None
    p.surgeries = None
    p.medications = None
    p.habits = None
    p.medical_alerts = None
    p.allergies = None
    p.dental_history = None
    p.is_finalized = is_finalized
    p.is_deleted = is_deleted
    p.created_at = created_at or datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    p.updated_at = updated_at or datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return p


def _make_diagnosis_orm(diagnosis_id=None, patient_record_id=None, diagnosis_type=DiagnosisType.CONFIRMED, diagnosis="Dental Caries", notes=None, is_deleted=False):
    d = MagicMock()
    d.id = diagnosis_id or uuid4()
    d.patient_record_id = patient_record_id or uuid4()
    d.diagnosis_type = diagnosis_type
    d.diagnosis = diagnosis
    d.notes = notes
    d.is_deleted = is_deleted
    d.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    d.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return d


def _make_prescription_orm(prescription_id=None, patient_record_id=None, prescribed_by=1, notes=None, is_deleted=False):
    p = MagicMock()
    p.id = prescription_id or uuid4()
    p.patient_record_id = patient_record_id or uuid4()
    p.prescribed_by = prescribed_by
    p.notes = notes
    p.is_deleted = is_deleted
    p.prescribed_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    p.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    p.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return p


def _make_prescription_item_orm(item_id=None, prescription_id=None, medicine_name="Amoxicillin", dosage="500mg", frequency="TDS", duration="5 days", instructions=None, is_deleted=False):
    i = MagicMock()
    i.id = item_id or uuid4()
    i.prescription_id = prescription_id or uuid4()
    i.medicine_name = medicine_name
    i.dosage = dosage
    i.frequency = frequency
    i.duration = duration
    i.instructions = instructions
    i.is_deleted = is_deleted
    i.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    i.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return i


def _make_attachment_orm(attachment_id=None, patient_record_id=None, attachment_type=AttachmentType.DOCUMENT, file_name="report.pdf", file_path="/uploads/report.pdf", mime_type="application/pdf", file_size=1024, is_deleted=False):
    a = MagicMock()
    a.id = attachment_id or uuid4()
    a.patient_record_id = patient_record_id or uuid4()
    a.attachment_type = attachment_type
    a.file_name = file_name
    a.file_path = file_path
    a.mime_type = mime_type
    a.file_size = file_size
    a.is_deleted = is_deleted
    a.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    a.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return a


def _make_followup_orm(followup_id=None, patient_record_id=None, followup_date=None, notes=None, is_deleted=False):
    f = MagicMock()
    f.id = followup_id or uuid4()
    f.patient_record_id = patient_record_id or uuid4()
    f.followup_date = followup_date or date(2026, 7, 15)
    f.notes = notes
    f.is_deleted = is_deleted
    f.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    f.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return f


def _make_audit_log_orm(log_id=None, patient_record_id=None, action="PATIENT_RECORD_CREATED", old_value=None, new_value=None, performed_by=1):
    a = MagicMock()
    a.id = log_id or uuid4()
    a.patient_record_id = patient_record_id or uuid4()
    a.action = action
    a.old_value = old_value
    a.new_value = new_value
    a.performed_by = performed_by
    a.performed_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    return a


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_patient_record():
    return _make_patient_record_orm()


@pytest.fixture
def mock_finalized_record():
    return _make_patient_record_orm(is_finalized=True, status=RecordStatus.FINALIZED)


@pytest.fixture
def mock_deleted_record():
    return _make_patient_record_orm(is_deleted=True)


@pytest.fixture
def mock_diagnosis():
    return _make_diagnosis_orm()


@pytest.fixture
def mock_prescription():
    return _make_prescription_orm()


@pytest.fixture
def mock_prescription_item():
    return _make_prescription_item_orm()


@pytest.fixture
def mock_attachment():
    return _make_attachment_orm()


@pytest.fixture
def mock_followup():
    return _make_followup_orm()


@pytest.fixture
def mock_audit_log():
    return _make_audit_log_orm()


__all__ = [
    "_make_patient_record_orm", "_make_diagnosis_orm",
    "_make_prescription_orm", "_make_prescription_item_orm",
    "_make_attachment_orm", "_make_followup_orm", "_make_audit_log_orm",
]
