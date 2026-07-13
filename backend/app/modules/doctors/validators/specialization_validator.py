"""Doctor Management Module — Specialization Pure Business Validation.

Extracted from ``SpecializationService`` to separate validation concerns
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

from app.modules.doctors.constants import (
    ERR_SPEC_ALREADY_ACTIVE,
    ERR_SPEC_ALREADY_INACTIVE,
    ERR_SPEC_ASSIGNED_TO_DOCTORS,
    ERR_SPEC_CODE_TAKEN,
    ERR_SPEC_NAME_TAKEN,
)
from app.modules.doctors.exceptions import SpecializationValidationFailed
from app.modules.doctors.models import Specialization


class SpecializationValidator:
    """Collection of reusable business validation rules for the Specialization aggregate.

    Every method raises a domain exception on failure.
    Validators never commit, rollback, or own transactions.
    Validators that need persistence receive a repository reference
    as an explicit parameter from the calling service.

    Example usage::

        SpecializationValidator.assert_name_unique(spec_repo, payload.name)
        SpecializationValidator.assert_code_unique(spec_repo, payload.code)
    """

    # ==================================================================
    # Uniqueness Validation
    # ==================================================================

    @staticmethod
    def assert_name_unique(
        specialization_repo,
        name: str,
        exclude_id: Optional[int] = None,
    ) -> None:
        """Verify a specialization name is not already taken (case-insensitive).

        Args:
            specialization_repo: Repository with a ``get_by_name(name)``
                method returning an optional ``Specialization``.
            name: The name to check.
            exclude_id: Optional specialization ID to exclude from the
                check (for updates).

        Raises:
            SpecializationValidationFailed: If the name is already in use.
        """
        existing = specialization_repo.get_by_name(name)
        if existing is not None and existing.id != exclude_id:
            raise SpecializationValidationFailed(ERR_SPEC_NAME_TAKEN)

    @staticmethod
    def assert_code_unique(
        specialization_repo,
        code: str,
        exclude_id: Optional[int] = None,
    ) -> None:
        """Verify a specialization code is not already taken (case-insensitive).

        Args:
            specialization_repo: Repository with a ``get_by_code(code)``
                method returning an optional ``Specialization``.
            code: The code to check.
            exclude_id: Optional specialization ID to exclude from the
                check (for updates).

        Raises:
            SpecializationValidationFailed: If the code is already in use.
        """
        existing = specialization_repo.get_by_code(code)
        if existing is not None and existing.id != exclude_id:
            raise SpecializationValidationFailed(ERR_SPEC_CODE_TAKEN)

    # ==================================================================
    # State Transition Validation
    # ==================================================================

    @staticmethod
    def assert_specialization_can_activate(specialization: Specialization) -> None:
        """Verify that a specialization can be activated.

        Args:
            specialization: The ``Specialization`` entity to check.

        Raises:
            SpecializationValidationFailed: If the specialization is
                already active.
        """
        if specialization.is_active:
            raise SpecializationValidationFailed(ERR_SPEC_ALREADY_ACTIVE)

    @staticmethod
    def assert_specialization_can_deactivate(specialization: Specialization) -> None:
        """Verify that a specialization can be deactivated.

        Args:
            specialization: The ``Specialization`` entity to check.

        Raises:
            SpecializationValidationFailed: If the specialization is
                already inactive.
        """
        if not specialization.is_active:
            raise SpecializationValidationFailed(ERR_SPEC_ALREADY_INACTIVE)

    # ==================================================================
    # Delete Guard Validation
    # ==================================================================

    @staticmethod
    def assert_not_assigned_to_doctors(
        doctor_spec_repo,
        specialization_id: int,
    ) -> None:
        """Verify that a specialization is not assigned to any doctor.

        Args:
            doctor_spec_repo: Repository with an
                ``is_specialization_assigned(specialization_id)`` method.
            specialization_id: ID of the specialization to check.

        Raises:
            SpecializationValidationFailed: If the specialization is
                assigned to one or more doctors.
        """
        if doctor_spec_repo.is_specialization_assigned(specialization_id):
            raise SpecializationValidationFailed(ERR_SPEC_ASSIGNED_TO_DOCTORS)
