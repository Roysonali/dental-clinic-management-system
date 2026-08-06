import uuid
from datetime import time
import pytest
from sqlalchemy.orm import Session
from app.modules.doctors.models import Doctor, Specialization, DoctorSchedule, DoctorSpecialization
from app.modules.doctors.repositories import DoctorRepository, SpecializationRepository, DoctorScheduleRepository, DoctorSpecializationRepository
from tests.modules.doctors.conftest import DoctorFactory, SpecializationFactory, ScheduleFactory, DoctorSpecializationFactory, UserFactory

class TestDoctorRepository:
    def test_create(self, db, doctor_user):
        repo = DoctorRepository(db)
        d = DoctorFactory.build(db, user_id=doctor_user.id)
        r = repo.create(d)
        assert r.id is not None
    def test_get_by_id(self, db, doctor):
        repo = DoctorRepository(db)
        r = repo.get_by_id(doctor.id)
        assert r is not None
    def test_list_empty(self, db):
        repo = DoctorRepository(db)
        i, t = repo.list()
        assert len(i) == 0 and t == 0
    def test_delete(self, db, doctor):
        repo = DoctorRepository(db)
        repo.delete(doctor)
        assert repo.get_by_id(doctor.id) is None

class TestSpecializationRepository:
    def test_create(self, db):
        repo = SpecializationRepository(db)
        r = repo.create(Specialization(name="S1", code="C1"))
        assert r.id is not None
    def test_get_by_id(self, db, specialization):
        repo = SpecializationRepository(db)
        assert repo.get_by_id(specialization.id) is not None

class TestDoctorScheduleRepository:
    def test_create(self, db, doctor):
        repo = DoctorScheduleRepository(db)
        s = DoctorSchedule(doctor_id=doctor.id, day_of_week=0, start_time=time(9,0), end_time=time(17,0))
        r = repo.create(s)
        assert r.id is not None

class TestDoctorSpecializationRepository:
    def test_assign(self, db, doctor, specialization):
        repo = DoctorSpecializationRepository(db)
        ds = DoctorSpecialization(doctor_id=doctor.id, specialization_id=specialization.id, is_primary=True)
        repo.assign_specialization(ds)
        assert repo.get_primary_specialization(doctor.id) is not None


# ======================================================================
# F2 regression: list search contract (doctor code + full name only)
# ======================================================================


class TestDoctorRepositorySearchContract:
    """Regression for the F2 production finding.

    The documented search contract is: doctor code OR doctor full name.
    Previously the repository searched doctor_code + registration_number
    and did not join the users table, so full-name search silently
    returned nothing.
    """

    def test_search_by_doctor_code(self, db, doctor):
        repo = DoctorRepository(db)
        items, total = repo.list(search=doctor.doctor_code[:8], page=1, page_size=10)
        assert total >= 1
        assert any(d.id == doctor.id for d in items)

    def test_search_by_full_name(self, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, full_name="Alice Reyes", email="alice@t.com")
        DoctorFactory.create(db, user_id=u.id)
        repo = DoctorRepository(db)
        items, total = repo.list(search="Reyes", page=1, page_size=10)
        assert total == 1
        assert items[0].user.full_name == "Alice Reyes"

    def test_search_partial_full_name_case_insensitive(self, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, full_name="Maria Clara Santos", email="mcs@t.com")
        DoctorFactory.create(db, user_id=u.id)
        repo = DoctorRepository(db)
        items, total = repo.list(search="clara", page=1, page_size=10)
        assert total == 1
        assert items[0].user.full_name == "Maria Clara Santos"

    def test_search_no_matches(self, db, doctor):
        repo = DoctorRepository(db)
        items, total = repo.list(search="zzzz-no-such-doctor", page=1, page_size=10)
        assert total == 0
        assert items == []

    def test_search_count_matches_filtered_population(self, db):
        """total must reflect the full-name filter (count query joins users too)."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        for i in range(3):
            u = UserFactory.create(db, full_name=f"Juan Dela Cruz {i}", email=f"jdc{i}@t.com")
            DoctorFactory.create(db, user_id=u.id)
        repo = DoctorRepository(db)
        items, total = repo.list(search="Dela", page=1, page_size=2)
        assert total == 3
        assert len(items) == 2
