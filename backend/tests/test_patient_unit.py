"""
Unit tests for the Patient Management Module.

Tests schema validation, service layer logic, and repository-level
behavior using mocked dependencies.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.modules.patients.exceptions import (
    DuplicatePatientDetected,
    InvalidPatientOperation,
    PatientCreationFailed,
    PatientNotFound,
    PatientUpdateFailed,
)
from app.modules.patients.schemas import (
    PatientBase,
    PatientCreate,
    PatientQuickCreate,
    PatientQuickCreateResponse,
    PatientUpdate,
    PatientResponse,
    PatientListItem,
    PatientListResponse,
    PatientProfileResponse,
)
from app.modules.patients.service import PatientService
from app.modules.patients.repository import PatientRepository
from app.modules.patients.mapper import PatientMapper
from app.core.constants import GenderEnum, ProfileStatus


def make_valid_patient_data(**overrides):
    data = {
        "first_name": "Juan",
        "middle_name": "Reyes",
        "last_name": "Dela Cruz",
        "date_of_birth": "1990-05-15",
        "gender": "male",
        "primary_contact_number": "+639123456789",
    }
    data.update(overrides)
    return data


def make_patient_orm(
    patient_id=None,
    code="PAT-000001",
    first_name="Juan",
    middle_name="Reyes",
    last_name="Dela Cruz",
    created_by=1,
    updated_by=None,
    is_active=True,
):
    p = MagicMock(spec=object)
    p.id = patient_id or uuid4()
    p.patient_code = code
    p.first_name = first_name
    p.middle_name = middle_name
    p.last_name = last_name
    p.date_of_birth = date(1990, 5, 15)
    p.gender = GenderEnum.male
    p.primary_contact_number = "+639123456789"
    p.emergency_contact_number = None
    p.email = None
    p.address = None
    p.remarks = None
    p.is_active = is_active
    p.profile_status = ProfileStatus.COMPLETE
    p.created_by = created_by
    p.updated_by = updated_by
    p.created_at = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    p.updated_at = datetime(2025, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return p


class TestPatientBaseSchema:
    def test_valid_patient_create(self):
        data = make_valid_patient_data()
        patient = PatientCreate(**data)
        assert patient.first_name == "Juan"
        assert patient.last_name == "Dela Cruz"
        assert patient.gender == GenderEnum.male
        assert patient.date_of_birth == date(1990, 5, 15)

    def test_name_stripping(self):
        data = make_valid_patient_data(first_name="  Juan  ", last_name="  Dela Cruz  ")
        patient = PatientCreate(**data)
        assert patient.first_name == "Juan"
        assert patient.last_name == "Dela Cruz"

    def test_name_special_chars_allowed(self):
        data = make_valid_patient_data(first_name="Mary-Jane", last_name="O'Brien")
        patient = PatientCreate(**data)
        assert patient.first_name == "Mary-Jane"
        assert patient.last_name == "O'Brien"

    def test_name_invalid_chars(self):
        data = make_valid_patient_data(first_name="Juan123")
        with pytest.raises(ValidationError, match="alphabetic"):
            PatientCreate(**data)

    def test_future_dob_rejected(self):
        from datetime import timedelta
        future = date.today() + timedelta(days=1)
        data = make_valid_patient_data(date_of_birth=future.isoformat())
        with pytest.raises(ValidationError, match="future"):
            PatientCreate(**data)

    def test_very_old_dob_rejected(self):
        data = make_valid_patient_data(date_of_birth="1889-01-01")
        with pytest.raises(ValidationError, match="Invalid"):
            PatientCreate(**data)

    def test_phone_normalization(self):
        data = make_valid_patient_data(primary_contact_number="+63 912 345 6789")
        patient = PatientCreate(**data)
        assert patient.primary_contact_number == "+639123456789"

    def test_email_normalization(self):
        data = make_valid_patient_data(email="  JUAN@Example.COM  ")
        patient = PatientCreate(**data)
        assert patient.email == "juan@example.com"

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            PatientCreate()

    def test_extra_field_forbidden(self):
        data = make_valid_patient_data(unknown_field="value")
        with pytest.raises(ValidationError, match="extra"):
            PatientCreate(**data)


class TestPatientUpdateSchema:
    def test_empty_update(self):
        update = PatientUpdate()
        assert update.model_dump(exclude_none=True) == {}

    def test_partial_update_first_name(self):
        update = PatientUpdate(first_name="  Jose  ")
        assert update.first_name == "Jose"

    def test_partial_update_dob_valid(self):
        update = PatientUpdate(date_of_birth="1995-06-15")
        assert update.date_of_birth == date(1995, 6, 15)

    def test_partial_update_future_dob(self):
        from datetime import timedelta
        future = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError, match="future"):
            PatientUpdate(date_of_birth=future.isoformat())

    def test_partial_update_invalid_name(self):
        with pytest.raises(ValidationError, match="alphabetic"):
            PatientUpdate(first_name="John123")


class TestPatientResponseSchema:
    def test_response_has_audit_fields(self):
        """PatientResponse through mapper should include audit fields."""
        p = make_patient_orm()
        response = PatientMapper.to_response(p)
        assert hasattr(response, "created_by")
        assert hasattr(response, "updated_by")
        assert hasattr(response, "created_at")
        assert hasattr(response, "updated_at")
        assert response.created_by == 1
        assert response.updated_by is None


class TestPatientValidatorsShared:
    def test_both_classes_inherit_validators(self):
        assert "normalize_names" in dir(PatientBase)
        assert "normalize_names" in dir(PatientUpdate)
        assert "normalize_email" in dir(PatientBase)
        assert "normalize_email" in dir(PatientUpdate)
        assert "normalize_phone" in dir(PatientBase)
        assert "normalize_phone" in dir(PatientUpdate)
        assert "validate_dob" in dir(PatientBase)
        assert "validate_dob" in dir(PatientUpdate)


class TestPatientMapper:
    def test_build_full_name_with_middle(self):
        p = make_patient_orm()
        name = PatientMapper.build_full_name(p)
        assert name == "Juan Reyes Dela Cruz"

    def test_build_full_name_without_middle(self):
        p = make_patient_orm(middle_name=None)
        name = PatientMapper.build_full_name(p)
        assert name == "Juan Dela Cruz"

    def test_calculate_age(self):
        dob = date(1990, 5, 15)
        today = date.today()
        expected = today.year - 1990
        if (today.month, today.day) < (5, 15):
            expected -= 1
        assert PatientMapper.calculate_age(dob) == expected

    def test_calculate_age_none(self):
        assert PatientMapper.calculate_age(None) is None

    def test_to_response_has_audit_fields(self):
        p = make_patient_orm(created_by=2, updated_by=3)
        response = PatientMapper.to_response(p)
        assert response.created_by == 2
        assert response.updated_by == 3


class TestPatientServiceUnit:
    @pytest.fixture
    def service(self):
        db = MagicMock()
        svc = PatientService(db)
        svc.repository = MagicMock(spec=PatientRepository)
        return svc

    def test_create_patient_success(self, service):
        payload = PatientCreate(**make_valid_patient_data())
        service.repository.get_next_patient_sequence.return_value = 1
        service.repository.find_exact_duplicate.return_value = None
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_email.return_value = []
        service.repository.find_by_name_dob.return_value = []
        service.repository.create.return_value = make_patient_orm(code="PAT-000001")
        result = service.create_patient(payload, created_by=1)
        assert result.patient_code == "PAT-000001"
        assert result.created_by == 1

    def test_create_exact_duplicate_blocked(self, service):
        payload = PatientCreate(**make_valid_patient_data())
        service.repository.get_next_patient_sequence.return_value = 1
        dup = make_patient_orm(code="PAT-000002")
        service.repository.find_exact_duplicate.return_value = dup
        with pytest.raises(DuplicatePatientDetected):
            service.create_patient(payload, created_by=1)
        service.db.rollback.assert_called_once()

    def test_create_failure_rollback(self, service):
        payload = PatientCreate(**make_valid_patient_data())
        # Mock all duplicate checks to return clean results first
        service.repository.find_exact_duplicate.return_value = None
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_email.return_value = []
        service.repository.find_by_name_dob.return_value = []
        # Then make the sequence call fail
        service.repository.get_next_patient_sequence.side_effect = Exception("DB error")
        with pytest.raises(PatientCreationFailed):
            service.create_patient(payload, created_by=1)
        service.db.rollback.assert_called_once()

    def test_get_patient_found(self, service):
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        result = service.get_patient(patient.id)
        assert result.id == str(patient.id)

    def test_get_patient_not_found(self, service):
        service.repository.get_by_id.return_value = None
        with pytest.raises(PatientNotFound):
            service.get_patient(uuid4())

    def test_list_patients(self, service):
        patients = [make_patient_orm() for _ in range(3)]
        service.repository.list.return_value = (patients, 10)
        result = service.list_patients(page=1, page_size=20)
        assert result.total == 10
        assert len(result.items) == 3

    def test_list_with_search(self, service):
        service.repository.list.return_value = ([], 0)
        service.list_patients(search="Juan")
        service.repository.list.assert_called_with(
            page=1, page_size=20, search="Juan", is_active=None
        )

    def test_update_patient_success(self, service):
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        service.repository.find_exact_duplicate_for_update.return_value = None
        service.repository.find_by_phone_for_update.return_value = None
        service.repository.find_by_email_for_update.return_value = None
        service.repository.find_by_name_dob_for_update.return_value = None
        service.repository.update.return_value = make_patient_orm(updated_by=2)
        payload = PatientUpdate(first_name="Updated")
        result = service.update_patient(patient.id, payload, updated_by=2)
        assert result.updated_by == 2
        service.db.commit.assert_called_once()

    def test_update_patient_not_found(self, service):
        service.repository.get_by_id.return_value = None
        payload = PatientUpdate(first_name="Updated")
        with pytest.raises(PatientNotFound):
            service.update_patient(uuid4(), payload)
        service.db.rollback.assert_called_once()

    def test_update_duplicate_blocked(self, service):
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        dup = make_patient_orm(code="PAT-000002")
        service.repository.find_exact_duplicate_for_update.return_value = dup
        payload = PatientUpdate(first_name="Duplicate")
        with pytest.raises(DuplicatePatientDetected):
            service.update_patient(patient.id, payload)
        service.db.rollback.assert_called_once()

    def test_update_sets_updated_by(self, service):
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        service.repository.find_exact_duplicate_for_update.return_value = None
        service.repository.find_by_phone_for_update.return_value = None
        service.repository.find_by_email_for_update.return_value = None
        service.repository.find_by_name_dob_for_update.return_value = None
        service.repository.update.return_value = patient
        payload = PatientUpdate(first_name="Updated")
        service.update_patient(patient.id, payload, updated_by=5)
        service.repository.update.assert_called_with(patient, {"first_name": "Updated"}, updated_by=5)

    def test_activate_patient(self, service):
        patient = make_patient_orm(is_active=False)
        service.repository.get_by_id.return_value = patient
        service.repository.set_active_status.return_value = make_patient_orm(is_active=True, updated_by=2)
        result = service.change_patient_status(patient.id, True, updated_by=2)
        assert result.is_active is True
        service.db.commit.assert_called_once()

    def test_deactivate_patient(self, service):
        patient = make_patient_orm(is_active=True)
        service.repository.get_by_id.return_value = patient
        service.repository.set_active_status.return_value = make_patient_orm(is_active=False, updated_by=3)
        result = service.change_patient_status(patient.id, False, updated_by=3)
        assert result.is_active is False
        service.db.commit.assert_called_once()

    def test_activate_already_active(self, service):
        patient = make_patient_orm(is_active=True)
        service.repository.get_by_id.return_value = patient
        with pytest.raises(InvalidPatientOperation):
            service.change_patient_status(patient.id, True)

    def test_deactivate_already_inactive(self, service):
        patient = make_patient_orm(is_active=False)
        service.repository.get_by_id.return_value = patient
        with pytest.raises(InvalidPatientOperation):
            service.change_patient_status(patient.id, False)

    def test_change_status_sets_updated_by(self, service):
        patient = make_patient_orm(is_active=False)
        service.repository.get_by_id.return_value = patient
        service.repository.set_active_status.return_value = patient
        service.change_patient_status(patient.id, True, updated_by=7)
        service.repository.set_active_status.assert_called_with(patient, True, updated_by=7)

    def test_change_status_not_found(self, service):
        service.repository.get_by_id.return_value = None
        with pytest.raises(PatientNotFound):
            service.change_patient_status(uuid4(), True)

    def test_get_profile(self, service):
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        result = service.get_patient_profile(patient.id)
        from app.modules.patients.schemas import PatientProfileResponse
        assert isinstance(result, PatientProfileResponse)
        assert result.created_by == 1
        assert result.updated_by is None


class TestPatientSummaryUnit:
    """Tests for the Patient Hub summary endpoint."""

    @pytest.fixture
    def service(self):
        db = MagicMock()
        svc = PatientService(db)
        svc.repository = MagicMock(spec=PatientRepository)
        return svc

    def test_summary_not_found(self, service):
        service.repository.get_by_id.return_value = None
        with pytest.raises(PatientNotFound):
            service.get_patient_summary(uuid4())

    def test_summary_empty_patient(self, service):
        """Patient with no related data returns zero counts and empty lists."""
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        service.db.scalar.return_value = 0
        mock_scalars_result = MagicMock()
        mock_scalars_result.all.return_value = []
        service.db.scalars.return_value = mock_scalars_result

        with patch(
            "app.modules.billing.services.financial_calculation_service.FinancialCalculationService",
            side_effect=Exception("no billing"),
        ):
            result = service.get_patient_summary(patient.id)

        assert result.counts.total_appointments == 0
        assert result.counts.total_records == 0
        assert result.counts.total_treatment_plans == 0
        assert result.counts.total_invoices == 0
        assert result.counts.total_payments == 0
        assert result.recent_appointments == []
        assert result.recent_records == []
        assert result.active_treatment_plans == []
        assert result.recent_invoices == []
        assert result.billing is None

    def test_summary_schema_fields(self, service):
        """Verify the summary response has the expected structure."""
        from app.modules.patients.schemas import (
            PatientSummaryResponse,
            PatientSummaryCounts,
        )
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        service.db.scalar.return_value = 5
        mock_scalars_result = MagicMock()
        mock_scalars_result.all.return_value = []
        service.db.scalars.return_value = mock_scalars_result

        with patch(
            "app.modules.billing.services.financial_calculation_service.FinancialCalculationService",
            side_effect=Exception("no billing"),
        ):
            result = service.get_patient_summary(patient.id)

        assert isinstance(result, PatientSummaryResponse)
        assert isinstance(result.counts, PatientSummaryCounts)
        assert result.counts.total_appointments == 5
        assert result.counts.total_records == 5


def make_quick_create_data(**overrides):
    """Helper for PatientQuickCreate test data."""
    data = {
        "first_name": "Abc",
        "last_name": "Dhf",
        "primary_contact_number": "+639123456789",
    }
    data.update(overrides)
    return data


def make_quick_patient_orm(
    patient_id=None,
    code="PAT-000015",
    first_name="Abc",
    last_name="Dhf",
    gender=None,
    date_of_birth=None,
    profile_status=None,
):
    """Helper for mock Patient ORM objects used in quick-create tests."""
    p = MagicMock(spec=object)
    p.id = patient_id or uuid4()
    p.patient_code = code
    p.first_name = first_name
    p.middle_name = None
    p.last_name = last_name
    p.date_of_birth = date_of_birth
    p.gender = gender
    p.primary_contact_number = "+639123456789"
    p.emergency_contact_number = None
    p.email = None
    p.address = None
    p.remarks = None
    p.is_active = True
    p.profile_status = profile_status or ProfileStatus.INCOMPLETE
    p.created_by = 1
    p.updated_by = None
    p.created_at = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    p.updated_at = datetime(2025, 6, 20, 14, 45, 0, tzinfo=timezone.utc)
    return p


class TestPatientQuickCreateSchema:
    """Tests for the PatientQuickCreate Pydantic schema."""

    def test_valid_quick_create(self):
        data = make_quick_create_data()
        patient = PatientQuickCreate(**data)
        assert patient.first_name == "Abc"
        assert patient.last_name == "Dhf"
        assert patient.primary_contact_number == "+639123456789"
        assert patient.gender is None

    def test_valid_quick_create_with_gender(self):
        data = make_quick_create_data(gender="male")
        patient = PatientQuickCreate(**data)
        assert patient.gender == GenderEnum.male

    def test_name_stripping(self):
        data = make_quick_create_data(first_name="  Abc  ", last_name="  Dhf  ")
        patient = PatientQuickCreate(**data)
        assert patient.first_name == "Abc"
        assert patient.last_name == "Dhf"

    def test_phone_normalization(self):
        data = make_quick_create_data(primary_contact_number="+63 912 345 6789")
        patient = PatientQuickCreate(**data)
        assert patient.primary_contact_number == "+639123456789"

    def test_name_invalid_chars(self):
        data = make_quick_create_data(first_name="Abc123")
        with pytest.raises(ValidationError, match="alphabetic"):
            PatientQuickCreate(**data)

    def test_missing_first_name(self):
        with pytest.raises(ValidationError):
            PatientQuickCreate(last_name="Dhf", primary_contact_number="+639123456789")

    def test_missing_last_name(self):
        with pytest.raises(ValidationError):
            PatientQuickCreate(first_name="Abc", primary_contact_number="+639123456789")

    def test_missing_phone(self):
        with pytest.raises(ValidationError):
            PatientQuickCreate(first_name="Abc", last_name="Dhf")

    def test_extra_field_forbidden(self):
        data = make_quick_create_data(unknown_field="value")
        with pytest.raises(ValidationError, match="extra"):
            PatientQuickCreate(**data)

    def test_dob_not_accepted(self):
        """Quick-create must NOT accept date_of_birth."""
        data = make_quick_create_data(date_of_birth="1990-01-01")
        with pytest.raises(ValidationError, match="extra"):
            PatientQuickCreate(**data)


class TestComputeProfileStatus:
    """Tests for PatientService._compute_profile_status."""

    def test_complete_when_all_fields_present(self):
        p = make_quick_patient_orm(
            date_of_birth=date(1990, 5, 15),
            gender=GenderEnum.male,
        )
        result = PatientService._compute_profile_status(p)
        assert result == ProfileStatus.COMPLETE

    def test_incomplete_when_dob_missing(self):
        p = make_quick_patient_orm(
            date_of_birth=None,
            gender=GenderEnum.male,
        )
        result = PatientService._compute_profile_status(p)
        assert result == ProfileStatus.INCOMPLETE

    def test_incomplete_when_gender_missing(self):
        p = make_quick_patient_orm(
            date_of_birth=date(1990, 5, 15),
            gender=None,
        )
        result = PatientService._compute_profile_status(p)
        assert result == ProfileStatus.INCOMPLETE

    def test_incomplete_when_both_missing(self):
        p = make_quick_patient_orm(
            date_of_birth=None,
            gender=None,
        )
        result = PatientService._compute_profile_status(p)
        assert result == ProfileStatus.INCOMPLETE


class TestQuickCreatePatientService:
    """Tests for PatientService.quick_create_patient."""

    @pytest.fixture
    def service(self):
        db = MagicMock()
        svc = PatientService(db)
        svc.repository = MagicMock(spec=PatientRepository)
        return svc

    @patch("app.modules.patients.service.Patient")
    def test_quick_create_success_no_matches(self, MockPatient, service):
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.get_next_patient_sequence.return_value = 15
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_name_and_phone.return_value = []
        mock_patient = make_quick_patient_orm()
        service.repository.create.return_value = mock_patient
        MockPatient.return_value = MagicMock()

        result = service.quick_create_patient(payload, created_by=1)

        assert isinstance(result, PatientQuickCreateResponse)
        assert result.potential_matches == []
        assert result.warnings == []
        service.db.commit.assert_called_once()
        MockPatient.assert_called_once()
        call_kwargs = MockPatient.call_args[1]
        assert call_kwargs["profile_status"] == ProfileStatus.INCOMPLETE
        assert call_kwargs["date_of_birth"] is None

    @patch("app.modules.patients.service.Patient")
    def test_quick_create_with_gender(self, MockPatient, service):
        payload = PatientQuickCreate(**make_quick_create_data(gender="female"))
        service.repository.get_next_patient_sequence.return_value = 16
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_name_and_phone.return_value = []
        service.repository.create.return_value = make_quick_patient_orm(
            gender=GenderEnum.female,
        )
        MockPatient.return_value = MagicMock()

        result = service.quick_create_patient(payload, created_by=1)

        assert result.patient.profile_status == ProfileStatus.INCOMPLETE
        call_kwargs = MockPatient.call_args[1]
        assert call_kwargs["gender"] == GenderEnum.female

    @patch("app.modules.patients.service.Patient")
    def test_quick_create_phone_matches(self, MockPatient, service):
        """Phone-based potential matches are returned as warnings."""
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.get_next_patient_sequence.return_value = 15
        MockPatient.return_value = MagicMock()

        existing = make_quick_patient_orm(
            code="PAT-000014",
            first_name="Xyz",
            last_name="Dhf",
        )
        service.repository.find_by_phone.return_value = [existing]
        service.repository.find_by_name_and_phone.return_value = []
        service.repository.create.return_value = make_quick_patient_orm()

        result = service.quick_create_patient(payload, created_by=1)

        assert len(result.potential_matches) == 1
        assert result.potential_matches[0].patient_code == "PAT-000014"
        assert any("phone number" in w for w in result.warnings)

    @patch("app.modules.patients.service.Patient")
    def test_quick_create_name_phone_matches(self, MockPatient, service):
        """Name+phone potential matches are returned as warnings."""
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.get_next_patient_sequence.return_value = 15
        MockPatient.return_value = MagicMock()
        service.repository.find_by_phone.return_value = []

        existing = make_quick_patient_orm(
            code="PAT-000014",
            first_name="Abc",
            last_name="Dhf",
        )
        service.repository.find_by_name_and_phone.return_value = [existing]
        service.repository.create.return_value = make_quick_patient_orm()

        result = service.quick_create_patient(payload, created_by=1)

        assert len(result.potential_matches) == 1
        assert result.potential_matches[0].patient_code == "PAT-000014"
        assert any("name and phone" in w for w in result.warnings)

    @patch("app.modules.patients.service.Patient")
    def test_quick_create_deduplicates_matches(self, MockPatient, service):
        """A patient matching both phone and name+phone appears only once."""
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.get_next_patient_sequence.return_value = 15
        MockPatient.return_value = MagicMock()

        existing = make_quick_patient_orm(code="PAT-000014")
        service.repository.find_by_phone.return_value = [existing]
        service.repository.find_by_name_and_phone.return_value = [existing]
        service.repository.create.return_value = make_quick_patient_orm()

        result = service.quick_create_patient(payload, created_by=1)

        assert len(result.potential_matches) == 1
        assert len(result.warnings) == 2

    def test_quick_create_failure_rollback(self, service):
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_name_and_phone.return_value = []
        service.repository.get_next_patient_sequence.side_effect = Exception("DB error")

        with pytest.raises(PatientCreationFailed):
            service.quick_create_patient(payload, created_by=1)
        service.db.rollback.assert_called_once()


class TestUpdatePatientProfileStatus:
    """Tests for profile_status recomputation on update."""

    @pytest.fixture
    def service(self):
        db = MagicMock()
        svc = PatientService(db)
        svc.repository = MagicMock(spec=PatientRepository)
        return svc

    def test_update_completes_incomplete_patient(self, service):
        """Adding DOB + gender to an incomplete patient sets profile_status to COMPLETE."""
        incomplete_patient = make_quick_patient_orm(
            date_of_birth=None,
            gender=None,
            profile_status=ProfileStatus.INCOMPLETE,
        )
        service.repository.get_by_id.return_value = incomplete_patient
        service.repository.find_exact_duplicate_for_update.return_value = None
        service.repository.find_by_phone_for_update.return_value = None
        service.repository.find_by_email_for_update.return_value = None
        service.repository.find_by_name_dob_for_update.return_value = None

        # After update, the patient object should have DOB and gender set
        updated_patient = make_quick_patient_orm(
            date_of_birth=date(1990, 5, 15),
            gender=GenderEnum.male,
            profile_status=ProfileStatus.COMPLETE,
        )
        service.repository.update.return_value = updated_patient

        payload = PatientUpdate(
            date_of_birth="1990-05-15",
            gender="male",
        )
        result = service.update_patient(incomplete_patient.id, payload, updated_by=1)

        assert result.profile_status == ProfileStatus.COMPLETE

    def test_update_keeps_incomplete_when_dob_only(self, service):
        """Adding only DOB (no gender) keeps profile_status INCOMPLETE."""
        incomplete_patient = make_quick_patient_orm(
            date_of_birth=None,
            gender=None,
            profile_status=ProfileStatus.INCOMPLETE,
        )
        service.repository.get_by_id.return_value = incomplete_patient
        service.repository.find_exact_duplicate_for_update.return_value = None
        service.repository.find_by_phone_for_update.return_value = None
        service.repository.find_by_email_for_update.return_value = None
        service.repository.find_by_name_dob_for_update.return_value = None

        updated_patient = make_quick_patient_orm(
            date_of_birth=date(1990, 5, 15),
            gender=None,
            profile_status=ProfileStatus.INCOMPLETE,
        )
        service.repository.update.return_value = updated_patient

        payload = PatientUpdate(date_of_birth="1990-05-15")
        result = service.update_patient(incomplete_patient.id, payload, updated_by=1)

        assert result.profile_status == ProfileStatus.INCOMPLETE


# ======================================================================
# AUD-04: Exception Leakage Tests
# ======================================================================


class TestExceptionLeakagePrevention:
    """Verify that internal exception details are NOT exposed to clients."""

    @pytest.fixture
    def service(self):
        db = MagicMock()
        svc = PatientService(db)
        svc.repository = MagicMock(spec=PatientRepository)
        return svc

    def test_create_failure_hides_internal_details(self, service):
        """PatientCreationFailed must not contain raw exception text."""
        payload = PatientCreate(**make_valid_patient_data())
        service.repository.find_exact_duplicate.return_value = None
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_email.return_value = []
        service.repository.find_by_name_dob.return_value = []
        service.repository.get_next_patient_sequence.side_effect = (
            Exception("relation 'patients' does not exist at character 42")
        )

        with pytest.raises(PatientCreationFailed) as exc_info:
            service.create_patient(payload, created_by=1)

        details = exc_info.value.details
        assert "relation" not in details.lower()
        assert "character" not in details.lower()
        assert "does not exist" not in details.lower()
        assert "unexpected error" in details.lower()

    def test_quick_create_failure_hides_internal_details(self, service):
        """PatientCreationFailed from quick-create must not expose SQL errors."""
        payload = PatientQuickCreate(**make_quick_create_data())
        service.repository.find_by_phone.return_value = []
        service.repository.find_by_name_and_phone.return_value = []
        service.repository.get_next_patient_sequence.side_effect = (
            Exception("could not connect to server: Connection refused")
        )

        with pytest.raises(PatientCreationFailed) as exc_info:
            service.quick_create_patient(payload, created_by=1)

        details = exc_info.value.details
        assert "connection refused" not in details.lower()
        assert "could not connect" not in details.lower()
        assert "unexpected error" in details.lower()

    def test_update_failure_hides_internal_details(self, service):
        """PatientUpdateFailed must not expose internal error details."""
        patient = make_patient_orm()
        service.repository.get_by_id.return_value = patient
        service.repository.find_exact_duplicate_for_update.return_value = None
        service.repository.find_by_phone_for_update.return_value = None
        service.repository.find_by_email_for_update.return_value = None
        service.repository.find_by_name_dob_for_update.return_value = None
        service.repository.update.side_effect = (
            Exception("deadlock detected")
        )

        with pytest.raises(PatientUpdateFailed) as exc_info:
            service.update_patient(
                patient.id,
                PatientUpdate(first_name="Test"),
                updated_by=1,
            )

        details = exc_info.value.details
        assert "deadlock" not in details.lower()
        assert "unexpected error" in details.lower()


class TestMigrationSafety:
    """Verify the migration script is safe and non-destructive."""

    def test_fix_profile_status_enum_uses_alter_type(self):
        """The migration must use ALTER TYPE RENAME VALUE, not DROP/CREATE."""
        from pathlib import Path

        migration_path = (
            Path(__file__).resolve().parent.parent
            / "alembic"
            / "versions"
            / "e7f8a9b0c1d3_fix_profile_status_enum_casing.py"
        )
        content = migration_path.read_text()

        # Must use the safe ALTER TYPE approach
        assert "ALTER TYPE" in content
        assert "RENAME VALUE" in content

        # Must NOT drop columns, types, or indexes
        assert "DROP COLUMN" not in content
        assert "DROP TYPE" not in content
        assert "DROP INDEX" not in content

        # Must NOT recreate columns or indexes
        assert "add_column" not in content
        assert "create_index" not in content

