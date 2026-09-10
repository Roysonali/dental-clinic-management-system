"""
Doctor Application Tests — Self-Registration & Admin Approval Workflow.

Tests cover:
1. Existing staff registration still works
2. Doctor application registration succeeds
3. Doctor-specific fields persist
4. Applicant cannot assign privileged roles
5. Duplicate email rejected
6. Duplicate license/registration number behavior
7. Pending doctor has no Doctor privileges
8. Pending applicant does not appear as active Doctor
9. Admin can retrieve Doctor application details
10. Unauthorized user cannot review application
11. Unauthorized user cannot approve
12. Admin approves application (atomic)
13. Approved RBAC role assigned
14. Doctor profile created
15. Doctor.user_id correct
16. Application marked approved
17. Approval audit metadata recorded
18. Double approval does not duplicate Doctor
19. Reject does not create Doctor
20. Reject does not assign Doctor role
21. Invalid specialization rejected
22. Approved Doctor appears in Doctor queries
"""

from __future__ import annotations

import os
import sys
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
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.core.constants import (
    USER_STATUS_ACTIVE,
    USER_STATUS_PENDING,
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    DOCTOR_ROLES,
)
from app.core.security import hash_password, create_access_token
from app.core.exception_handlers import register_exception_handlers
from app.modules.auth.models import User, Role
from app.modules.auth.routes import router as auth_router
from app.modules.doctors.routes import router as doctor_router
from app.modules.doctors.routers.doctor_application_router import (
    router as doctor_application_router,
)
from app.modules.doctors.models import (
    Doctor,
    DoctorApplication,
    DoctorSpecialization,
    Specialization,
)


# ====================================================================
# Test Fixtures
# ====================================================================

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def app():
    """Create a FastAPI app with auth + doctor + doctor-application routers."""
    application = FastAPI(title="DensCare Doctor Application Test")
    application.include_router(auth_router)
    application.include_router(doctor_router)
    application.include_router(doctor_application_router)
    register_exception_handlers(application)
    return application


@pytest.fixture(scope="function")
def db():
    """Provide a DB session for direct queries in tests."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    # Seed roles
    role_names = [
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    ]
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
def client(app, db):
    """TestClient with DB session override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_user(db):
    role = db.query(Role).filter(Role.name == ROLE_ADMIN).first()
    user = User(
        full_name="Admin User",
        email="admin@test.com",
        password_hash=hash_password("Admin@Pass1"),
        status=USER_STATUS_ACTIVE,
        is_active=True,
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})


@pytest.fixture(scope="function")
def receptionist_user(db):
    role = db.query(Role).filter(Role.name == ROLE_RECEPTIONIST).first()
    user = User(
        full_name="Receptionist User",
        email="reception@test.com",
        password_hash=hash_password("Recep@Pass1"),
        status=USER_STATUS_ACTIVE,
        is_active=True,
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def receptionist_token(receptionist_user):
    return create_access_token({"sub": receptionist_user.email})


@pytest.fixture(scope="function")
def specialization(db):
    spec = Specialization(
        name="Orthodontics",
        code="ORTHO",
        description="Test specialization",
        is_active=True,
    )
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


@pytest.fixture(scope="function")
def specialization2(db):
    spec = Specialization(
        name="Endodontics",
        code="ENDO",
        description="Test specialization 2",
        is_active=True,
    )
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ====================================================================
# 1. EXISTING STAFF REGISTRATION STILL WORKS
# ====================================================================


class TestExistingStaffRegistration:
    """Verify that the existing staff registration flow is unbroken."""

    def test_staff_register_success(self, client):
        """POST /auth/register with staff data should still work."""
        resp = client.post("/auth/register", json={
            "full_name": "Staff Member",
            "email": "staff@test.com",
            "password": "Staff@Pass1",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "message" in data

    def test_staff_pending_approval(self, client, db):
        """Staff registration should create a pending user with no role."""
        client.post("/auth/register", json={
            "full_name": "Staff Member",
            "email": "staff2@test.com",
            "password": "Staff@Pass1",
        })
        user = db.query(User).filter(User.email == "staff2@test.com").first()
        assert user is not None
        assert user.status == USER_STATUS_PENDING
        assert user.is_active is False
        assert user.role_id is None

    def test_staff_can_be_approved(self, client, db, admin_token):
        """Staff can be approved via existing PATCH /auth/users/{id}/approve."""
        client.post("/auth/register", json={
            "full_name": "Staff Member",
            "email": "staff3@test.com",
            "password": "Staff@Pass1",
        })
        user = db.query(User).filter(User.email == "staff3@test.com").first()
        receptionist_role = db.query(Role).filter(Role.name == ROLE_RECEPTIONIST).first()

        resp = client.patch(
            f"/auth/users/{user.id}/approve",
            json={"role_id": receptionist_role.id},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        db.refresh(user)
        assert user.status == USER_STATUS_ACTIVE
        assert user.is_active is True
        assert user.role_id == receptionist_role.id


# ====================================================================
# 2. DOCTOR APPLICATION REGISTRATION
# ====================================================================


class TestDoctorApplicationRegistration:
    """POST /auth/register-doctor — public doctor self-registration."""

    def test_doctor_register_success(self, client):
        """Doctor registration should succeed and return confirmation."""
        resp = client.post("/auth/register-doctor", json={
            "full_name": "Dr. Juan Dela Cruz",
            "email": "dr.juan@test.com",
            "password": "Doctor@Pass1",
            "qualification": "DMD",
            "registration_number": "DEN-2024-001",
            "years_of_experience": 10,
            "primary_phone": "+639171234567",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "doctor application" in data["message"].lower()

    def test_doctor_register_creates_pending_user(self, client, db):
        """Doctor registration should create a pending user with no role."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Juan Dela Cruz",
            "email": "dr.juan2@test.com",
            "password": "Doctor@Pass1",
            "qualification": "DMD",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.juan2@test.com").first()
        assert user is not None
        assert user.status == USER_STATUS_PENDING
        assert user.is_active is False
        assert user.role_id is None  # CRITICAL: No role assigned

    def test_doctor_register_creates_application(self, client, db):
        """Doctor registration should create a DoctorApplication record."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Juan Dela Cruz",
            "email": "dr.juan3@test.com",
            "password": "Doctor@Pass1",
            "qualification": "DMD, specialty in Orthodontics",
            "registration_number": "DEN-2024-002",
            "years_of_experience": 15,
            "primary_phone": "+639171234567",
            "date_of_birth": "1985-06-15",
            "gender": "male",
            "address": "123 Rizal St., Manila",
        })
        user = db.query(User).filter(User.email == "dr.juan3@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        assert app is not None
        assert app.status == "pending"
        assert app.qualification == "DMD, specialty in Orthodontics"
        assert app.registration_number == "DEN-2024-002"
        assert app.years_of_experience == 15
        assert app.primary_phone == "+639171234567"

    def test_doctor_register_with_specializations(self, client, db, specialization, specialization2):
        """Doctor registration with specialization IDs should persist them."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Maria Santos",
            "email": "dr.maria@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
            "requested_specialization_ids": [specialization.id, specialization2.id],
            "primary_specialization_id": specialization.id,
        })
        user = db.query(User).filter(User.email == "dr.maria@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        assert app is not None
        assert specialization.id in app.requested_specialization_ids
        assert specialization2.id in app.requested_specialization_ids
        assert app.primary_specialization_id == specialization.id

    def test_doctor_register_duplicate_email_rejected(self, client):
        """Duplicate email should be rejected."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. One",
            "email": "dup@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        resp = client.post("/auth/register-doctor", json={
            "full_name": "Dr. Two",
            "email": "dup@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        assert resp.status_code == 409

    def test_doctor_register_duplicate_reg_number_rejected(self, client):
        """Duplicate registration number should be rejected."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. One",
            "email": "dr.one@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "DUP-REG-001",
            "primary_phone": "+639171234567",
        })
        resp = client.post("/auth/register-doctor", json={
            "full_name": "Dr. Two",
            "email": "dr.two@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "DUP-REG-001",
            "primary_phone": "+639171234567",
        })
        assert resp.status_code in (409, 500)

    def test_doctor_register_invalid_specialization_rejected(self, client):
        """Invalid specialization IDs should be rejected."""
        resp = client.post("/auth/register-doctor", json={
            "full_name": "Dr. Bad",
            "email": "dr.bad@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
            "requested_specialization_ids": [99999],
        })
        assert resp.status_code in (400, 422, 500)


# ====================================================================
# 3. SECURITY: APPLICANT CANNOT SELF-ASSIGN ROLES
# ====================================================================


class TestRoleEscapionPrevention:
    """Verify that public registration cannot self-assign privileged roles."""

    def test_regular_register_has_no_role(self, client, db):
        """POST /auth/register creates user with no role_id."""
        client.post("/auth/register", json={
            "full_name": "Staff",
            "email": "norole@test.com",
            "password": "Staff@Pass1",
        })
        user = db.query(User).filter(User.email == "norole@test.com").first()
        assert user.role_id is None

    def test_doctor_register_has_no_role(self, client, db):
        """POST /auth/register-doctor creates user with no role_id."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. NoRole",
            "email": "dr.norole@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.norole@test.com").first()
        assert user.role_id is None


# ====================================================================
# 4. PENDING USER ACCESS RESTRICTIONS
# ====================================================================


class TestPendingUserAccess:
    """Pending doctor applicants must NOT access clinical functionality."""

    def test_pending_user_cannot_login(self, client, db):
        """Pending users cannot log in (is_active=False)."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Pending",
            "email": "dr.pending@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        resp = client.post("/auth/login", data={
            "username": "dr.pending@test.com",
            "password": "Doctor@Pass1",
        })
        assert resp.status_code == 403

    def test_pending_user_does_not_appear_as_active_doctor(self, client, db, admin_token):
        """Pending applicants should not appear in the doctor list."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Pending",
            "email": "dr.pending2@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        resp = client.get("/doctors", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        # The pending user should NOT have a Doctor profile
        assert data["total"] == 0


# ====================================================================
# 5. ADMIN CAN RETRIEVE DOCTOR APPLICATION DETAILS
# ====================================================================


class TestAdminReviewApplication:
    """Admin can view doctor application details."""

    def _create_doctor_app(self, client, email="dr.review@test.com"):
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Review",
            "email": email,
            "password": "Doctor@Pass1",
            "qualification": "DMD",
            "registration_number": "REV-2024-001",
            "years_of_experience": 10,
            "primary_phone": "+639171234567",
            "date_of_birth": "1985-06-15",
            "gender": "male",
            "address": "123 Rizal St.",
        })

    def test_admin_list_applications(self, client, admin_token, db):
        """Admin can list pending doctor applications."""
        self._create_doctor_app(client)
        resp = client.get(
            "/doctor-applications",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    def test_admin_get_application_detail(self, client, admin_token, db):
        """Admin can get a specific application's details."""
        self._create_doctor_app(client)
        # Get the application ID
        user = db.query(User).filter(User.email == "dr.review@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()

        resp = client.get(
            f"/doctor-applications/{app.id}",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_full_name"] == "Dr. Review"
        assert data["qualification"] == "DMD"
        assert data["registration_number"] == "REV-2024-001"
        assert data["status"] == "pending"

    def test_unauthorized_user_cannot_list_applications(self, client, receptionist_token):
        """Non-admin users cannot list doctor applications."""
        resp = client.get(
            "/doctor-applications",
            headers=auth_header(receptionist_token),
        )
        assert resp.status_code == 403

    def test_unauthenticated_cannot_list_applications(self, client):
        """Unauthenticated users cannot list doctor applications."""
        resp = client.get("/doctor-applications")
        assert resp.status_code == 401


# ====================================================================
# 6. ADMIN APPROVES APPLICATION (ATOMIC)
# ====================================================================


class TestAdminApproveApplication:
    """Admin can approve a doctor application atomically."""

    def _create_doctor_app(self, client, email="dr.approve@test.com"):
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Approve",
            "email": email,
            "password": "Doctor@Pass1",
            "qualification": "DMD",
            "registration_number": "APR-2024-001",
            "years_of_experience": 10,
            "primary_phone": "+639171234567",
        })

    def test_approve_creates_doctor_profile(self, client, admin_user, admin_token, db):
        """Approval should create a Doctor profile linked to the user."""
        self._create_doctor_app(client)
        user = db.query(User).filter(User.email == "dr.approve@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        resp = client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200

        # Verify Doctor profile was created
        db.refresh(user)
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        assert doctor is not None
        assert doctor.user_id == user.id
        assert doctor.qualification == "DMD"
        assert doctor.registration_number == "APR-2024-001"

    def test_approve_assigns_role(self, client, admin_user, admin_token, db):
        """Approval should assign the selected RBAC role to the user."""
        self._create_doctor_app(client)
        user = db.query(User).filter(User.email == "dr.approve@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        db.refresh(user)
        assert user.role_id == gen_doc_role.id
        assert user.status == USER_STATUS_ACTIVE
        assert user.is_active is True

    def test_approve_marks_application_approved(self, client, admin_user, admin_token, db):
        """Approval should mark the application as approved."""
        self._create_doctor_app(client)
        user = db.query(User).filter(User.email == "dr.approve@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        db.refresh(app)
        assert app.status == "approved"
        assert app.reviewed_by == admin_user.id
        assert app.reviewed_at is not None
        assert app.approved_role_id == gen_doc_role.id
        assert app.doctor_id is not None

    def test_approve_records_audit_metadata(self, client, admin_user, admin_token, db):
        """Approval should record reviewed_by and reviewed_at."""
        self._create_doctor_app(client)
        user = db.query(User).filter(User.email == "dr.approve@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        db.refresh(app)
        assert app.reviewed_by == admin_user.id
        assert app.reviewed_at is not None

    def test_approved_doctor_appears_in_doctor_list(self, client, admin_user, admin_token, db):
        """After approval, the doctor should appear in the doctor list."""
        self._create_doctor_app(client, email="dr.list@test.com")
        user = db.query(User).filter(User.email == "dr.list@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        resp = client.get("/doctors", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        doctor_emails = [
            d.get("user_email") for d in data["items"] if d.get("user_email")
        ]
        assert "dr.list@test.com" in doctor_emails

    def test_approved_doctor_can_login(self, client, admin_user, admin_token, db):
        """After approval, the doctor should be able to log in."""
        self._create_doctor_app(client, email="dr.login@test.com")
        user = db.query(User).filter(User.email == "dr.login@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        resp = client.post("/auth/login", data={
            "username": "dr.login@test.com",
            "password": "Doctor@Pass1",
        })
        assert resp.status_code == 200


# ====================================================================
# 7. DOUBLE APPROVAL PROTECTION
# ====================================================================


class TestDoubleApprovalProtection:
    """Double approval must not create duplicate Doctor profiles."""

    def test_double_approval_rejected(self, client, admin_user, admin_token, db):
        """Approving an already-approved application should fail."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Double",
            "email": "dr.double@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "DBL-2024-001",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.double@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        # First approval
        resp1 = client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )
        assert resp1.status_code == 200

        # Second approval should fail
        resp2 = client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )
        assert resp2.status_code in (400, 409)

        # Verify only ONE doctor profile exists
        doctors = db.query(Doctor).filter(Doctor.user_id == user.id).all()
        assert len(doctors) == 1


# ====================================================================
# 8. REJECTION
# ====================================================================


class TestRejectionFlow:
    """Rejection must not create Doctor profile or assign role."""

    def test_reject_does_not_create_doctor(self, client, admin_user, admin_token, db):
        """Rejecting should not create a Doctor profile."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Reject",
            "email": "dr.reject@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "REJ-2024-001",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.reject@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()

        resp = client.patch(
            f"/doctor-applications/{app.id}/reject",
            json={"rejection_reason": "Insufficient qualifications"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200

        # No Doctor profile should be created
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        assert doctor is None

    def test_reject_does_not_assign_role(self, client, admin_user, admin_token, db):
        """Rejecting should not assign any role to the user."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Reject2",
            "email": "dr.reject2@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "REJ-2024-002",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.reject2@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/reject",
            json={"rejection_reason": "Not qualified"},
            headers=auth_header(admin_token),
        )

        db.refresh(user)
        assert user.role_id is None
        assert user.status == USER_STATUS_PENDING
        assert user.is_active is False

    def test_reject_records_audit_metadata(self, client, admin_user, admin_token, db):
        """Rejection should record reviewed_by, reviewed_at, and rejection_reason."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Reject3",
            "email": "dr.reject3@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "REJ-2024-004",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.reject3@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/reject",
            json={"rejection_reason": "Incomplete documentation"},
            headers=auth_header(admin_token),
        )

        db.refresh(app)
        assert app.status == "rejected"
        assert app.reviewed_by == admin_user.id
        assert app.reviewed_at is not None
        assert app.rejection_reason == "Incomplete documentation"

    def test_reject_already_processed_rejected(self, client, admin_user, admin_token, db):
        """Cannot reject an already-processed application."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Reject4",
            "email": "dr.reject4@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "REJ-2024-003",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.reject4@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()

        # First rejection
        client.patch(
            f"/doctor-applications/{app.id}/reject",
            json={},
            headers=auth_header(admin_token),
        )

        # Second rejection should fail
        resp = client.patch(
            f"/doctor-applications/{app.id}/reject",
            json={},
            headers=auth_header(admin_token),
        )
        assert resp.status_code in (400, 409)


# ====================================================================
# 9. SPECIALIZATION HANDLING
# ====================================================================


class TestSpecializationHandling:
    """Specialization IDs should be validated and transferred on approval."""

    def test_approve_with_specializations(self, client, admin_user, admin_token, db, specialization):
        """Approval should transfer specialization assignments to the new Doctor."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Spec",
            "email": "dr.spec@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "SPE-2024-001",
            "primary_phone": "+639171234567",
            "requested_specialization_ids": [specialization.id],
            "primary_specialization_id": specialization.id,
        })
        user = db.query(User).filter(User.email == "dr.spec@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        assert doctor is not None
        specs = db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor.id
        ).all()
        assert len(specs) >= 1
        assert specs[0].specialization_id == specialization.id
        assert specs[0].is_primary is True


# ====================================================================
# 10. ADMIN ROLE SELECTION VALIDATION
# ====================================================================


class TestRoleSelectionValidation:
    """Admin must select a valid doctor role for approval."""

    def test_approve_with_non_doctor_role_rejected(self, client, admin_user, admin_token, db):
        """Approving with a non-doctor role (e.g., RECEPTIONIST) should fail."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. BadRole",
            "email": "dr.badrole@test.com",
            "password": "Doctor@Pass1",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.badrole@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        receptionist_role = db.query(Role).filter(
            Role.name == ROLE_RECEPTIONIST
        ).first()

        resp = client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": receptionist_role.id},
            headers=auth_header(admin_token),
        )
        assert resp.status_code in (400, 422)


# ====================================================================
# 11. DOCTOR CODE GENERATION
# ====================================================================


class TestDoctorCodeGeneration:
    """Approved doctors should receive unique doctor codes."""

    def test_approved_doctor_gets_code(self, client, admin_user, admin_token, db):
        """Doctor created via approval should have a DOC-XXXXXX code."""
        client.post("/auth/register-doctor", json={
            "full_name": "Dr. Code",
            "email": "dr.code@test.com",
            "password": "Doctor@Pass1",
            "registration_number": "COD-2024-001",
            "primary_phone": "+639171234567",
        })
        user = db.query(User).filter(User.email == "dr.code@test.com").first()
        app = db.query(DoctorApplication).filter(
            DoctorApplication.user_id == user.id
        ).first()
        gen_doc_role = db.query(Role).filter(
            Role.name == ROLE_GENERAL_DOCTOR
        ).first()

        client.patch(
            f"/doctor-applications/{app.id}/approve",
            json={"role_id": gen_doc_role.id},
            headers=auth_header(admin_token),
        )

        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        assert doctor is not None
        assert doctor.doctor_code.startswith("DOC-")
        assert len(doctor.doctor_code) == 10  # DOC-XXXXXX
