"""
Unit tests for AuditLogService.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from conftest import _make_audit_log_orm
from app.modules.patient_records.services import AuditLogService

class TestAuditLogService:
    def test_create_audit(self):
        db = MagicMock(); svc = AuditLogService(db)
        svc.audit_repo = MagicMock()
        audit = _make_audit_log_orm()
        svc.audit_repo.create.return_value = audit
        result = svc.create_audit(patient_record_id=uuid4(), action='PATIENT_RECORD_CREATED', performed_by=1)
        assert result.id == audit.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
