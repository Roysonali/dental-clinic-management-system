# Phase 5: API Design — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only endpoints required for Treatment Plan, Items, Versions, Approvals, and Procedures management.

---

## 1. Base Path & Versioning

```
http://localhost:8000/api/treatment-plans    # Treatment plans and sub-resources
http://localhost:8000/api/procedures          # Procedure catalog
```

The FastAPI router prefix is `/treatment-plans` with tag `["Treatment Plans"]` for plan/item/version/approval endpoints, and `/procedures` with tag `["Procedures"]` for procedure catalog endpoints.

**API Versioning:** DensCare follows implicit versioning — no version prefix in the URL (current version = v1). This module introduces no breaking changes to existing API contracts.

---

## 2. Authentication & Authorization

- **Authentication:** All endpoints require a valid JWT token via `Authorization: Bearer <token>`.
- **Authorization:** Endpoint-specific role requirements via `require_roles()` (see Phase 6).
- **Unauthenticated:** Returns 401.
- **Unauthorized:** Returns 403.

## 2.1 Standard Error Response Envelope

All errors follow the existing DensCare format:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "details": null
}
```

For validation errors (422), `details` contains the field-level error array from Pydantic. Domain-specific errors use the error codes defined in Phase 7.

**Status Code Rules:**
- `401` — Missing or invalid authentication token
- `403` — Authenticated but insufficient permissions (role or ownership)
- `404` — Resource not found
- `409` — Conflict (duplicate, state conflict, invalid transition)
- `422` — Validation error (schema validation, business rule violation)
- `500` — Unexpected server error

---

## 3. Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/treatment-plans` | Admin, Clinical roles | Create treatment plan |
| GET | `/treatment-plans` | All clinical roles | List/search treatment plans |
| GET | `/treatment-plans/{id}` | All clinical roles | Get treatment plan details |
| PATCH | `/treatment-plans/{id}` | Admin, Doctor (owner) | Update treatment plan |
| DELETE | `/treatment-plans/{id}` | Admin, Doctor (draft only) | Delete draft plan (hard) |
| PATCH | `/treatment-plans/{id}/status` | Admin, Doctor | Transition plan status |
| PATCH | `/treatment-plans/{id}/deactivate` | Admin | Deactivate plan |
| PATCH | `/treatment-plans/{id}/activate` | Admin | Reactivate plan |
| GET | `/treatment-plans/{id}/items` | All clinical roles | List items for a plan |
| POST | `/treatment-plans/{id}/items` | Admin, Doctor (owner) | Add item to plan |
| PATCH | `/treatment-plans/{id}/items/{item_id}` | Admin, Doctor (owner) | Update item |
| DELETE | `/treatment-plans/{id}/items/{item_id}` | Admin, Doctor (owner) | Remove item |
| PATCH | `/treatment-plans/{id}/items/{item_id}/status` | Admin, Doctor | Update item status |
| POST | `/treatment-plans/{id}/items/reorder` | Admin, Doctor (owner) | Reorder items |
| GET | `/treatment-plans/{id}/versions` | All clinical roles | List version history |
| GET | `/treatment-plans/{id}/versions/{v_id}` | All clinical roles | Get version details |
| GET | `/treatment-plans/{id}/approval` | All clinical roles | Get approval record |
| POST | `/treatment-plans/{id}/approval/doctor` | Admin, Doctor | Record doctor approval |
| POST | `/treatment-plans/{id}/approval/patient` | Admin, Doctor | Record patient acknowledgment |
| GET | `/procedures` | All authenticated | List procedures |
| POST | `/procedures` | Admin, Chief Doctor | Create procedure |
| PATCH | `/procedures/{id}` | Admin, Chief Doctor | Update procedure |

---

## 4. Endpoint Details

### 4.1 POST `/treatment-plans`

Create a new treatment plan.

**Request:**
```json
{
  "patient_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "doctor_id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
  "clinical_notes": "Patient presents with pain in #36",
  "observations": "Deep caries observed on #36, #46",
  "dentist_recommendations": "RCT #36, composite filling #46",
  "valid_from": "2026-07-15",
  "valid_to": "2026-10-15",
  "diagnosis_ids": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "plan_code": "TXN-00001",
  "patient_id": "...",
  "patient_name": "Juan Dela Cruz",
  "doctor_id": "...",
  "doctor_name": "Dr. Maria Santos",
  "clinical_notes": "...",
  "status": "draft",
  "current_version": 1,
  "items": [],
  "created_by": 1,
  "updated_by": null,
  "created_at": "2026-07-13T10:00:00Z",
  "updated_at": "2026-07-13T10:00:00Z"
}
```

**Error Responses:** 404 (patient/doctor not found), 409 (duplicate), 422 (validation).

### 4.2 GET `/treatment-plans`

List/search treatment plans with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `search` | string | No | — | Partial match on plan_code, patient name |
| `patient_id` | UUID | No | — | Filter by patient |
| `doctor_id` | UUID | No | — | Filter by doctor |
| `status` | string | No | — | Filter by status |
| `is_active` | boolean | No | — | Filter by active status |
| `date_from` | date | No | — | Plans created on or after |
| `date_to` | date | No | — | Plans created on or before |
| `page` | integer | No | 1 | Page number (1-based) |
| `page_size` | integer | No | 20 | Items per page (max 100) |
| `sort_by` | string | No | `created_at` | Sort field |
| `sort_order` | string | No | `desc` | `asc` or `desc` |

**Response (200):**
```json
{
  "items": [...],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

### 4.3 GET `/treatment-plans/{id}`

Get detailed treatment plan with items and approval status.

**Error Responses:** 404 (plan not found)

**Response (200):** `TreatmentPlanDetailResponse` — plan fields + items array + approval record.

### 4.4 PATCH `/treatment-plans/{id}`

Partial update. Field-level authorization applies.

**Request:** Only provided fields are updated.
```json
{
  "clinical_notes": "Updated notes",
  "valid_to": "2026-12-15"
}
```

**Response (200):** Full `TreatmentPlanResponse`.

### 4.5 DELETE `/treatment-plans/{id}`

Hard delete only allowed for Draft plans. Accepted or later plans return 409.

**Response (204):** No content on success.

**Error Responses:** 409 (plan is not in Draft status).

### 4.6 PATCH `/treatment-plans/{id}/status`

Transition plan status with guarded state machine.

**Request:**
```json
{
  "status": "under_review"
}
```

**Response (200):** Full `TreatmentPlanResponse` with updated status.

**Error Responses:** 409 (invalid transition — see Phase 4 §1.2 transition table), 422 (business condition not met).

### 4.7 Treatment Plan Item Endpoints

| Method | Path | Request Body | Response | Error |
|---|---|---|---|---|
| GET | `/treatment-plans/{id}/items` | — | `list[ItemResponse]` | 404 (plan not found) |
| POST | `/treatment-plans/{id}/items` | `ItemCreate` | `ItemResponse` | 404, 409 (duplicate sequence), 422 |
| PATCH | `/treatment-plans/{id}/items/{item_id}` | `ItemUpdate` | `ItemResponse` | 404, 422 |
| DELETE | `/treatment-plans/{id}/items/{item_id}` | — | 204 | 404 |
| PATCH | `/treatment-plans/{id}/items/{item_id}/status` | `ItemStatusUpdate` | `ItemResponse` | 404, 409 |
| POST | `/treatment-plans/{id}/items/reorder` | `ReorderRequest` | `list[ItemResponse]` | 404, 422 |

**ItemCreate Request:**
```json
{
  "procedure_id": 14,
  "sequence_number": 1,
  "tooth_number": 36,
  "tooth_surface": "O",
  "estimated_cost": 7000.00,
  "discount": 0,
  "notes": "Upper right first molar"
}
```

### 4.8 Version Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| GET | `/treatment-plans/{id}/versions` | List all versions | `list[VersionSummaryResponse]` |
| GET | `/treatment-plans/{id}/versions/{version_id}` | Get full version with snapshot | `VersionDetailResponse` |

### 4.9 Approval Endpoints

| Method | Path | Request Body | Description |
|---|---|---|---|
| GET | `/treatment-plans/{id}/approval` | — | Get approval record |
| POST | `/treatment-plans/{id}/approval/doctor` | `DoctorApprovalRequest` | Record doctor approval |
| POST | `/treatment-plans/{id}/approval/patient` | `PatientAcknowledgmentRequest` | Record patient acknowledgment |

**DoctorApprovalRequest:**
```json
{
  "approval_notes": "Plan approved. Patient informed of costs and timeline."
}
```

**PatientAcknowledgmentRequest:**
```json
{
  "patient_status": "accepted",
  "approval_notes": "Patient reviewed and accepted the treatment plan."
}
```

### 4.10 Procedure Endpoints

| Method | Path | Request Body | Response | Error |
|---|---|---|---|---|
| GET | `/procedures` | — | `list[ProcedureResponse]` | — |
| POST | `/procedures` | `ProcedureCreate` | `ProcedureResponse` | 409 (duplicate code), 422 |
| PATCH | `/procedures/{id}` | `ProcedureUpdate` | `ProcedureResponse` | 404, 409 |

---

## 5. Request/Response Schemas

All request schemas use `ConfigDict(extra="forbid")` to reject unknown fields. All response schemas use `ConfigDict(from_attributes=True)`.

### 5.1 Request Schemas

| Schema | Method | Fields |
|---|---|---|
| `TreatmentPlanCreate` | POST /treatment-plans | patient_id, doctor_id, clinical_notes?, observations?, dentist_recommendations?, valid_from?, valid_to?, diagnosis_ids? |
| `TreatmentPlanUpdate` | PATCH /treatment-plans/{id} | All optional |
| `PlanStatusUpdate` | PATCH .../status | status |
| `ItemCreate` | POST .../items | procedure_id, sequence_number, tooth_number?, tooth_surface?, quadrant?, arch?, estimated_cost?, discount?, notes?, appointment_id?, diagnosis_id? |
| `ItemUpdate` | PATCH .../items/{item_id} | All optional |
| `ItemStatusUpdate` | PATCH .../items/{item_id}/status | item_status |
| `ReorderRequest` | POST .../items/reorder | item_ids: [uuid] (ordered list) |
| `DoctorApprovalRequest` | POST .../approval/doctor | approval_notes? |
| `PatientAcknowledgmentRequest` | POST .../approval/patient | patient_status, approval_notes? |
| `ProcedureCreate` | POST /procedures | code, name, description?, default_cost?, category |
| `ProcedureUpdate` | PATCH /procedures/{id} | All optional |

### 5.2 Response Schemas

| Schema | Description |
|---|---|
| `TreatmentPlanResponse` | Plan details with items count, no nested items |
| `TreatmentPlanDetailResponse` | Plan with nested items array and approval record |
| `TreatmentPlanListResponse` | `{items: TreatmentPlanListItem[], total, page, page_size}` |
| `TreatmentPlanListItem` | Summary for list views (plan_code, patient_name, doctor_name, status, created_at) |
| `ItemResponse` | Full item with procedure name and code |
| `VersionSummaryResponse` | Version metadata (version_number, change_reason, changed_by, created_at) |
| `VersionDetailResponse` | Version with items_snapshot |
| `ApprovalResponse` | Approval record with doctor and patient status |
| `ProcedureResponse` | Procedure with all fields |

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md) (requirements), [02-domain-analysis.md](02-domain-analysis.md) (entities) |
| **Related** | [15-mappers-schemas.md](15-mappers-schemas.md), [16-router-design.md](16-router-design.md) |
| **Depends On** | [04-workflows-state-machines.md](04-workflows-state-machines.md) (status transitions), [06-security-rbac.md](06-security-rbac.md) (auth) |
| **Used By** | [16-router-design.md](16-router-design.md), [17-testing-strategy.md](17-testing-strategy.md) |
| **Next Reading** | [06-security-rbac.md](06-security-rbac.md) |
