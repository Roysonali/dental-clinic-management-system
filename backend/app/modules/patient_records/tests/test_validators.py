"""
Unit tests for Patient Record validators.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from uuid import uuid4
from datetime import date
import pytest
from conftest import _make_patient_record_orm
from app.modules.patient_records.validators import PatientRecordValidator
from app.modules.patient_records.validators.followup_validator import FollowupValidator
from app.modules.patient_records.exceptions import PatientRecordBusinessRule


class TestPatientRecordValidator:
    def test_assert_exists_passes(self):
        record = _make_patient_record_orm()
        PatientRecordValidator.assert_exists(record)

    def test_assert_exists_raises(self):
        with pytest.raises(PatientRecordBusinessRule, match="does not exist"):
            PatientRecordValidator.assert_exists(None, record_id=uuid4())

    def test_assert_not_deleted_passes(self):
        record = _make_patient_record_orm(is_deleted=False)
        PatientRecordValidator.assert_not_deleted(record)

    def test_assert_not_deleted_raises(self):
        record = _make_patient_record_orm(is_deleted=True)
        with pytest.raises(PatientRecordBusinessRule, match="deleted"):
            PatientRecordValidator.assert_not_deleted(record)

    def test_assert_not_finalized_passes(self):
        record = _make_patient_record_orm(is_finalized=False)
        PatientRecordValidator.assert_not_finalized(record)

    def test_assert_not_finalized_raises(self):
        record = _make_patient_record_orm(is_finalized=True)
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            PatientRecordValidator.assert_not_finalized(record)

    def test_assert_modifiable_passes(self):
        record = _make_patient_record_orm(is_deleted=False, is_finalized=False)
        PatientRecordValidator.assert_modifiable(record)

    def test_assert_modifiable_raises_deleted(self):
        record = _make_patient_record_orm(is_deleted=True)
        with pytest.raises(PatientRecordBusinessRule, match="deleted"):
            PatientRecordValidator.assert_modifiable(record)

    def test_assert_modifiable_raises_finalized(self):
        record = _make_patient_record_orm(is_finalized=True)
        with pytest.raises(PatientRecordBusinessRule, match="finalized"):
            PatientRecordValidator.assert_modifiable(record)


class TestFollowupValidator:
    def test_valid_future_date(self):
        FollowupValidator.validate_followup_date(date(2099, 12, 31))

    def test_valid_today(self):
        FollowupValidator.validate_followup_date(date.today())

    def test_past_date_raises(self):
        with pytest.raises(PatientRecordBusinessRule, match="past"):
            FollowupValidator.validate_followup_date(date(2020, 1, 1))
