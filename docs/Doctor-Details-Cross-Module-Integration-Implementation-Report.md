# Doctor Details — Cross-Module Integration Implementation Report

**Date:** September 1, 2026
**Sprint:** Doctor Details Cross-Module Integration
**Status:** ✅ COMPLETE — Ready for architecture/review approval
**Backend Changes:** NONE (frontend-only sprint)

---

## 1. Executive Summary

This sprint converted the Doctor Details page from placeholder tabs to real cross-module integration. The Billing tab was removed, and the Appointments and Treatment Plans tabs now consume existing backend APIs with server-side filtering and pagination.

**Final tab structure:**
- **Overview** — Doctor profile, clinical info, specializations, working schedule (unchanged)
- **Appointments** — Real data via `GET /appointments?dentist_id={doctor.user_id}` (Integer)
- **Treatment Plans** — Real data via `GET /treatment-plans/by-doctor/{doctor.id}` (UUID)

**Key architectural decisions:**
- Billing tab removed (Invoice.doctor_id is nullable, unreliable for revenue attribution)
- No new backend endpoints created
- No new frontend hooks created (existing `useAppointments` and `treatmentPlanService.listByDoctor` reused directly)
- No lifecycle mutations in embedded views (domain ownership preserved)
- All filtering and pagination remain server-side

---

## 2. Pre-Implementation Contract Verification

All 12 verification points passed ✅:

| # | Verification | Status |
|---|-------------|--------|
| 1 | Doctor Details route `/doctors/:doctorId` works | ✅ |
| 2 | Doctor profile exposes both `doctor.id` (UUID) and `doctor.user_id` (Integer) | ✅ |
| 3 | `GET /appointments?dentist_id={user_id}` supports Integer filter | ✅ |
| 4 | `AppointmentListParams.dentist_id` exists in frontend types | ✅ |
| 5 | `useAppointments()` accepts `dentist_id` param | ✅ |
| 6 | `GET /treatment-plans/by-doctor/{uuid}` supports UUID filter | ✅ |
| 7 | `treatmentPlanService.listByDoctor(doctorId)` exists and works | ✅ |
| 8 | `AppointmentResponse` includes `patient_name` (eager-loaded) | ✅ |
| 9 | `TreatmentPlanListItem` includes `patient_id` for name resolution | ✅ |
| 10 | Both APIs support server-side pagination | ✅ |
| 11 | Current Appointments/Treatment Plans/Billing tabs are placeholders | ✅ |
| 12 | Working Schedule remains inside Overview | ✅ |

---

## 3. Final Doctor Details Tab Structure

```
Doctor Details — /doctors/:doctorId
│
├── Overview
│   ├── DoctorHeader (name, code, status, actions)
│   ├── DoctorProfileCard (personal info, contact)
│   ├── DoctorClinicalCard + DoctorEmergencyCard
│   ├── DoctorScheduleSection (working schedule)
│   └── DoctorSpecializationsSection
│
├── Appointments          ← INTEGRATED (real data)
│   ├── Status filter (All | Scheduled | Confirmed | ...)
│   ├── DataTable (appointment #, date, time, patient, type, duration, status)
│   ├── Server-side pagination (skip/limit)
│   └── Appointment # link → /appointments/{id}
│
└── Treatment Plans       ← INTEGRATED (real data)
    ├── Status filter (All | Draft | Under Review | ...)
    ├── DataTable (plan code, patient, status, items, cost, created)
    ├── Server-side pagination (page/page_size)
    └── Plan Code link → /treatment-plans/{id}

REMOVED: Billing tab
```

---

## 4. Billing Tab Removal

**Files changed:** `DoctorDetailsContainer.tsx`

**Removed:**
- `UNWIRED_TABS` constant (contained billing entry)
- `EmptyTab` component (no longer needed)
- Billing tab trigger and content rendering

**Preserved:**
- Billing module itself (Invoice, Payment, Receipt, Refund, Credit Note models/services/routes)
- No doctor revenue reporting added
- No modifications to billing domain

**Rationale:** Invoice.doctor_id is nullable and inconsistently populated. Payment has no direct doctor reference. Revenue cannot be reliably attributed to a doctor. Admin-only revenue restriction conflicts with doctor-facing billing.

---

## 5. Appointment Integration Architecture

### 5.1 Component: `DoctorAppointmentList`

**File:** `frontend/src/components/doctors/DoctorAppointmentList.tsx`

**Data source:** `useAppointments({ dentist_id: doctor.user_id, skip, limit, status })`

**Key design decisions:**
- Reuses existing `useAppointments` hook directly (no wrapper hook needed)
- Uses `DataTable` for table rendering with loading/error/empty states
- Uses `AppointmentStatusBadge` for status display
- Uses `Pagination` for server-side pagination
- Uses `Link` from react-router-dom for appointment number navigation
- Status filter maps directly to backend `status` param (exact single-status filter)
- No lifecycle mutations (Create/Edit/Cancel/Confirm/Check In belong to Appointment module)

### 5.2 Doctor.user_id → Appointment.dentist_id Mapping

```
Doctor.user_id (Integer, e.g. 3)
    ↓
Appointment.dentist_id (Integer FK to users.id)
    ↓
GET /appointments?dentist_id=3
```

**CRITICAL:** `doctor.user_id` (Integer) is used, NOT `doctor.id` (UUID).

### 5.3 Columns Displayed

| Column | Source | Notes |
|--------|--------|-------|
| Appointment # | `appointment_number` | Accessible link → `/appointments/{id}` |
| Date | `appointment_date` | Formatted via `formatISODate` |
| Time | `start_time` / `end_time` | Formatted via `formatTimeRange` |
| Patient | `patient_name` | Eager-loaded by backend |
| Type | `appointment_type` | Badge display |
| Duration | `duration_minutes` | `N min` format |
| Status | `status` | `AppointmentStatusBadge` component |

### 5.4 Filtering Strategy

Status filter maps directly to backend-supported exact statuses:
- All (no status param)
- Scheduled
- Confirmed
- Checked In
- In Treatment
- Completed
- Cancelled
- No Show

**No compound filters.** No client-side post-filtering. Filter change resets pagination to page 1.

### 5.5 Pagination Strategy

- Server-side: `skip` (offset) + `limit`
- Page size selector: 10, 20, 50, 100
- `keepPreviousData` via React Query for smooth transitions
- Filter change resets to `skip: 0`
- `dentist_id` remains applied across all filter/page changes

### 5.6 Empty / Loading / Error States

| State | Display |
|-------|---------|
| Loading | DataTable skeleton rows |
| Error | "Failed to load data" + Retry button |
| Empty (no filter) | "No appointments found for this doctor." |
| Empty (filtered) | "No appointments match the selected filters." |

---

## 6. Treatment Plan Integration Architecture

### 6.1 Component: `DoctorTreatmentPlanList`

**File:** `frontend/src/components/doctors/DoctorTreatmentPlanList.tsx`

**Data source:** `treatmentPlanService.listByDoctor(doctor.id, { page, page_size, status })`

**Key design decisions:**
- Uses `treatmentPlanService.listByDoctor()` directly (existing service method)
- Uses React Query with `treatmentPlanQueryKeys.byDoctor()` for caching
- Uses `DataTable` for table rendering with loading/error/empty states
- Uses `TreatmentPlanStatusBadge` for status display
- Uses `Pagination` for server-side pagination
- Uses `Link` from react-router-dom for plan code navigation
- Uses `useTreatmentPlanNames` to resolve patient display names
- Status filter maps directly to backend `TreatmentPlanStatus` enum
- No lifecycle mutations (those belong to Treatment Plan module)

### 6.2 Doctor.id → TreatmentPlan.doctor_id Mapping

```
Doctor.id (UUID, e.g. 'd1')
    ↓
TreatmentPlan.doctor_id (UUID FK to doctors.id)
    ↓
GET /treatment-plans/by-doctor/d1
```

**CRITICAL:** `doctor.id` (UUID) is used, NOT `doctor.user_id` (Integer).

### 6.3 Columns Displayed

| Column | Source | Notes |
|--------|--------|-------|
| Plan Code | `plan_code` | Accessible link → `/treatment-plans/{id}` |
| Patient | `patient_name` | Resolved via `useTreatmentPlanNames` |
| Status | `status` | `TreatmentPlanStatusBadge` component |
| Items | `item_count` | Computed by backend list mapper |
| Estimated Cost | `total_estimated_cost` | Formatted via `formatCurrency` (INR) |
| Created | `created_at` | Formatted via `formatISODate` |

### 6.4 Filtering Strategy

Status filter maps directly to backend-supported statuses:
- All Status (no status param)
- Draft
- Under Review
- Proposed
- Rejected
- Accepted
- In Progress
- On Hold
- Completed
- Cancelled

**No compound filters.** No client-side post-filtering. Filter change resets page to 1.

### 6.5 Pagination Strategy

- Server-side: `page` (1-based) + `page_size`
- Page size selector: 10, 20, 50, 100
- `keepPreviousData` via React Query for smooth transitions
- Filter change resets to page 1
- `doctor_id` remains applied across all filter/page changes

### 6.6 Empty / Loading / Error States

| State | Display |
|-------|---------|
| Loading | DataTable skeleton rows |
| Error | "Failed to load data" + Retry button |
| Empty (no filter) | "No treatment plans found for this doctor." |
| Empty (filtered) | "No treatment plans match the selected filters." |

---

## 7. Cross-Module Ownership Preservation

| Module | Owns | Consumed by Doctor Details |
|--------|------|---------------------------|
| Doctor | Profile, schedule, availability, leave, specializations | Overview tab |
| Appointment | Appointment CRUD, status lifecycle, booking | Appointments tab (read-only) |
| Treatment Plan | Plan CRUD, items, versions, approvals | Treatment Plans tab (read-only) |

**Boundaries maintained:**
- ❌ No appointment services/repositories moved to Doctor module
- ❌ No treatment plan services/repositories moved to Doctor module
- ❌ No lifecycle mutations in Doctor Details embedded views
- ❌ No duplicate Doctor-specific API endpoints created
- ✅ Frontend composition only — domain ownership unchanged

---

## 8. RBAC Verification

- Doctor Details route existing access rules remain authoritative
- Appointments tab consumes Appointment API (Admin, Receptionist, Doctor roles)
- Treatment Plans tab consumes Treatment Plan API (Admin, Receptionist, Doctor roles)
- Backend APIs remain security authority for data access
- Frontend tab visibility is UX only
- No role checks weakened or new roles invented

---

## 9. Responsive UX

- `DataTable` component handles responsive table rendering
- Columns prioritize: identity (appointment#/plan code) → date/time → patient → status
- Secondary columns (duration, items, cost) have `tabular-nums` for alignment
- Mobile-friendly column layout inherited from DataTable

---

## 10. Tests Added

### 10.1 DoctorDetailsContainer.test.tsx (35 tests total)

**Existing tests updated:**
- Tab structure test updated to expect 3 tabs (Overview, Appointments, Treatment Plans) — Billing removed
- Old placeholder assertion replaced with real tab structure verification

**New tests — Appointments Tab Integration (12 tests):**
1. Appointments tab exists and is clickable
2. Does NOT show old placeholder message
3. Triggers real appointment query with `doctor.user_id` as `dentist_id`
4. Shows loading state for appointments
5. Shows error state with retry for appointments
6. Shows empty state when no appointments exist
7. Renders appointment results with date, time, patient, type, status
8. Renders appointment number as accessible navigation link
9. Resets pagination when filter changes
10. Sends correct skip/limit for pagination
11. Does NOT show lifecycle mutation controls in embedded view
12. `dentist_id` remains correct Integer (not UUID)

**New tests — Treatment Plans Tab Integration (7 tests):**
1. Treatment Plans tab exists and is clickable
2. Does NOT show old placeholder message
3. Triggers real treatment plan query with `doctor.id` UUID (NOT `user_id`)
4. Shows empty state when no treatment plans exist
5. Renders treatment plan results with plan code, patient, status, items, cost
6. Renders plan code as accessible navigation link
7. `doctor.id` remains applied after filter/page changes

**New tests — Billing Tab Removal (3 tests):**
1. Billing tab trigger is absent
2. Billing placeholder content is absent
3. Old Billing placeholder text is absent

**New tests — Overview Regression (3 tests):**
1. Overview still renders with all expected sections
2. Working Schedule is inside Overview, not in a separate tab
3. Doctor actions (Edit, Activate/Deactivate, Toggle) still work

---

## 11. ID Contract Protection Tests

Two specific tests protect the critical ID distinction:

1. **Appointment query uses `doctor.user_id` (Integer):** Verifies `dentist_id: 3` (not `'d1'`)
2. **Treatment Plan query uses `doctor.id` (UUID):** Verifies first arg to `listByDoctor` is `'d1'` (not `3`)

---

## 12. Quality Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ Clean (0 errors) |
| `npm run lint` | ✅ No new warnings/errors (6 pre-existing issues in other files) |
| `npm run build` | ✅ Built successfully (1.81s) |
| Doctor tests (`src/components/doctors/`) | ✅ 14 files, 162 tests, all pass |
| Full frontend test suite | ✅ 223/231 files pass; 8 failing files are pre-existing (billing/patient record tests) |

---

## 13. Files Changed

### New Files (created in this sprint)
| File | Purpose |
|------|---------|
| `frontend/src/components/doctors/DoctorAppointmentList.tsx` | Appointments tab component |
| `frontend/src/components/doctors/DoctorTreatmentPlanList.tsx` | Treatment Plans tab component |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/components/doctors/containers/DoctorDetailsContainer.tsx` | Removed Billing tab, replaced UNWIRED_TABS with real tab content |
| `frontend/src/components/doctors/containers/DoctorDetailsContainer.test.tsx` | Updated tab assertions, added 25 new integration tests |

---

## 14. Known Issues / Technical Debt

1. **Pre-existing test failures:** 8 billing/patient-record test files fail independently of this sprint. These are unrelated to Doctor Details integration.

2. **Pre-existing lint warnings:** 6 lint issues in other files (TreatmentPlanListContainer, useAppointments test, api.ts) — none in new code.

3. **Patient name resolution for Treatment Plans:** `useTreatmentPlanNames` makes per-patient API calls to resolve display names. This is consistent with the existing pattern in the Treatment Plan module but creates N+1 queries for large result sets. A future improvement could batch-resolve names.

4. **DoctorForm.test.tsx flaky test:** Previously reported as flaky due to `waitFor` timeout. Not affected by this sprint. Documented under technical debt.

---

## 15. Regression Risk

| Area | Risk | Mitigation |
|------|------|-----------|
| Overview tab | LOW | No changes to Overview content or layout |
| Working Schedule | LOW | Remains inside Overview, untouched |
| Schedule editing | LOW | No modifications to schedule components |
| Doctor list | NONE | No changes to DoctorListContainer |
| Billing module | NONE | Billing tab removed from Doctor Details only; module unchanged |
| Appointment module | NONE | Doctor Details consumes existing API; no Appointment module changes |
| Treatment Plan module | NONE | Doctor Details consumes existing API; no Treatment Plan module changes |

---

## 16. Manual Browser Acceptance (Checklist)

| Case | Description | Status |
|------|-------------|--------|
| CASE 1 | Doctor Details shows Overview, Appointments, Treatment Plans (no Billing) | ✅ Automated test |
| CASE 2 | Overview with Working Schedule renders correctly | ✅ Automated test |
| CASE 3 | Appointments tab loads real data with correct `dentist_id` | ✅ Automated test |
| CASE 4 | Status filter maps to backend-supported exact status | ✅ Automated test |
| CASE 5 | Pagination sends correct `skip/limit` with `dentist_id` | ✅ Automated test |
| CASE 6 | Treatment Plans tab loads real data with correct `doctor.id` UUID | ✅ Automated test |
| CASE 7 | Treatment Plan filter/pagination maintains doctor ID | ✅ Automated test |
| CASE 8 | Empty states show production messages | ✅ Automated test |

**Note:** Manual browser verification should be performed by QA to validate the complete user journey including visual layout, responsive behavior, and navigation flows.

---

## 17. Final Production-Readiness Verdict

### ✅ COMPLETE

All acceptance criteria are met:

- [x] Doctor Details shows: Overview, Appointments, Treatment Plans — NOT Billing
- [x] Appointments tab: real data, correct `doctor.user_id → dentist_id`, server-side filtering/pagination, production states, explicit navigation
- [x] Treatment Plans tab: real data, correct `doctor.id → doctor_id`, server-side filtering/pagination, production states, explicit navigation
- [x] Overview: unchanged, Working Schedule still functional
- [x] No backend modifications
- [x] All quality gates green
- [x] ID contract distinction protected by tests
- [x] Cross-module ownership preserved
- [x] No lifecycle mutations in embedded views

**Ready for architecture/review approval.**

---

*Generated by implementation sprint — Doctor Details Cross-Module Integration.*
