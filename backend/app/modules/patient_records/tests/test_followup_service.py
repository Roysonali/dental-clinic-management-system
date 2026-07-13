"""
Unit tests for FollowupService.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from uuid import uuid4
from unittest.mock import MagicMock
from datetime import date, timedelta
import pytest
from conftest import _make_patient_record_orm, _make_followup_orm
from app.modules.patient_records.services import FollowupService
from app.modules.patient_records.exceptions import PatientRecordBusinessRule
from app.modules.patient_records.schemas.followup_schema import FollowupCreate


class TestCreateFollowup:
    def test_success(self):
        db = MagicMock(); svc = FollowupService(db)
        svc.followup_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        record = _make_patient_record_orm()
        followup = _make_followup_orm()
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.followup_repo.create.return_value = followup
        payload = FollowupCreate(followup_date=date.today() + timedelta(days=7))
        result = svc.create_followup(record.id, payload, actor_id=1)
        assert result.id == followup.id
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()

    def test_finalized_record_raises(self):
        db = MagicMock(); svc = FollowupService(db)
        svc.record_repo = MagicMock()
        record = _make_patient_record_orm(is_finalized=True)
        svc.record_repo.get_by_id_or_raise.return_value = record
        payload = FollowupCreate(followup_date=date.today() + timedelta(days=7))
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            svc.create_followup(record.id, payload, actor_id=1)


class TestDeleteFollowup:
    def test_success(self):
        db = MagicMock(); svc = FollowupService(db)
        svc.followup_repo = MagicMock(); svc.record_repo = MagicMock(); svc.audit_repo = MagicMock()
        followup = _make_followup_orm(is_deleted=False)
        record = _make_patient_record_orm()
        svc.followup_repo.get_by_id_or_raise.return_value = followup
        svc.record_repo.get_by_id_or_raise.return_value = record
        svc.delete_followup(followup.id, actor_id=1)
        svc.followup_repo.soft_delete.assert_called_once()
        svc.audit_repo.create.assert_called_once()
        db.commit.assert_called_once()
