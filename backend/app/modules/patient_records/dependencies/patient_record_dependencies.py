"""FastAPI dependency injection for patient record services.

Each factory function constructs a single service instance bound to
the active database session.  The service-layer classes handle all
business logic, transaction management, and audit logging so the
router can focus on HTTP concerns.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.patient_records.services import (
    PatientRecordService,
    DiagnosisService,
    PrescriptionService,
    PrescriptionItemService,
    AttachmentService,
    FollowupService,
    AuditLogService,
)


# ======================================================================
# PatientRecordService
# ======================================================================


def get_patient_record_service(
    db: Session = Depends(get_db),
) -> PatientRecordService:
    """Construct a ``PatientRecordService`` bound to the current session.

    Usage::

        @router.get(...)
        def list_records(
            service: PatientRecordService = Depends(get_patient_record_service),
        ):
            ...
    """
    return PatientRecordService(db)


# ======================================================================
# DiagnosisService
# ======================================================================


def get_diagnosis_service(
    db: Session = Depends(get_db),
) -> DiagnosisService:
    """Construct a ``DiagnosisService`` bound to the current session."""
    return DiagnosisService(db)


# ======================================================================
# PrescriptionService
# ======================================================================


def get_prescription_service(
    db: Session = Depends(get_db),
) -> PrescriptionService:
    """Construct a ``PrescriptionService`` bound to the current session."""
    return PrescriptionService(db)


# ======================================================================
# PrescriptionItemService
# ======================================================================


def get_prescription_item_service(
    db: Session = Depends(get_db),
) -> PrescriptionItemService:
    """Construct a ``PrescriptionItemService`` bound to the current session."""
    return PrescriptionItemService(db)


# ======================================================================
# AttachmentService
# ======================================================================


def get_attachment_service(
    db: Session = Depends(get_db),
) -> AttachmentService:
    """Construct an ``AttachmentService`` bound to the current session."""
    return AttachmentService(db)


# ======================================================================
# FollowupService
# ======================================================================


def get_followup_service(
    db: Session = Depends(get_db),
) -> FollowupService:
    """Construct a ``FollowupService`` bound to the current session."""
    return FollowupService(db)


# ======================================================================
# AuditLogService
# ======================================================================


def get_audit_log_service(
    db: Session = Depends(get_db),
) -> AuditLogService:
    """Construct an ``AuditLogService`` bound to the current session."""
    return AuditLogService(db)
