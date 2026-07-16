"""Treatment Plan module — API routers.

Exposes:
- ``procedure_router`` — ``/procedures`` endpoints
- ``treatment_plan_router`` — ``/treatment-plans`` endpoints
"""

from app.modules.treatment.routers.procedure_router import router as procedure_router
from app.modules.treatment.routers.treatment_plan_router import router as treatment_plan_router

__all__ = [
    "procedure_router",
    "treatment_plan_router",
]
