"""
Unit tests for AttachmentService (real file uploads).
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
from app.modules.patient_records.exceptions import (
    AttachmentDownloadError,
    PatientRecordBusinessRule,
)
from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.schemas.attachment_schema import AttachmentUpload
from app.core.storage import StorageFileNotFound

PDF_BYTES = b"%PDF-1.4\nfake pdf content for tests"
JPG_BYTES = b"\xff\xd8\xff\xe0fake jpeg content"
PNG_BYTES = b"\x89PNG\r\n\x1a\nfake png content"
TXT_BYTES = b"plain clinical note text"


def _upload(attachment_type=AttachmentType.PDF, file_name="report.pdf",
            content=PDF_BYTES, content_type="application/pdf"):
    return AttachmentUpload(
        file_name=file_name,
        content=content,
        content_type=content_type,
        attachment_type=attachment_type,
    )


def _make_service(db, storage=None):
    svc = AttachmentService(db, storage=storage or MagicMock())
    svc.attachment_repo = MagicMock()
    svc.record_repo = MagicMock()
    svc.audit_repo = MagicMock()
    return svc


class TestUploadAttachment:
    def test_success_stores_file_and_metadata(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        record = _make_patient_record_orm()
        attachment = _make_attachment_orm(storage_key="a" * 32, uploaded_by=1)
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.attachment_repo.create.return_value = attachment

        result = svc.upload_attachment(record.id, _upload(), actor_id=7)

        assert result.id == attachment.id
        # Physical file saved under an opaque key BEFORE the row exists.
        storage.save.assert_called_once()
        saved_key = storage.save.call_args.args[0]
        assert len(saved_key) == 32 and saved_key.isalnum()
        # The row carries the opaque key + uploader + authoritative mime.
        created = svc.attachment_repo.create.call_args.args[0]
        assert created.storage_key == saved_key
        assert created.file_path == saved_key
        assert created.uploaded_by == 7
        assert created.mime_type == "application/pdf"
        assert created.file_size == len(PDF_BYTES)
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_finalized_record_raises(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.upload_attachment(record.id, _upload(), actor_id=1)

        # No file stored, nothing committed.
        svc.storage.save.assert_not_called()
        svc.attachment_repo.create.assert_not_called()

    def test_oversized_file_raises(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        from app.core.config import settings
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        with pytest.raises(PatientRecordBusinessRule, match="exceeds"):
            svc.upload_attachment(
                record.id,
                _upload(content=b"x" * (max_bytes + 1)),
                actor_id=1,
            )

        svc.storage.save.assert_not_called()

    def test_unsupported_extension_raises(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="not supported"):
            svc.upload_attachment(
                record.id,
                _upload(file_name="evil.exe", content=PDF_BYTES),
                actor_id=1,
            )

        svc.storage.save.assert_not_called()

    def test_extension_must_match_type(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        # A .jpg name registered as PDF must be rejected even though the
        # content itself is a valid PDF.
        with pytest.raises(PatientRecordBusinessRule, match="not supported"):
            svc.upload_attachment(
                record.id,
                _upload(file_name="photo.jpg", content=PDF_BYTES),
                actor_id=1,
            )

    def test_magic_bytes_mismatch_raises(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        # A .pdf registered as PDF but containing a JPEG — the sniffed
        # content is not allowed for the PDF type, so it must be rejected.
        with pytest.raises(PatientRecordBusinessRule, match="not allowed"):
            svc.upload_attachment(
                record.id,
                _upload(file_name="fake.pdf", content=JPG_BYTES),
                actor_id=1,
            )

        svc.storage.save.assert_not_called()

    def test_unrecognised_content_rejected(self):
        db = MagicMock()
        svc = _make_service(db)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        with pytest.raises(PatientRecordBusinessRule, match="unsupported format"):
            svc.upload_attachment(
                record.id,
                _upload(
                    file_name="report.pdf",
                    content=b"\x00\x01\x02arbitrary bytes",
                    content_type="application/pdf",
                ),
                actor_id=1,
            )

    def test_plain_text_accepted_only_as_document(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        result = svc.upload_attachment(
            record.id,
            _upload(
                attachment_type=AttachmentType.DOCUMENT,
                file_name="notes.txt",
                content=TXT_BYTES,
                content_type="text/plain",
            ),
            actor_id=1,
        )
        created = svc.attachment_repo.create.call_args.args[0]
        assert created.mime_type == "text/plain"

    def test_storage_failure_rolls_back_and_cleans_up(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        storage.save.side_effect = OSError("disk full")

        with pytest.raises(OSError):
            svc.upload_attachment(record.id, _upload(), actor_id=1)

        db.rollback.assert_called_once()
        svc.attachment_repo.create.assert_not_called()

    def test_image_upload_for_image_type(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        record = _make_patient_record_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record

        svc.upload_attachment(
            record.id,
            _upload(
                attachment_type=AttachmentType.IMAGE,
                file_name="xray.png",
                content=PNG_BYTES,
                content_type="image/png",
            ),
            actor_id=1,
        )
        created = svc.attachment_repo.create.call_args.args[0]
        assert created.mime_type == "image/png"


class TestDownloadAttachment:
    def test_success_returns_bytes_and_audits(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        attachment = _make_attachment_orm(storage_key="b" * 32, uploaded_by=1)
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        storage.open.return_value = PDF_BYTES

        content, att = svc.download_attachment(attachment.id, actor_id=3)

        assert content == PDF_BYTES
        assert att is attachment
        storage.open.assert_called_once_with(attachment.storage_key)
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_legacy_row_without_storage_key_raises(self):
        db = MagicMock()
        svc = _make_service(db)
        attachment = _make_attachment_orm(storage_key=None)
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment

        with pytest.raises(AttachmentDownloadError):
            svc.download_attachment(attachment.id, actor_id=3)

        svc.storage.open.assert_not_called()

    def test_missing_stored_file_raises(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        attachment = _make_attachment_orm(storage_key="c" * 32)
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        storage.open.side_effect = StorageFileNotFound(attachment.storage_key)

        with pytest.raises(AttachmentDownloadError):
            svc.download_attachment(attachment.id, actor_id=3)


class TestDeleteAttachment:
    def test_success_soft_deletes_and_removes_stored_file(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        attachment = _make_attachment_orm(storage_key="d" * 32, is_deleted=False)
        record = _make_patient_record_orm()
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        svc.record_repo.get_by_id_or_raise.return_value = record

        svc.delete_attachment(attachment.id, actor_id=1)

        svc.attachment_repo.soft_delete.assert_called_once_with(attachment)
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
        storage.delete.assert_called_once_with(attachment.storage_key)

    def test_storage_failure_does_not_block_delete(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        attachment = _make_attachment_orm(storage_key="e" * 32, is_deleted=False)
        record = _make_patient_record_orm()
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        svc.record_repo.get_by_id_or_raise.return_value = record
        storage.delete.side_effect = OSError("unlink failed")

        # Must not raise — the logical delete already committed.
        svc.delete_attachment(attachment.id, actor_id=1)

    def test_legacy_row_skips_storage_delete(self):
        db = MagicMock()
        storage = MagicMock()
        svc = _make_service(db, storage)
        attachment = _make_attachment_orm(storage_key=None)
        record = _make_patient_record_orm()
        svc.attachment_repo.get_by_id_or_raise.return_value = attachment
        svc.record_repo.get_by_id_or_raise.return_value = record

        svc.delete_attachment(attachment.id, actor_id=1)

        storage.delete.assert_not_called()
