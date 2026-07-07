"""
Unit tests for AttachmentService.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from conftest import _make_patient_record_orm, _make_attachment_orm
from app.modules.patient_records.services import AttachmentService
from app.modules.patient_records.exceptions import PatientRecordBusinessRule
from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.schemas.attachment_schema import AttachmentCreate


class TestUploadAttachment:
    def test_success(self):
        db = MagicMock(); svc = AttachmentService(db)
        svc.attachment_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        record = _make_patient_record_orm()
        attachment = _make_attachment_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.attachment_repo.create.return_value = attachment
        payload = AttachmentCreate(attachment_type=AttachmentType.DOCUMENT, file_name="report.pdf", file_path="/uploads/report.pdf")
        result = svc.upload_attachment(record.id, payload, actor_id=1)
        assert result.id == attachment.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_finalized_record_raises(self):
        db = MagicMock(); svc = AttachmentService(db)
        svc.record_repo = MagicMock()
        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record
        payload = AttachmentCreate(attachment_type=AttachmentType.DOCUMENT, file_name="report.pdf", file_path="/uploads/report.pdf")
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.upload_attachment(record.id, payload, actor_id=1)


class TestDeleteAttachment:
    def test_success(self):
        db = MagicMock(); svc = AttachmentService(db)
        svc.attachment_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        attachment = _make_attachment_orm(is_deleted=False)
        record = _make_patient_record_orm()
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.delete_attachment(attachment.id, actor_id=1)
        svc.attachment_repo.soft_delete.assert_called_once()
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
