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
    AppointmentUpdate,
)

from app.modules.appointments.service import (
    AppointmentService,
)

from app.dependencies.auth import (
    get_current_user,
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
        get_current_user,
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
    service: AppointmentService = Depends(
        get_service,
    ),
):

    rows, total = (
        service.list(
            skip=skip,
            limit=limit,
        )
    )

    return {
        "items": rows,
        "total": total,
    }


@router.get(
    "/today",
    response_model=list[
        AppointmentResponse
    ],
)
def get_today_appointments(
    service: AppointmentService = Depends(
        get_service,
    ),
):

    return service.today()


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
)
def get_appointment(
    appointment_id: UUID,
    service: AppointmentService = Depends(
        get_service,
    ),
):

    try:

        return service.get(
            appointment_id,
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
        get_current_user,
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
        get_current_user,
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

