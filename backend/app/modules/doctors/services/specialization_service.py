"""Doctor Management Module — Specialization Service Layer.

Manages the master list of dental specialisations. Each specialization
has a unique name and a unique short code for programmatic reference.

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

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.doctors.constants import (
    DEFAULT_PAGE_SIZE,
    ERR_SPEC_NOT_FOUND,
)
from app.modules.doctors.exceptions import (
    SpecializationCreationFailed,
    SpecializationNotFound,
    SpecializationUpdateFailed,
    SpecializationValidationFailed,
)
from app.modules.doctors.models import Specialization
from app.modules.doctors.repositories import (
    DoctorSpecializationRepository,
    SpecializationRepository,
)
from app.modules.doctors.schemas import SpecializationCreate, SpecializationUpdate
from app.modules.doctors.validators import SpecializationValidator


logger = logging.getLogger(__name__)

_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "name", "code", "description",
})
class SpecializationService:
    """Service-layer orchestrator for Specialization management.

    Responsibilities:
    * Business rule validation (name/code uniqueness, delete constraints).
    * Transaction ownership (commit on success, rollback on failure).
    * Delegation to SpecializationRepository for all data access.
    * Structured logging for auditability.

    The service layer is the **only** layer that calls commit().
    Repositories must call flush() / refresh() only.
    """

    def __init__(self, db: Session) -> None:
        """Initialize the service with required repositories.

        Args:
            db: Active SQLAlchemy session (injected by the router layer).
        """
        self.db = db
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
        on_unexpected: type[Exception] = SpecializationCreationFailed,
        log_context: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Execute a callable within a transaction boundary.

        Wraps the supplied callable with commit-on-success and
        rollback-on-failure semantics.

        Args:
            operation: Human-readable label for log messages.
            fn: Zero-argument callable containing the business logic.
            on_unexpected: Exception class for unexpected errors.
            log_context: Extra context merged into log records.

        Returns:
            The return value of *fn*, typically the affected entity.
        """
        ctx: dict[str, Any] = {"operation": operation}
        if log_context:
            ctx.update(log_context)
        try:
            result = fn()
            self.db.commit()
            logger.info("Specialization operation succeeded", extra=ctx)
            return result
        except (SpecializationCreationFailed, SpecializationUpdateFailed, SpecializationValidationFailed):
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
    # Query Methods
    # ------------------------------------------------------------------

    def get_specialization(self, specialization_id: int) -> Specialization:
        """Retrieve a specialization by its ID.

        Args:
            specialization_id: Numeric ID of the specialization.

        Returns:
            The matching Specialization ORM entity.

        Raises:
            SpecializationNotFound: If no specialization matches the ID.
        """
        return self._get_specialization_or_raise(specialization_id)


    def list_specializations(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        is_active: Optional[bool] = None,
    ) -> tuple[list[Specialization], int]:
        """Return a paginated, filterable list of specializations.

        Args:
            page: One-based page index (default: 1).
            page_size: Items per page (default: 20).
            is_active: Optional filter by active status.

        Returns:
            A tuple of (list of Specialization entities, total count).
        """
        return self.specialization_repo.list(
            page=page, page_size=page_size, is_active=is_active,
        )

    # ------------------------------------------------------------------
    # Write Methods
    # ------------------------------------------------------------------

    def create_specialization(
        self,
        payload: SpecializationCreate,
        *,
        actor_id: int,
    ) -> Specialization:
        """Create a new specialization with uniqueness validation.

        Validates that the name and code are not already taken.

        Args:
            payload: The validated SpecializationCreate schema.
            actor_id: ID of the authenticated user.

        Returns:
            The newly created Specialization ORM entity (refreshed).

        Raises:
            SpecializationValidationFailed: If name or code is already taken.
            SpecializationCreationFailed: If persistence fails.
        """
        def _create() -> Specialization:
            SpecializationValidator.assert_name_unique(self.specialization_repo, payload.name)
            SpecializationValidator.assert_code_unique(self.specialization_repo, payload.code)
            specialization = Specialization(
                name=payload.name,
                code=payload.code,
                description=payload.description,
            )
            return self.specialization_repo.create(specialization)

        return self._run_in_transaction(
            "create_specialization", _create,
            log_context={"actor_id": actor_id},
        )


    def update_specialization(
        self,
        specialization_id: int,
        payload: SpecializationUpdate,
        *,
        actor_id: int,
    ) -> Specialization:
        """Update an existing specialization.

        Only supplied fields are applied. Name and code uniqueness
        are re-validated if they are being changed.

        Args:
            specialization_id: ID of the specialization to update.
            payload: The validated SpecializationUpdate schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated Specialization ORM entity (refreshed).

        Raises:
            SpecializationNotFound: If the specialization does not exist.
            SpecializationValidationFailed: If name/code is already taken.
            SpecializationUpdateFailed: If persistence fails.
        """
        def _update() -> Specialization:
            spec = self._get_specialization_for_update_or_raise(specialization_id)
            update_data = payload.model_dump(exclude_unset=True)
            filtered = {
                k: v for k, v in update_data.items()
                if k in _ALLOWED_UPDATE_FIELDS
            }
            if not filtered:
                return spec
            name = filtered.get("name")
            if name is not None:
                SpecializationValidator.assert_name_unique(
                    self.specialization_repo, name, exclude_id=specialization_id,
                )
            code = filtered.get("code")
            if code is not None:
                SpecializationValidator.assert_code_unique(
                    self.specialization_repo, code, exclude_id=specialization_id,
                )
            return self.specialization_repo.update(spec, filtered)

        return self._run_in_transaction(
            "update_specialization", _update,
            on_unexpected=SpecializationUpdateFailed,
            log_context={"specialization_id": specialization_id, "actor_id": actor_id},
        )


    def activate_specialization(self, specialization_id: int, *, actor_id: int) -> Specialization:
        """Activate a specialization. Idempotent if already active.

        Args:
            specialization_id: ID of the specialization to activate.
            actor_id: ID of the authenticated user.

        Returns:
            The activated Specialization entity.

        Raises:
            SpecializationNotFound: If the specialization does not exist.
            SpecializationValidationFailed: If already active.
        """
        def _activate() -> Specialization:
            spec = self._get_specialization_for_update_or_raise(specialization_id)
            SpecializationValidator.assert_specialization_can_activate(spec)
            return self.specialization_repo.update(spec, {"is_active": True})

        return self._run_in_transaction(
            "activate_specialization", _activate,
            log_context={"specialization_id": specialization_id, "actor_id": actor_id},
        )


    def deactivate_specialization(self, specialization_id: int, *, actor_id: int) -> Specialization:
        """Deactivate a specialization. Idempotent if already inactive.

        Args:
            specialization_id: ID of the specialization to deactivate.
            actor_id: ID of the authenticated user.

        Returns:
            The deactivated Specialization entity.

        Raises:
            SpecializationNotFound: If the specialization does not exist.
            SpecializationValidationFailed: If already inactive.
        """
        def _deactivate() -> Specialization:
            spec = self._get_specialization_for_update_or_raise(specialization_id)
            SpecializationValidator.assert_specialization_can_deactivate(spec)
            return self.specialization_repo.update(spec, {"is_active": False})

        return self._run_in_transaction(
            "deactivate_specialization", _deactivate,
            log_context={"specialization_id": specialization_id, "actor_id": actor_id},
        )


    def delete_specialization(self, specialization_id: int, *, actor_id: int) -> None:
        """Delete a specialization if it is not assigned to any doctor.

        Args:
            specialization_id: ID of the specialization to delete.
            actor_id: ID of the authenticated user.

        Raises:
            SpecializationNotFound: If the specialization does not exist.
            SpecializationValidationFailed: If the specialization is assigned to doctors.
        """
        def _delete() -> None:
            spec = self._get_specialization_for_update_or_raise(specialization_id)
            SpecializationValidator.assert_not_assigned_to_doctors(
                self.doctor_spec_repo, specialization_id,
            )
            self.specialization_repo.delete(spec)

        return self._run_in_transaction(
            "delete_specialization", _delete,
            log_context={"specialization_id": specialization_id, "actor_id": actor_id},
        )

    # ------------------------------------------------------------------
    # Private Helpers
    # ------------------------------------------------------------------

    def _get_specialization_or_raise(self, specialization_id: int) -> Specialization:
        """Look up a specialization by ID or raise SpecializationNotFound.

        Args:
            specialization_id: Numeric ID of the specialization.

        Returns:
            The Specialization ORM instance.

        Raises:
            SpecializationNotFound: If no specialization with the given ID exists.
        """
        spec = self.specialization_repo.get_by_id(specialization_id)
        if spec is None:
            raise SpecializationNotFound()
        return spec


    def _get_specialization_for_update_or_raise(self, specialization_id: int) -> Specialization:
        """Lock and retrieve a specialization row, or raise if not found.

        Uses ``SELECT ... FOR UPDATE`` to prevent concurrent modification
        races during write operations.

        Args:
            specialization_id: Numeric ID of the specialization.

        Returns:
            The locked Specialization ORM instance.

        Raises:
            SpecializationNotFound: If no specialization with the given ID exists.
        """
        spec = self.specialization_repo.get_by_id_for_update(specialization_id)
        if spec is None:
            raise SpecializationNotFound()
        return spec


