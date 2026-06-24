# app/modules/appointments/exceptions.py


class AppointmentException(Exception):
    """Base appointment exception."""

    def __init__(
        self,
        message: str,
    ) -> None:
        super().__init__(message)
        self.message = message


class AppointmentValidationException(
    AppointmentException,
):
    """Business validation failed."""


class AppointmentNotFoundException(
    AppointmentException,
):
    """Appointment not found."""


class AppointmentConflictException(
    AppointmentException,
):
    """Scheduling conflict."""


class InvalidAppointmentStatusTransition(
    AppointmentException,
):
    """Invalid status change."""
