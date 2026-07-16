"""Treatment Plan module — service package.

The service layer owns:

- **Transaction boundaries** (commit / rollback).
- **Orchestration** (coordinating repositories, validators, and the state machine).
- **Logging** (infrastructure-level; business events are logged here).
- **Repository coordination** (multiple repositories for a single operation).
- **Validator coordination** (invoking validators in the correct order).

The service layer does NOT own:

- Business validation (validators).
- Transition rules (state machine).
- SQL (repositories).
- HTTP concerns (routers).
- Serialization / deserialization (mappers / schemas).
"""

from __future__ import annotations

from app.modules.treatment.services.procedure_service import (
    ProcedureService,
)
from app.modules.treatment.services.treatment_plan_service import (
    TreatmentPlanService,
)

__all__ = [
    "ProcedureService",
    "TreatmentPlanService",
]
