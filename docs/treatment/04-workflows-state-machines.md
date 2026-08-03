# Phase 4: Workflows & State Machines — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only workflows and state machines for Treatment Plan management.

---

## 1. Treatment Plan State Machine

### 1.1 State Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft: Plan created (initial state)

    Draft --> UnderReview: Doctor submits for review
    Draft --> Cancelled: Doctor cancels draft

    UnderReview --> Proposed: Doctor finalizes and proposes to patient
    UnderReview --> Draft: Doctor revises (returns to draft)
    UnderReview --> Cancelled: Doctor cancels during review

    Proposed --> Accepted: Patient acknowledges acceptance
    Proposed --> Draft: Doctor revises after patient feedback
    Proposed --> Rejected: Patient rejects plan
    Proposed --> Cancelled: Doctor cancels proposed plan

    Rejected --> Draft: Doctor revises based on rejection feedback
    Rejected --> Cancelled: No further action

    Accepted --> InProgress: Treatment commences
    Accepted --> Cancelled: Plan cancelled before treatment starts

    InProgress --> OnHold: Temporary pause (financial, medical, patient request)
    InProgress --> Completed: All items marked completed
    InProgress --> Cancelled: Plan abandoned mid-treatment

    OnHold --> InProgress: Resume treatment
    OnHold --> Cancelled: Plan cancelled from hold
    OnHold --> Completed: Items completed before hold ended

    Completed --> Cancelled: Not applicable
    Completed --> [*]: Plan complete

    Cancelled --> [*]: Terminal state
    Cancelled --> Draft: Cannot reopen (new plan required)
```

### 1.2 Transition Table

| From | To | Trigger | Authorization | Business Condition |
|---|---|---|---|---|
| Draft | UnderReview | Submit for review | Doctor (owner) | Plan must have ≥1 item |
| Draft | Cancelled | Cancel draft | Doctor (owner) | Always allowed |
| UnderReview | Proposed | Finalize & propose | Doctor (owner) | All items valid |
| UnderReview | Draft | Return to draft | Doctor (owner) | Always allowed |
| UnderReview | Cancelled | Cancel | Doctor (owner) | Always allowed |
| Proposed | Accepted | Patient accepts | Patient (via doctor) | Patient acknowledgment recorded |
| Proposed | Draft | Revise | Doctor | Always allowed |
| Proposed | Rejected | Patient rejects | Patient (via doctor) | Patient acknowledgment recorded |
| Proposed | Cancelled | Cancel | Doctor | Always allowed |
| Rejected | Draft | Revise | Doctor | Always allowed |
| Rejected | Cancelled | Cancel | Doctor | Always allowed |
| Accepted | InProgress | Start treatment | Doctor | Plan has ≥1 pending item |
| Accepted | Cancelled | Cancel | Doctor | Always allowed |
| InProgress | OnHold | Pause treatment | Doctor | At least 1 item in progress |
| InProgress | Completed | Complete all | Doctor | All items completed or cancelled |
| InProgress | Cancelled | Cancel | Doctor | Always allowed |
| OnHold | InProgress | Resume | Doctor | Always allowed |
| OnHold | Cancelled | Cancel | Doctor | Always allowed |
| OnHold | Completed | Complete | Doctor | All items in terminal state |

### 1.3 Invalid Transitions (Rejected)

| From | To | Reason |
|---|---|---|
| Draft | Accepted | Cannot skip review and proposal |
| Draft | InProgress | Cannot start treatment without acceptance |
| Proposed | InProgress | Must be accepted first |
| Rejected | Accepted | Must go back to draft and repropose |
| Completed | Any | Terminal state |
| Cancelled | Any | Terminal state |

---

## 2. Treatment Plan Item State Machine

### 2.1 State Diagram

```mermaid
stateDiagram-v2
    [*] --> Pending: Item added to plan

    Pending --> InProgress: Work started on procedure
    Pending --> Cancelled: Cancelled before work starts
    Pending --> Deferred: Postponed to later date

    InProgress --> Completed: Procedure finished
    InProgress --> Cancelled: Cancelled during work
    InProgress --> Deferred: Work paused, postponed

    Completed --> [*]: Terminal state
    Cancelled --> [*]: Terminal state
    Deferred --> Pending: Re-scheduled to active status
    Deferred --> Cancelled: Cancelled from deferred
```

### 2.2 Item Transition Table

| From | To | Trigger | Condition |
|---|---|---|---|
| Pending | InProgress | Start procedure | Plan is InProgress or OnHold |
| Pending | Cancelled | Cancel item | Always allowed |
| Pending | Deferred | Defer | Always allowed |
| InProgress | Completed | Mark complete | Procedure performed |
| InProgress | Cancelled | Cancel | Always allowed |
| InProgress | Deferred | Defer | Always allowed |
| Deferred | Pending | Reactivate | Always allowed |
| Deferred | Cancelled | Cancel | Always allowed |

---

## 3. Business Workflows

### 3.1 Treatment Plan Creation Workflow

```mermaid
sequenceDiagram
    participant Doctor
    participant Service
    participant Validator
    participant Repository
    participant DB

    Doctor->>Service: create_plan(patient_id, doctor_id, notes)
    Service->>Validator: validate_patient_exists(patient_id)
    Service->>Validator: validate_doctor_exists(doctor_id)
    Validator-->>Service: valid
    Service->>Service: generate_plan_code()
    Service->>Repository: create(treatment_plan)
    Repository->>DB: INSERT treatment_plans
    DB-->>Repository: plan row
    Service-->>Doctor: TreatmentPlanResponse (status=draft)
```

### 3.2 Adding Items to Plan

```mermaid
sequenceDiagram
    participant Doctor
    participant Service
    participant Validator
    participant Repository
    participant DB

    Doctor->>Service: add_item(plan_id, procedure_id, tooth, cost, sequence)
    Service->>Validator: validate_plan_editable(plan_id)
    Service->>Validator: validate_procedure_exists(procedure_id)
    Service->>Validator: validate_tooth_number(tooth_number)
    Service->>Validator: validate_sequence_unique(plan_id, sequence)
    Validator-->>Service: valid
    Service->>Repository: create_item(item)
    Repository->>DB: INSERT treatment_plan_items
    Service-->>Doctor: ItemResponse
```

### 3.3 Plan Status Transition Workflow

```mermaid
sequenceDiagram
    participant Doctor
    participant Service
    participant StateMachine
    participant Repository
    participant DB

    Doctor->>Service: transition_status(plan_id, to_status)
    Service->>StateMachine: validate_transition(current_status, to_status)
    StateMachine-->>Service: valid/invalid

    alt Valid Transition
        Service->>Service: check_business_conditions(to_status)
        Service->>Repository: update_status(plan_id, to_status)
        Repository->>DB: UPDATE treatment_plans
        Service-->>Doctor: Updated PlanResponse
    else Invalid Transition
        Service-->>Doctor: InvalidTransitionError
    end
```

### 3.4 Version Creation on Modification (Post-Acceptance)

```mermaid
sequenceDiagram
    participant Doctor
    participant Service
    participant Repository
    participant DB

    Doctor->>Service: add_item(plan_id, procedure_id, ...)
    Service->>Repository: get_plan(plan_id)

    alt Plan is Draft/UnderReview/Proposed
        Service->>Repository: create_item(item) - direct edit
    else Plan is Accepted/InProgress/OnHold
        Service->>Repository: create_version_snapshot(plan_id, reason, user)
        Repository->>DB: INSERT version (snapshot of current items)
        Service->>Repository: increment plan version
        Repository->>DB: UPDATE plan current_version
        Service->>Repository: create_item(item) - on new version
    end

    Service-->>Doctor: ItemResponse
```

### 3.5 Approval and Patient Acknowledgment Workflow

```mermaid
sequenceDiagram
    participant Doctor
    participant Service
    participant Patient
    participant Repository
    participant DB

    Note over Doctor,Patient: Doctor approves plan first
    Doctor->>Service: approve_plan(plan_id)
    Service->>Repository: record_approval(plan_id, doctor_id)
    Repository->>DB: INSERT/UPDATE treatment_plan_approvals
    Service-->>Doctor: Approval recorded

    Note over Patient,Service: Patient reviews and acknowledges
    Patient->>Service: acknowledge_plan(plan_id, accepted=true)
    Service->>Validator: validate_plan_is_proposed(plan_id)
    Service->>Repository: record_acknowledgment(plan_id, accepted)
    Repository->>DB: UPDATE approval patient_status
    alt Accepted
        Service->>Repository: transition_status(plan_id, accepted)
        Repository->>DB: UPDATE plan status
    end
    Service-->>Patient: Acknowledgment recorded
```

---

## 4. Recovery Paths

| Scenario | Recovery | Automation |
|---|---|---|
| Plan stuck in Draft (doctor left) | Admin reassigns or cancels | Manual |
| Version creation fails during item modification | Rollback entire transaction; no partial state | Automatic (transaction) |
| Patient acknowledgment DB write fails | Rollback; status stays at Proposed | Automatic (transaction) |
| Item accidentally marked Completed | Doctor can revert to InProgress or Pending | Manual (via PATCH) |
| Concurrent modification of accepted plan | Last writer wins; version created per transaction | Automatic |

---

## 5. Edge Cases

| # | Edge Case | Handling |
|---|---|---|
| EC-1 | Patient acknowledges plan, then requests changes | Revert to Proposed → Doctor revises → New proposal |
| EC-2 | All items cancelled in InProgress plan | Auto-transition plan to Cancelled if no items remain active |
| EC-3 | Adding items to fully completed plan | Create new version, reopen plan to InProgress |
| EC-4 | Deleting the only item in a Draft plan | Allowed; plan remains in Draft but cannot transition |
| EC-5 | Invalid tooth number (e.g., 99) | Rejected by validator + DB CHECK constraint |
| EC-6 | Discount exceeds estimated cost | Allowed (zero-cost item) — clinic may offer complementary procedures |
| EC-7 | Plan created with valid_from after valid_to | Rejected by validator + DB CHECK |
| EC-8 | Doctor tries to modify another doctor's plan | Authorized roles (Admin, Chief Doctor) can modify any plan |

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [02-domain-analysis.md](02-domain-analysis.md) (entity lifecycle), [08-enums-constants.md](08-enums-constants.md) |
| **Related** | [07-validation-rules.md](07-validation-rules.md) (state transition rules), [ADR-003-state-machine.md](adr/ADR-003-state-machine.md) |
| **Depends On** | State machine configuration from [08-enums-constants.md](08-enums-constants.md) §2.6 |
| **Used By** | [14-service-design.md](14-service-design.md), [05-api-design.md](05-api-design.md) |
| **Next Reading** | [05-api-design.md](05-api-design.md) |
