# Phase 6: API Design — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only endpoints required for Doctor Profile, Specializations, and Schedule management.

---

## 1. Base Path & Versioning

Doctor profile and schedule endpoints are prefixed with `/doctors`. Specialization management endpoints are prefixed with `/specializations` (separate resource, separate router):

```
http://localhost:8000/api/doctors    # Doctor profiles and schedules
http://localhost:8000/api/specializations  # Specialization management
```

The FastAPI router prefix is `/doctors` with tag `["Doctors"]` for profile/schedule endpoints, and `/specializations` with tag `["Specializations"]` for specialization management.

**API Versioning:** DensCare follows implicit versioning — no version prefix in the URL (current version = v1). Breaking changes introduce a path prefix (`/api/v2`) per the existing project convention. This module introduces no breaking changes to existing API contracts.

---

## 2. Authentication & Authorization

- **Authentication:** All endpoints require a valid JWT token via `Authorization: Bearer <token>`.
- **Authorization:** Endpoint-specific role requirements via `require_roles()` (see Phase 7).
- **Unauthenticated:** Returns 401.
- **Unauthorized:** Returns 403.

## 2.1 Standard Error Response Envelope

All errors follow the existing DensCare format (see `app/core/exception_handlers.py`):

```json
{
  "success": false,
  "message": "Human-readable error description",
  "details": null
}
```

For validation errors (422), `details` contains the field-level error array from Pydantic. Domain-specific errors use the error codes defined in Phase 5 §1.

**Status Code Rules:**
- `401` — Missing or invalid authentication token
- `403` — Authenticated but insufficient permissions (role or ownership)
- `404` — Resource not found
- `409` — Conflict (duplicate, state conflict, schedule overlap)
- `422` — Validation error (schema validation, business rule violation, idempotent state transition)
- `500` — Unexpected server error

**Cross Reference:** Phase 5 §1 (Error Codes), `app/core/exception_handlers.py`

---

## 3. Endpoint Summary

Each endpoint follows the existing DensCare FastAPI decorator pattern with `summary`, `description`, and `response_description` (see `patients/routes.py`, `appointments/router.py`).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/doctors` | Admin, Chief Doctor | Create doctor profile |
| GET | `/doctors` | All clinical roles | List/search doctors |
| GET | `/doctors/{id}` | All clinical roles | Get doctor details |
| PATCH | `/doctors/{id}` | Admin, Chief Doctor; Doctor (self, limited fields) | Update doctor profile |
| PATCH | `/doctors/{id}/deactivate` | Admin, Chief Doctor | Deactivate doctor |
| PATCH | `/doctors/{id}/activate` | Admin, Chief Doctor | Reactivate doctor |
| PATCH | `/doctors/{id}/availability` | Admin, Doctor (self) | Toggle `available_for_appointment` |
| PATCH | `/doctors/{id}/leave-toggle` | Admin, Doctor (self) | Toggle `on_leave` flag |
| GET | `/doctors/{id}/profile` | Doctor (self), Admin | Get own detailed profile |
| GET | `/doctors/{id}/availability` | All clinical roles | Check doctor availability |
| GET | `/specializations` | All authenticated | List specializations |
| POST | `/specializations` | Admin, Chief Doctor | Create specialization |

> **Note:** The `/specializations` endpoints are on a separate router (prefix `/specializations`), while doctor-specific specialization assignment endpoints (`/doctors/{id}/specializations`) remain on the doctors router.
| GET | `/doctors/{id}/specializations` | All authenticated | Get doctor specializations |
| POST | `/doctors/{id}/specializations` | Admin, Chief Doctor | Assign specialization |
| DELETE | `/doctors/{id}/specializations/{sid}` | Admin, Chief Doctor | Remove specialization |
| PUT | `/doctors/{id}/specializations/primary/{sid}` | Admin, Chief Doctor | Set primary specialization |
| GET | `/doctors/{id}/schedules` | Admin, Doctor (self) | Get schedule templates |
| POST | `/doctors/{id}/schedules` | Admin, Doctor (self) | Create schedule entry |
| DELETE | `/doctors/{id}/schedules/{sid}` | Admin, Doctor (self) | Delete schedule entry |
| PATCH | `/doctors/{id}/schedules/{sid}` | Admin, Doctor (self) | Update schedule entry |

---

## 4. Endpoint Details

### 4.1 POST `/doctors`

Create a new doctor profile. Identity data (full_name, email) is owned by the linked User record — not duplicated here.

**Request:**
```json
{
  "user_id": 1,
  "date_of_birth": "1985-06-15",
  "gender": "male",
  "primary_phone": "+639171234567",
  "address": "123 Rizal St., Manila",
  "qualification": "DMD, University of the Philippines",
  "registration_number": "DEN-2020-12345",
  "years_of_experience": 10,
  "consultation_fee": 800.00,
  "consultation_duration": 30,
  "languages_known": ["Filipino", "English"],
  "profile_photo_url": null,
  "biography": "Experienced general dentist",
  "emergency_contact_name": "Maria Dela Cruz",
  "emergency_contact_phone": "+639177654321"
}
```

**Response (201):**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "doctor_code": "DOC-00001",
  "user_id": 1,
  "user_full_name": "Juan Dela Cruz",
  "user_email": "juan@example.com",
  "gender": "male",
  "date_of_birth": "1985-06-15",
  "primary_phone": "+639171234567",
  "address": "123 Rizal St., Manila",
  "qualification": "DMD, University of the Philippines",
  "registration_number": "DEN-2020-12345",
  "years_of_experience": 10,
  "consultation_fee": 800.00,
  "consultation_duration": 30,
  "languages_known": ["Filipino", "English"],
  "profile_photo_url": null,
  "biography": "Experienced general dentist",
  "emergency_contact_name": "Maria Dela Cruz",
  "emergency_contact_phone": "+639177654321",
  "available_for_appointment": true,
  "on_leave": false,
  "is_active": true,
  "specializations": [],
  "created_by": 1,
  "updated_by": null,
  "created_at": "2026-07-07T10:00:00Z",
  "updated_at": "2026-07-07T10:00:00Z"
}
```

**Error Responses:** 404 (user not found), 409 (duplicate), 422 (validation). This endpoint is NOT idempotent — a second POST with the same data creates a duplicate error (409).

### 4.2 GET `/doctors`

List doctors with search, filter, pagination, and sorting.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `search` | string | No | — | Partial match on doctor code or User full_name |
| `specialization_id` | integer | No | — | Filter by specialization |
| `is_active` | boolean | No | — | Filter by active status |
| `available` | boolean | No | — | Filter by availability |
| `page` | integer | No | 1 | Page number (1-based) |
| `page_size` | integer | No | 20 | Items per page (max 100) |
| `sort_by` | string | No | `full_name` | Sort field (supports: `full_name`, `years_of_experience`) |
| `sort_order` | string | No | `asc` | `asc` or `desc` |

**Note:** Name search queries the `users.full_name` column via the User join — names are on User, not DoctorProfile. `sort_by=full_name` resolves through the User relationship. Invalid `sort_by` values return 422.

**Response (200):**
```json
{
  "items": [...],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

### 4.3 GET `/doctors/{id}`

Get detailed doctor profile by ID.

**Error Responses:** 404 (doctor not found)

**Response (200):**
```json
{
  "id": "3fa85f64-...",
  "doctor_code": "DOC-00001",
  "user_id": 1,
  "user_full_name": "Juan Dela Cruz",
  "user_email": "juan@example.com",
  "date_of_birth": "1985-06-15",
  "gender": "male",
  "primary_phone": "+639171234567",
  "address": "123 Rizal St., Manila",
  "qualification": "DMD, University of the Philippines",
  "registration_number": "DEN-2020-12345",
  "years_of_experience": 10,
  "consultation_fee": 800.00,
  "consultation_duration": 30,
  "languages_known": ["Filipino", "English"],
  "profile_photo_url": null,
  "biography": "Experienced general dentist",
  "emergency_contact_name": "Maria Dela Cruz",
  "emergency_contact_phone": "+639177654321",
  "available_for_appointment": true,
  "on_leave": false,
  "is_active": true,
  "specializations": [...],
  "created_by": 1,
  "updated_by": null,
  "created_at": "2026-07-07T10:00:00Z",
  "updated_at": "2026-07-07T10:00:00Z"
}
```

### 4.4 GET `/doctors/{id}/profile`

Extended profile for self-view. Returns the same data as GET `/doctors/{id}` plus the `schedules` array (DoctorProfileResponse).

**Error Responses:** 403 (non-owner, non-Admin), 404 (doctor not found)

**Response (200):** `DoctorProfileResponse` — `DoctorResponse` fields plus `schedules: ScheduleResponse[]`.

### 4.5 PATCH `/doctors/{id}`

Partial update of doctor profile fields. Field-level authorization restricts which fields a doctor (self) may update vs admin-only fields.

**Request:** Only provided fields are updated.
```json
{
  "consultation_fee": 1000.00,
  "biography": "Updated biography"
}
```

**Response (200):** Full `DoctorResponse`.

**Error Responses:** 403 (self-service doctor attempting admin-only field — see Phase 5 BR-304 and Self-Service vs Admin-Only Fields table), 404 (not found), 409 (duplicate), 422 (validation)

**Cross Reference:** Phase 5 §2.4 Self-Service vs Admin-Only Fields table

### 4.6 PATCH `/doctors/{id}/deactivate`

Set `is_active = false`. Blocks new appointment booking. Returns the full doctor profile (matching existing Patient module convention).

**Response (200):** Full `DoctorResponse` with `is_active: false`.

**Error Responses:** 404 (not found), 409 (already inactive — see Phase 5 BR-009).

### 4.7 PATCH `/doctors/{id}/activate`

Set `is_active = true`. Restores appointment booking capability. Returns the full doctor profile (matching existing Patient module convention).

**Response (200):** Full `DoctorResponse` with `is_active: true`.

**Error Responses:** 404 (not found), 409 (already active — see Phase 5 BR-010).

### 4.8 PATCH `/doctors/{id}/availability`

Toggle the `available_for_appointment` flag. If the doctor is inactive, the toggle is rejected (Phase 2 INV-11).

**Request:**
```json
{
  "available": false
}
```

**Error Responses:** 403 (insufficient permissions), 404 (not found), 409 (inactive doctor cannot toggle — Phase 5 BR-011)

### 4.9 PATCH `/doctors/{id}/leave-toggle`

Toggle the `on_leave` flag (simple toggle, no approval workflow).

**Request:**
```json
{
  "on_leave": true
}
```

**Error Responses:** 403 (insufficient permissions), 404 (not found)

### 4.10 GET `/doctors/{id}/availability`

Check whether the doctor is currently accepting appointments. Returns computed availability status (respects INV-11 and INV-12).

**Error Responses:** 404 (doctor not found)

**Response (200):**
```json
{
  "id": "...",
  "is_active": true,
  "available_for_appointment": true,
  "on_leave": false,
  "available": true
}
```

### 4.11 Specialization Endpoints

| Method | Path | Description | Request Body |
|---|---|---|---|
| Method | Path | Description | Request Body | Error Responses |
|---|---|---|---|---|
| GET | `/specializations` | List all active specializations | — | — |
| POST | `/specializations` | Create specialization | `{name, code, description}` | 409 (duplicate name/code), 422 (validation) |
| GET | `/doctors/{id}/specializations` | Get doctor's specializations | — | 404 (doctor not found) |
| POST | `/doctors/{id}/specializations` | Assign specialization | `{specialization_id, is_primary, certification_date}` | 404 (doctor/specialization not found), 409 (duplicate assignment), 422 (missing primary) |
| DELETE | `/doctors/{id}/specializations/{sid}` | Remove specialization (idempotent — second delete returns 404) | — | 404 (specialization not found) |
| PUT | `/doctors/{id}/specializations/primary/{sid}` | Set as primary (idempotent — re-setting succeeds) | — | 404 (doctor/specialization not found) |

### 4.12 Schedule Endpoints

> **Overlap validation behavior on updates:** When updating an existing schedule entry (`PATCH /doctors/{id}/schedules/{sid}`), the overlap check excludes the entry being updated. This ensures a doctor can modify the time range of a schedule entry without triggering a false overlap with the entry's own original time range. The `has_overlap()` repository method accepts an optional `exclude_id` parameter for this purpose.

| Method | Path | Description | Request Body | Error Responses |
|---|---|---|---|---|
| GET | `/doctors/{id}/schedules` | Get all active schedules | — | 404 (doctor not found) |
| POST | `/doctors/{id}/schedules` | Create schedule entry | `{day_of_week, start_time, end_time}` | 404 (doctor not found), 409 (overlap), 422 (validation) |
| DELETE | `/doctors/{id}/schedules/{sid}` | Delete schedule entry (idempotent) | — | 404 (schedule not found) |
| PATCH | `/doctors/{id}/schedules/{sid}` | Update schedule entry | Partial fields (`day_of_week`, `start_time`, `end_time`, `is_active`) | 404 (schedule not found), 409 (overlap), 422 (validation) |

---

## 5. Request/Response Schemas

All request schemas use `ConfigDict(extra="forbid")` to reject unknown fields (matching existing Patient and Appointment conventions). All response schemas use `ConfigDict(from_attributes=True)` for ORM-to-schema mapping.

### 5.1 Request Schemas

| Schema | Method | Fields |
|---|---|---|
| `DoctorCreate` | POST /doctors | user_id, date_of_birth?, gender?, primary_phone, address?, qualification?, registration_number?, years_of_experience?, consultation_fee?, consultation_duration?, languages_known?, profile_photo_url?, biography?, emergency_contact_name?, emergency_contact_phone? |
| `DoctorUpdate` | PATCH /doctors/{id} | All DoctorCreate fields optional. Field-level auth restricts self-service vs admin-only fields. |
| `DoctorAvailabilityUpdate` | PATCH .../availability | available: boolean |
| `DoctorLeaveToggle` | PATCH .../leave-toggle | on_leave: boolean |
| `SpecializationCreate` | POST /specializations | name, code, description? |
| `DoctorSpecializationAssign` | POST .../specializations | specialization_id, is_primary, certification_date? |
| `ScheduleCreate` | POST .../schedules | day_of_week, start_time, end_time |
| `ScheduleUpdate` | PATCH .../schedules/{sid} | day_of_week?, start_time?, end_time?, is_active? |

### 5.2 Response Schemas

| Schema | Description |
|---|---|
| `DoctorResponse` | Full doctor profile with nested specializations (no schedules) |
| `DoctorListResponse` | `{items: DoctorResponse[], total, page, page_size}` |
| `DoctorProfileResponse` | Extended profile for self-view (includes schedules, returned by GET /doctors/{id}/profile) |
| `DoctorAvailabilityResponse` | Computed availability status |
| `SpecializationResponse` | Specialization with id, name, code, description, is_active |
| `DoctorSpecializationResponse` | Join with is_primary and certification_date |
| `ScheduleResponse` | Schedule entry with all fields |

---

## 6. Endpoints Explicitly Excluded from MVP

The following endpoint groups are NOT part of the MVP and are documented in Phase 18:

| Endpoint Group | Feature | Future Phase |
|---|---|---|
| `GET/POST /doctors/{id}/credentials` | Credential management | Phase 18 |
| `DELETE /doctors/{id}/credentials/{cid}` | Credential removal | Phase 18 |
| `GET/POST /doctors/{id}/leaves` | Leave requests | Phase 18 |
| `PATCH /doctors/{id}/leaves/{lid}/approve` | Leave approval workflow | Phase 18 |
| `GET/POST /doctors/{id}/commissions` | Commission configuration | Phase 18 |
| `GET /doctors/{id}/performance` | Performance analytics | Phase 18 |
| `GET /doctors/{id}/revenue` | Revenue analytics | Phase 18 |
| `GET /doctors/analytics/*` | Dashboards and KPIs | Phase 18 |
