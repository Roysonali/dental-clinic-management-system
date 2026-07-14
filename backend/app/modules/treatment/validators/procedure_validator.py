"""ProcedureValidator — business validation for the Procedure master catalog.

Responsibilities
----------------
* Field-level validation: code format, name length, cost bounds, category.
* Uniqueness validation: procedure codes must be unique (case-insensitive).
* Existence validation: procedures must exist before update/activate/deactivate/delete.

Design
------
* **Stateless** — instance holds only the repository reference (no mutable state).
* **Read-only** — repository is used exclusively for existence and uniqueness
  lookups (``get_by_code``, ``exists_by_code``, ``get_by_id``). Never writes.
* **Approved exceptions** — raises only ``ProcedureNotFound``,
  ``DuplicateProcedureDetected``, ``InvalidPlanOperation``, and
  ``PlanValidationFailed`` from the approved hierarchy.
* **Composable** — the service layer calls whichever validators it needs in the
  order it needs them.

Integration example::

    from app.modules.treatment.validators import ProcedureValidator

    validator = ProcedureValidator(procedure_repo)

    # Before creating a procedure
    validator.validate_create(code="EXTR-01", name="Extraction", default_cost=Decimal("150.00"), category="oral_surgery")

    # Before updating a procedure
    validator.validate_update(procedure_id=1, updates={"name": "Simple Extraction", "default_cost": Decimal("200.00")})
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping

from app.modules.treatment.constants import (
    MAX_ESTIMATED_COST,
    MIN_ESTIMATED_COST,
    PROCEDURE_CODE_MAX_LENGTH,
    PROCEDURE_NAME_MAX_LENGTH,
)
from app.modules.treatment.enums import ProcedureCategory
from app.modules.treatment.exceptions import (
    DuplicateProcedureDetected,
    InvalidPlanOperation,
    PlanValidationFailed,
    ProcedureNotFound,
)
from app.modules.treatment.repositories import ProcedureRepository


class ProcedureValidator:
    """Business rule validator for the Procedure master catalog.

    Args:
        repo: A ``ProcedureRepository`` instance used for **read-only**
            lookups (existence, uniqueness).
    """

    # Fields recognised by ``validate_update``. Declared at class level so
    # the set is computed once and can be reused by future schema-generation
    # or documentation tooling.
    RECOGNISED_UPDATE_FIELDS: frozenset[str] = frozenset({
        "code",
        "name",
        "description",
        "default_cost",
        "category",
        "is_active",
    })

    def __init__(self, repo: ProcedureRepository) -> None:
        self._repo = repo

    # ------------------------------------------------------------------
    # Composite validators
    # ------------------------------------------------------------------

    def validate_create(
        self,
        code: str,
        name: str,
        default_cost: Decimal,
        category: str,
        description: str | None = None,
    ) -> None:
        """Validate that a procedure with the given fields can be created.

        Checks in order:
        1. Code is non-empty, within max length, alphanumeric with ``_`` / ``-``.
        2. Name is non-empty, within max length.
        3. Cost is within ``[MIN_ESTIMATED_COST, MAX_ESTIMATED_COST]``.
        4. Category is a recognised ``ProcedureCategory``.
        5. Code is unique across the catalog.

        Raises:
            PlanValidationFailed: If any field-level constraint is violated.
            DuplicateProcedureDetected: If the code already exists.
        """
        code = self._normalize_code(code)
        _validate_code_format(code)
        _validate_name(name)
        self.validate_default_cost(default_cost)
        _validate_category(category)
        if description is not None:
            _validate_description(description)

        # Uniqueness must be checked against the database.
        self.validate_unique_code(code)

    def validate_update(
        self,
        procedure_id: int,
        updates: Mapping[str, Any],
    ) -> None:
        """Validate that an existing procedure may be updated with ``updates``.

        Checks in order:
        1. Procedure exists (raises ``ProcedureNotFound`` if missing).
        2. Only recognised, mutable fields are present.
        3. Each recognised field passes its own validation.

        Raises:
            ProcedureNotFound: If ``procedure_id`` does not resolve.
            PlanValidationFailed: If any field value is invalid.
            DuplicateProcedureDetected: If the update changes ``code`` and the
                new code collides with another procedure.
        """
        existing = self._repo.get_by_id(procedure_id)
        if existing is None:
            raise ProcedureNotFound(
                f"Procedure {procedure_id} not found for update",
                details={"procedure_id": procedure_id},
            )

        for field, value in updates.items():
            if field not in self.RECOGNISED_UPDATE_FIELDS:
                raise PlanValidationFailed(
                    f"Unrecognised procedure field: {field!r}. "
                    f"Recognised fields: {', '.join(sorted(self.RECOGNISED_UPDATE_FIELDS))}",
                    details={
                        "field": field,
                        "recognised_fields": sorted(self.RECOGNISED_UPDATE_FIELDS),
                    },
                )

            if field == "code":
                code = self._normalize_code(value)
                _validate_code_format(code)
                self.validate_unique_code(code, exclude_id=procedure_id)
            elif field == "name":
                _validate_name(value)
            elif field == "default_cost":
                self.validate_default_cost(value)
            elif field == "category":
                _validate_category(value)
            elif field == "description":
                _validate_description(value)
            # ``is_active`` is a simple boolean toggle — no additional
            # validation needed here; the ``validate_active`` method handles
            # activation-specific business rules.

    def validate_deletable(self, procedure_id: int) -> None:
        """Validate that a procedure may be deleted.

        Checks in order:
        1. Procedure exists.
        2. Procedure is inactive (active procedures should be deactivated
           first rather than deleted, but this is an operational guideline
           — the DB ``ON DELETE RESTRICT`` on ``treatment_plan_items`` will
           block deletion if items reference this procedure).

        Raises:
            ProcedureNotFound: If ``procedure_id`` does not resolve.
            InvalidPlanOperation: If the procedure is still active (soft
                deactivation is the recommended retirement path).
        """
        existing = self._repo.get_by_id(procedure_id)
        if existing is None:
            raise ProcedureNotFound(
                f"Procedure {procedure_id} not found for deletion",
                details={"procedure_id": procedure_id},
            )

        if existing.is_active:
            raise InvalidPlanOperation(
                f"Cannot delete active procedure '{existing.code}' (id={procedure_id}). "
                f"Deactivate the procedure first, then delete.",
                details={
                    "procedure_id": procedure_id,
                    "procedure_code": existing.code,
                    "is_active": existing.is_active,
                },
            )

    # ------------------------------------------------------------------
    # Field-level validators (stateless, no repo needed)
    # ------------------------------------------------------------------

    def validate_default_cost(self, cost: Decimal) -> None:
        """Validate that ``cost`` is within the allowed range.

        Raises:
            PlanValidationFailed: If cost is negative or exceeds
                ``MAX_ESTIMATED_COST``.
        """
        try:
            cost = Decimal(str(cost))
        except (ValueError, TypeError, ArithmeticError):
            raise PlanValidationFailed(
                f"Invalid default cost: {cost!r}. Must be a decimal number.",
                details={"cost": str(cost)},
            )

        if cost < MIN_ESTIMATED_COST:
            raise PlanValidationFailed(
                f"Default cost must be >= {MIN_ESTIMATED_COST}. Got {cost}.",
                details={
                    "cost": str(cost),
                    "min": str(MIN_ESTIMATED_COST),
                },
            )

        if cost > MAX_ESTIMATED_COST:
            raise PlanValidationFailed(
                f"Default cost must be <= {MAX_ESTIMATED_COST}. Got {cost}.",
                details={
                    "cost": str(cost),
                    "max": str(MAX_ESTIMATED_COST),
                },
            )

    # ------------------------------------------------------------------
    # Existence / uniqueness validators (repo reads)
    # ------------------------------------------------------------------

    def validate_unique_code(
        self,
        code: str,
        exclude_id: int | None = None,
    ) -> None:
        """Validate that ``code`` is unique across the procedure catalog.

        Args:
            code: The (already-normalised) procedure code to check.
            exclude_id: Optional procedure id to exclude from the check.
                Pass the current procedure's id during updates to avoid
                flagging the procedure's own code as a duplicate.

        Raises:
            DuplicateProcedureDetected: If another procedure already has this
                code (case-insensitive).
        """
        existing = self._repo.get_by_code(code)
        if existing is not None and existing.id != exclude_id:
            raise DuplicateProcedureDetected(
                code_value=code,
                details={
                    "code": code,
                    "existing_procedure_id": existing.id,
                    "existing_procedure_code": existing.code,
                },
            )

    def validate_active(self, procedure_id: int) -> None:
        """Validate that a procedure exists and is active.

        Uses ``get_active_by_id`` as the primary lookup (most efficient when
        the procedure is active). Falls back to ``get_by_id`` only to
        distinguish "not found" from "already inactive" — avoids two queries
        on the common (active) path.

        Raises:
            ProcedureNotFound: If ``procedure_id`` does not resolve.
            InvalidPlanOperation: If the procedure is already inactive.
        """
        existing = self._repo.get_active_by_id(procedure_id)
        if existing is None:
            # Could be missing or inactive — check which case.
            missing = self._repo.get_by_id(procedure_id)
            if missing is None:
                raise ProcedureNotFound(
                    f"Procedure {procedure_id} not found for activation",
                    details={"procedure_id": procedure_id},
                )
            raise InvalidPlanOperation(
                f"Procedure '{missing.code}' (id={procedure_id}) is already inactive.",
                details={
                    "procedure_id": procedure_id,
                    "procedure_code": missing.code,
                    "is_active": missing.is_active,
                },
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_code(code: str) -> str:
        """Strip whitespace and uppercase the code."""
        if not isinstance(code, str):
            raise PlanValidationFailed(
                f"Procedure code must be a string. Got {type(code).__name__!r}.",
                details={"received_type": type(code).__name__},
            )
        return code.strip().upper()


# ======================================================================
# Module-level pure validation helpers (no dependencies)
# ======================================================================


def _validate_code_format(code: str) -> None:
    """Validate that ``code`` is non-empty, within max length, and contains
    only alphanumeric characters, underscores, and hyphens.

    Raises ``PlanValidationFailed`` on any violation.
    """
    if not code:
        raise PlanValidationFailed(
            "Procedure code is required.",
            details={"code": code},
        )

    if len(code) > PROCEDURE_CODE_MAX_LENGTH:
        raise PlanValidationFailed(
            f"Procedure code must be at most {PROCEDURE_CODE_MAX_LENGTH} characters. "
            f"Got {len(code)}.",
            details={
                "code": code,
                "length": len(code),
                "max_length": PROCEDURE_CODE_MAX_LENGTH,
            },
        )

    for ch in code:
        if not (ch.isalnum() or ch in ("_", "-")):
            raise PlanValidationFailed(
                f"Procedure code must contain only alphanumeric characters, "
                f"underscores, and hyphens. Found {ch!r}.",
                details={
                    "code": code,
                    "invalid_character": ch,
                },
            )


def _validate_name(name: str) -> None:
    """Validate that ``name`` is non-empty and within max length.

    Raises ``PlanValidationFailed`` on any violation.
    """
    if not isinstance(name, str) or not name.strip():
        raise PlanValidationFailed(
            "Procedure name is required.",
            details={"name": name},
        )

    name = name.strip()
    if len(name) > PROCEDURE_NAME_MAX_LENGTH:
        raise PlanValidationFailed(
            f"Procedure name must be at most {PROCEDURE_NAME_MAX_LENGTH} characters. "
            f"Got {len(name)}.",
            details={
                "name": name,
                "length": len(name),
                "max_length": PROCEDURE_NAME_MAX_LENGTH,
            },
        )


def _validate_description(description: str | None) -> None:
    """Validate that ``description`` is a string if provided.

    Raises ``PlanValidationFailed`` if it is not ``None`` or a ``str``.
    """
    if description is not None and not isinstance(description, str):
        raise PlanValidationFailed(
            f"Procedure description must be a string or null. "
            f"Got {type(description).__name__!r}.",
            details={"received_type": type(description).__name__},
        )


def _validate_category(category: str) -> None:
    """Validate that ``category`` is a recognised ``ProcedureCategory`` value.

    Raises ``PlanValidationFailed`` on any violation.
    """
    if not isinstance(category, str):
        raise PlanValidationFailed(
            f"Procedure category must be a string. Got {type(category).__name__!r}.",
            details={"received_type": type(category).__name__},
        )

    try:
        ProcedureCategory(category)
    except ValueError:
        raise PlanValidationFailed(
            f"Unrecognised procedure category: {category!r}. "
            f"Must be one of: {', '.join(sorted(ProcedureCategory.all_values()))}.",
            details={
                "received": category,
                "expected_values": sorted(ProcedureCategory.all_values()),
            },
        )
