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
