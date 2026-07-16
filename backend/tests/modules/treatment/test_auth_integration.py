"""Role-based integration test for Treatment module authentication.

Tests that:
- ADMIN can create treatment plans and procedures
- RECEPTIONIST can create treatment plans but NOT procedures
- GENERAL_DOCTOR can create treatment plans but NOT procedures
- Unauthenticated requests are rejected (401)
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.constants import (
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_DENTAL_ASSISTANT,
    USER_STATUS_ACTIVE,
)
from app.core.exception_handlers import register_exception_handlers
from app.core.security import create_access_token, hash_password
from app.database.base import Base
from app.database.session import get_db
from app.modules.auth.models import Role, User
from app.modules.doctors.models import Doctor
from app.modules.patients.models import Patient
from app.modules.treatment.dependencies import (
    get_procedure_service,
    get_treatment_plan_service,
)
from app.modules.treatment.routers.procedure_router import router as procedure_router
from app.modules.treatment.routers.treatment_plan_router import (
    router as treatment_plan_router,
)
from app.modules.treatment.services import ProcedureService, TreatmentPlanService
from app.modules.treatment.validators import ProcedureValidator, TreatmentPlanValidator
from app.modules.treatment.repositories import ProcedureRepository, TreatmentPlanRepository


# ---------------------------------------------------------------------------
# SQLite compilation overrides
# ---------------------------------------------------------------------------

@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(element, compiler, **kw):
    return "VARCHAR(36)"


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(element, compiler, **kw):
    return "TEXT"


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_db() -> Session:
    """Create all tables, seed roles, return session."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    role_names = [
        ROLE_ADMIN,
        ROLE_CHIEF_DOCTOR,
        ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR,
        ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST,
        ROLE_DENTAL_ASSISTANT,
    ]
    for rn in role_names:
        if not db.query(Role).filter(Role.name == rn).first():
            db.add(Role(name=rn))

    db.commit()
    return db


def teardown_db(db: Session):
    db.rollback()
    db.close()
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# User factory helpers
# ---------------------------------------------------------------------------

def create_user(db: Session, role_name: str, email: str, full_name: str = "Test User") -> User:
    """Create an active user with the specified role."""
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role is not None, f"Role {role_name} not found"

    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password("Test@Pass1"),
        status=USER_STATUS_ACTIVE,
        is_active=True,
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_fk_stubs(db: Session) -> tuple[uuid.UUID, uuid.UUID, int]:
    """Create minimal FK target records required by TreatmentPlan."""
    patient_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    doctor_id = uuid.UUID("00000000-0000-0000-0000-000000000002")

    patient = Patient(
        id=patient_id,
        patient_code="P-TEST-001",
        first_name="Test",
        last_name="Patient",
        date_of_birth=date(1990, 1, 1),
        gender="male",
        primary_contact_number="+1234567890",
    )
    db.add(patient)

    # Need a user for the doctor
    user = User(
        full_name="Dr. Test",
        email="fk-doctor@test.com",
        password_hash=hash_password("Test@Pass1"),
        status=USER_STATUS_ACTIVE,
        is_active=True,
        role_id=db.query(Role).filter(Role.name == ROLE_GENERAL_DOCTOR).first().id,
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        id=doctor_id,
        doctor_code="D-TEST-001",
        user_id=user.id,
        primary_phone="+1234567890",
    )
    db.add(doctor)

    db.commit()
    return patient_id, doctor_id, user.id


# ---------------------------------------------------------------------------
# Test client factory
# ---------------------------------------------------------------------------

def build_client(db: Session) -> TestClient:
    """Create a FastAPI app with treatment routers and DB override."""
    application = FastAPI(title="Treatment Test")
    application.include_router(treatment_plan_router)
    application.include_router(procedure_router)
    register_exception_handlers(application)

    def override_get_db():
        yield db

    def override_get_treatment_plan_service():
        plan_repo = TreatmentPlanRepository(db)
        procedure_repo = ProcedureRepository(db)
        procedure_validator = ProcedureValidator(procedure_repo)
        plan_validator = TreatmentPlanValidator(
            plan_repo=plan_repo,
            procedure_repo=procedure_repo,
        )
        return TreatmentPlanService(
            plan_repo=plan_repo,
            procedure_repo=procedure_repo,
            plan_validator=plan_validator,
            procedure_validator=procedure_validator,
            db=db,
        )

    def override_get_procedure_service():
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo)
        return ProcedureService(repo=repo, validator=validator, db=db)

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_treatment_plan_service] = override_get_treatment_plan_service
    application.dependency_overrides[get_procedure_service] = override_get_procedure_service
    return TestClient(application)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTreatmentAuth:
    """Verify Treatment module access control per role."""

    def test_admin_can_create_treatment_plan(self):
        db = setup_db()
        try:
            patient_id, doctor_id, _ = create_fk_stubs(db)
            admin = create_user(db, ROLE_ADMIN, "admin@test.com", "Admin User")
            token = create_access_token({"sub": admin.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "patient_id": str(patient_id),
                "doctor_id": str(doctor_id),
            }

            resp = client.post("/treatment-plans", json=payload, headers=headers)
            print(f"\nADMIN create treatment plan: {resp.status_code}")
            assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_admin_can_create_procedure(self):
        db = setup_db()
        try:
            admin = create_user(db, ROLE_ADMIN, "admin2@test.com", "Admin User")
            token = create_access_token({"sub": admin.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "code": "TEST001",
                "name": "Test Procedure",
                "default_cost": "100.00",
                "category": "other",
                "description": "Test procedure description",
            }

            resp = client.post("/procedures", json=payload, headers=headers)
            print(f"\nADMIN create procedure: {resp.status_code}")
            assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_receptionist_can_create_treatment_plan(self):
        db = setup_db()
        try:
            patient_id, doctor_id, _ = create_fk_stubs(db)
            receptionist = create_user(db, ROLE_RECEPTIONIST, "reception@test.com", "Reception User")
            token = create_access_token({"sub": receptionist.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "patient_id": str(patient_id),
                "doctor_id": str(doctor_id),
            }

            resp = client.post("/treatment-plans", json=payload, headers=headers)
            print(f"\nRECEPTIONIST create treatment plan: {resp.status_code}")
            assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_receptionist_cannot_create_procedure(self):
        db = setup_db()
        try:
            receptionist = create_user(db, ROLE_RECEPTIONIST, "reception2@test.com", "Reception User")
            token = create_access_token({"sub": receptionist.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "code": "TEST002",
                "name": "Test Procedure 2",
                "default_cost": "100.00",
                "category": "other",
                "description": "Test",
            }

            resp = client.post("/procedures", json=payload, headers=headers)
            print(f"\nRECEPTIONIST create procedure: {resp.status_code}")
            assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_doctor_can_create_treatment_plan(self):
        db = setup_db()
        try:
            patient_id, doctor_id, _ = create_fk_stubs(db)
            doctor = create_user(db, ROLE_GENERAL_DOCTOR, "doctor3@test.com", "Dr. Test")
            token = create_access_token({"sub": doctor.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "patient_id": str(patient_id),
                "doctor_id": str(doctor_id),
            }

            resp = client.post("/treatment-plans", json=payload, headers=headers)
            print(f"\nDOCTOR create treatment plan: {resp.status_code}")
            assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_doctor_cannot_create_procedure(self):
        db = setup_db()
        try:
            doctor = create_user(db, ROLE_GENERAL_DOCTOR, "doctor4@test.com", "Dr. Test")
            token = create_access_token({"sub": doctor.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "code": "TEST003",
                "name": "Test Procedure 3",
                "default_cost": "100.00",
                "category": "other",
                "description": "Test",
            }

            resp = client.post("/procedures", json=payload, headers=headers)
            print(f"\nDOCTOR create procedure: {resp.status_code}")
            assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_unauthenticated_cannot_create_treatment_plan(self):
        db = setup_db()
        try:
            patient_id, doctor_id, _ = create_fk_stubs(db)
            client = build_client(db)
            payload = {
                "patient_id": str(patient_id),
                "doctor_id": str(doctor_id),
            }

            resp = client.post("/treatment-plans", json=payload)
            print(f"\nUNAUTHENTICATED create treatment plan: {resp.status_code}")
            assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_unauthenticated_cannot_create_procedure(self):
        db = setup_db()
        try:
            client = build_client(db)
            payload = {
                "code": "TEST004",
                "name": "Test Procedure 4",
                "default_cost": "100.00",
                "category": "other",
                "description": "Test",
            }

            resp = client.post("/procedures", json=payload)
            print(f"\nUNAUTHENTICATED create procedure: {resp.status_code}")
            assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_all_doctor_roles_can_create_treatment_plan(self):
        """Verify all 5 doctor roles can create treatment plans."""
        doctor_roles = [
            ROLE_CHIEF_DOCTOR,
            ROLE_GENERAL_DOCTOR,
            ROLE_SPECIALIST_DOCTOR,
            ROLE_CONSULTING_DOCTOR,
        ]

        for role_name in doctor_roles:
            db = setup_db()
            try:
                patient_id, doctor_id, _ = create_fk_stubs(db)
                doctor = create_user(db, role_name, f"{role_name.lower()}@test.com", f"Dr. {role_name}")
                token = create_access_token({"sub": doctor.email})

                client = build_client(db)
                headers = {"Authorization": f"Bearer {token}"}
                payload = {
                    "patient_id": str(patient_id),
                    "doctor_id": str(doctor_id),
                }

                resp = client.post("/treatment-plans", json=payload, headers=headers)
                print(f"\n{role_name} create treatment plan: {resp.status_code}")
                assert resp.status_code == 201, f"{role_name}: Expected 201, got {resp.status_code}: {resp.text}"
            finally:
                teardown_db(db)

    def test_admin_can_list_treatment_plans(self):
        db = setup_db()
        try:
            patient_id, doctor_id, _ = create_fk_stubs(db)
            admin = create_user(db, ROLE_ADMIN, "admin3@test.com", "Admin User")
            token = create_access_token({"sub": admin.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get("/treatment-plans", headers=headers)
            print(f"\nADMIN list treatment plans: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)

    def test_admin_can_list_procedures(self):
        db = setup_db()
        try:
            admin = create_user(db, ROLE_ADMIN, "admin4@test.com", "Admin User")
            token = create_access_token({"sub": admin.email})

            client = build_client(db)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get("/procedures", headers=headers)
            print(f"\nADMIN list procedures: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        finally:
            teardown_db(db)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
