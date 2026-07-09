"""Doctor Management Module — Service Layer.

Coordinates business logic, transaction ownership, cross-repository
workflows, and business rule enforcement for the Doctor aggregate.

Transaction Rules
-----------------
* The service layer owns commit() and rollback().
* Repositories only flush() and refresh() — they NEVER commit.
* All state-changing operations wrap their logic in try/except blocks
  so that any failure triggers an automatic rollback.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DOCTOR_ROLES, USER_STATUS_ACTIVE
from app.modules.auth.models import User
from app.modules.doctors.constants import (
    DOCTOR_CODE_PREFIX,
    DOCTOR_CODE_SEQUENCE_WIDTH,
    ERR_ALREADY_ACTIVE,
    ERR_ALREADY_HAS_PROFILE,
    ERR_ALREADY_INACTIVE,
    ERR_CANNOT_MARK_INACTIVE_AVAILABLE,
    ERR_DOCTOR_NOT_FOUND,
    ERR_NOT_A_DOCTOR_USER,
    ERR_PRIMARY_SPEC_NOT_IN_LIST,
    ERR_REG_NUMBER_TAKEN,
    ERR_SPEC_NOT_ASSIGNED,
    ERR_SPEC_NOT_FOUND,
    ERR_USER_MUST_BE_ACTIVE,
    ERR_USER_NOT_FOUND,
)
from app.modules.doctors.exceptions import (
    DoctorCreationFailed,
    DoctorNotFound,
    DoctorUpdateFailed,
    DoctorUserNotFound,
    DoctorValidationFailed,
    DuplicateDoctorDetected,
    InvalidDoctorOperation,
    NotADoctorUser,
    SpecializationNotFound,
)
from app.modules.doctors.models import Doctor, DoctorSpecialization
from app.modules.doctors.repositories import (
    DoctorRepository,
    DoctorScheduleRepository,
    DoctorSpecializationRepository,
    SpecializationRepository,
)
from app.modules.doctors.schemas import DoctorCreate, DoctorUpdate
from app.modules.users.repository import get_user_by_id


logger = logging.getLogger(__name__)

_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "registration_number", "primary_phone", "date_of_birth", "gender",
    "address", "qualification", "years_of_experience", "consultation_fee",
    "consultation_duration", "languages_known", "profile_photo_url",
    "biography", "emergency_contact_name", "emergency_contact_phone",
    "available_for_appointment", "on_leave",
})


class _UserRepository:
    """Lightweight adapter wrapping the standalone user repository functions.

    Exists to satisfy the dependency-inversion principle within the
    Doctor module without requiring changes to the shared User repository.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        """Look up a user by primary key with their role eager-loaded.

        Args:
            user_id: The user's numeric ID.

        Returns:
            The matching User (with role loaded), or None if not found.
        """
        return get_user_by_id(self._db, user_id)


class DoctorService:
    """Service-layer orchestrator for the Doctor aggregate.

    Responsibilities:
    * Business rule validation (user existence, role checks, uniqueness).
    * Transaction ownership (commit on success, rollback on failure).
    * Coordination between DoctorRepository, DoctorScheduleRepository,
      DoctorSpecializationRepository, and SpecializationRepository.
    * Doctor code auto-generation with retry for concurrency safety.
    * Structured logging for auditability.

    The service layer is the **only** layer that calls commit().
    Repositories must call flush() / refresh() only.
    """

    def __init__(self, db: Session) -> None:
        """Initialize the service with all required repositories.

        Args:
            db: Active SQLAlchemy session (injected by the router layer).
        """
        self.db = db
        self.user_repo = _UserRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.schedule_repo = DoctorScheduleRepository(db)
        self.specialization_repo = SpecializationRepository(db)
        self.doctor_spec_repo = DoctorSpecializationRepository(db)

    # ------------------------------------------------------------------
    # Transaction Helper
    # ------------------------------------------------------------------

    def _run_in_transaction(
        self,
        operation: str,
        fn: callable,
        *,
        on_unexpected: type[Exception] = DoctorCreationFailed,
        log_context: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Execute a callable within a transaction boundary.

        Wraps the supplied callable with commit-on-success and
        rollback-on-failure semantics. Any exception raised by the
        callable triggers a rollback before re-raising a domain exception.

        Args:
            operation: Human-readable label for log messages.
            fn: Zero-argument callable containing the business logic.
            on_unexpected: Exception class used to wrap unexpected errors.
                          Defaults to DoctorCreationFailed.
            log_context: Optional extra context merged into log records
                         (e.g. doctor_id, user_id, actor_id).

        Returns:
            The return value of *fn*, typically the affected domain entity.

        Raises:
            DoctorCreationFailed: If creation fails (or on_unexpected).
            DoctorUpdateFailed: If update fails.
            InvalidDoctorOperation: If the operation is invalid.
        """
        ctx: dict[str, Any] = {"operation": operation}
        if log_context:
            ctx.update(log_context)
        try:
            result = fn()
            self.db.commit()
            logger.info("Doctor operation succeeded", extra=ctx)
            return result
        except (DoctorCreationFailed, DoctorUpdateFailed, InvalidDoctorOperation):
            self.db.rollback()
            raise
        except IntegrityError as exc:
            self.db.rollback()
            logger.error("Integrity violation during %s: %s", operation, exc)
            raise on_unexpected(f"Operation '{operation}' failed: integrity violation") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error during %s", operation, extra=ctx)
            raise on_unexpected(f"Operation '{operation}' failed unexpectedly: {exc}") from exc

    # ------------------------------------------------------------------
    # Common Helpers
    # ------------------------------------------------------------------

    def _get_doctor_or_raise(self, doctor_id: UUID) -> Doctor:
        """Look up a doctor by ID or raise DoctorNotFound.

        Args:
            doctor_id: UUID of the doctor to retrieve.

        Returns:
            The Doctor ORM instance.

        Raises:
            DoctorNotFound: If no doctor with the given ID exists.
        """
        doctor = self.doctor_repo.get_by_id(doctor_id)
        if doctor is None:
            raise DoctorNotFound(ERR_DOCTOR_NOT_FOUND)
        return doctor

    def get_doctor_by_id(self, doctor_id: UUID) -> Doctor:
        """Retrieve a doctor profile by its UUID.

        Args:
            doctor_id: The UUID of the doctor to retrieve.

        Returns:
            The matching Doctor ORM entity.

        Raises:
            DoctorNotFound: If no doctor matches the given ID.
        """
        return self._get_doctor_or_raise(doctor_id)


    def get_doctor_by_user_id(self, user_id: int) -> Doctor:
        """Retrieve a doctor profile by the linked user account ID.

        Args:
            user_id: Numeric ID of the user account.

        Returns:
            The matching Doctor ORM entity.

        Raises:
            DoctorNotFound: If no doctor is linked to this user.
        """
        doctor = self.doctor_repo.get_by_user_id(user_id)
        if doctor is None:
            raise DoctorNotFound(ERR_DOCTOR_NOT_FOUND)
        return doctor


    def list_doctors(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        specialization_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        is_available: Optional[bool] = None,
        sort_by: str = "full_name",
        sort_order: str = "asc",
    ) -> tuple[list[Doctor], int]:
        """Return a paginated, filterable list of doctors.

        Delegates filtering and sorting entirely to the repository.

        Args:
            page: One-based page index (default: 1).
            page_size: Number of items per page (default: 20).
            search: Optional full-name or email search string.
            specialization_id: Filter by specialization ID.
            is_active: Filter by active status.
            is_available: Filter by availability flag.
            sort_by: Sort field (default: "full_name").
            sort_order: Sort direction "asc" or "desc" (default: "asc").

        Returns:
            A tuple of (list of Doctor entities, total count).
        """
        skip = (page - 1) * page_size
        return self.doctor_repo.list_all(
            skip=skip, limit=page_size, search=search,
            specialization_id=specialization_id, is_active=is_active,
            is_available=is_available, sort_by=sort_by, sort_order=sort_order,
        )

    def create_doctor(self, payload: DoctorCreate, *, actor_id: int) -> Doctor:
        """Create a new doctor profile with full business validation.

        Validates the user, generates a unique doctor code, persists
        the profile, and assigns specialisations if provided.

        Args:
            payload: The validated DoctorCreate schema from the API layer.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The newly created Doctor ORM entity (refreshed after insert).

        Raises:
            DoctorUserNotFound: If the user does not exist.
            DoctorValidationFailed: If the user is inactive or not a doctor.
            DuplicateDoctorDetected: If the user already has a profile.
            DoctorCreationFailed: If any persistence error occurs.
        """
        def _create() -> Doctor:
            self._validate_create_payload(payload)
            doctor_code = self._generate_doctor_code()
            doctor = Doctor(
                user_id=payload.user_id,
                doctor_code=doctor_code,
                registration_number=payload.registration_number,
                primary_phone=payload.primary_phone,
                date_of_birth=payload.date_of_birth,
                gender=payload.gender,
                address=payload.address,
                qualification=payload.qualification,
                years_of_experience=payload.years_of_experience,
                consultation_fee=payload.consultation_fee,
                consultation_duration=payload.consultation_duration,
                languages_known=payload.languages_known,
                profile_photo_url=payload.profile_photo_url,
                biography=payload.biography,
                emergency_contact_name=payload.emergency_contact_name,
                emergency_contact_phone=payload.emergency_contact_phone,
                created_by=actor_id,
            )
            self.doctor_repo.add(doctor)
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            if payload.specialization_ids:
                self._assign_specializations_to_doctor(
                    doctor.id, payload.specialization_ids,
                    primary_id=payload.primary_specialization_id,
                )
            return doctor

        return self._run_in_transaction(
            "create_doctor", _create,
            log_context={"user_id": payload.user_id, "actor_id": actor_id},
        )
    def update_doctor(self, doctor_id: UUID, payload: DoctorUpdate, *, actor_id: int) -> Doctor:
        """Update an existing doctor profile with selective field merging.

        Only the fields explicitly supplied in the payload are applied.
        Immutable fields (doctor_code, user_id, id, timestamps, created_by)
        are silently ignored even if present to prevent accidental mutation.

        Args:
            doctor_id: UUID of the doctor to update.
            payload: The validated DoctorUpdate schema with only changed fields.
            actor_id: ID of the authenticated user performing the update.

        Returns:
            The updated Doctor ORM entity (refreshed after commit).

        Raises:
            DoctorNotFound: If the doctor does not exist.
            DoctorUpdateFailed: If the update or registration-number check fails.
        """
        def _update() -> Doctor:
            doctor = self._get_doctor_or_raise(doctor_id)
            update_data = payload.model_dump(exclude_unset=True)
            # Apply only explicitly whitelisted fields for future-proofing
            filtered = {
                k: v for k, v in update_data.items()
                if k in _ALLOWED_UPDATE_FIELDS
            }
            if not filtered:
                return doctor
            registration_number = filtered.get("registration_number")
            if registration_number is not None:
                self._assert_registration_number_unique(registration_number, exclude_doctor_id=doctor_id)
            for field, value in filtered.items():
                setattr(doctor, field, value)
            doctor.updated_by = actor_id
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            return doctor

        return self._run_in_transaction(
            "update_doctor", _update,
            on_unexpected=DoctorUpdateFailed,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )


    def activate_doctor(self, doctor_id: UUID, *, actor_id: int) -> Doctor:
        """Activate a doctor profile. Idempotent if already active.

        Args:
            doctor_id: UUID of the doctor to activate.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The activated Doctor entity.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If already active.
        """
        def _activate() -> Doctor:
            doctor = self._get_doctor_or_raise(doctor_id)
            if doctor.is_active:
                raise InvalidDoctorOperation(ERR_ALREADY_ACTIVE)
            doctor.is_active = True
            doctor.updated_by = actor_id
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            return doctor

        return self._run_in_transaction(
            "activate_doctor", _activate,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )


    def deactivate_doctor(self, doctor_id: UUID, *, actor_id: int) -> Doctor:
        """Deactivate a doctor profile. Idempotent if already inactive.

        Args:
            doctor_id: UUID of the doctor to deactivate.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The deactivated Doctor entity.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If already inactive.
        """
        def _deactivate() -> Doctor:
            doctor = self._get_doctor_or_raise(doctor_id)
            if not doctor.is_active:
                raise InvalidDoctorOperation(ERR_ALREADY_INACTIVE)
            doctor.is_active = False
            doctor.updated_by = actor_id
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            return doctor

        return self._run_in_transaction(
            "deactivate_doctor", _deactivate,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )

    def toggle_leave(self, doctor_id: UUID, *, actor_id: int) -> Doctor:
        """Toggle the on-leave flag for a doctor.

        Args:
            doctor_id: UUID of the doctor to update.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The updated Doctor entity.

        Raises:
            DoctorNotFound: If the doctor does not exist.
        """
        def _toggle() -> Doctor:
            doctor = self._get_doctor_or_raise(doctor_id)
            doctor.on_leave = not doctor.on_leave
            doctor.updated_by = actor_id
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            return doctor

        return self._run_in_transaction(
            "toggle_leave", _toggle,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )


    def toggle_availability(self, doctor_id: UUID, *, actor_id: int) -> Doctor:
        """Toggle the available-for-appointment flag.

        An inactive doctor cannot be marked as available.

        Args:
            doctor_id: UUID of the doctor to update.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The updated Doctor entity.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If trying to mark an inactive doctor.
        """
        def _toggle() -> Doctor:
            doctor = self._get_doctor_or_raise(doctor_id)
            if not doctor.is_active and not doctor.available_for_appointment:
                raise InvalidDoctorOperation(ERR_CANNOT_MARK_INACTIVE_AVAILABLE)
            doctor.available_for_appointment = not doctor.available_for_appointment
            doctor.updated_by = actor_id
            self.doctor_repo.flush()
            self.doctor_repo.refresh(doctor)
            return doctor

        return self._run_in_transaction(
            "toggle_availability", _toggle,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )
    def assign_specializations(
        self,
        doctor_id: UUID,
        specialization_ids: list[int],
        *,
        primary_specialization_id: Optional[int] = None,
        actor_id: int,
    ) -> list[DoctorSpecialization]:
        """Assign one or more specialisations to a doctor.

        Duplicate assignments are silently skipped. If a primary
        specialisation is specified, it must be in the list.

        Args:
            doctor_id: UUID of the target doctor.
            specialization_ids: List of specialisation IDs to assign.
            primary_specialization_id: Optional ID to set as primary.
            actor_id: ID of the authenticated user.

        Returns:
            List of DoctorSpecialization junction entries.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            SpecializationNotFound: If any ID is invalid.
        """
        def _assign() -> list[DoctorSpecialization]:
            self._get_doctor_or_raise(doctor_id)
            resolved = self._resolve_specializations(specialization_ids, primary_specialization_id)
            new_entries: list[DoctorSpecialization] = []
            for spec_id, is_primary in resolved:
                if self.doctor_spec_repo.exists(doctor_id, spec_id):
                    if is_primary:
                        self.doctor_spec_repo.set_primary_specialization(doctor_id, spec_id)
                    continue
                entry = DoctorSpecialization(
                    doctor_id=doctor_id,
                    specialization_id=spec_id,
                    is_primary=is_primary,
                )
                self.doctor_spec_repo.add(entry)
                new_entries.append(entry)
            self.doctor_spec_repo.flush()
            return new_entries

        return self._run_in_transaction(
            "assign_specializations", _assign,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )


    def remove_specialization(self, doctor_id: UUID, specialization_id: int, *, actor_id: int) -> None:
        """Remove a specialisation assignment from a doctor.

        Args:
            doctor_id: UUID of the target doctor.
            specialization_id: ID of the specialisation to remove.
            actor_id: ID of the authenticated user.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            DoctorValidationFailed: If the specialisation is not assigned.
        """
        def _remove() -> None:
            self._get_doctor_or_raise(doctor_id)
            if not self.doctor_spec_repo.exists(doctor_id, specialization_id):
                raise DoctorValidationFailed(ERR_SPEC_NOT_ASSIGNED)
            self.doctor_spec_repo.delete(doctor_id, specialization_id)

        return self._run_in_transaction(
            "remove_specialization", _remove,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )
    def get_doctor_profile(self, doctor_id: UUID) -> Doctor:
        """Retrieve a doctor with schedules and specialisations.

        Schedules are sorted by day-of-week for presentation.

        Args:
            doctor_id: UUID of the doctor.

        Returns:
            The Doctor entity with schedules and specialisations.

        Raises:
            DoctorNotFound: If the doctor does not exist.
        """
        doctor = self._get_doctor_or_raise(doctor_id)
        if doctor.schedules:
            doctor.schedules.sort(key=lambda s: s.day_of_week.value)
        return doctor


    def delete_doctor(self, doctor_id: UUID, *, actor_id: int) -> None:
        """Permanently remove a doctor profile.

        .. caution::
           This performs a hard (permanent) delete. The ADR does not
           specify soft-delete for the Doctor aggregate. If future
           requirements call for soft-delete, introduce an is_deleted
           flag on the model and move deletion logic to the repository.

        Args:
            doctor_id: UUID of the doctor to delete.
            actor_id: ID of the authenticated user.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If the doctor has dependencies.
        """
        def _delete() -> None:
            doctor = self._get_doctor_or_raise(doctor_id)
            self.doctor_repo.delete(doctor)

        return self._run_in_transaction(
            "delete_doctor", _delete,
            log_context={"doctor_id": str(doctor_id), "actor_id": actor_id},
        )

    # ------------------------------------------------------------------
    # Doctor Code Generation (Concurrency Safe)
    # ------------------------------------------------------------------

    def _generate_doctor_code(self) -> str:
        """Generate a unique doctor code in "DOC-XXXXXX" format.

        Uses a simple auto-increment based on the highest existing code.
        Concurrency safety is provided at the transaction level by the
        unique constraint on ``doctor_code`` in the database — any
        duplicate-key violation triggers an ``IntegrityError`` that is
        caught by ``_run_in_transaction``, which rolls back and re-raises
        as a domain exception.

        Returns:
            A string like "DOC-000001".
        """
        latest = self.doctor_repo.get_latest_doctor_code()
        if latest:
            try:
                seq = int(latest.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        seqstr = str(seq).zfill(DOCTOR_CODE_SEQUENCE_WIDTH)
        return f"{DOCTOR_CODE_PREFIX}-{seqstr}"

    # ------------------------------------------------------------------
    # Create Doctor Helpers
    # ------------------------------------------------------------------

    def _validate_create_payload(self, payload: DoctorCreate) -> None:
        """Validate all business rules for doctor creation.

        Loads the User once and reuses it across all assertion
        helpers to avoid redundant database lookups.

        Args:
            payload: The validated create schema.

        Raises:
            DoctorUserNotFound: If the user does not exist.
            DoctorValidationFailed: If the user is inactive or not a doctor.
            DuplicateDoctorDetected: If the user already has a profile.
        """
        user = self._assert_user_exists(payload.user_id)
        self._assert_user_active(user)
        self._assert_user_has_doctor_role(user)
        self._assert_no_existing_profile(payload.user_id)
        if payload.registration_number:
            self._assert_registration_number_unique(payload.registration_number)

    def _assign_specializations_to_doctor(
        self,
        doctor_id: UUID,
        specialization_ids: list[int],
        *,
        primary_id: Optional[int] = None,
    ) -> None:
        """Assign specialisations to a doctor during creation.

        Args:
            doctor_id: UUID of the newly created doctor.
            specialization_ids: List of IDs to assign.
            primary_id: Optional ID to mark as primary.

        Raises:
            SpecializationNotFound: If any ID is invalid.
        """
        resolved = self._resolve_specializations(specialization_ids, primary_id)
        for spec_id, is_primary in resolved:
            entry = DoctorSpecialization(
                doctor_id=doctor_id,
                specialization_id=spec_id,
                is_primary=is_primary,
            )
            self.doctor_spec_repo.add(entry)
        self.doctor_spec_repo.flush()

    # ------------------------------------------------------------------
    # Assertion Helpers
    # ------------------------------------------------------------------

    def _assert_user_exists(self, user_id: int) -> User:
        """Verify that a user exists.

        Args:
            user_id: Numeric ID of the user to check.

        Returns:
            The User entity for further checks.

        Raises:
            DoctorUserNotFound: If the user does not exist.
        """
        user = self.user_repo.get_by_id(user_id)
        if user is None:
            raise DoctorUserNotFound(ERR_USER_NOT_FOUND)
        return user

    def _assert_user_active(self, user: User) -> None:
        """Verify that a user is active.

        Checks both the is_active flag and the user status field.

        Args:
            user: The pre-loaded User entity.

        Raises:
            DoctorValidationFailed: If the user is not active.
        """
        if not user.is_active or user.status != USER_STATUS_ACTIVE:
            raise DoctorValidationFailed(ERR_USER_MUST_BE_ACTIVE)

    def _assert_user_has_doctor_role(self, user: User) -> None:
        """Verify that a user has a role eligible to be a doctor.

        Args:
            user: The pre-loaded User entity.

        Raises:
            NotADoctorUser: If the user lacks a doctor role.
        """
        if not user.role or user.role.name not in DOCTOR_ROLES:
            raise NotADoctorUser(ERR_NOT_A_DOCTOR_USER)

    def _assert_no_existing_profile(self, user_id: int) -> None:
        """Verify that a user does not already have a doctor profile.

        Args:
            user_id: Numeric ID of the user to check.

        Raises:
            DuplicateDoctorDetected: If the user already has a profile.
        """
        if self.doctor_repo.exists_by_user_id(user_id):
            raise DuplicateDoctorDetected(ERR_ALREADY_HAS_PROFILE)

    def _assert_registration_number_unique(
        self,
        registration_number: str,
        exclude_doctor_id: Optional[UUID] = None,
    ) -> None:
        """Verify that a registration number is not already taken.

        Args:
            registration_number: The registration number to check.
            exclude_doctor_id: Optional doctor ID to exclude (for updates).

        Raises:
            DoctorValidationFailed: If the registration number is taken.
        """
        if self.doctor_repo.registration_number_exists(
            registration_number, exclude_doctor_id=exclude_doctor_id
        ):
            raise DoctorValidationFailed(ERR_REG_NUMBER_TAKEN)

    # ------------------------------------------------------------------
    # Specialisation Resolution
    # ------------------------------------------------------------------

    def _resolve_specializations(
        self,
        specialization_ids: list[int],
        primary_specialization_id: Optional[int] = None,
    ) -> list[tuple[int, bool]]:
        """Resolve specialisation IDs and validate they exist.

        Returns a list of (specialization_id, is_primary) tuples.
        Validates that the primary specialisation (if specified)
        is included in the list of IDs.

        Args:
            specialization_ids: List of specialisation IDs to resolve.
            primary_specialization_id: Optional ID to mark as primary.

        Returns:
            List of (specialization_id, is_primary) tuples.

        Raises:
            SpecializationNotFound: If any ID is invalid.
            DoctorValidationFailed: If primary is not in the list.
        """
        if primary_specialization_id is not None:
            if primary_specialization_id not in specialization_ids:
                raise DoctorValidationFailed(ERR_PRIMARY_SPEC_NOT_IN_LIST)

        existing = self.specialization_repo.get_by_ids(specialization_ids)
        existing_ids = {s.id for s in existing}
        missing = set(specialization_ids) - existing_ids
        if missing:
            raise SpecializationNotFound(
                f'{ERR_SPEC_NOT_FOUND}: {sorted(missing)}'
            )

        return [
            (spec_id, spec_id == primary_specialization_id)
            for spec_id in specialization_ids
        ]
