"""Structural Protocol interfaces for repositories consumed by validators.

These are *structural* (duck-typed) contracts: a validator only requires a
callable with the matching signature. The concrete repository implementation
is never imported or instantiated by the validator layer, which keeps the
validators pure (stateless, side-effect free, framework independent).

They exist purely to improve IDE autocomplete, mypy static analysis, and to
document the minimal repository surface each validator depends on.
"""

from __future__ import annotations

from typing import Optional, Protocol
from uuid import UUID

from app.modules.auth.models import User
from app.modules.doctors.models import DoctorSchedule, Specialization


class UserRepositoryProtocol(Protocol):
    """Minimum repository surface for user-eligibility validation."""

    def get_by_id(self, user_id: int) -> Optional[User]:
        ...


class DoctorRepositoryProtocol(Protocol):
    """Minimum repository surface for doctor existence/uniqueness validation."""

    def exists_by_user_id(self, user_id: int) -> bool:
        ...

    def registration_number_exists(
        self,
        registration_number: str,
        *,
        exclude_doctor_id: Optional[UUID] = None,
    ) -> bool:
        ...


class DoctorSpecializationRepositoryProtocol(Protocol):
    """Minimum repository surface for doctor-specialization validation."""

    def exists(self, doctor_id: UUID, specialization_id: int) -> bool:
        ...

    def is_specialization_assigned(self, specialization_id: int) -> bool:
        ...


class ScheduleRepositoryProtocol(Protocol):
    """Minimum repository surface for schedule validation."""

    def get_schedule_for_day(
        self,
        doctor_id: UUID,
        day_of_week: int,
    ) -> Optional[DoctorSchedule]:
        ...


class SpecializationRepositoryProtocol(Protocol):
    """Minimum repository surface for specialization uniqueness validation."""

    def get_by_name(self, name: str) -> Optional[Specialization]:
        ...

    def get_by_code(self, code: str) -> Optional[Specialization]:
        ...
