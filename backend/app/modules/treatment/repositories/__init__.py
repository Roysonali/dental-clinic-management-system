"""Treatment Plan module — repository package.

Exposes the aggregate-boundary repositories for the Treatment Plan module.

Per the architecture decision, only aggregate repositories are exposed:
``ProcedureRepository`` (master catalog) and ``TreatmentPlanRepository`` (the
TreatmentPlan aggregate root that also owns persistence of its child entities:
items, versions, and approvals). Child entities do not get their own
repositories.
"""

from app.modules.treatment.repositories.procedure_repository import (
    ProcedureRepository,
)
from app.modules.treatment.repositories.treatment_plan_repository import (
    TreatmentPlanRepository,
)

__all__ = [
    "ProcedureRepository",
    "TreatmentPlanRepository",
]
