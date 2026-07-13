"""
Doctor Management Module - Shared Test Fixtures & Factory Helpers.
"""

from __future__ import annotations

import os
import sys
from datetime import date, time
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.core.constants import (
    USER_STATUS_ACTIVE, ROLE_ADMIN, ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR, ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
    ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
)
from app.core.security import hash_password, create_access_token
from app.core.exception_handlers import register_exception_handlers
from app.modules.auth.models import User, Role

@compiles(UUID, "sqlite")
def compile_uuid_sqlite(element, compiler, **kw):
    return "VARCHAR(32)"

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(element, compiler, **kw):
    return "TEXT"

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class DoctorFactory:
    _code_counter = 0
    @classmethod
    def _next_code(cls):
        cls._code_counter += 1
        return f"DOC-TEST-{cls._code_counter:06d}"
    @classmethod
    def build(cls, db, user_id, **kwargs):
        from app.modules.doctors.models import Doctor
        import uuid
        defaults = dict(
            id=uuid.uuid4(), doctor_code=cls._next_code(), user_id=user_id,
            primary_phone="+639171234567", date_of_birth=date(1985,6,15),
            gender="male", address="123 Rizal St.", qualification="DMD",
            years_of_experience=10, consultation_fee=Decimal("800.00"),
            consultation_duration=30, languages_known=["English","Filipino"],
            biography="Experienced dentist.", emergency_contact_name="Maria Dela Cruz",
            emergency_contact_phone="+639177654321", available_for_appointment=True,
            on_leave=False, is_active=True, created_by=1,
        )
        defaults.update(kwargs)
        return Doctor(**defaults)
    @classmethod
    def create(cls, db, user_id, **kwargs):
        doctor = cls.build(db, user_id=user_id, **kwargs)
        db.add(doctor)
        db.flush()
        db.refresh(doctor)
        return doctor


class SpecializationFactory:
    _counter = 0
    @classmethod
    def _next(cls):
        cls._counter += 1
        return cls._counter
    @classmethod
    def build(cls, **kwargs):
        from app.modules.doctors.models import Specialization
        n = cls._next()
        defaults = dict(name=f"Specialization-{n}", code=f"SPEC-{n}",
                       description="Test specialization", is_active=True)
        defaults.update(kwargs)
        return Specialization(**defaults)
    @classmethod
    def create(cls, db, **kwargs):
        spec = cls.build(**kwargs)
        db.add(spec)
        db.flush()
        db.refresh(spec)
        return spec


class DoctorSpecializationFactory:
    @classmethod
    def build(cls, doctor_id, specialization_id, **kwargs):
        from app.modules.doctors.models import DoctorSpecialization
        defaults = dict(doctor_id=doctor_id, specialization_id=specialization_id,
                       is_primary=False, certification_date=None)
        defaults.update(kwargs)
        return DoctorSpecialization(**defaults)
    @classmethod
    def create(cls, db, doctor_id, specialization_id, **kwargs):
        entry = cls.build(doctor_id, specialization_id, **kwargs)
        db.add(entry)
        db.flush()
        return entry


class ScheduleFactory:
    @classmethod
    def build(cls, doctor_id, **kwargs):
        from app.modules.doctors.models import DoctorSchedule
        import uuid
        defaults = dict(id=uuid.uuid4(), doctor_id=doctor_id, day_of_week=0,
                       start_time=time(9,0), end_time=time(17,0), is_active=True)
        defaults.update(kwargs)
        return DoctorSchedule(**defaults)
    @classmethod
    def create(cls, db, doctor_id, **kwargs):
        entry = cls.build(doctor_id, **kwargs)
        db.add(entry)
        db.flush()
        db.refresh(entry)
        return entry


class UserFactory:
    _user_counter = 0
    @classmethod
    def _next_email(cls):
        cls._user_counter += 1
        return f"doctor{cls._user_counter}@test.com"
    @classmethod
    def create(cls, db, role_name=ROLE_GENERAL_DOCTOR, full_name="Test Doctor",
               email=None, status=USER_STATUS_ACTIVE, is_active=True):
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            max_id = db.query(Role.id).order_by(Role.id.desc()).first()
            next_id = (max_id[0] + 1) if max_id else 1
            role = Role(id=next_id, name=role_name)
            db.add(role)
            db.flush()
        user = User(full_name=full_name, email=email or cls._next_email(),
                    password_hash=hash_password("Test@Pass1"),
                    status=status, is_active=is_active, role_id=role.id)
        db.add(user)
        db.flush()
        db.refresh(user)
        return user


@pytest.fixture(scope="function", autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    role_names = [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
                  ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
                  ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT]
    for rn in role_names:
        if not session.query(Role).filter(Role.name == rn).first():
            session.add(Role(name=rn))
    session.commit()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def admin_user(db):
    return UserFactory.create(db, role_name=ROLE_ADMIN, email="admin@test.com")

@pytest.fixture(scope="function")
def receptionist_user(db):
    return UserFactory.create(db, role_name=ROLE_RECEPTIONIST, email="reception@test.com")

@pytest.fixture(scope="function")
def doctor_user(db):
    return UserFactory.create(db, role_name=ROLE_GENERAL_DOCTOR, email="doctor@test.com")

@pytest.fixture(scope="function")
def inactive_app_user(db):
    return UserFactory.create(db, role_name=ROLE_GENERAL_DOCTOR,
                              status="inactive", is_active=False, email="inactive@test.com")

@pytest.fixture(scope="function")
def non_doctor_user(db):
    return UserFactory.create(db, role_name=ROLE_DENTAL_ASSISTANT, email="assistant@test.com")

@pytest.fixture(scope="function")
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})

@pytest.fixture(scope="function")
def doctor_token(doctor_user):
    return create_access_token({"sub": doctor_user.email})

@pytest.fixture(scope="function")
def doctor(db, doctor_user):
    return DoctorFactory.create(db, user_id=doctor_user.id)

@pytest.fixture(scope="function")
def specialization(db):
    return SpecializationFactory.create(db)

@pytest.fixture(scope="function")
def doctor_with_specialization(db, doctor, specialization):
    DoctorSpecializationFactory.create(db, doctor_id=doctor.id,
                                        specialization_id=specialization.id, is_primary=True)
    db.refresh(doctor)
    return doctor

@pytest.fixture(scope="function")
def schedule(db, doctor):
    return ScheduleFactory.create(db, doctor_id=doctor.id)

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def mock_doctor_repo():
    return MagicMock()

@pytest.fixture
def mock_schedule_repo():
    return MagicMock()

@pytest.fixture
def mock_specialization_repo():
    return MagicMock()

@pytest.fixture
def mock_doctor_spec_repo():
    return MagicMock()

@pytest.fixture
def mock_user_repo():
    return MagicMock()
