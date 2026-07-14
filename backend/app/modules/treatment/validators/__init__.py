"""Treatment Plan module — validators package.

The validators layer is split into:

1. **State machine** (``state_machine.py``): Pure workflow-transition validation
   for plan and item statuses. No database access, no repositories, no services.
   Consumes the transition maps defined in ``app.modules.treatment.constants``.

2. **ProcedureValidator** (``procedure_validator.py``): Business validation for
   the Procedure master catalog. Accepts a ``ProcedureRepository`` dependency
   for read-only existence and uniqueness checks. No writes, no transactions.

3. **TreatmentPlanValidator / ItemValidator** (future): Data validators for plan
   and item field-level rules (Phase 3, Part 3 — not yet implemented).
"""

from app.modules.treatment.validators.procedure_validator import (
    ProcedureValidator,
)
from app.modules.treatment.validators.state_machine import (
    get_allowed_transitions,
    is_editable_state,
    is_terminal_state,
    validate_item_transition,
    validate_plan_transition,
)
from app.modules.treatment.validators.treatment_plan_validator import (
    TreatmentPlanValidator,
)

__all__ = [
    "get_allowed_transitions",
    "is_editable_state",
    "is_terminal_state",
    "ProcedureValidator",
    "TreatmentPlanValidator",
    "validate_item_transition",
    "validate_plan_transition",
]
