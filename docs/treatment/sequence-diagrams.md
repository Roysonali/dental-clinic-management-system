# Sequence Diagrams — Treatment Plan Module

> **Purpose:** Complete request flow diagrams showing how every major operation traverses the layered architecture.

---

## 1. Create Treatment Plan

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: POST /treatment-plans\n{patient_id, doctor_id, notes}
    Router->>Router: Authenticate via get_current_user()
    Router->>Router: Authorize via require_roles(DOCTOR_ROLES)
    Router->>Service: create_plan(payload, created_by)

    Service->>Service: generate_plan_code("TXN-{seq:06d}")
    Service->>Validator: validate_patient_exists(patient_id)
    Validator-->>Service: ✓ patient exists
    Service->>Validator: validate_doctor_exists(doctor_id)
    Validator-->>Service: ✓ doctor exists
    Service->>Validator: validate_date_range(valid_from, valid_to)
    Validator-->>Service: ✓ valid dates

    Service->>Repository: create(TreatmentPlan)
    Repository->>DB: INSERT INTO treatment_plans\n(id, plan_code, patient_id, doctor_id, status)
    DB-->>Repository: ✓ plan created
    Repository-->>Service: TreatmentPlan ORM

    Service->>Service: set created_by, created_at
    Service->>Service: Build response via TreatmentPlanMapper.to_response()
    Service-->>Router: TreatmentPlanResponse
    Router-->>Client: 201 Created\n{plan_code: "TXN-00001", status: "draft"}
```

---

## 2. Update Treatment Plan

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: PATCH /treatment-plans/{plan_id}\n{clinical_notes: "..."}
    Router->>Router: Authenticate + Authorize
    Router->>Router: plan_owner_or_admin(plan_id)
    Router->>Service: update_plan(plan_id, payload, updated_by)

    Service->>Repository: get_by_id(plan_id)
    Repository->>DB: SELECT FROM treatment_plans WHERE id = ?
    DB-->>Repository: TreatmentPlan ORM
    Repository-->>Service: TreatmentPlan ORM

    Service->>Validator: validate_date_range(valid_from, valid_to)
    Validator-->>Service: ✓ valid dates

    Service->>Repository: update(plan, updates, updated_by)
    Repository->>DB: UPDATE treatment_plans\nSET clinical_notes = ?, updated_at = NOW()
    DB-->>Repository: ✓ updated

    Service-->>Router: TreatmentPlanResponse (mapper)
    Router-->>Client: 200 OK\n{...updated fields}
```

---

## 3. Approve Treatment Plan (Doctor + Patient)

```mermaid
sequenceDiagram
    participant Doctor as Doctor (UI)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Note over Doctor,DB: Step 1: Doctor Approval
    Doctor->>Router: POST /treatment-plans/{id}/approval/doctor\n{approval_notes}
    Router->>Service: record_doctor_approval(plan_id, payload, approved_by)

    Service->>Repository: get_by_id(plan_id)
    Repository-->>Service: TreatmentPlan (status: proposed)

    Service->>Validator: validate_plan_is_proposed("proposed")
    Validator-->>Service: ✓ proposed

    Service->>Repository: get_by_plan(plan_id) [approval]
    Repository-->>Service: existing approval or None

    alt No existing approval
        Service->>Repository: create(TreatmentPlanApproval)
        Repository->>DB: INSERT INTO treatment_plan_approvals
    else Existing approval without doctor
        Service->>Repository: update(approval, {approved_by, approved_at})
        Repository->>DB: UPDATE treatment_plan_approvals
    end

    Service-->>Router: ApprovalResponse

    Note over Doctor,DB: Step 2: Patient Acknowledgment
    Doctor->>Router: POST /treatment-plans/{id}/approval/patient\n{patient_status: "accepted"}
    Router->>Service: record_patient_acknowledgment(plan_id, payload)

    Service->>Validator: validate_acknowledgment_status("accepted")
    Validator-->>Service: ✓ accepted
    Service->>Validator: validate_plan_is_proposed(plan_id)
    Validator-->>Service: ✓ proposed

    Service->>Repository: update(approval, {patient_status, acknowledged_at})
    Repository->>DB: UPDATE treatment_plan_approvals\nSET patient_status = "accepted"

    Service->>Repository: update_status(plan_id, "accepted", updated_by)
    Repository->>DB: UPDATE treatment_plans\nSET status = "accepted"

    Service-->>Router: ApprovalResponse (updated)
    Router-->>Client: 201 Created\n{patient_status: "accepted", plan_auto_transitioned: true}
```

---

## 4. Cancel Treatment Plan

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: PATCH /treatment-plans/{plan_id}/status\n{status: "cancelled"}
    Router->>Router: plan_owner_or_admin(plan_id)
    Router->>Service: transition_status(plan_id, "cancelled", updated_by)

    Service->>Repository: get_by_id(plan_id)
    Repository-->>Service: TreatmentPlan (status: in_progress)

    Service->>Validator: validate_status_transition("in_progress", "cancelled")
    Validator->>Validator: lookup VALID_PLAN_TRANSITIONS["in_progress"]
    Validator-->>Service: ✓ {"on_hold", "completed", "cancelled"}
    Service->>Validator: validate_plan_cancellable("in_progress")
    Validator-->>Service: ✓ cancellable

    Service->>Repository: update_status(plan_id, "cancelled", updated_by)
    Repository->>DB: UPDATE treatment_plans\nSET status = "cancelled", updated_at = NOW()

    Service-->>Router: TreatmentPlanResponse (status: cancelled)
    Router-->>Client: 200 OK\n{status: "cancelled"}
```

---

## 5. Complete Procedure (Item Status Update)

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: PATCH /treatment-plans/{plan_id}/items/{item_id}/status\n{item_status: "completed"}

    Router->>Router: require_doctor_or_admin(plan_id)
    Router->>Service: update_item_status(plan_id, item_id, payload)

    Service->>Repository: get_by_id(item_id) [item]
    Repository-->>Service: TreatmentPlanItem (status: in_progress)

    Service->>Validator: validate_item_status_transition("in_progress", "completed")
    Validator-->>Service: ✓ {"completed", "cancelled", "deferred"}

    Service->>Repository: update_status(item_id, "completed")
    Repository->>DB: UPDATE treatment_plan_items\nSET item_status = "completed"

    alt All items now terminal
        Service->>Repository: count_active_items_by_status(plan_id, "pending")
        Repository-->>Service: 0
        Service->>Repository: count_active_items_by_status(plan_id, "in_progress")
        Repository-->>Service: 0
        Service->>Repository: update_status(plan_id, "completed")
        Repository->>DB: UPDATE treatment_plans SET status = "completed"
    end

    Service-->>Router: ItemResponse (item_status: completed)
    Router-->>Client: 200 OK\n{item_status: "completed"}
```

---

## 6. Create New Version (Post-Acceptance Modification)

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Validator as Validator
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: POST /treatment-plans/{plan_id}/items\n{procedure_id, sequence_number, ...}

    Router->>Router: plan_owner_or_admin(plan_id)
    Router->>Service: add_item(plan_id, payload, current_user)

    Service->>Repository: get_by_id(plan_id)
    Repository-->>Service: TreatmentPlan (status: in_progress, version: 2)

    alt Plan is draft/under_review/proposed
        Service->>Repository: create_item(item) [direct edit]
        Repository->>DB: INSERT INTO treatment_plan_items
    else Plan is accepted/in_progress/on_hold
        Note over Service: Versioning triggered!
        Service->>Repository: get_by_plan(plan_id) [items]
        Repository-->>Service: list[TreatmentPlanItem]

        Service->>Service: serialize items to JSON dict
        Service->>Repository: create(TreatmentPlanVersion)
        Repository->>DB: INSERT INTO treatment_plan_versions\n(plan_id, version_number=3, items_snapshot=[...])

        Service->>Repository: increment_version(plan_id)
        Repository->>DB: UPDATE treatment_plans\nSET current_version = 3

        Service->>Repository: create_item(item) [new version context]
        Repository->>DB: INSERT INTO treatment_plan_items
    end

    Service-->>Router: ItemResponse
    Router-->>Client: 201 Created\n{item_id, ...}
    Note over Router: Response does not expose version details explicitly\n(frontend refreshes version list separately)
```

---

## 7. View Treatment Plan (Detail)

```mermaid
sequenceDiagram
    participant Client as Client (UI/API)
    participant Router as Router Layer
    participant Service as Service Layer
    participant Repository as Repository Layer
    participant DB as PostgreSQL

    Client->>Router: GET /treatment-plans/{plan_id}

    Router->>Router: require_clinical_role()
    Router->>Service: get_plan(plan_id)

    Service->>Repository: get_by_id(plan_id)
    Repository->>Repository: load plan + items (selectinload)
    Repository->>Repository: load plan + approval (selectinload)
    Repository->>DB: SELECT FROM treatment_plans\nJOIN items ON items.plan_id = plans.id\nLEFT JOIN approval ON approval.plan_id = plans.id
    DB-->>Repository: TreatmentPlan + items[] + approval?

    alt Plan not found
        Repository-->>Service: None
        Service-->>Service: raise PlanNotFound(plan_id)
        Service-->>Router: PlanNotFound exception
        Router-->>Client: 404 Not Found\n{"code": "PLAN_NOT_FOUND"}
    else Plan found
        Repository-->>Service: TreatmentPlan ORM (fully loaded)

        Service->>Service: TreatmentPlanMapper.to_detail_response(plan)
        Service->>Service: ↳ build_patient_name(plan) via plan.patient
        Service->>Service: ↳ build_doctor_name(plan) via plan.doctor.user
        Service->>Service: ↳ ItemMapper.to_response(item) for each item
        Service->>Service: ↳ ApprovalMapper.to_response(approval) if exists

        Service-->>Router: TreatmentPlanDetailResponse
        Router-->>Client: 200 OK\n{plan: {...}, items: [...], approval: {...}}
    end
```

---

## Request Flow Legend

```
Every request follows this path:
  Client → Router (Auth + RBAC) → Service (TX mgmt) → Validator → Repository → Database
```

| Layer | Responsibility |
|---|---|
| **Client** | HTTP request with JWT in Authorization header |
| **Router** | Authenticate (get_current_user), Authorize (require_roles), map exceptions to HTTP |
| **Service** | Transaction boundaries (commit/rollback), business logic, audit fields, coordinator |
| **Validator** | Pure function checks — returns None or raises ValueError/domain exception |
| **Repository** | ORM queries, pagination, filters — no business logic |
| **Database** | PostgreSQL — constraints, indexes, FK enforcement |
