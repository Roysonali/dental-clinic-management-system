"""Doctor Management Module — Pure Business Validation.

Extracted from ``DoctorService`` to separate validation concerns
from transaction ownership and orchestration.

Each method is a ``@staticmethod`` — no state, no side effects, no
transaction management.  Validators that need data access receive a
repository as an explicit parameter (keeping the layer pure and
framework-independent).

Raises:
    DoctorException subclasses on every violation (never returns
    ``False`` or ``None`` to indicate failure — uses exceptions).
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.core.constants import DOCTOR_ROLES, USER_STATUS_ACTIVE
from app.modules.auth.models import User
from app.modules.doctors.constants import (
    ERR_ALREADY_ACTIVE,
    ERR_ALREADY_HAS_PROFILE,
    ERR_ALREADY_INACTIVE,
    ERR_CANNOT_MARK_INACTIVE_AVAILABLE,
    ERR_DOCTOR_MUST_BE_ACTIVE,
    ERR_NOT_A_DOCTOR_USER,
    ERR_PRIMARY_SPEC_NOT_IN_LIST,
    ERR_REG_NUMBER_TAKEN,
    ERR_SPEC_NOT_ASSIGNED,
    ERR_SPEC_NOT_FOUND,
    ERR_USER_MUST_BE_ACTIVE,
    ERR_USER_NOT_FOUND,
)
from app.modules.doctors.exceptions import (
    DoctorUserNotFound,
    DoctorValidationFailed,
    DuplicateDoctorDetected,
    InvalidDoctorOperation,
    NotADoctorUser,
    SpecializationNotFound,
)
from app.modules.doctors.models import Doctor
from ._protocols import (
    DoctorRepositoryProtocol,
    DoctorSpecializationRepositoryProtocol,
    UserRepositoryProtocol,
)


class DoctorValidator:
    """Collection of reusable business validation rules for the Doctor aggregate.

    Every method raises a domain exception on failure.
    Validators never commit, rollback, or own transactions.
    Validators that need persistence receive a repository reference
    as an explicit parameter from the calling service.

    Example usage::

        user = DoctorValidator.assert_user_exists(user_repo, payload.user_id)
        DoctorValidator.assert_user_active(user)
        DoctorValidator.assert_user_has_doctor_role(user)
    """

    # ==================================================================
    # User Eligibility (for doctor profile creation)
    # ==================================================================

    @staticmethod
    def assert_user_exists(
        user_repo: UserRepositoryProtocol,
        user_id: int,
    ) -> User:
        """Verify that a user exists and return it for further checks.

        Args:
            user_repo: Repository (or adapter) with a ``get_by_id(user_id)``
                method returning an optional ``User``.
            user_id: Numeric ID of the user to look up.

        Returns:
            The ``User`` entity for downstream validation.

        Raises:
            DoctorUserNotFound: If the user does not exist.
        """
        user = user_repo.get_by_id(user_id)
        if user is None:
            raise DoctorUserNotFound(ERR_USER_NOT_FOUND)
        return user

    @staticmethod
    def assert_user_active(user: User) -> None:
        """Verify that a user account is active.

        Checks both the ``is_active`` flag and the ``status`` field
        for defence-in-depth.

        Args:
            user: The pre-loaded ``User`` entity.

        Raises:
            DoctorValidationFailed: If the user is not active.
        """
        if not user.is_active or user.status != USER_STATUS_ACTIVE:
            raise DoctorValidationFailed(ERR_USER_MUST_BE_ACTIVE)

    @staticmethod
    def assert_user_has_doctor_role(user: User) -> None:
        """Verify that a user's role is eligible to become a doctor.

        Args:
            user: The pre-loaded ``User`` entity (must have ``role``
                eager-loaded).

        Raises:
            NotADoctorUser: If the user's role is not in the
                ``DOCTOR_ROLES`` set.
        """
        if not user.role or user.role.name not in DOCTOR_ROLES:
            raise NotADoctorUser(ERR_NOT_A_DOCTOR_USER)

    @staticmethod
    def assert_no_existing_profile(
        doctor_repo: DoctorRepositoryProtocol,
        user_id: int,
    ) -> None:
        """Verify that a user does not already have a doctor profile.

        Args:
            doctor_repo: ``DoctorRepository`` (or equivalent) with an
                ``exists_by_user_id(user_id)`` method.
            user_id: Numeric ID of the user to check.

        Raises:
            DuplicateDoctorDetected: If the user already has a profile.
        """
        if doctor_repo.exists_by_user_id(user_id):
            raise DuplicateDoctorDetected(ERR_ALREADY_HAS_PROFILE)

    @staticmethod
    def assert_registration_number_unique(
        doctor_repo: DoctorRepositoryProtocol,
        registration_number: str,
        exclude_doctor_id: Optional[UUID] = None,
    ) -> None:
        """Verify that a registration number is not already taken.

        Args:
            doctor_repo: ``DoctorRepository`` (or equivalent) with a
                ``registration_number_exists(reg_number, exclude_doctor_id=)``
                method.
            registration_number: The registration number to check.
            exclude_doctor_id: Optional doctor UUID to exclude (for
                updates where the current doctor owns the number).

        Raises:
            DoctorValidationFailed: If the registration number is taken.
        """
        if doctor_repo.registration_number_exists(
            registration_number,
            exclude_doctor_id=exclude_doctor_id,
        ):
            raise DoctorValidationFailed(ERR_REG_NUMBER_TAKEN)

    # ==================================================================
    # Doctor State Transitions
    # ==================================================================

    @staticmethod
    def assert_doctor_can_activate(doctor: Doctor) -> None:
        """Verify that a doctor can be activated.

        Args:
            doctor: The ``Doctor`` entity to check.

        Raises:
            InvalidDoctorOperation: If the doctor is already active.
        """
        if doctor.is_active:
            raise InvalidDoctorOperation(ERR_ALREADY_ACTIVE)

    @staticmethod
    def assert_doctor_can_deactivate(doctor: Doctor) -> None:
        """Verify that a doctor can be deactivated.

        Args:
            doctor: The ``Doctor`` entity to check.

        Raises:
            InvalidDoctorOperation: If the doctor is already inactive.
        """
        if not doctor.is_active:
            raise InvalidDoctorOperation(ERR_ALREADY_INACTIVE)

    @staticmethod
    def assert_doctor_can_toggle_availability(doctor: Doctor) -> None:
        """Verify that a doctor can toggle their availability.

        An inactive doctor cannot be marked as available.

        Args:
            doctor: The ``Doctor`` entity to check.

        Raises:
            InvalidDoctorOperation: If the doctor is inactive and
                currently unavailable.
        """
        if not doctor.is_active and not doctor.available_for_appointment:
            raise InvalidDoctorOperation(ERR_CANNOT_MARK_INACTIVE_AVAILABLE)

    @staticmethod
    def assert_doctor_active(doctor: Doctor) -> None:
        """Verify that a doctor is active.

        Reusable business rule for dependent operations (e.g. managing
        a doctor's schedule) that require an active doctor.

        Args:
            doctor: The ``Doctor`` entity to check.

        Raises:
            InvalidDoctorOperation: If the doctor is inactive.
        """
        if not doctor.is_active:
            raise InvalidDoctorOperation(ERR_DOCTOR_MUST_BE_ACTIVE)

    # ==================================================================
    # Specialization Validation
    # ==================================================================

    @staticmethod
    def assert_primary_specialization_valid(
        primary_specialization_id: Optional[int],
        specialization_ids: list[int],
    ) -> None:
        """Verify that the chosen primary specialization is in the assigned list.

        Raises:
            DoctorValidationFailed: If a primary specialization is specified
                but is not present in ``specialization_ids``.
        """
        if (
            primary_specialization_id is not None
            and primary_specialization_id not in specialization_ids
        ):
            raise DoctorValidationFailed(ERR_PRIMARY_SPEC_NOT_IN_LIST)

    @staticmethod
    def assert_specialization_assigned(
        doctor_spec_repo: DoctorSpecializationRepositoryProtocol,
        doctor_id: UUID,
        specialization_id: int,
    ) -> None:
        """Verify that a specialization is assigned to a specific doctor.

        Args:
            doctor_spec_repo: ``DoctorSpecializationRepository`` (or
                equivalent) with an ``exists(doctor_id, specialization_id)``
                method.
            doctor_id: UUID of the doctor.
            specialization_id: ID of the specialization.

        Raises:
            DoctorValidationFailed: If the specialization is not assigned.
        """
        if not doctor_spec_repo.exists(doctor_id, specialization_id):
            raise DoctorValidationFailed(ERR_SPEC_NOT_ASSIGNED)
