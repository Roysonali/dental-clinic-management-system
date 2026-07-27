"""Billing Router Integration Tests — Shared Fixtures.

Provides FastAPI TestClient with all billing routers, DB session override,
auth fixtures (roles, users, tokens), and URL/helper constants.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.exception_handlers import register_exception_handlers
from app.core.security import create_access_token
from app.modules.auth.models import User, Role
from app.core.constants import (
    USER_STATUS_ACTIVE, ROLE_ADMIN, ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
)
from tests.modules.billing.conftest import db, engine, TestingSessionLocal  # noqa: F401
from app.database.base import Base


# ======================================================================
# URL Constants
# ======================================================================

INVOICES_URL = "/billing/invoices"
PAYMENTS_URL = "/billing/payments"
RECEIPTS_URL = "/billing/receipts"
REFUNDS_URL = "/billing/refunds"
CREDIT_NOTES_URL = "/billing/credit-notes"
DASHBOARD_URL = "/billing/dashboard"
SUMMARY_URL = "/billing/summary"

STUB_PATIENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
STUB_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")


# ======================================================================
# Auth helpers
# ======================================================================

def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

URL_PREFIX = "/billing"


# ======================================================================
# App & Client Fixtures
# ======================================================================

@pytest.fixture(scope="function")
def app():
    """Create a FastAPI app with all billing routers and exception handlers."""
    Base.metadata.create_all(bind=engine)

    from app.modules.billing.routers import billing_router
    application = FastAPI(title="DensCare Billing Test")
    application.include_router(billing_router)
    register_exception_handlers(application)
    return application


@pytest.fixture(scope="function")
def client(app: FastAPI, db: Session):
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


# ======================================================================
# Auth Fixtures (roles, users, tokens)
# ======================================================================

@pytest.fixture(scope="function")
def seed_roles(db: Session):
    """Seed roles using the constant names that RBAC checks expect."""
    from app.core.constants import (
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    )
    names = [
        ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
        ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR,
        ROLE_RECEPTIONIST, ROLE_DENTAL_ASSISTANT,
    ]
    roles = []
    for i, name in enumerate(names, 1):
        role = Role(id=i, name=name)
        db.add(role)
        db.commit()
    for r in db.query(Role).all():
        roles.append(r)
    return roles


@pytest.fixture(scope="function")
def admin_user(db: Session, seed_roles):
    from app.core.security import hash_password
    admin_role = db.query(Role).filter(Role.name == ROLE_ADMIN).first()
    user = User(
        full_name="Admin User", email="admin_billing@example.com",
        password_hash=hash_password("Admin@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True, role_id=admin_role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})


@pytest.fixture(scope="function")
def receptionist_user(db: Session, seed_roles):
    from app.core.security import hash_password
    role = db.query(Role).filter(Role.name == ROLE_RECEPTIONIST).first()
    user = User(
        full_name="Receptionist User", email="receptionist_billing@example.com",
        password_hash=hash_password("Rec@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True, role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def receptionist_token(receptionist_user):
    return create_access_token({"sub": receptionist_user.email})


@pytest.fixture(scope="function")
def assistant_user(db: Session, seed_roles):
    from app.core.security import hash_password
    role = db.query(Role).filter(Role.name == ROLE_DENTAL_ASSISTANT).first()
    user = User(
        full_name="Assistant User", email="assistant_billing@example.com",
        password_hash=hash_password("Assist@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True, role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def assistant_token(assistant_user):
    return create_access_token({"sub": assistant_user.email})


@pytest.fixture(scope="function")
def doctor_user(db: Session, seed_roles):
    from app.core.security import hash_password
    role = db.query(Role).filter(Role.name == ROLE_GENERAL_DOCTOR).first()
    user = User(
        full_name="Doctor User", email="doctor_billing@example.com",
        password_hash=hash_password("Doc@Pass1"),
        status=USER_STATUS_ACTIVE, is_active=True, role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def doctor_token(doctor_user):
    return create_access_token({"sub": doctor_user.email})


@pytest.fixture(scope="function")
def unauthorized_token():
    """Token for a user with no role (should not exist)."""
    return create_access_token({"sub": "nobody@example.com"})


# ======================================================================
# Data Fixtures (reusable across tests)
# ======================================================================

@pytest.fixture(scope="function")
def draft_invoice(db: Session):
    """Create a draft invoice."""
    from tests.modules.billing.conftest import InvoiceFactory
    return InvoiceFactory.create(db)


@pytest.fixture(scope="function")
def issued_invoice(db: Session):
    """Create an issued invoice with 2 line items (grand_total=200)."""
    from tests.modules.billing.conftest import InvoiceFactory, InvoiceItemFactory
    from app.modules.billing.enums import InvoiceStatus
    from decimal import Decimal
    inv = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
    InvoiceItemFactory.create(
        db, invoice_id=inv.id, sequence_number=1,
        unit_price=Decimal("150.00"), net_amount=Decimal("150.00"),
    )
    InvoiceItemFactory.create(
        db, invoice_id=inv.id, sequence_number=2,
        unit_price=Decimal("50.00"), net_amount=Decimal("50.00"),
    )
    db.refresh(inv)
    return inv


@pytest.fixture(scope="function")
def pending_payment(db: Session):
    """Create a pending payment."""
    from tests.modules.billing.conftest import PaymentFactory
    return PaymentFactory.create(db)


@pytest.fixture(scope="function")
def completed_payment(db: Session):
    """Create a completed payment."""
    from tests.modules.billing.conftest import PaymentFactory
    from app.modules.billing.enums import PaymentStatus
    return PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value)


@pytest.fixture(scope="function")
def stub_patient(db: Session):
    """Ensure the stub patient exists in the DB (done in conftest autouse)."""
    from app.modules.patients.models import Patient
    from datetime import date
    patient = db.query(Patient).filter(Patient.id == STUB_PATIENT_ID).first()
    if patient is None:
        patient = Patient(
            id=STUB_PATIENT_ID,
            patient_code="P-TEST-001",
            first_name="Test",
            last_name="Patient",
            date_of_birth=date(1990, 1, 1),
            gender="male",
            primary_contact_number="+1234567890",
        )
        db.add(patient)
        db.flush()
    return patient
