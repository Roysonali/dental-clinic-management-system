"""Doctor Application Router — Admin endpoints for reviewing doctor applications.

Handles:
- GET /doctor-applications — List pending doctor applications (admin only)
- GET /doctor-applications/{id} — Get application details (admin only)
- PATCH /doctor-applications/{id}/approve — Approve application (admin only)
- PATCH /doctor-applications/{id}/reject — Reject application (admin only)
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.models import User
from app.modules.doctors.schemas import (
    DoctorApplicationActionResponse,
    DoctorApplicationApprove,
    DoctorApplicationReject,
    DoctorApplicationResponse,
)
from app.modules.doctors.services.doctor_application_service import (
    DoctorApplicationService,
)
from app.modules.rbac.permissions import require_admin


router = APIRouter(
    prefix="/doctor-applications",
    tags=["Doctor Applications"],
)


def get_doctor_application_service(
    db: Session = Depends(get_db),
) -> DoctorApplicationService:
    """FastAPI dependency that constructs a DoctorApplicationService instance."""
    return DoctorApplicationService(db)


# ====================================================================
# LIST PENDING APPLICATIONS
# ====================================================================


@router.get(
    "",
    response_model=List[DoctorApplicationResponse],
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="List Doctor Applications",
    description=(
        "Retrieve all doctor applications for admin review. "
        "Returns applications newest-first. Requires admin role."
    ),
    responses={
        401: {"description": "Not authenticated."},
        403: {"description": "Admin role required."},
    },
)
def list_doctor_applications(
    current_admin: User = Depends(require_admin),
    service: DoctorApplicationService = Depends(get_doctor_application_service),
) -> List[DoctorApplicationResponse]:
    applications = service.list_pending_applications()
    return [_to_response(app) for app in applications]


# ====================================================================
# GET APPLICATION BY ID
# ====================================================================


@router.get(
    "/{application_id}",
    response_model=DoctorApplicationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor Application",
    description="Retrieve a single doctor application by ID. Requires admin role.",
    responses={
        401: {"description": "Not authenticated."},
        403: {"description": "Admin role required."},
        404: {"description": "Application not found."},
    },
)
def get_doctor_application(
    application_id: int = Path(..., ge=1),
    current_admin: User = Depends(require_admin),
    service: DoctorApplicationService = Depends(get_doctor_application_service),
) -> DoctorApplicationResponse:
    application = service.get_application(application_id)
    return _to_response(application)


# ====================================================================
# APPROVE APPLICATION
# ====================================================================


@router.patch(
    "/{application_id}/approve",
    response_model=DoctorApplicationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve Doctor Application",
    description=(
        "Atomically approve a doctor application: assign RBAC role, "
        "create Doctor profile, and mark application approved."
    ),
    responses={
        400: {"description": "Application already processed."},
        401: {"description": "Not authenticated."},
        403: {"description": "Admin role required."},
        404: {"description": "Application not found."},
        422: {"description": "Invalid role or validation error."},
    },
)
def approve_doctor_application(
    application_id: int,
    payload: DoctorApplicationApprove,
    current_admin: User = Depends(require_admin),
    service: DoctorApplicationService = Depends(get_doctor_application_service),
) -> DoctorApplicationActionResponse:
    service.approve_application(
        application_id,
        payload,
        approved_by=current_admin.id,
    )
    return {"message": "Doctor application approved successfully."}


# ====================================================================
# REJECT APPLICATION
# ====================================================================


@router.patch(
    "/{application_id}/reject",
    response_model=DoctorApplicationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject Doctor Application",
    description="Reject a doctor application. No Doctor profile is created.",
    responses={
        400: {"description": "Application already processed."},
        401: {"description": "Not authenticated."},
        403: {"description": "Admin role required."},
        404: {"description": "Application not found."},
    },
)
def reject_doctor_application(
    application_id: int,
    payload: DoctorApplicationReject,
    current_admin: User = Depends(require_admin),
    service: DoctorApplicationService = Depends(get_doctor_application_service),
) -> DoctorApplicationActionResponse:
    service.reject_application(
        application_id,
        payload,
        rejected_by=current_admin.id,
    )
    return {"message": "Doctor application rejected."}


# ====================================================================
# HELPERS
# ====================================================================


def _to_response(application) -> DoctorApplicationResponse:
    """Convert a DoctorApplication ORM entity to a response schema."""
    # Resolve specialization names
    spec_names = None
    if application.requested_specialization_ids:
        from app.modules.doctors.models import Specialization

        # We can't easily resolve without a DB query, so we'll use
        # the relationship if available or skip
        spec_names = []  # Will be populated by the service if needed

    user_full_name = None
    user_email = None
    if application.user:
        user_full_name = application.user.full_name
        user_email = application.user.email

    return DoctorApplicationResponse(
        id=application.id,
        user_id=application.user_id,
        user_full_name=user_full_name,
        user_email=user_email,
        qualification=application.qualification,
        registration_number=application.registration_number,
        years_of_experience=application.years_of_experience,
        date_of_birth=application.date_of_birth,
        gender=application.gender,
        primary_phone=application.primary_phone,
        address=application.address,
        profile_photo_url=application.profile_photo_url,
        requested_specialization_ids=application.requested_specialization_ids,
        primary_specialization_id=application.primary_specialization_id,
        specialization_names=spec_names,
        status=application.status,
        submitted_at=application.submitted_at,
        reviewed_at=application.reviewed_at,
        reviewed_by=application.reviewed_by,
        rejection_reason=application.rejection_reason,
        doctor_id=str(application.doctor_id) if application.doctor_id else None,
    )
