"""ProcedureService — service-layer orchestrator for the Procedure master catalog.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Orchestration**: coordinates ``ProcedureRepository`` and ``ProcedureValidator``.
* **Logging**: business-event logging at INFO level; search/list at DEBUG level.

Ownership boundaries
--------------------
+---------------------------+-------------------------------+
| Owned by service          | Owned by validator / repo     |
+===========================+===============================+
| Transaction (commit /     | Business validation           |
| rollback)                 | (ProcedureValidator)          |
+---------------------------+-------------------------------+
| Orchestration             | Persistence (ProcedureRepo)   |
+---------------------------+-------------------------------+
| Logging                   | SQL                           |
+---------------------------+-------------------------------+
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    PROCEDURE_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.exceptions import (
    ProcedureNotFound,
)
from app.modules.treatment.models import Procedure
from app.modules.treatment.repositories import ProcedureRepository
from app.modules.treatment.validators import ProcedureValidator

logger = logging.getLogger(__name__)


class ProcedureService:
    """Service-layer orchestrator for the Procedure master catalog.

    Args:
        repo: The ``ProcedureRepository`` instance to use for persistence.
        validator: The ``ProcedureValidator`` instance to use for business
            validation.
        db: The active SQLAlchemy ``Session`` (injected by the router / DI
            layer). The service owns commit and rollback on this session.
    """

    def __init__(
        self,
        repo: ProcedureRepository,
        validator: ProcedureValidator,
        db: Session,
    ) -> None:
        self._repo = repo
        self._validator = validator
        self._db = db

    # ==================================================================
    # Transaction helpers
    # ==================================================================

    def _commit(self) -> None:
        """Commit the current transaction.

        Rolls back on any ``IntegrityError`` or ``SQLAlchemyError`` and
        re-raises the original exception so the caller never sees stale
        transaction state.

        Raises:
            The original exception after rollback; the wrapping method
            should catch and translate it to a domain exception.
        """
        try:
            self._db.commit()
        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception("Database error during commit — transaction rolled back")
            raise

    # ==================================================================
    # Write operations
    # ==================================================================

    def create_procedure(
        self,
        code: str,
        name: str,
        default_cost: Decimal,
        category: str,
        description: str | None = None,
    ) -> Procedure:
        """Create a new procedure in the master catalog.

        Flow: validate input → validate_unique_code → validate_default_cost
        → validate category → construct ORM model → repository.create() → commit.

        Args:
            code: Unique business code for the procedure (will be uppercased).
            name: Display name.
            default_cost: Default cost of the procedure.
            category: Procedure category (must match ``ProcedureCategory``).
            description: Optional description.

        Returns:
            The newly created ``Procedure`` ORM instance.

        Raises:
            PlanValidationFailed: If any field-level constraint is violated.
            DuplicateProcedureDetected: If the code already exists.
        """
        self._validator.validate_create(
            code=code,
            name=name,
            default_cost=default_cost,
            category=category,
            description=description,
        )

        procedure = Procedure(
            code=code.strip().upper(),
            name=name.strip(),
            default_cost=default_cost,
            category=category,
            description=description.strip() if description else None,
            is_active=True,
        )

        procedure = self._repo.create(procedure)
        self._commit()

        logger.info(
            "Procedure created: id=%s, code=%s, name=%s",
            procedure.id,
            procedure.code,
            procedure.name,
        )

        return procedure

    def update_procedure(
        self,
        procedure_id: int,
        updates: dict[str, Any],
    ) -> Procedure:
        """Update an existing procedure's mutable fields.

        Flow: load procedure → validator.validate_update() → repo.update() → commit.

        Only fields recognised by ``ProcedureValidator.RECOGNISED_UPDATE_FIELDS``
        are applied. Immutable fields (``code``, ``id``) are silently skipped
        by the repository.

        Args:
            procedure_id: The integer ID of the procedure.
            updates: Dictionary of field → value pairs to update.

        Returns:
            The updated ``Procedure`` ORM instance.

        Raises:
            ProcedureNotFound: If the procedure does not exist.
            PlanValidationFailed: If any field value is invalid.
            DuplicateProcedureDetected: If an updated code collides.
        """
        self._validator.validate_update(procedure_id, updates)
        procedure = self._repo.get_by_id(procedure_id)
        # validate_update already raised ``ProcedureNotFound`` if
        # ``procedure_id`` doesn't resolve, so this guard is defensive.
        if procedure is None:
            raise ProcedureNotFound(procedure_id)

        procedure = self._repo.update(procedure, updates)
        self._commit()

        logger.info(
            "Procedure updated: id=%s, fields=%s",
            procedure_id,
            list(updates.keys()),
        )

        return procedure

    def activate_procedure(self, procedure_id: int) -> Procedure:
        """Activate a procedure.

        Flow: validator.validate_active() → repo.activate() → commit.

        Args:
            procedure_id: The integer ID of the procedure to activate.

        Returns:
            The activated ``Procedure`` ORM instance.

        Raises:
            ProcedureNotFound: If the procedure does not exist.
            InvalidPlanOperation: If the procedure is already inactive.
        """
        self._validator.validate_active(procedure_id)
        procedure = self._repo.get_by_id(procedure_id)
        # validate_active already raised ``ProcedureNotFound`` or
        # ``InvalidPlanOperation``, so ``procedure`` is guaranteed to be
        # a valid, active instance.

        procedure = self._repo.activate(procedure)
        self._commit()

        logger.info(
            "Procedure activated: id=%s, code=%s",
            procedure.id,
            procedure.code,
        )

        return procedure

    def deactivate_procedure(self, procedure_id: int) -> Procedure:
        """Deactivate a procedure (soft retire from the catalog).

        Flow: load procedure → repo.deactivate() → commit.

        Unlike ``activate_procedure``, this method does not validate
        whether the procedure is already inactive — deactivation is
        idempotent at the repository level. The repository's ``deactivate``
        simply sets ``is_active = False`` regardless of the current value.

        Args:
            procedure_id: The integer ID of the procedure to deactivate.

        Returns:
            The deactivated ``Procedure`` ORM instance.

        Raises:
            ProcedureNotFound: If the procedure does not exist.
        """
        procedure = self._repo.get_by_id(procedure_id)
        if procedure is None:
            raise ProcedureNotFound(procedure_id)

        procedure = self._repo.deactivate(procedure)
        self._commit()

        logger.info(
            "Procedure deactivated: id=%s, code=%s",
            procedure.id,
            procedure.code,
        )

        return procedure

    def delete_procedure(self, procedure_id: int) -> None:
        """Hard-delete a procedure.

        Flow: validator.validate_deletable() → repo.delete() → commit.

        The procedure must be inactive before deletion (validated by
        ``validate_deletable``). If treatment plan items still reference
        this procedure, ``ON DELETE RESTRICT`` at the database level will
        raise an ``IntegrityError``, which is rolled back and re-raised.

        Args:
            procedure_id: The integer ID of the procedure to delete.

        Raises:
            ProcedureNotFound: If the procedure does not exist.
            InvalidPlanOperation: If the procedure is still active.
        """
        self._validator.validate_deletable(procedure_id)
        procedure = self._repo.get_by_id(procedure_id)
        # validate_deletable already raised ``ProcedureNotFound`` or
        # ``InvalidPlanOperation``, so ``procedure`` is guaranteed to
        # exist and be inactive.

        self._repo.delete(procedure)
        self._commit()

        logger.info(
            "Procedure deleted: id=%s, code=%s",
            procedure_id,
            procedure.code,
        )

    # ==================================================================
    # Read operations (no commit)
    # ==================================================================

    def get_procedure(self, procedure_id: int) -> Procedure:
        """Retrieve a procedure by its integer primary key.

        Args:
            procedure_id: The integer ID of the procedure.

        Returns:
            The ``Procedure`` ORM instance.

        Raises:
            ProcedureNotFound: If no procedure with the given ID exists.
        """
        procedure = self._repo.get_by_id(procedure_id)
        if procedure is None:
            raise ProcedureNotFound(procedure_id)
        return procedure

    def get_procedure_by_code(self, code: str) -> Procedure:
        """Retrieve a procedure by its business code (case-insensitive).

        Args:
            code: The procedure code to look up (will be uppercased).

        Returns:
            The ``Procedure`` ORM instance.

        Raises:
            ProcedureNotFound: If no procedure with the given code exists.
        """
        code = code.strip().upper()
        procedure = self._repo.get_by_code(code)
        if procedure is None:
            raise ProcedureNotFound(
                f"Procedure with code '{code}' not found",
                details={"code": code},
            )
        return procedure

    def list_procedures(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        is_active: bool | None = None,
        category: str | None = None,
        sort_by: str | None = None,
        sort_order: str = "asc",
    ) -> tuple[list[Procedure], int]:
        """Return a paginated, filterable list of procedures.

        Args:
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            is_active: Optional filter by active state.
            category: Optional filter by procedure category.
            sort_by: Optional sort field (defaults to ``code``).
            sort_order: ``\"asc\"`` or ``\"desc\"`` (default: ``\"asc\"``).

        Returns:
            A tuple of ``(items, total)``.
        """
        return self._repo.list(
            page=page,
            page_size=page_size,
            is_active=is_active,
            category=category,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_active_procedures(self) -> list[Procedure]:
        """Return all active procedures ordered by code.

        Intended for dropdowns, seed data, and frontend options.

        Returns:
            A list of active ``Procedure`` ORM instances.
        """
        return self._repo.list_active()

    def search_procedures(
        self,
        term: str,
        limit: int = PROCEDURE_SEARCH_DEFAULT_LIMIT,
    ) -> list[Procedure]:
        """Search procedures by code or name (case-insensitive substring).

        Trims the search term before passing to the repository. Returns an
        empty list when the term is empty or whitespace-only.

        Args:
            term: The search string (code or name fragment).
            limit: Maximum number of results (defaults to
                ``PROCEDURE_SEARCH_DEFAULT_LIMIT``).

        Returns:
            A list of matching ``Procedure`` ORM instances (may be empty).
        """
        term = term.strip() if term else ""
        if not term:
            return []
        return self._repo.search(term=term, limit=limit)

    def count_procedures(self, is_active: bool | None = None) -> int:
        """Count procedures, optionally filtered by active state.

        Args:
            is_active: If ``True``, count only active procedures. If
                ``False``, count only inactive. If ``None``, count all.

        Returns:
            The total count.
        """
        return self._repo.count(is_active=is_active)
