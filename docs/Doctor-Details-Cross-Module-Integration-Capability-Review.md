# Doctor Details — Cross-Module Integration Capability Review

**Date:** 2026-09-01
**Scope:** Architecture review & capability mapping — NO implementation
**Status:** Ready for architecture approval

---

## 1. Executive Summary

This review audits the DensCare Doctor Details page to determine which tabs are legitimate, which can be integrated using existing APIs, which need backend capability, and which should not exist.

**Key findings:**

| Tab | Verdict | Reason |
|-----|---------|--------|
| **Overview** | ✅ KEEP AS-IS | Fully integrated, includes Working Schedule |
| **Appointments** | ✅ INTEGRATE NOW | Existing `GET /appointments?dentist_id=` supports filtering by doctor's `user_id`. Frontend types already include `dentist_id` param. |
| **Treatment Plans** | ✅ INTEGRATE NOW | `TreatmentPlan.doctor_id` is a direct UUID FK to `doctors.id`. Existing `GET /treatment-plans?doctor_id=` and `GET /treatment-plans/by-doctor/{id}` endpoints support filtering. |
| **Billing** | ⚠️ DEFER — REMOVE TAB FOR NOW | `Invoice.doctor_id` exists but is **nullable** and often unset. No reliable doctor-revenue attribution. Admin-only revenue requirement conflicts. Remove tab; revisit when doctor attribution is consistently populated. |
| **Working Schedule** | ✅ KEEP INSIDE OVERVIEW | Well-placed in Overview; no justification for a separate tab. |

**Final Verdict: OPTION B** — Appointments and Treatment Plans can integrate now using existing APIs. Billing should be removed/hidden pending future domain work.

---

## 2. Current Doctor Details Architecture

### 2.1 Route & Page

| Layer | File | Role |
|-------|------|------|
| Route | `/doctors/:doctorId` | Route path (defined in router config) |
| Page | `frontend/src/pages/doctors/DoctorDetailsPage.tsx` | Thin route wrapper |
| Container | `frontend/src/components/doctors/containers/DoctorDetailsContainer.tsx` | Orchestrates all data, tabs, dialogs |

### 2.2 Tab Configuration

The container defines tabs via a `UNWIRED_TABS` constant array and a hardcoded Overview tab:

```tsx
const UNWIRED_TABS = [
  { value: 'appointments',    label: 'Appointments',     title: 'No appointments', ... },
  { value: 'treatment-plans', label: 'Treatment Plans',  title: 'No treatment plans', ... },
  { value: 'billing',         label: 'Billing',          title: 'No billing activity', ... },
];
```

### 2.3 Data Flow

- **Profile data:** `useDoctorProfile(doctorId)` → `GET /doctors/{id}/profile` → `DoctorProfileResponse`
- **Overview:** `DoctorHeader`, `DoctorProfileCard`, `DoctorClinicalCard`, `DoctorEmergencyCard`, `DoctorSpecializationsSection`, `DoctorScheduleSection`
- **Other tabs:** All render `<EmptyTab>` placeholder component

### 2.4 RBAC

- Edit button: visible to all permitted roles
- Activate/Deactivate: gated by `<PermissionGate requiredRoles={ADMIN_ROLES}>`
- Backend: activate/deactivate require `require_admin`

---

## 3. Current Tab Implementation Status

| Tab | Status | Evidence |
|-----|--------|----------|
| **Overview** | ✅ FULLY INTEGRATED | Renders profile cards, specializations, working schedule from `GET /doctors/{id}/profile` |
| **Appointments** | 🔴 PLACEHOLDER | Renders `EmptyTab` with message: *"Appointments for this doctor will appear here once the Appointments module is connected."* |
| **Treatment Plans** | 🔴 PLACEHOLDER | Renders `EmptyTab` with message: *"Treatment plans for this doctor will appear here once the Treatment module is connected."* |
| **Billing** | 🔴 PLACEHOLDER | Renders `EmptyTab` with message: *"Invoices and payments for this doctor will appear here once the Billing module is connected."* |

**Placeholder source:** `UNWIRED_TABS` array in `DoctorDetailsContainer.tsx`, rendered via `EmptyTab` component which wraps `<EmptyState>`.

---

## 4. Overview Assessment

### 4.1 Current Content

The Overview tab renders a 3-column grid layout:

**Left column (2/3 width):**
1. `DoctorHeader` — name, code, status badges, action buttons
2. `DoctorProfileCard` — personal info, contact, emergency contact
3. `DoctorClinicalCard` + `DoctorEmergencyCard` — qualifications, registration, emergency contact
4. `DoctorScheduleSection` — weekly working schedule

**Right column (1/3 width):**
1. `DoctorSpecializationsSection` — assigned specializations with primary indicator

### 4.2 Data Source

All Overview data comes from a single API call: `GET /doctors/{id}/profile` which returns `DoctorProfileResponse` (extends `DoctorResponse` with `schedules[]`).

### 4.3 Assessment

**VERDICT: KEEP AS-IS**

The Overview provides an appropriate doctor profile summary containing:
- ✅ Doctor identity (name, code)
- ✅ Contact information (phone, address)
- ✅ Professional information (qualifications, registration, experience, fee)
- ✅ Specializations (with primary indicator)
- ✅ Active status / Availability / Leave status
- ✅ Working Schedule (recently implemented)
- ✅ Emergency contact

The layout is well-structured and not overloaded. No changes recommended.

---

## 5. Working Schedule Placement Assessment

### 5.1 Current Location

`DoctorScheduleSection` renders inside the Overview tab's left column, below the clinical/emergency cards.

### 5.2 Content

- Shows weekly Mon–Sat schedule
- Handles two states: clinic default vs. custom schedule
- Groups multiple sessions per weekday
- Shows inactive sessions with strikethrough
- Admin can edit via "Create Custom Schedule" / "Edit Schedule" button

### 5.3 Assessment

**VERDICT: KEEP INSIDE OVERVIEW**

Rationale:
- Working Schedule is a **property of the doctor profile**, not an independent workflow
- The Overview is not materially overloaded — the 3-column grid has capacity
- Creating a separate Schedule tab would fragment the doctor profile view without UX benefit
- The schedule is already accessible and editable from Overview
- **No workflow evidence** justifies separation (users don't "work in" the schedule tab — they glance at it)

**Recommendation:** Only consider a separate Schedule tab if:
- Schedule editing becomes significantly more complex (e.g., date-specific overrides, shift swap requests)
- Or the Overview becomes materially overloaded from other additions

---

## 6. Appointment Domain Relationship

### 6.1 Appointment Model

```python
class Appointment(Base):
    dentist_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
```

**CRITICAL FINDING:** `Appointment.dentist_id` references `users.id` (Integer), **NOT** `doctors.id` (UUID).

This means:
- To filter appointments by a doctor, we must use `doctor.user_id` (the Integer PK of the linked User)
- NOT `doctor.id` (the UUID PK of the Doctor profile)

### 6.2 Relationship Diagram

```
Doctor (UUID PK: id)
  └── user_id (Integer FK) ──→ User (Integer PK: id)
                                    ↑
Appointment.dentist_id (Integer FK) ─┘
```

### 6.3 Clinical Meaning

The `dentist_id` on Appointment represents **the user who will perform the dental appointment**. This is a legitimate clinical relationship — a doctor (as a user) is assigned to perform an appointment.

### 6.4 Assessment

**RELATIONSHIP: LEGITIMATE** — Appointments have a meaningful Doctor ↔ Appointment relationship via the User bridge.

---

## 7. Appointment API Capability

### 7.1 Existing Endpoint

```
GET /appointments
```

**Query parameters (from `router.py`):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | int (≥0) | Zero-based offset |
| `limit` | int (1–100) | Records per page |
| `search` | string \| null | Search appointment number, patient name or phone |
| `status` | AppointmentStatus \| null | Filter by status |
| `date_from` | date \| null | Inclusive start date |
| `date_to` | date \| null | Inclusive end date |
| `dentist_id` | int \| null | **Filter by dentist user ID** |

### 7.2 Contract Verification

```python
# router.py
dentist_id: int | None = Query(
    default=None, gt=0,
    description="Filter by dentist user ID",
)
```

```python
# repository.py
if dentist_id is not None:
    base = base.where(Appointment.dentist_id == dentist_id)
```

### 7.3 Response Shape

```typescript
interface AppointmentListResponse {
  items: AppointmentResponse[];
  total: number;
}

interface AppointmentResponse {
  id: string;                    // UUID
  appointment_number: string;    // "APT-YYYYMMDD-NNNN"
  patient_id: string;            // UUID
  dentist_id: number;            // Integer (User PK)
  appointment_date: string;      // "YYYY-MM-DD"
  start_time: string;            // "HH:MM:SS"
  end_time: string;              // "HH:MM:SS"
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit: string;
  notes: string | null;
  patient_name?: string | null;  // Eager-loaded
  dentist_name?: string | null;  // Eager-loaded
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}
```

### 7.4 Pagination

- Server-side: `skip` (offset) + `limit`
- Total count returned for client-side pagination controls
- `keepPreviousData` used by React Query for smooth page transitions

### 7.5 Sorting

- Default: `created_at DESC` (hardcoded in repository)
- No configurable sort parameter on list endpoint

### 7.6 Filtering

- ✅ Status filter (exact match)
- ✅ Date range filter (inclusive `date_from`/`date_to`)
- ✅ Dentist filter (`dentist_id`)
- ✅ Free-text search (appointment number, patient name, patient phone)

### 7.7 RBAC

```python
current_user: User = Depends(
    require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
)
```

**All clinical roles** can list appointments. Doctors can see their own and others' appointments.

### 7.8 Doctor ID Mapping

To use `GET /appointments?dentist_id=X` from Doctor Details:

```typescript
// From DoctorProfileResponse
const doctorUserId = doctor.user_id;  // Integer

// Pass to appointment query
useAppointments({ dentist_id: doctorUserId });
```

**This works because:**
- `Doctor.user_id` is available in `DoctorProfileResponse`
- `Appointment.dentist_id` references `users.id`
- The frontend `AppointmentListParams` already has `dentist_id?: number`

### 7.9 Backend Capability Verdict

**✅ FULLY SUPPORTED** — No backend changes needed. The existing `GET /appointments?dentist_id={user_id}` endpoint with server-side filtering, pagination, and status/date filters covers all Doctor Details → Appointments requirements.

---

## 8. Appointment Frontend Reuse Capability

### 8.1 Existing Hooks

| Hook | Purpose | Reusable? |
|------|---------|-----------|
| `useAppointments(params)` | Paginated list query | ✅ Yes — accepts `dentist_id` param |
| `useAppointmentFilters()` | Search/status/pagination state | ⚠️ Partial — coupled to URL search params |
| `useAppointmentMutations()` | Create/update/cancel | ✅ Yes |
| `useAppointmentNames()` | Name resolution | ✅ Not needed — backend eager-loads names |

### 8.2 Existing Services

| Service | Method | Reusable? |
|---------|--------|-----------|
| `appointmentService.list(params)` | GET /appointments | ✅ Yes — passes all params including `dentist_id` |
| `appointmentService.get(id)` | GET /appointments/{id} | ✅ Yes |
| `appointmentService.calendar(params)` | GET /appointments/calendar | ✅ Yes |

### 8.3 Existing Components

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| `AppointmentTable` | ⚠️ Partially | Tightly coupled to full list page actions (create, edit, cancel). Needs refactoring for read-only embedded view. |
| `AppointmentStatusBadge` | ✅ Yes | Pure presentational |
| `AppointmentToolbar` | ⚠️ Partially | Has create button; needs conditional rendering |
| `Pagination` | ✅ Yes | Generic, fully reusable |
| `MobileAppointmentList` | ⚠️ Partially | Same action coupling as table |

### 8.4 Reuse Strategy

**Preferred approach:** Create a **new lightweight `DoctorAppointmentList` component** that:
- Reuses `useAppointments` hook with `dentist_id` pre-set
- Reuses `AppointmentStatusBadge` for status display
- Reuses `Pagination` for pagination
- Uses a simplified table/list (date, time, patient, type, status)
- Links to `/appointments/{id}` for details
- Does NOT include create/edit/cancel actions (those belong to the Appointments module)

**Alternative:** Refactor `AppointmentTable` to accept an `actions` prop or `mode` prop, but this risks regression in the main Appointments page.

---

## 9. Proposed Doctor Appointments UX

### 9.1 Tab Content

**Filter bar:**
- Status filter: `All | Upcoming | Completed | Cancelled`
- Date range (optional, future enhancement)

**Appointment list (table):**

| Column | Description |
|--------|-------------|
| Date | `appointment_date` formatted |
| Time | `start_time – end_time` |
| Patient | `patient_name` (eager-loaded) |
| Type | `appointment_type` badge |
| Status | `AppointmentStatusBadge` |
| Duration | `duration_minutes` + "min" |

**Row click:** Navigate to `/appointments/{id}` (Appointment Details)

**Pagination:** Server-side, reusing existing `Pagination` component

### 9.2 Filter Design

Use date-based filtering to create natural groupings:

| Filter | `date_from` | `date_to` | Status |
|--------|-------------|-----------|--------|
| **Upcoming** | `today` | *(none)* | Exclude `Cancelled`, `No Show` |
| **Completed** | *(none)* | `today` | `Completed` |
| **Cancelled** | *(none)* | *(none)* | `Cancelled`, `No Show` |
| **All** | *(none)* | *(none)* | *(none)* |

**Note:** The backend does not support "future only" or "past only" semantics natively. The "Upcoming" filter would use `date_from=today` to get today and future appointments. For a v1, a simple status filter (`All | Upcoming | Past | Cancelled`) with `date_from` for upcoming is sufficient.

### 9.3 Empty States

| Context | Message |
|---------|---------|
| No appointments at all | "No appointments found for this doctor." |
| No upcoming | "No upcoming appointments." |
| No completed | "No completed appointments." |
| Loading | Spinner |
| Error | Error state with retry |

### 9.4 RBAC

Same as main Appointments page: Admin, Receptionist, Doctor roles can view. No create/edit/cancel from Doctor Details (keep module boundaries).

---

## 10. Treatment Plan Domain Relationship

### 10.1 TreatmentPlan Model

```python
class TreatmentPlan(Base):
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="RESTRICT"),
        nullable=False,
    )
```

**CRITICAL FINDING:** `TreatmentPlan.doctor_id` is a **mandatory, non-nullable UUID FK to `doctors.id`**.

### 10.2 Relationship Nature

This is a **direct clinical relationship**, not an audit field:
- The `doctor_id` represents the **treating/responsible doctor** for the treatment plan
- It is `nullable=False` — every treatment plan MUST have a doctor
- The `TreatmentPlanApproval.approved_by` is a separate audit field (User FK)
- The `created_by` field is the audit field (User FK)

### 10.3 Related Entities

```
TreatmentPlan
  ├── doctor_id → Doctor (UUID FK, mandatory)
  ├── patient_id → Patient (UUID FK, mandatory)
  ├── items[] → TreatmentPlanItem (procedure line items)
  ├── approval → TreatmentPlanApproval (doctor approval + patient acknowledgment)
  └── versions[] → TreatmentPlanVersion (immutable snapshots)
```

### 10.4 Assessment

**RELATIONSHIP: LEGITIMATE AND STRONG** — TreatmentPlan has a mandatory, non-nullable relationship with Doctor. "Doctor's Treatment Plans" is a meaningful clinical concept representing all treatment plans that a doctor is responsible for.

---

## 11. Treatment Plan API Capability

### 11.1 Existing Endpoints

**Option A — List with filter:**
```
GET /treatment-plans?doctor_id={doctor_uuid}
```

**Option B — Dedicated endpoint:**
```
GET /treatment-plans/by-doctor/{doctor_id}
```

Both support pagination, sorting, and additional filters.

### 11.2 Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `doctor_id` | UUID \| null | Filter by doctor UUID |
| `patient_id` | UUID \| null | Filter by patient UUID |
| `status` | TreatmentPlanStatus \| null | Filter by status |
| `is_active` | bool \| null | Filter by active state |
| `search` | string \| null | Search plan code and patient name |
| `date_from` | string \| null | Created on/after date |
| `date_to` | string \| null | Created on/before date |
| `page` | int (≥1) | Page number |
| `page_size` | int (1–MAX) | Items per page |
| `sort_by` | string \| null | Sort field |
| `sort_order` | "asc" \| "desc" | Sort direction |

### 11.3 Response Shape

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

interface TreatmentPlanListItem {
  id: string;
  plan_code: string;
  patient: { id, patient_code, full_name, is_active };
  doctor: { id, doctor_code, user_full_name, is_active };
  status: TreatmentPlanStatus;
  current_version: number;
  is_active: boolean;
  item_count: number;
  total_estimated_cost: string;
  created_at: string;
  updated_at: string;
}
```

### 11.4 Frontend Service

```typescript
// treatmentPlanService.ts
async listByDoctor(doctorId: string, params: PlanListParams = {})
  : Promise<PaginatedResponse<TreatmentPlanListItem>> {
  const { data } = await api.get(
    `/treatment-plans/by-doctor/${doctorId}`, { params }
  );
  return data;
}
```

### 11.5 Backend Capability Verdict

**✅ FULLY SUPPORTED** — No backend changes needed. Both `GET /treatment-plans?doctor_id={uuid}` and `GET /treatment-plans/by-doctor/{uuid}` exist with full pagination, sorting, and filtering.

---

## 12. Treatment Plan Tab Decision

### Classification: **A. INTEGRATE NOW**

**Rationale:**
1. ✅ Legitimate domain relationship: `TreatmentPlan.doctor_id` is mandatory (FK to `doctors.id`)
2. ✅ Existing API support: `GET /treatment-plans/by-doctor/{doctor_id}` with pagination
3. ✅ Frontend service method exists: `treatmentPlanService.listByDoctor()`
4. ✅ Meaningful clinical question: "What treatment plans is this doctor responsible for?"
5. ✅ No reinterpretation of audit metadata — this is a core clinical assignment

**Do NOT remove this tab.** The domain relationship is real and the API fully supports it.

---

## 13. Billing Domain Relationship

### 13.1 Invoice Model

```python
class Invoice(Base, VersioningMixin):
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True,  # ← NULLABLE
    )
```

### 13.2 Relationship Nature

- `Invoice.doctor_id` is a **nullable** FK to `doctors.id`
- It is **optional** — not all invoices have a doctor
- The FK uses `ondelete="SET NULL"` — deleting a doctor nullifies the reference
- There is **no corresponding index for doctor-based queries** beyond `ix_invoices_doctor`

### 13.3 Payment Model

```python
class Payment(Base, VersioningMixin):
    # NO doctor_id field at all
    patient_id: Mapped[uuid.UUID] = ...  # Patient-centric only
```

**Payment has no direct doctor reference.**

### 13.4 Indirect Relationships

Doctor association in billing is only available through:
1. `Invoice.doctor_id` (nullable, optional)
2. `Invoice.appointment_id` → `Appointment.dentist_id` (User FK, not Doctor FK)
3. `Invoice.treatment_plan_id` → `TreatmentPlan.doctor_id` (mandatory Doctor FK)

### 13.5 Assessment

**RELATIONSHIP: WEAK AND INCONSISTENT**

- `Invoice.doctor_id` is nullable — many invoices may have no doctor
- `Payment` has no doctor reference at all
- Doctor attribution on invoices is **not consistently populated**
- There is no reliable way to attribute revenue to a doctor

---

## 14. Billing API Capability

### 14.1 Existing Endpoint

```
GET /billing/invoices?doctor_id={doctor_uuid}
```

**Supported.** The invoice list endpoint accepts `doctor_id` as a UUID filter.

### 14.2 Frontend Type

```typescript
interface InvoiceListParams {
  doctor_id?: string;  // ✅ Already in frontend types
  // ... other params
}
```

### 14.3 Limitation

While the API supports filtering, the **data quality is unreliable**:
- `doctor_id` is nullable on Invoice creation
- Not all invoices are created with a doctor reference
- Filtering by `doctor_id` would return an **incomplete and misleading** view

---

## 15. Doctor Revenue Attribution Assessment

### 15.1 Current State

| Entity | Doctor Reference | Reliability |
|--------|-----------------|-------------|
| Invoice | `doctor_id` (nullable UUID) | ❌ Often NULL |
| InvoiceItem | None | ❌ No doctor ref |
| Payment | None | ❌ Patient-centric only |
| Receipt | None | ❌ Via Payment only |
| Refund | None | ❌ Via Payment only |

### 15.2 Can Revenue Be Attributed to a Doctor?

**No.** The current data model does not support reliable doctor revenue attribution because:
1. `Invoice.doctor_id` is nullable and inconsistently populated
2. `Payment` has no doctor reference
3. A single payment can cover multiple invoices (possibly different doctors)
4. There is no revenue allocation logic at the doctor level

### 15.3 Would Doing So Create Inaccurate Financial Reporting?

**Yes.** Showing partial revenue (only from invoices that happen to have `doctor_id` set) would be misleading. Incomplete data presented as authoritative financial information is worse than no data.

---

## 16. Admin-Only Revenue RBAC Impact

### 16.1 Client Requirement

DensCare has a client requirement that **total revenue visibility should be restricted to Admin**.

### 16.2 Impact Analysis

If a Doctor Billing tab were to show:
- Total revenue generated by the doctor → **Conflicts with admin-only revenue restriction**
- Invoice list for the doctor → Revenue-adjacent, requires Admin role
- Payment list → Directly financial, requires Admin role

### 16.3 RBAC Implications

Even if doctor-revenue attribution were implemented:
- The tab would need to be **Admin-only** (or at minimum, revenue totals hidden from doctors)
- Doctors should NOT see other doctors' revenue
- This adds RBAC complexity without clear domain justification

### 16.4 Recommendation

Do not introduce revenue visibility in the Doctor Details context. The admin-only revenue restriction and the weak domain relationship together make this tab inappropriate.

---

## 17. Billing Tab Decision

### Classification: **D. REMOVE/HIDE**

**Rationale:**

1. ❌ **Weak domain relationship:** `Invoice.doctor_id` is nullable; `Payment` has no doctor ref
2. ❌ **Unreliable data:** Doctor attribution is inconsistently populated
3. ❌ **No meaningful business question:** "Doctor's billing" is ambiguous — is it invoices they created? Invoices for their patients? Invoices for their appointments?
4. ❌ **Revenue attribution risk:** Showing partial revenue would be inaccurate and misleading
5. ❌ **RBAC conflict:** Admin-only revenue restriction makes a doctor-facing billing tab inappropriate
6. ❌ **Module boundary violation:** Billing is patient/invoice-centric, not doctor-centric

**Recommendation:**
- **Remove the Billing tab** from Doctor Details
- Do NOT create `/doctors/{id}/invoices` endpoint
- Do NOT add doctor_id to Payment model
- Revisit only if/when:
  - Doctor revenue attribution becomes a confirmed product requirement
  - The data model consistently populates `Invoice.doctor_id`
  - Revenue attribution logic is implemented at the billing layer
  - RBAC implications are fully resolved

---

## 18. Cross-Module Ownership Analysis

### 18.1 Module Boundaries

| Module | Owns | Does NOT Own |
|--------|------|-------------|
| **Doctor** | Profile, schedule, availability, leave, specializations | Appointments, treatment plans, invoices |
| **Appointment** | Appointment CRUD, status lifecycle, booking validation | Doctor profile, treatment plans |
| **Treatment Plan** | Plan CRUD, items, versions, approvals | Doctor profile, appointments, billing |
| **Billing** | Invoices, payments, receipts, refunds, credit notes | Doctor profile, appointments |

### 18.2 Integration Pattern

Doctor Details **consumes** data from other modules. It does NOT own or duplicate their data.

```
Doctor Details Frontend
    │
    ├── Overview
    │      └── Doctor APIs (GET /doctors/{id}/profile)
    │
    ├── Appointments
    │      └── Appointment APIs (GET /appointments?dentist_id={user_id})
    │
    └── Treatment Plans
           └── Treatment Plan APIs (GET /treatment-plans?doctor_id={uuid})
```

### 18.3 Anti-Patterns to Avoid

- ❌ `/doctors/{id}/appointments` — if `/appointments?dentist_id=` already exists
- ❌ `/doctors/{id}/treatment-plans` — if `/treatment-plans/by-doctor/{id}` already exists
- ❌ `/doctors/{id}/invoices` — Billing tab is being removed
- ❌ Moving appointment/treatment-plan repositories into Doctor module
- ❌ Creating duplicate Doctor-specific persistence

---

## 19. API Reuse vs New Endpoint Analysis

| Integration | Existing API | New Endpoint Needed? |
|-------------|-------------|---------------------|
| Appointments | `GET /appointments?dentist_id={user_id}` | ❌ No |
| Treatment Plans | `GET /treatment-plans/by-doctor/{doctor_id}` | ❌ No |
| Billing | *(tab removed)* | ❌ No |

**Verdict: Zero new backend endpoints required.**

---

## 20. Performance/Pagination Assessment

### 20.1 Appointments

| Aspect | Status | Notes |
|--------|--------|-------|
| Pagination | ✅ Server-side | `skip`/`limit` with total count |
| Filtering | ✅ Server-side | Status, date range, dentist_id |
| Sorting | ✅ Server-side | `created_at DESC` (fixed) |
| N+1 risk | ✅ Mitigated | `selectinload` for patient and dentist relationships |
| Patient name hydration | ✅ Eager-loaded | `PatientMapper.build_full_name()` |
| Doctor name hydration | ✅ Eager-loaded | `apt.dentist.full_name` |
| Large dataset | ✅ Safe | Server-side pagination prevents loading all rows |
| Index | ✅ Present | `ix_appointments_dentist_schedule` on `(dentist_id, appointment_date, start_time)` |

### 20.2 Treatment Plans

| Aspect | Status | Notes |
|--------|--------|-------|
| Pagination | ✅ Server-side | `page`/`page_size` with total count |
| Filtering | ✅ Server-side | doctor_id, status, date range, search |
| Sorting | ✅ Server-side | Configurable sort field + direction |
| N+1 risk | ✅ Mitigated | `selectinload` for related entities |
| Large dataset | ✅ Safe | Server-side pagination |
| Index | ✅ Present | `ix_tp_doctor` on `doctor_id` |

### 20.3 Performance Verdict

**✅ NO PERFORMANCE CONCERNS** — Both modules support full server-side pagination and filtering. No client-side filtering of large datasets is required.

---

## 21. RBAC Assessment

### 21.1 Current Roles

| Role | Doctor Details | Appointments | Treatment Plans | Billing |
|------|---------------|-------------|----------------|---------|
| Admin | ✅ Full access | ✅ Full access | ✅ Full access | ✅ Full access |
| Receptionist | ✅ Read | ✅ Full access | ✅ Full access | ✅ Read |
| Doctor | ✅ Own profile only | ✅ Read (all) | ✅ Read (all) | ✅ Read |
| Dental Assistant | ❌ No access | ✅ Read | ✅ Read | ✅ Read |

### 21.2 Doctor Details Tab RBAC

| Tab | Read Access | Write Access |
|-----|------------|-------------|
| Overview | Admin, Receptionist, Doctor (own) | Admin only (edit, activate/deactivate, toggle) |
| Appointments | Admin, Receptionist, Doctor | None from Doctor Details (use Appointments module) |
| Treatment Plans | Admin, Receptionist, Doctor | None from Doctor Details (use Treatment Plans module) |
| Billing | *(removed)* | *(removed)* |

### 21.3 Frontend vs Backend

- Frontend tab visibility is UX only — backend authorization remains authoritative
- The existing RBAC on each module's API endpoints already enforces access control
- No additional RBAC changes needed for Appointments or Treatment Plans tabs

---

## 22. Empty-State Recommendations

### 22.1 Current (Unacceptable) Messages

```
"Appointments for this doctor will appear here once the Appointments module is connected."
"Treatment plans for this doctor will appear here once the Treatment module is connected."
"Invoices and payments for this doctor will appear here once the Billing module is connected."
```

**Problem:** Developer/project-management language. Not suitable for production.

### 22.2 Recommended Empty States

| Tab | Context | Message |
|-----|---------|---------|
| Appointments | No appointments at all | "No appointments found for this doctor." |
| Appointments | No upcoming appointments | "No upcoming appointments." |
| Appointments | No completed appointments | "No completed appointments." |
| Treatment Plans | No plans at all | "No treatment plans found for this doctor." |
| Treatment Plans | No active plans | "No active treatment plans." |
| Billing | *(tab removed)* | N/A |

### 22.3 Design Principles

- State the facts, not the implementation
- Never reference modules, connections, or integration status
- Use present tense
- Be specific when possible ("No upcoming appointments" vs "No appointments")

---

## 23. Final Doctor Details Information Architecture

### 23.1 Proposed Tab Structure

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
├── Appointments          ← INTEGRATE NOW
│   ├── Status filter (All | Upcoming | Completed | Cancelled)
│   ├── Appointment list (date, time, patient, type, status)
│   ├── Pagination
│   └── Row click → /appointments/{id}
│
└── Treatment Plans       ← INTEGRATE NOW
    ├── Status filter (All | Active | Completed | etc.)
    ├── Plan list (code, patient, status, items, cost)
    ├── Pagination
    └── Row click → /treatment-plans/{id}
```

**Billing tab: REMOVED**

### 23.2 Why Not a Separate Schedule Tab

- Working Schedule is a doctor profile property, not an independent workflow
- Overview is not overloaded
- No workflow evidence justifies separation
- Schedule editing is already accessible from Overview

---

## 24. Capability Matrix

| Tab / Feature | Domain Relationship | Backend Support | Filter Support | Frontend Support | RBAC | Performance | Action | Priority |
|---------------|-------------------|----------------|---------------|-----------------|------|-------------|--------|----------|
| **Overview** | Doctor (self) | ✅ Full | N/A | ✅ Full | ✅ Admin gate on mutations | ✅ Single query | KEEP AS-IS | — |
| **Working Schedule** | Doctor (self) | ✅ Full | N/A | ✅ Full | ✅ Admin gate on edit | ✅ Included in profile | KEEP INSIDE OVERVIEW | — |
| **Appointments** | Doctor ↔ User bridge | ✅ `dentist_id` filter | ✅ Status, date, search | ✅ `dentist_id` in params | ✅ Module RBAC | ✅ Indexed, paginated | INTEGRATE NOW | P1 |
| **Treatment Plans** | Doctor (direct FK, mandatory) | ✅ `doctor_id` filter + by-doctor endpoint | ✅ Status, date, search | ✅ `listByDoctor()` service | ✅ Module RBAC | ✅ Indexed, paginated | INTEGRATE NOW | P1 |
| **Billing** | Doctor (nullable FK, inconsistent) | ⚠️ `doctor_id` filter exists but data unreliable | ⚠️ Partial | ✅ `doctor_id` in params | ❌ Revenue restriction conflict | ⚠️ Depends on data quality | REMOVE/HIDE | — |

---

## 25. Required Backend Changes

### 25.1 Appointments Tab

**None.** Existing API fully supports the integration.

### 25.2 Treatment Plans Tab

**None.** Existing API fully supports the integration.

### 25.3 Billing Tab

**None — tab is being removed.**

### 25.4 Summary

**Zero backend changes required for this integration.**

---

## 26. Required Frontend Changes

### 26.1 DoctorDetailsContainer.tsx

1. **Remove** `UNWIRED_TABS` constant (or remove billing entry)
2. **Remove** `<EmptyTab>` component (no longer needed for approved tabs)
3. **Add** Appointments tab content (new component or inline)
4. **Add** Treatment Plans tab content (new component or inline)
5. **Remove** Billing tab trigger and content
6. **Add** tab triggers for Appointments and Treatment Plans

### 26.2 New Components Needed

| Component | Purpose | Complexity |
|-----------|---------|-----------|
| `DoctorAppointmentList` | Embedded appointment list for doctor context | Medium |
| `DoctorTreatmentPlanList` | Embedded treatment plan list for doctor context | Medium |

### 26.3 Hooks Needed

| Hook | Purpose | Can Reuse? |
|------|---------|-----------|
| `useDoctorAppointments(userId, params)` | Query appointments filtered by dentist_id | ✅ Wrap `useAppointments` with pre-set `dentist_id` |
| `useDoctorTreatmentPlans(doctorId, params)` | Query treatment plans filtered by doctor_id | ✅ New hook wrapping `treatmentPlanService.listByDoctor` |

### 26.4 Estimated Effort

| Task | Files | Estimated LOC |
|------|-------|--------------|
| Remove Billing tab | `DoctorDetailsContainer.tsx` | ~15 lines removed |
| Add Appointments tab | Container + new component + hook | ~200–300 lines |
| Add Treatment Plans tab | Container + new component + hook | ~200–300 lines |
| Empty states | Within new components | ~20 lines |
| **Total** | | ~450–650 lines |

---

## 27. Test Plan

### 27.1 Appointments Tab Tests

| Test | Type | Priority |
|------|------|----------|
| Tab renders when Appointments trigger is clicked | Component | P1 |
| Correct `dentist_id` (user_id) is passed to query | Unit | P1 |
| Loading state shows spinner | Component | P1 |
| Error state shows retry button | Component | P1 |
| Empty state shows "No appointments found" | Component | P1 |
| Results render date, time, patient, type, status | Component | P1 |
| Pagination works (next/prev page) | Integration | P1 |
| Status filter changes query params | Component | P2 |
| Row click navigates to `/appointments/{id}` | Component | P1 |
| RBAC: tab visible to appropriate roles | Integration | P2 |

### 27.2 Treatment Plans Tab Tests

| Test | Type | Priority |
|------|------|----------|
| Tab renders when Treatment Plans trigger is clicked | Component | P1 |
| Correct `doctor_id` (UUID) is passed to query | Unit | P1 |
| Loading state shows spinner | Component | P1 |
| Error state shows retry button | Component | P1 |
| Empty state shows "No treatment plans found" | Component | P1 |
| Results render plan code, patient, status, items | Component | P1 |
| Pagination works | Integration | P1 |
| Row click navigates to `/treatment-plans/{id}` | Component | P1 |

### 27.3 Billing Tab Tests

**None — tab is removed.**

### 27.4 Regression Tests

| Test | Type | Priority |
|------|------|----------|
| Overview tab still renders correctly | Component | P1 |
| Working Schedule still renders in Overview | Component | P1 |
| Schedule edit dialog still works | Integration | P1 |
| Doctor header/actions still work | Component | P1 |
| Activate/deactivate still works | Integration | P1 |
| Toggle availability/leave still works | Integration | P1 |

---

## 28. Implementation Priority

| Priority | Task | Depends On |
|----------|------|-----------|
| **P0** | Remove Billing tab + placeholder | — |
| **P1** | Implement Appointments tab (hook + component + integration) | — |
| **P1** | Implement Treatment Plans tab (hook + component + integration) | — |
| **P2** | Add status/date filters to Appointments tab | P1 |
| **P2** | Add status filters to Treatment Plans tab | P1 |
| **P3** | Empty state refinement | P1 |

**P0 should be done first** to remove the misleading placeholder before adding real integrations.

---

## 29. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Appointment `dentist_id` type confusion (UUID vs Integer) | Medium | High | Use `doctor.user_id` (Integer), not `doctor.id` (UUID) |
| Treatment Plan query returns large result sets | Low | Medium | Server-side pagination already supported |
| Billing tab removal confuses users who expect it | Low | Low | It's a placeholder — no real functionality to lose |
| Working Schedule regression from tab changes | Low | High | Schedule is in Overview, unaffected by other tab changes |
| Frontend component coupling with main module pages | Medium | Medium | Create dedicated embedded components, don't reuse coupled ones |
| RBAC bypass via frontend-only tab visibility | Low | High | Backend authorization is authoritative; frontend is UX only |

---

## 30. Final Verdict

### OPTION B — Appointments and Treatment Plans can integrate now; Billing requires removal

**Summary:**

1. **Overview:** ✅ KEEP AS-IS — well-structured, not overloaded
2. **Working Schedule:** ✅ KEEP INSIDE OVERVIEW — no justification for separation
3. **Appointments:** ✅ INTEGRATE NOW — existing `GET /appointments?dentist_id={user_id}` fully supports it. Frontend types already have `dentist_id` param. Use `doctor.user_id` (Integer), NOT `doctor.id` (UUID).
4. **Treatment Plans:** ✅ INTEGRATE NOW — `TreatmentPlan.doctor_id` is a mandatory UUID FK to `doctors.id`. Existing `GET /treatment-plans/by-doctor/{uuid}` fully supports it. Frontend service `listByDoctor()` exists.
5. **Billing:** ❌ REMOVE — `Invoice.doctor_id` is nullable and inconsistently populated. `Payment` has no doctor reference. No reliable revenue attribution. Admin-only revenue restriction conflicts. Remove tab; revisit only when domain capability matures.

**Backend changes required: ZERO**
**Frontend changes required: ~450–650 lines (2 new components, 2 new hooks, container modifications)**
**New API endpoints required: ZERO**

**Architecture is sound.** The existing cross-module API contracts already support the approved integrations. The Doctor Details page can be enhanced purely through frontend work, consuming existing APIs with appropriate filters.

---

*Generated by architecture review — ready for approval before implementation begins.*
