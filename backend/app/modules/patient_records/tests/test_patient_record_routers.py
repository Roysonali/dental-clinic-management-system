"""
Router Tests for Patient Records Module
========================================

Tests all API endpoints using FastAPI TestClient with mocked services
via dependency overrides.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

import os
os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite3"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.exception_handlers import register_exception_handlers
from app.core.constants import ROLE_ADMIN
from app.modules.auth.models import User
from app.dependencies.auth import get_current_user
from app.modules.patient_records.enums import RecordStatus, DiagnosisType, AttachmentType
from app.modules.patient_records.exceptions import (
    PatientRecordNotFound, PatientRecordBusinessRule,
    PatientRecordConflict, DiagnosisNotFound,
    PrescriptionNotFound, AttachmentNotFound, FollowupNotFound,
)
from app.modules.patient_records.services import (
    PatientRecordService, DiagnosisService,
    PrescriptionService, AttachmentService, FollowupService,
)
from app.modules.patient_records.routers.patient_record_router import router as patient_record_router
from app.modules.patient_records.routers.diagnosis_router import router as diagnosis_router
from app.modules.patient_records.routers.diagnosis_router import item_router as diagnosis_item_router
from app.modules.patient_records.routers.prescription_router import router as prescription_router
from app.modules.patient_records.routers.prescription_router import item_router as prescription_item_router
from app.modules.patient_records.routers.attachment_router import router as attachment_router
from app.modules.patient_records.routers.attachment_router import item_router as attachment_item_router
from app.modules.patient_records.routers.followup_router import router as followup_router
from app.modules.patient_records.routers.followup_router import item_router as followup_item_router


def _make_mock_user(role=ROLE_ADMIN, user_id=1):
    user = MagicMock(spec=User)
    user.id = user_id
    user.role = MagicMock()
    user.role.name = role
    return user


def _make_mock_patient_record(record_id=None):
    r = MagicMock()
    r.id = record_id or uuid4()
    r.patient_id = uuid4()
    r.appointment_id = uuid4()
    r.status = RecordStatus.DRAFT
    r.chief_complaint = "Tooth pain"
    r.clinical_notes = None
    r.doctor_remarks = None
    r.treatment_recommendation = None
    r.systemic_diseases = None
    r.surgeries = None
    r.medications = None
    r.habits = None
    r.medical_alerts = None
    r.allergies = None
    r.dental_history = None
    r.is_finalized = False
    r.is_deleted = False
    r.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    r.updated_at = datetime(2026, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    r.diagnoses = []
    r.prescriptions = []
    r.attachments = []
    r.followups = []
    r.audit_logs = []
    return r


@pytest.fixture
def mock_svc():
    return MagicMock(spec=PatientRecordService)


@pytest.fixture
def mock_diag_svc():
    return MagicMock(spec=DiagnosisService)


@pytest.fixture
def mock_rx_svc():
    return MagicMock(spec=PrescriptionService)


@pytest.fixture
def mock_att_svc():
    return MagicMock(spec=AttachmentService)


@pytest.fixture
def mock_fup_svc():
    return MagicMock(spec=FollowupService)


@pytest.fixture
def app(mock_svc, mock_diag_svc, mock_rx_svc, mock_att_svc, mock_fup_svc):
    application = FastAPI(title="DensCare Test")
    application.include_router(patient_record_router)
    application.include_router(diagnosis_router)
    application.include_router(diagnosis_item_router)
    application.include_router(prescription_router)
    application.include_router(prescription_item_router)
    application.include_router(attachment_router)
    application.include_router(attachment_item_router)
    application.include_router(followup_router)
    application.include_router(followup_item_router)
    register_exception_handlers(application)
    application.dependency_overrides[get_db] = lambda: MagicMock(spec=Session)
    admin_user = _make_mock_user(ROLE_ADMIN)
    application.dependency_overrides[get_current_user] = lambda: admin_user
    from app.modules.patient_records.dependencies.patient_record_dependencies import (
        get_patient_record_service, get_diagnosis_service,
        get_prescription_service, get_attachment_service, get_followup_service,
    )
    application.dependency_overrides[get_patient_record_service] = lambda: mock_svc
    application.dependency_overrides[get_diagnosis_service] = lambda: mock_diag_svc
    application.dependency_overrides[get_prescription_service] = lambda: mock_rx_svc
    application.dependency_overrides[get_attachment_service] = lambda: mock_att_svc
    application.dependency_overrides[get_followup_service] = lambda: mock_fup_svc
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


class TestPatientRecordEndpoints:
    def test_create_success(self, client, mock_svc):
        record = _make_mock_patient_record()
        mock_svc.create_patient_record.return_value = record
        payload = {"patient_id": str(record.patient_id), "appointment_id": str(record.appointment_id), "chief_complaint": "Tooth pain"}
        resp = client.post("/patient-records", json=payload)
        assert resp.status_code == 201
        assert resp.json()["id"] == str(record.id)

    def test_create_without_appointment(self, client, mock_svc):
        """Records can be created without appointment_id (walk-in, historical)."""
        record = _make_mock_patient_record()
        record.appointment_id = None
        mock_svc.create_patient_record.return_value = record
        payload = {"patient_id": str(record.patient_id), "chief_complaint": "Walk-in consultation"}
        resp = client.post("/patient-records", json=payload)
        assert resp.status_code == 201
        assert resp.json()["id"] == str(record.id)

    def test_create_duplicate(self, client, mock_svc):
        mock_svc.create_patient_record.side_effect = PatientRecordConflict(message="A record already exists")
        resp = client.post("/patient-records", json={"patient_id": str(uuid4()), "appointment_id": str(uuid4())})
        assert resp.status_code == 409

    def test_get_success(self, client, mock_svc):
        record = _make_mock_patient_record()
        mock_svc.get_record_or_raise.return_value = record
        resp = client.get(f"/patient-records/{record.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(record.id)

    def test_get_not_found(self, client, mock_svc):
        mock_svc.get_record_or_raise.side_effect = PatientRecordNotFound(record_id=uuid4())
        resp = client.get(f"/patient-records/{uuid4()}")
        assert resp.status_code == 404

    def test_update_success(self, client, mock_svc):
        record = _make_mock_patient_record()
        mock_svc.update_record.return_value = record
        resp = client.patch(f"/patient-records/{record.id}", json={"chief_complaint": "Updated"})
        assert resp.status_code == 200

    def test_update_finalized_raises(self, client, mock_svc):
        mock_svc.update_record.side_effect = PatientRecordBusinessRule(message="is finalized")
        resp = client.patch(f"/patient-records/{uuid4()}", json={"chief_complaint": "Updated"})
        assert resp.status_code == 400

    def test_delete_success(self, client, mock_svc):
        mock_svc.delete_record.return_value = None
        resp = client.delete(f"/patient-records/{uuid4()}")
        assert resp.status_code == 204

    def test_delete_finalized_raises(self, client, mock_svc):
        mock_svc.delete_record.side_effect = PatientRecordBusinessRule(message="is finalized")
        resp = client.delete(f"/patient-records/{uuid4()}")
        assert resp.status_code == 400

    def test_finalize_success(self, client, mock_svc):
        record = _make_mock_patient_record()
        record.is_finalized = True
        mock_svc.finalize_record.return_value = record
        resp = client.post(f"/patient-records/{record.id}/finalize", json={"confirm": True})
        assert resp.status_code == 200
        assert resp.json()["is_finalized"] is True

    def test_finalize_no_confirm_raises(self, client, mock_svc):
        resp = client.post(f"/patient-records/{uuid4()}/finalize", json={"confirm": False})
        assert resp.status_code == 422

    def test_list_pagination(self, client, mock_svc):
        records = [_make_mock_patient_record() for _ in range(3)]
        mock_svc.list_records.return_value = (records, 10)
        resp = client.get("/patient-records?page=1&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 3
        assert data["total"] == 10

    def test_list_with_filters(self, client, mock_svc):
        mock_svc.list_records.return_value = ([], 0)
        resp = client.get("/patient-records?status=DRAFT&is_finalized=false&search=pain")
        assert resp.status_code == 200

    def test_get_by_appointment_not_found(self, client, mock_svc):
        mock_svc.get_record_by_appointment.return_value = None
        resp = client.get(f"/patient-records/appointment/{uuid4()}")
        assert resp.status_code == 404


class TestDiagnosisEndpoints:
    def test_create_success(self, client, mock_diag_svc):
        diag = MagicMock()
        diag.id = uuid4()
        diag.diagnosis_name = "Dental Caries"
        diag.diagnosis_type = "CONFIRMED"
        diag.notes = None
        diag.patient_record_id = uuid4()
        diag.created_at = "2026-01-15T10:30:00Z"
        diag.updated_at = "2026-06-20T14:45:00Z"
        mock_diag_svc.create_diagnosis.return_value = diag
        resp = client.post(f"/patient-records/{uuid4()}/diagnoses", json={"diagnosis_name": "Caries", "diagnosis_type": "CONFIRMED"})
        assert resp.status_code == 201

    def test_create_validation_error(self, client, mock_diag_svc):
        resp = client.post(f"/patient-records/{uuid4()}/diagnoses", json={"diagnosis_name": "A", "diagnosis_type": "CONFIRMED"})
        assert resp.status_code == 422

    def test_list_success(self, client, mock_diag_svc):
        mock_diag_svc.list_diagnoses.return_value = ([], 0)
        resp = client.get(f"/patient-records/{uuid4()}/diagnoses")
        assert resp.status_code == 200

    def test_update_success(self, client, mock_diag_svc):
        diag = MagicMock()
        diag.id = uuid4()
        diag.diagnosis_name = "Dental Caries"
        diag.diagnosis_type = "CONFIRMED"
        diag.notes = "Updated"
        diag.patient_record_id = uuid4()
        diag.created_at = "2026-01-15T10:30:00Z"
        diag.updated_at = "2026-06-20T14:45:00Z"
        mock_diag_svc.update_diagnosis.return_value = diag
        resp = client.patch(f"/diagnoses/{diag.id}", json={"notes": "Updated"})
        assert resp.status_code == 200

    def test_update_not_found(self, client, mock_diag_svc):
        mock_diag_svc.update_diagnosis.side_effect = DiagnosisNotFound(diagnosis_id=uuid4())
        resp = client.patch(f"/diagnoses/{uuid4()}", json={"notes": "Updated"})
        assert resp.status_code == 404

    def test_delete_success(self, client, mock_diag_svc):
        resp = client.delete(f"/diagnoses/{uuid4()}")
        assert resp.status_code == 204

    def test_get_not_found(self, client, mock_diag_svc):
        mock_diag_svc.get_diagnosis.return_value = None
        resp = client.get(f"/diagnoses/{uuid4()}")
        assert resp.status_code == 404


class TestPrescriptionEndpoints:
    def test_create_success(self, client, mock_rx_svc):
        rx = MagicMock()
        rx.id = uuid4()
        rx.items = []
        rx.notes = "Take with food"
        rx.patient_record_id = uuid4()
        rx.prescribed_by = 1
        rx.prescribed_at = "2026-01-15T10:30:00Z"
        rx.created_at = "2026-01-15T10:30:00Z"
        rx.updated_at = "2026-06-20T14:45:00Z"
        mock_rx_svc.create_prescription.return_value = rx
        payload = {"notes": "Take with food", "items": [{"medicine_name": "Amoxicillin", "dosage": "500mg", "frequency": "TDS", "duration": "5 days"}]}
        resp = client.post(f"/patient-records/{uuid4()}/prescriptions", json=payload)
        assert resp.status_code == 201

    def test_create_no_items(self, client, mock_rx_svc):
        resp = client.post(f"/patient-records/{uuid4()}/prescriptions", json={"items": []})
        assert resp.status_code == 422

    def test_list_success(self, client, mock_rx_svc):
        mock_rx_svc.list_prescriptions.return_value = ([], 0)
        resp = client.get(f"/patient-records/{uuid4()}/prescriptions")
        assert resp.status_code == 200

    def test_update_success(self, client, mock_rx_svc):
        rx = MagicMock()
        rx.id = uuid4()
        rx.notes = "Updated"
        rx.patient_record_id = uuid4()
        rx.prescribed_by = 1
        rx.prescribed_at = "2026-01-15T10:30:00Z"
        rx.created_at = "2026-01-15T10:30:00Z"
        rx.updated_at = "2026-06-20T14:45:00Z"
        rx.items = []
        mock_rx_svc.update_prescription.return_value = rx
        resp = client.patch(f"/prescriptions/{rx.id}", json={"notes": "Updated"})
        assert resp.status_code == 200

    def test_delete_success(self, client, mock_rx_svc):
        resp = client.delete(f"/prescriptions/{uuid4()}")
        assert resp.status_code == 204

    def test_get_not_found(self, client, mock_rx_svc):
        mock_rx_svc.get_prescription.return_value = None
        resp = client.get(f"/prescriptions/{uuid4()}")
        assert resp.status_code == 404


def _make_mock_attachment(**overrides):
    att = MagicMock()
    defaults = dict(
        id=uuid4(),
        attachment_type="PDF",
        file_name="report.pdf",
        file_path="a" * 32,
        storage_key="a" * 32,
        uploaded_by=1,
        mime_type="application/pdf",
        file_size=1024,
        patient_record_id=uuid4(),
        created_at="2026-01-15T10:30:00Z",
        updated_at="2026-06-20T14:45:00Z",
    )
    for key, value in {**defaults, **overrides}.items():
        setattr(att, key, value)
    return att


class TestAttachmentEndpoints:
    def test_upload_success_multipart(self, client, mock_att_svc):
        att = _make_mock_attachment()
        mock_att_svc.upload_attachment.return_value = att
        resp = client.post(
            f"/patient-records/{uuid4()}/attachments",
            data={"attachment_type": "PDF"},
            files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert resp.status_code == 201
        assert resp.json()["file_name"] == "report.pdf"
        # The service receives the raw file + declared type.
        upload_payload = mock_att_svc.upload_attachment.call_args.kwargs["payload"]
        assert upload_payload.file_name == "report.pdf"
        assert upload_payload.content.startswith(b"%PDF-1.4")
        assert upload_payload.attachment_type == "PDF"

    def test_upload_missing_file_is_422(self, client):
        resp = client.post(
            f"/patient-records/{uuid4()}/attachments",
            data={"attachment_type": "PDF"},
        )
        assert resp.status_code == 422

    def test_upload_missing_type_is_422(self, client):
        resp = client.post(
            f"/patient-records/{uuid4()}/attachments",
            files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert resp.status_code == 422

    def test_list_success(self, client, mock_att_svc):
        mock_att_svc.list_attachments.return_value = ([], 0)
        resp = client.get(f"/patient-records/{uuid4()}/attachments")
        assert resp.status_code == 200

    def test_get_success(self, client, mock_att_svc):
        att = _make_mock_attachment()
        mock_att_svc.get_attachment.return_value = att
        resp = client.get(f"/attachments/{att.id}")
        assert resp.status_code == 200
        assert resp.json()["uploaded_by"] == 1

    def test_get_not_found(self, client, mock_att_svc):
        mock_att_svc.get_attachment.return_value = None
        resp = client.get(f"/attachments/{uuid4()}")
        assert resp.status_code == 404

    def test_download_success(self, client, mock_att_svc):
        att = _make_mock_attachment(file_name="Réport pdf.pdf")
        mock_att_svc.download_attachment.return_value = (b"%PDF-1.4 content", att)
        resp = client.get(f"/attachments/{att.id}/download")
        assert resp.status_code == 200
        assert resp.content == b"%PDF-1.4 content"
        assert resp.headers["content-type"].startswith("application/pdf")
        disposition = resp.headers["content-disposition"]
        assert disposition.startswith("attachment")
        # Non-ASCII filename is preserved via the RFC 5987 filename* form.
        assert "filename*=UTF-8''" in disposition

    def test_download_not_found(self, client, mock_att_svc):
        mock_att_svc.download_attachment.side_effect = AttachmentNotFound(attachment_id=uuid4())
        resp = client.get(f"/attachments/{uuid4()}/download")
        assert resp.status_code == 404

    def test_download_legacy_row_returns_404(self, client, mock_att_svc):
        from app.modules.patient_records.exceptions import AttachmentDownloadError
        mock_att_svc.download_attachment.side_effect = AttachmentDownloadError(attachment_id=uuid4())
        resp = client.get(f"/attachments/{uuid4()}/download")
        assert resp.status_code == 404

    def test_preview_success_inline(self, client, mock_att_svc):
        att = _make_mock_attachment(mime_type="application/pdf")
        mock_att_svc.download_attachment.return_value = (b"%PDF-1.4 content", att)
        resp = client.get(f"/attachments/{att.id}/preview")
        assert resp.status_code == 200
        assert resp.headers["content-disposition"].startswith("inline")

    def test_preview_unsupported_type_returns_400(self, client, mock_att_svc):
        att = _make_mock_attachment(mime_type="text/plain", file_name="notes.txt")
        mock_att_svc.download_attachment.return_value = (b"plain text", att)
        resp = client.get(f"/attachments/{att.id}/preview")
        assert resp.status_code == 400

    def test_download_denied_for_unauthorized_role(self, client, app):
        """RBAC/IDOR: a user without patient-record read roles is denied
        even with a valid attachment ID (not just hidden in the UI)."""
        app.dependency_overrides[get_current_user] = lambda: _make_mock_user("NURSE")
        resp = client.get(f"/attachments/{uuid4()}/download")
        assert resp.status_code == 403

    def test_delete_success(self, client, mock_att_svc):
        resp = client.delete(f"/attachments/{uuid4()}")
        assert resp.status_code == 204


class TestFollowupEndpoints:
    def test_create_success(self, client, mock_fup_svc):
        fup = MagicMock()
        fup.id = uuid4()
        fup.followup_date = "2026-12-31"
        fup.notes = None
        fup.patient_record_id = uuid4()
        fup.created_at = "2026-01-15T10:30:00Z"
        fup.updated_at = "2026-06-20T14:45:00Z"
        mock_fup_svc.create_followup.return_value = fup
        resp = client.post(f"/patient-records/{uuid4()}/followups", json={"followup_date": "2026-12-31"})
        assert resp.status_code == 201

    def test_list_success(self, client, mock_fup_svc):
        mock_fup_svc.list_followups.return_value = ([], 0)
        resp = client.get(f"/patient-records/{uuid4()}/followups")
        assert resp.status_code == 200

    def test_update_success(self, client, mock_fup_svc):
        fup = MagicMock()
        fup.id = uuid4()
        fup.followup_date = "2026-12-31"
        fup.notes = "Updated"
        fup.patient_record_id = uuid4()
        fup.created_at = "2026-01-15T10:30:00Z"
        fup.updated_at = "2026-06-20T14:45:00Z"
        mock_fup_svc.update_followup.return_value = fup
        resp = client.patch(f"/followups/{fup.id}", json={"notes": "Updated"})
        assert resp.status_code == 200

    def test_delete_success(self, client, mock_fup_svc):
        resp = client.delete(f"/followups/{uuid4()}")
        assert resp.status_code == 204

    def test_get_not_found(self, client, mock_fup_svc):
        mock_fup_svc.get_followup.return_value = None
        resp = client.get(f"/followups/{uuid4()}")
        assert resp.status_code == 404

    def test_upcoming(self, client, mock_fup_svc):
        mock_fup_svc.get_upcoming.return_value = ([], 0)
        resp = client.get("/followups/upcoming")
        assert resp.status_code == 200
