"""Billing Module — Dependency injection.

Provides ``Depends()``-compatible callables that wire up the full
service-layer stack (repository → validator → service) for the
billing routers.

Every dependency uses a factory function that creates a fresh
service instance per request, taking the SQLAlchemy ``Session``
from the existing ``get_db`` dependency.

Usage example::

    @router.get("/invoices/{invoice_id}")
    def get_invoice(
        invoice_id: UUID,
        service: InvoiceService = Depends(get_invoice_service),
    ):
        ...

Architecture boundary
---------------------
* Builds validators and repositories inside the dependency so that
  the router never constructs them manually.
* Never stores request-scoped state on module globals.
* Never commits, rolls back, or manages the session lifecycle — that
  remains the responsibility of the service layer.
"""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.billing.repositories import (
    AuditRepository,
    CreditNoteRepository,
    DocumentSequenceRepository,
    InvoiceRepository,
    PaymentRepository,
    ReceiptRepository,
)
from app.modules.billing.repositories.refund_repository import RefundRepository
from app.modules.billing.services import (
    DocumentSequenceService,
    InvoiceService,
    PaymentService,
)
from app.modules.billing.services.billing_orchestration_service import (
    BillingOrchestrationService,
)
from app.modules.billing.services.credit_note_service import CreditNoteService
from app.modules.billing.services.financial_calculation_service import (
    FinancialCalculationService,
)
from app.modules.billing.services.receipt_service import ReceiptService
from app.modules.billing.services.refund_service import RefundService
from app.modules.billing.validators import (
    CreditNoteValidator,
    DocumentSequenceValidator,
    FinancialValidator,
    InvoiceValidator,
    PaymentValidator,
    ReceiptValidator,
)
from app.modules.billing.validators.refund_validator import RefundValidator


def get_billing_logger() -> logging.Logger:
    """Return the structured logger for the billing module.

    Centralizes logger naming so every billing layer logs under the same
    namespace (``app.modules.billing``).

    Returns:
        A :class:`logging.Logger` bound to the billing module.
    """
    return logging.getLogger("app.modules.billing")


def get_billing_session(
    db: Session = Depends(get_db),
) -> Session:
    """Provide the request-scoped SQLAlchemy session for billing handlers.

    Thin, typed wrapper around the application-wide ``get_db`` dependency so
    billing routers/services depend on a single, explicit provider.

    Args:
        db: Session injected by FastAPI's ``get_db``.

    Returns:
        The active :class:`~sqlalchemy.orm.Session`.
    """
    return db


# ======================================================================
# InvoiceService dependency
# ======================================================================


def get_invoice_service(
    db: Session = Depends(get_billing_session),
) -> InvoiceService:
    """Build an ``InvoiceService`` with its full dependency stack.

    Injects the active SQLAlchemy ``Session``, then constructs:
    ``InvoiceRepository`` → ``FinancialValidator``
    → ``InvoiceValidator`` (with FK reference protocols)
    → ``DocumentSequenceRepository`` → ``DocumentSequenceValidator``
    → ``DocumentSequenceService``
    → ``AuditRepository``
    → ``InvoiceService``

    FK reference repositories (Patient, Doctor, Appointment, TreatmentPlan)
    are wired to ``InvoiceValidator`` for Sprint 12A application-layer
    foreign-key validation before persistence.

    Returns:
        A fully-wired ``InvoiceService`` ready for request handling.
    """
    from app.modules.patients.repository import PatientRepository
    from app.modules.doctors.repositories.doctor_repository import DoctorRepository
    from app.modules.appointments.repository import AppointmentRepository
    from app.modules.treatment.repositories.treatment_plan_repository import (
        TreatmentPlanRepository,
    )
    from app.modules.patient_records.repositories import (
        DiagnosisRepository,
    )

    invoice_repo = InvoiceRepository(db)
    patient_repo = PatientRepository(db)
    doctor_repo = DoctorRepository(db)
    appointment_repo = AppointmentRepository(db)
    treatment_plan_repo = TreatmentPlanRepository(db)
    diagnosis_repo = DiagnosisRepository(db)
    financial_validator = FinancialValidator()
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
        appointment_repo=appointment_repo,
        doctor_repo=doctor_repo,
        treatment_plan_repo=treatment_plan_repo,
        treatment_plan_item_repo=treatment_plan_repo,
        diagnosis_repo=diagnosis_repo,
    )
    sequence_repo = DocumentSequenceRepository(db)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )
    audit_repo = AuditRepository(db)

    return InvoiceService(
        db=db,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


def get_payment_service(
    db: Session = Depends(get_billing_session),
) -> PaymentService:
    """Build a ``PaymentService`` with its full dependency stack.

    Injects the active SQLAlchemy ``Session``, then constructs:
    ``PaymentRepository`` → ``FinancialValidator``
    → ``PaymentValidator``
    → ``DocumentSequenceRepository`` → ``DocumentSequenceValidator``
    → ``DocumentSequenceService``
    → ``InvoiceRepository``
    → ``InvoiceValidator``
    → ``AuditRepository``
    → ``PaymentService``

    Note:
        ``InvoiceRepository`` and ``InvoiceValidator`` are required for
        allocation operations (lock invoice + validate payable). They are
        optional in the ``PaymentService`` constructor — the service raises
        ``RuntimeError`` if allocation is attempted without them.

    Returns:
        A fully-wired ``PaymentService`` ready for request handling.
    """
    from app.modules.patients.repository import PatientRepository

    payment_repo = PaymentRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(
        payment_repo=payment_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    sequence_repo = DocumentSequenceRepository(db)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )
    from app.modules.doctors.repositories.doctor_repository import DoctorRepository
    from app.modules.appointments.repository import AppointmentRepository
    from app.modules.treatment.repositories.treatment_plan_repository import (
        TreatmentPlanRepository,
    )
    from app.modules.patient_records.repositories import (
        DiagnosisRepository,
    )

    invoice_repo = InvoiceRepository(db)
    patient_repo = PatientRepository(db)
    doctor_repo = DoctorRepository(db)
    appointment_repo = AppointmentRepository(db)
    treatment_plan_repo = TreatmentPlanRepository(db)
    diagnosis_repo = DiagnosisRepository(db)
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
        appointment_repo=appointment_repo,
        doctor_repo=doctor_repo,
        treatment_plan_repo=treatment_plan_repo,
        treatment_plan_item_repo=treatment_plan_repo,
        diagnosis_repo=diagnosis_repo,
    )
    audit_repo = AuditRepository(db)

    return PaymentService(
        db=db,
        payment_repo=payment_repo,
        payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
    )



# ======================================================================
# ReceiptService dependency
# ======================================================================


def get_receipt_service(
    db: Session = Depends(get_billing_session),
) -> ReceiptService:
    """Build a ``ReceiptService`` with its full dependency stack.

    Injects the active SQLAlchemy ``Session``, then constructs:
    ``ReceiptRepository`` → ``ReceiptValidator``
    → ``PaymentRepository``
    → ``DocumentSequenceRepository`` → ``DocumentSequenceValidator``
    → ``DocumentSequenceService``
    → ``AuditRepository``
    → ``ReceiptService``

    Returns:
        A fully-wired ``ReceiptService`` ready for request handling.
    """
    receipt_repo = ReceiptRepository(db)
    receipt_validator = ReceiptValidator(receipt_repo)
    payment_repo = PaymentRepository(db)
    sequence_repo = DocumentSequenceRepository(db)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )
    audit_repo = AuditRepository(db)

    return ReceiptService(
        db=db,
        receipt_repo=receipt_repo,
        receipt_validator=receipt_validator,
        payment_repo=payment_repo,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


# ======================================================================
# RefundService dependency
# ======================================================================


def get_refund_service(
    db: Session = Depends(get_billing_session),
) -> RefundService:
    """Build a ``RefundService`` with its full dependency stack.

    Injects the active SQLAlchemy ``Session``, then constructs:
    ``RefundRepository`` → ``RefundValidator``
    → ``FinancialValidator``
    → ``PaymentRepository``
    → ``DocumentSequenceRepository`` → ``DocumentSequenceValidator``
    → ``DocumentSequenceService``
    → ``AuditRepository``
    → ``RefundService``

    Returns:
        A fully-wired ``RefundService`` ready for request handling.
    """
    refund_repo = RefundRepository(db)
    payment_repo = PaymentRepository(db)
    financial_validator = FinancialValidator()
    refund_validator = RefundValidator(
        refund_repo=refund_repo,
        financial_validator=financial_validator,
    )
    sequence_repo = DocumentSequenceRepository(db)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )
    audit_repo = AuditRepository(db)

    return RefundService(
        db=db,
        refund_repo=refund_repo,
        payment_repo=payment_repo,
        refund_validator=refund_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


# ======================================================================
# CreditNoteService dependency
# ======================================================================


def get_credit_note_service(
    db: Session = Depends(get_billing_session),
) -> CreditNoteService:
    """Build a ``CreditNoteService`` with its full dependency stack.

    Injects the active SQLAlchemy ``Session``, then constructs:
    ``CreditNoteRepository`` → ``CreditNoteValidator``
    → ``FinancialValidator``
    → ``InvoiceRepository``
    → ``DocumentSequenceRepository`` → ``DocumentSequenceValidator``
    → ``DocumentSequenceService``
    → ``AuditRepository``
    → ``CreditNoteService``

    Returns:
        A fully-wired ``CreditNoteService`` ready for request handling.
    """
    from app.modules.patients.repository import PatientRepository

    credit_note_repo = CreditNoteRepository(db)
    invoice_repo = InvoiceRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    credit_note_validator = CreditNoteValidator(
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    sequence_repo = DocumentSequenceRepository(db)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )
    audit_repo = AuditRepository(db)

    return CreditNoteService(
        db=db,
        credit_note_repo=credit_note_repo,
        invoice_repo=invoice_repo,
        credit_note_validator=credit_note_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


# ======================================================================
# BillingOrchestrationService dependency
# ======================================================================


def get_billing_orchestration_service(
    db: Session = Depends(get_billing_session),
) -> BillingOrchestrationService:
    """Build a ``BillingOrchestrationService`` with its full dependency stack.

    Wires every domain service required by the orchestrator along with
    ``FinancialCalculationService`` for read-only aggregation.

    Returns:
        A fully-wired ``BillingOrchestrationService`` ready for reporting
        and dashboard workflows.
    """
    # ── Repository layer ──────────────────────────────────────────────
    invoice_repo = InvoiceRepository(db)
    payment_repo = PaymentRepository(db)
    refund_repo = RefundRepository(db)
    credit_note_repo = CreditNoteRepository(db)
    receipt_repo = ReceiptRepository(db)
    sequence_repo = DocumentSequenceRepository(db)
    audit_repo = AuditRepository(db)

    # ── Validator layer ───────────────────────────────────────────────
    financial_validator = FinancialValidator()
    from app.modules.patients.repository import PatientRepository
    from app.modules.doctors.repositories.doctor_repository import DoctorRepository
    from app.modules.appointments.repository import AppointmentRepository
    from app.modules.treatment.repositories.treatment_plan_repository import (
        TreatmentPlanRepository,
    )
    from app.modules.patient_records.repositories import (
        DiagnosisRepository,
    )

    patient_repo = PatientRepository(db)
    doctor_repo = DoctorRepository(db)
    appointment_repo = AppointmentRepository(db)
    treatment_plan_repo = TreatmentPlanRepository(db)
    diagnosis_repo = DiagnosisRepository(db)
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
        appointment_repo=appointment_repo,
        doctor_repo=doctor_repo,
        treatment_plan_repo=treatment_plan_repo,
        treatment_plan_item_repo=treatment_plan_repo,
        diagnosis_repo=diagnosis_repo,
    )
    payment_validator = PaymentValidator(
        payment_repo=payment_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    receipt_validator = ReceiptValidator(receipt_repo)
    sequence_validator = DocumentSequenceValidator(sequence_repo)
    credit_note_validator = CreditNoteValidator(
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    refund_validator = RefundValidator(
        refund_repo=refund_repo,
        financial_validator=financial_validator,
    )

    # ── Document Sequence Service (shared) ────────────────────────────
    document_sequence_service = DocumentSequenceService(
        db=db,
        sequence_repo=sequence_repo,
        sequence_validator=sequence_validator,
    )

    # ── Domain services ───────────────────────────────────────────────
    invoice_service = InvoiceService(
        db=db,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )

    payment_service = PaymentService(
        db=db,
        payment_repo=payment_repo,
        payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
    )

    receipt_service = ReceiptService(
        db=db,
        receipt_repo=receipt_repo,
        receipt_validator=receipt_validator,
        payment_repo=payment_repo,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )

    refund_service = RefundService(
        db=db,
        refund_repo=refund_repo,
        payment_repo=payment_repo,
        refund_validator=refund_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )

    credit_note_service = CreditNoteService(
        db=db,
        credit_note_repo=credit_note_repo,
        invoice_repo=invoice_repo,
        credit_note_validator=credit_note_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )

    # ── Financial Calculation Service (read-only) ─────────────────────
    financial_calc_service = FinancialCalculationService(
        invoice_repo=invoice_repo,
        payment_repo=payment_repo,
        refund_repo=refund_repo,
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
    )

    # ── Orchestration Service ─────────────────────────────────────────
    return BillingOrchestrationService(
        db=db,
        invoice_service=invoice_service,
        payment_service=payment_service,
        refund_service=refund_service,
        credit_note_service=credit_note_service,
        receipt_service=receipt_service,
        financial_calc_service=financial_calc_service,
    )


__all__ = [
    "get_db",
    "get_billing_logger",
    "get_billing_session",
    "get_invoice_service",
    "get_payment_service",
    "get_receipt_service",
    "get_refund_service",
    "get_credit_note_service",
    "get_billing_orchestration_service",
]

