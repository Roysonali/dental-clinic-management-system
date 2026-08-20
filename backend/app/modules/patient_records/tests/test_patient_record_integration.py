"""
Integration Tests for Patient Records Module
=============================================

End-to-end tests using a temporary database with actual services
and repositories.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

import os
import uuid as _uuid
os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite3"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from datetime import date
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.base import Base
from app.modules.patient_records.models import (
    PatientRecord, PatientRecordDiagnosis, PatientRecordPrescription,
    PatientRecordPrescriptionItem, PatientRecordAttachment,
    PatientRecordFollowup, PatientRecordAuditLog,
)
from app.modules.patient_records.enums import RecordStatus, DiagnosisType, AttachmentType
from app.modules.patient_records.services import (
    PatientRecordService, DiagnosisService,
    PrescriptionService, FollowupService, AttachmentService,
)
from app.modules.patient_records.repositories import (
    PatientRecordRepository, AuditLogRepository,
)
from app.modules.patient_records.schemas.patient_record_schema import PatientRecordCreate
from app.modules.patient_records.schemas.diagnosis_schema import DiagnosisCreate, DiagnosisUpdate
from app.modules.patient_records.schemas.prescription_schema import PrescriptionCreate, PrescriptionItemCreate
from app.modules.patient_records.schemas.followup_schema import FollowupCreate, FollowupUpdate
from app.modules.patient_records.schemas.attachment_schema import AttachmentUpload
from app.modules.patient_records.constants import PRESCRIPTION_CREATED, ATTACHMENT_DOWNLOADED
from app.modules.patient_records.exceptions import (
    AttachmentDownloadError,
    PatientRecordBusinessRule,
)
from app.modules.patient_records.validators import PatientRecordValidator
from app.core.storage import LocalStorage


@pytest.fixture(scope="function")
def db():
    """Create a unique temp-file SQLite database for each test."""
    import tempfile
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine, checkfirst=True)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        engine.dispose()
        try:
            os.unlink(db_path)
        except OSError:
            pass


@pytest.fixture
def record_svc(db: Session):
    return PatientRecordService(db)


@pytest.fixture
def diagnosis_svc(db: Session):
    return DiagnosisService(db)


@pytest.fixture
def prescription_svc(db: Session):
    return PrescriptionService(db)


@pytest.fixture
def followup_svc(db: Session):
    return FollowupService(db)


@pytest.fixture
def attachment_svc(db: Session):
    return AttachmentService(db)


class TestPatientRecordLifecycle:
    """Workflow 1: create -> update -> finalize -> verify immutable."""

    def test_full_lifecycle(self, record_svc):
        svc = record_svc
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4(), chief_complaint="Initial tooth pain")
        record = svc.record_repo.create_patient_record(record)
        record_id = record.id
        assert record_id is not None
        assert record.status == RecordStatus.DRAFT
        assert record.chief_complaint == "Initial tooth pain"

        updated = svc.record_repo.update_record(record, {
            "chief_complaint": "Updated: severe tooth pain",
            "clinical_notes": "Patient reports pain in #36",
        })
        assert updated.chief_complaint == "Updated: severe tooth pain"
        assert updated.clinical_notes == "Patient reports pain in #36"

        finalized = svc.record_repo.finalize_record(svc.record_repo.get_by_id_or_raise(record_id))
        assert finalized.is_finalized is True
        assert finalized.status == RecordStatus.FINALIZED

        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            PatientRecordValidator.assert_not_finalized(finalized)

    def test_create_with_service_validates(self, record_svc):
        with pytest.raises(PatientRecordBusinessRule, match="does not exist"):
            record_svc.create_patient_record(PatientRecordCreate(patient_id=uuid4(), appointment_id=uuid4()), actor_id=1)


class TestDiagnosisWorkflow:
    """Workflow 2: create -> update -> list -> verify audit."""

    def test_diagnosis_lifecycle(self, db: Session):
        record_repo = PatientRecordRepository(db)
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)
        svc = DiagnosisService(db)

        result = svc.create_diagnosis(record.id, DiagnosisCreate(diagnosis_name="Gingivitis", diagnosis_type=DiagnosisType.CONFIRMED), actor_id=1)
        assert result.id is not None
        assert result.diagnosis_name == "Gingivitis"

        updated = svc.update_diagnosis(result.id, DiagnosisUpdate(notes="Mild case"), actor_id=1)
        assert updated.notes == "Mild case"

        diagnoses, total = svc.list_diagnoses(record.id)
        assert total >= 1
        db.rollback()


class TestPrescriptionWorkflow:
    """Workflow 3: create -> add items -> verify ownership -> verify audit."""

    def test_prescription_lifecycle(self, db: Session):
        record_repo = PatientRecordRepository(db)
        audit_repo = AuditLogRepository(db)
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)

        svc = PrescriptionService(db)
        payload = PrescriptionCreate(
            notes="Take after meals",
            items=[
                PrescriptionItemCreate(medicine_name="Amoxicillin", dosage="500mg", frequency="TDS", duration="5 days"),
                PrescriptionItemCreate(medicine_name="Ibuprofen", dosage="400mg", frequency="PRN", duration="3 days", instructions="Take if pain persists"),
            ],
        )
        prescription = svc.create_prescription(patient_record_id=record.id, prescribed_by=1, payload=payload, actor_id=1)
        assert prescription.id is not None
        assert len(prescription.items) == 2
        for item in prescription.items:
            assert item.prescription_id == prescription.id

        _, total = svc.list_prescriptions(record.id)
        assert total >= 1

        audits, _ = audit_repo.get_by_record(record.id)
        audit_actions = [a.action for a in audits]
        assert PRESCRIPTION_CREATED in audit_actions
        db.rollback()


class TestFollowupWorkflow:
    """Workflow 4: create -> update -> list."""

    def test_followup_lifecycle(self, db: Session):
        record_repo = PatientRecordRepository(db)
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)
        svc = FollowupService(db)

        followup = svc.create_followup(record.id, FollowupCreate(followup_date=date(2099, 12, 31), notes="Review healing progress"), actor_id=1)
        assert followup.id is not None
        assert followup.followup_date == date(2099, 12, 31)
        assert followup.notes == "Review healing progress"

        updated = svc.update_followup(followup.id, FollowupUpdate(notes="Updated: review pain level"), actor_id=1)
        assert updated.notes == "Updated: review pain level"

        _, total = svc.list_followups(record.id)
        assert total >= 1

        upcoming, _ = svc.get_upcoming(from_date=date(2099, 1, 1), to_date=date(2099, 12, 31))
        assert len(upcoming) >= 1
        db.rollback()


class TestSoftDeleteWorkflow:
    """Workflow 5: create -> delete -> verify hidden -> verify include_deleted."""

    def test_soft_delete_lifecycle(self, db: Session):
        svc = PatientRecordService(db)
        record_repo = svc.record_repo
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)
        record_id = record.id

        assert record_repo.get_by_id(record_id) is not None

        svc.record_repo.soft_delete(record)
        db.commit()

        assert record_repo.get_by_id(record_id) is None
        visible = record_repo.get_by_id(record_id, include_deleted=True)
        assert visible is not None
        assert visible.is_deleted is True

        assert record_repo.count() == 0
        assert record_repo.count(include_deleted=True) >= 1
        db.rollback()


class TestAttachmentWorkflow:
    """upload file -> get -> download -> delete (real storage round-trip)."""

    def test_attachment_lifecycle(self, db: Session, tmp_path):
        record_repo = PatientRecordRepository(db)
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)
        storage = LocalStorage(tmp_path / "uploads")
        svc = AttachmentService(db, storage=storage)

        content = b"%PDF-1.4\nreal pdf content"
        attachment = svc.upload_attachment(record.id, AttachmentUpload(
            file_name="xray.pdf",
            content=content,
            content_type="application/pdf",
            attachment_type=AttachmentType.PDF,
        ), actor_id=1)
        assert attachment.id is not None
        assert attachment.file_name == "xray.pdf"
        assert attachment.mime_type == "application/pdf"
        assert attachment.file_size == len(content)
        assert attachment.uploaded_by == 1
        assert attachment.storage_key is not None
        # Physical object really exists on disk.
        assert storage.exists(attachment.storage_key)

        assert svc.get_attachment(attachment.id) is not None
        _, total = svc.list_attachments(record.id)
        assert total >= 1

        # Download returns the exact bytes and writes an audit entry.
        downloaded, att = svc.download_attachment(attachment.id, actor_id=2)
        assert downloaded == content
        assert att.id == attachment.id
        audits, _ = AuditLogRepository(db).get_by_record(record.id)
        assert ATTACHMENT_DOWNLOADED in [a.action for a in audits]

        svc.delete_attachment(attachment.id, actor_id=1)
        # Soft delete hides the row AND removes the physical file.
        assert svc.get_attachment(attachment.id) is None
        visible = svc.get_attachment(attachment.id, include_deleted=True)
        assert visible is not None
        assert visible.is_deleted is True
        assert not storage.exists(attachment.storage_key)
        db.rollback()

    def test_legacy_row_without_file_cannot_be_downloaded(self, db: Session, tmp_path):
        """Metadata-only legacy rows (no storage_key) must not resolve."""
        record_repo = PatientRecordRepository(db)
        record = PatientRecord(patient_id=uuid4(), appointment_id=uuid4())
        record = record_repo.create_patient_record(record)
        storage = LocalStorage(tmp_path / "uploads")
        svc = AttachmentService(db, storage=storage)

        # Simulate a legacy metadata-only row (storage_key stays NULL).
        legacy = PatientRecordAttachment(
            patient_record_id=record.id,
            attachment_type=AttachmentType.DOCUMENT,
            file_name="legacy.pdf",
            file_path="D:\\Xrays\\legacy.pdf",
            mime_type="application/pdf",
            file_size=1024,
        )
        legacy = svc.attachment_repo.create(legacy)
        db.commit()

        with pytest.raises(AttachmentDownloadError):
            svc.download_attachment(legacy.id, actor_id=1)
        db.rollback()
