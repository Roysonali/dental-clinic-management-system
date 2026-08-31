from __future__ import annotations

from datetime import date
from typing import List
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy.orm import Session

from app.database.session import (
    get_db,
)

from app.modules.appointments.enums import (
    AppointmentStatus,
)

from sqlalchemy.exc import IntegrityError

from app.modules.appointments.exceptions import (
    AppointmentConflictException,
    AppointmentNotFoundException,
    AppointmentValidationException,
    InvalidAppointmentStatusTransition,
)

from app.modules.appointments.schema import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AppointmentUpdate,
    CalendarAppointmentListResponse,
)
from app.modules.patients.mapper import PatientMapper

from app.modules.appointments.service import (
    AppointmentService,
)

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)

from app.modules.rbac.permissions import (
    require_roles,
)

from app.modules.auth.models import (
    User,
)


router = APIRouter(
    prefix="/appointments",
    tags=[
        "Appointments",
    ],
)


def get_service(
    db: Session = Depends(
        get_db,
    ),
) -> AppointmentService:

    return AppointmentService(
        db,
    )


def _handle_service_exception(
    exc: Exception,
) -> None:
    """
    Map domain exceptions to HTTP responses.

    Always raises an HTTPException or re-raises the
    original exception — never returns normally.

    Handles:
    - Domain exceptions from the appointment module
    - IntegrityError from PostgreSQL constraint violations
      (EXCLUDE constraint, unique constraint on appointment_number)
    """

    if isinstance(
        exc,
        AppointmentNotFoundException,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    if isinstance(
        exc,
        AppointmentConflictException,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if isinstance(
        exc,
        (
            AppointmentValidationException,
            InvalidAppointmentStatusTransition,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # Database constraint violations (EXCLUDE, unique) that
    # were not caught at the application level become 409 Conflict
    # rather than a generic 500 Internal Server Error.
    if isinstance(
        exc,
        IntegrityError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A scheduling conflict was detected. "
                "The requested time slot may overlap "
                "with an existing appointment."
            ),
        )

    raise exc


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment(
    payload: AppointmentCreate,
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    try:

        return service.create(
            payload=payload,
            actor=current_user,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )


@router.get(
    "",
    response_model=AppointmentListResponse,
)
def list_appointments(
    skip: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    search: str | None = Query(
        default=None,
        description="Search appointment number, patient name or phone",
    ),
    status_filter: AppointmentStatus | None = Query(
        default=None,
        alias="status",
        description="Filter by appointment status",
    ),
    date_from: date | None = Query(
        default=None,
        description="Inclusive start date (YYYY-MM-DD)",
    ),
    date_to: date | None = Query(
        default=None,
        description="Inclusive end date (YYYY-MM-DD)",
    ),
    dentist_id: int | None = Query(
        default=None,
        gt=0,
        description="Filter by dentist user ID",
    ),
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    rows, total = (
        service.list(
            skip=skip,
            limit=limit,
            search=search,
            status=status_filter.value if status_filter else None,
            date_from=date_from,
            date_to=date_to,
            dentist_id=dentist_id,
        )
    )

    # Map eager-loaded relationships to response fields.
    # PatientMapper.build_full_name handles None middle names gracefully.
    items = [
        AppointmentResponse(
            id=apt.id,
            appointment_number=apt.appointment_number,
            patient_id=apt.patient_id,
            dentist_id=apt.dentist_id,
            appointment_date=apt.appointment_date,
            start_time=apt.start_time,
            end_time=apt.end_time,
            duration_minutes=apt.duration_minutes,
            appointment_type=apt.appointment_type,
            status=apt.status,
            reason_for_visit=apt.reason_for_visit,
            notes=apt.notes,
            patient_name=PatientMapper.build_full_name(apt.patient) if apt.patient else None,
            dentist_name=apt.dentist.full_name if apt.dentist else None,
            created_by=apt.created_by,
            updated_by=apt.updated_by,
            created_at=apt.created_at,
            updated_at=apt.updated_at,
        )
        for apt in rows
    ]

    return {
        "items": items,
        "total": total,
    }


@router.get(
    "/today",
    response_model=List[
        AppointmentResponse
    ],
)
def get_today_appointments(
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    return service.today()


@router.get(
    "/calendar",
    response_model=CalendarAppointmentListResponse,
)
def get_calendar_appointments(
    start: date = Query(
        ...,
        description="Start date (inclusive)",
    ),
    end: date = Query(
        ...,
        description="End date (exclusive)",
    ),
    dentist_id: int | None = Query(
        default=None,
        gt=0,
        description="Optional dentist ID filter",
    ),
    status_filter: AppointmentStatus | None = Query(
        default=None,
        alias="status",
        description="Optional status filter",
    ),
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    try:

        return service.calendar(
            start=start,
            end=end,
            dentist_id=dentist_id,
            status=status_filter.value if status_filter else None,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
)
def get_appointment(
    appointment_id: UUID,
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    try:
        apt = service.get(appointment_id)

        return AppointmentResponse(
            id=apt.id,
            appointment_number=apt.appointment_number,
            patient_id=apt.patient_id,
            dentist_id=apt.dentist_id,
            appointment_date=apt.appointment_date,
            start_time=apt.start_time,
            end_time=apt.end_time,
            duration_minutes=apt.duration_minutes,
            appointment_type=apt.appointment_type,
            status=apt.status,
            reason_for_visit=apt.reason_for_visit,
            notes=apt.notes,
            patient_name=PatientMapper.build_full_name(apt.patient) if apt.patient else None,
            dentist_name=apt.dentist.full_name if apt.dentist else None,
            created_by=apt.created_by,
            updated_by=apt.updated_by,
            created_at=apt.created_at,
            updated_at=apt.updated_at,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )


@router.put(
    "/{appointment_id}",
    response_model=AppointmentResponse,
)
def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    try:
        appointment = service.get(
            appointment_id,
        )

        return service.update(
            appointment=appointment,
            payload=payload,
            actor=current_user,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )


@router.patch(
    "/{appointment_id}/cancel",
    response_model=AppointmentResponse,
)
def cancel_appointment(
    appointment_id: UUID,
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):

    try:
        appointment = service.get(
            appointment_id,
        )

        return service.cancel(
            appointment=appointment,
            actor=current_user,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentResponse,
)
def update_appointment_status(
    appointment_id: UUID,
    payload: AppointmentStatusUpdate,
    service: AppointmentService = Depends(
        get_service,
    ),
    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        ),
    ),
):
    """Transition an appointment to a new status.

    Allowed transitions are enforced by the backend validator:
    SCHEDULED  → CONFIRMED | CANCELLED | NO_SHOW
    CONFIRMED  → CHECKED_IN | CANCELLED | NO_SHOW
    CHECKED_IN → IN_TREATMENT
    IN_TREATMENT → COMPLETED
    """

    try:
        appointment = service.get(
            appointment_id,
        )

        return service.change_status(
            appointment=appointment,
            new_status=payload.status,
            actor=current_user,
        )

    except Exception as exc:
        _handle_service_exception(
            exc,
        )
