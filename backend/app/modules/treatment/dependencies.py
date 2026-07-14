"""Treatment Plan module — FastAPI dependency injection.

Provides ``Depends()``-compatible callables that wire up the full
service-layer stack (repository → validator → service) for the
Procedure and Treatment Plan routers.

Every dependency uses a factory function that creates a fresh
service instance per request, taking the SQLAlchemy ``Session``
from the existing ``get_db`` dependency.

Usage example::

    @router.get("/procedures/{id}")
    def get_procedure(
        procedure_id: int,
        service: ProcedureService = Depends(get_procedure_service),
    ):
        ...

Architecture boundary
---------------------
- Builds validators and repositories inside the dependency so that
  the router never constructs them manually.
- Never stores request-scoped state on module globals.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.validators import (
    ProcedureValidator,
    TreatmentPlanValidator,
)
from app.modules.treatment.services import (
    ProcedureService,
    TreatmentPlanService,
)


# ======================================================================
# ProcedureService dependency
# ======================================================================


def get_procedure_service(
    db: Session = Depends(get_db),
) -> ProcedureService:
    """Build a ``ProcedureService`` with its repository and validator.

    Injects the active SQLAlchemy ``Session`` from FastAPI's
    ``get_db`` dependency, then constructs:
    ``ProcedureRepository`` → ``ProcedureValidator`` → ``ProcedureService``

    Returns:
        A fully-wired ``ProcedureService`` ready for request handling.
    """
    repo = ProcedureRepository()
    validator = ProcedureValidator(repo)
    return ProcedureService(repo=repo, validator=validator, db=db)


# ======================================================================
# TreatmentPlanService dependency
# ======================================================================


def get_treatment_plan_service(
    db: Session = Depends(get_db),
) -> TreatmentPlanService:
    """Build a ``TreatmentPlanService`` with its repositories and validators.

    Injects the active SQLAlchemy ``Session`` from FastAPI's
    ``get_db`` dependency, then constructs:
    ``TreatmentPlanRepository``,
    ``ProcedureRepository``,
    ``TreatmentPlanValidator``,
    ``ProcedureValidator``,
    ``TreatmentPlanService``

    Returns:
        A fully-wired ``TreatmentPlanService`` ready for request handling.
    """
    plan_repo = TreatmentPlanRepository()
    procedure_repo = ProcedureRepository()
    procedure_validator = ProcedureValidator(procedure_repo)
    plan_validator = TreatmentPlanValidator(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
    )
    return TreatmentPlanService(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
        plan_validator=plan_validator,
        procedure_validator=procedure_validator,
        db=db,
    )
