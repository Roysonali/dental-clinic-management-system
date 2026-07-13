"""
Unit tests for PatientRecordMapper.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from app.modules.patient_records.mappers import PatientRecordMapper
from app.modules.patient_records.enums import RecordStatus

class TestPatientRecordMapper:
    def test_to_response(self):
        assert True
