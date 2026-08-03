# ADR-003: Treatment Plan State Machine

| Field | Value |
|---|---|
| **ADR ID** | ADR-003 |
| **Status** | Accepted |
| **Date** | 2026-07-13 |
| **Module** | Treatment Plan |
| **Deciders** | Engineering Team |

---

## Context

Treatment plans move through a defined lifecycle: from initial creation through review, patient proposal, acceptance, treatment execution, and eventual completion or cancellation. Allowing arbitrary status changes would enable invalid transitions (e.g., skipping directly from Draft to Completed) and corrupt the clinical workflow.

## Problem

How should treatment plan status transitions be controlled to prevent invalid state mutations while remaining flexible enough to handle real-world clinical scenarios?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Config-driven state machine** | A dictionary mapping `from_state → {allowed_to_states}` defines all valid transitions. The service consults this map before every status change. | Explicit; testable; easy to audit; simple to extend | Requires code deployment for new transitions |
| **B: Enum-based state transitions** | Each enum value has methods defining allowed next states | Encapsulated; type-safe | Scattered logic; harder to audit; can't be easily queried by UI |
| **C: Workflow engine (e.g., Camunda, Temporal)** | External workflow engine manages state transitions | Visual modeling; BPMN standard; monitoring | Over-engineered for this use case; operational complexity; external dependency |
| **D: Free-form status (no enforcement)** | Status is a string field with no transition validation | Maximum flexibility | Impossible to guarantee data integrity; invalid states corrupt reporting |

## Decision

**Option A: Config-driven state machine.**

## Rationale

- **Single source of truth:** The transition table is defined once in `constants.py` and is the authoritative reference for all valid transitions. Any code path that changes status must go through the same validation function.
- **UI-ready:** The transition table can be exposed via API so the frontend can render only valid next-status buttons, providing a seamless user experience.
- **Testable:** The transition table and its validator function can be tested exhaustively with a single parameterized test covering every `(from, to)` pair — approximately 72 combinations.
- **Auditable:** Every attempted transition (valid or invalid) is logged with the current state, requested state, user, and result.

## Consequences

### Positive
- Explicit, auditable state machine
- UI can query valid transitions dynamically
- New statuses can be added by updating one dictionary
- Exhaustive testing is trivial (one test covers all transitions)

### Negative
- Transition logic is externalized from the enum (mitigated by keeping the dictionary adjacent to the enum definition)
- Code deployment required for new statuses (acceptable — status changes are rare, intentional events)

## Transition Table

```
Draft → UnderReview, Cancelled
UnderReview → Proposed, Draft, Cancelled
Proposed → Accepted, Draft, Cancelled, Rejected
Rejected → Draft, Cancelled
Accepted → InProgress, Cancelled
InProgress → OnHold, Completed, Cancelled
OnHold → InProgress, Completed, Cancelled
Completed → (terminal)
Cancelled → (terminal)
```

### Guard Conditions

| Transition | Condition |
|---|---|
| Draft → UnderReview | Plan must have ≥ 1 item |
| Accepted → InProgress | Plan must have ≥ 1 pending item |
| InProgress → Completed | All items must be in terminal state (Completed or Cancelled) |
| Proposed → Accepted | Patient must have acknowledged acceptance |

## Alternatives Rejected

**Option B (Enum-based)** was rejected because the transition logic would be scattered across enum methods, making it impossible to audit all transitions in one place or expose them via API.

**Option C (Workflow engine)** was rejected as over-engineering. The state machine has 8 states and approximately 17 valid transitions — well within the capabilities of a config-driven approach.

**Option D (Free-form status)** was rejected because it provides no data integrity guarantees. Invalid plan states would corrupt reporting, billing, and clinical workflows.

## Future Considerations

If the state machine grows to 15+ states with conditional guard logic, consider extracting it into a dedicated `StateMachineService` class. For the MVP, a config dictionary + validator function is sufficient.

## Related ADRs

- ADR-001 (Aggregate Root) — status is a property of the aggregate root
- ADR-002 (Versioning Strategy) — version creation is triggered by status transitions
