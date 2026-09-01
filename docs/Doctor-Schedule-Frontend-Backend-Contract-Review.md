# Doctor Schedule — Frontend ↔ Backend Contract Review

> **Status:** Review Complete — Ready for Evaluation  
> **Date:** August 31, 2026  
> **Scope:** Doctor Schedule module frontend/backend contract audit  
> **Author:** Codebuff automated review  

---

## 1. Executive Summary

The DensCare Doctor Schedule system has a **mature backend** with full CRUD, atomic weekly replacement, multi-session support, and overlap validation. The **frontend is minimal** — read-only schedule display with no CRUD UI. The backend correctly implements the approved scheduling precedence hierarchy. The primary gap is that the frontend has no schedule management capability, and the appointment form lacks schedule-aware time constraints.

**Verdict: Option B — Ready with minor backend hardening first.** The backend is production-ready for schedule semantics. Frontend schedule UI can be built against existing APIs with no backend API changes required.

---

## 2. Current Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      ARCHITECTURE OVERVIEW                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Backend (FastAPI + SQLAlchemy + PostgreSQL)                 │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐             │
│  │  Router   │───▶│ Service  │───▶│ Repository │───▶ DB      │
│  └──────────┘    └──────────┘    └────────────┘             │
│                       │                                      │
│                  ┌────▼────┐                                 │
│                  │Validator│                                 │
│                  └─────────┘                                 │
│                                                              │
│  Frontend (React + TanStack Query + TypeScript)              │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐             │
│  │  Pages   │───▶│  Hooks   │───▶│  Service   │───▶ API     │
│  └──────────┘    └──────────┘    └────────────┘             │
│                                                              │
│  Modules:                                                    │
│  - Doctor Module: owns profile, schedule, availability      │
│  - Appointment Module: consumes schedule for validation      │
│  - No circular dependency between modules                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Verified Backend Schedule Contract

### 3.1 Schedule API Inventory

| Method | Path | RBAC | Purpose |
|--------|------|------|---------|
| `GET` | `/doctors/{id}/schedules` | Admin, Doctor (self), Receptionist | List all schedule entries |
| `POST` | `/doctors/{id}/schedules` | Admin only | Create single schedule entry |
| `PATCH` | `/doctors/{id}/schedules/{sid}` | Admin only | Partial update schedule entry |
| `DELETE` | `/doctors/{id}/schedules/{sid}` | Admin only | Delete schedule entry |
| `PUT` | `/doctors/{id}/schedules` | Admin only | **Atomic** replace entire weekly schedule |
| `GET` | `/doctors/{id}/profile` | Admin, Doctor (self), Receptionist | Profile + schedules + specializations |

### 3.2 Request/Response Schemas

**ScheduleCreate (POST/PUT body):**
```json
{
  "day_of_week": 0,      // 0=Monday .. 5=Saturday
  "start_time": "09:00", // ISO time
  "end_time": "17:00"    // ISO time, must be > start_time
}
```

**ScheduleUpdate (PATCH body):**
```json
{
  "day_of_week": 2,      // optional
  "start_time": "10:00", // optional
  "end_time": "16:00",   // optional
  "is_active": false     // optional
}
```

**ScheduleResponse:**
```json
{
  "id": "uuid",
  "doctor_id": "uuid",
  "day_of_week": 0,
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "is_active": true
}
```

### 3.3 Validation Rules (Backend)

| Rule | Enforced By | Error |
|------|-------------|-------|
| `end_time > start_time` | `ScheduleValidator.assert_time_ordering()` | `"End time must be after start time"` |
| No overlapping sessions same day | `ScheduleValidator.assert_no_session_overlap()` | `"Schedule sessions overlap: ..."` |
| Cross-doctor access blocked | `ScheduleValidator.assert_schedule_belongs_to_doctor()` | `"Schedule does not belong to the specified doctor"` |
| Max entries per doctor | `ScheduleValidator.assert_entry_count_not_exceeded()` | `"Cannot exceed maximum schedule entries"` (limit: 14) |
| Doctor must be active | `DoctorValidator.assert_doctor_active()` | `"Doctor must be active to manage schedules"` |
| Day of week 0–5 | Pydantic `ScheduleCreate.day_of_week: ge=0, le=5` | 422 Validation Error |
| DB CheckConstraint | `day_of_week >= 0 AND day_of_week <= 5` | IntegrityError |
| DB CheckConstraint | `end_time > start_time` | IntegrityError |

---

## 4. DoctorSchedule Data Model

```sql
CREATE TABLE doctor_schedules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,  -- 0=Monday .. 5=Saturday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT ck_schedule_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 5),
    CONSTRAINT ck_schedule_end_after_start CHECK (end_time > start_time)
);

-- Indexes (non-unique, supports multiple sessions per day)
CREATE INDEX ix_schedule_doctor_day ON doctor_schedules (doctor_id, day_of_week);
CREATE INDEX ix_schedule_active ON doctor_schedules (doctor_id, is_active);
```

**Key observations:**
- `ix_schedule_doctor_day` is **NOT unique** — multiple rows per `doctor_id + day_of_week` are allowed
- No DB-level exclusion constraint for time overlap — overlap is enforced at application level only
- Cascade delete: deleting a Doctor cascades to all its schedules

---

## 5. Multiple Session Support Verification

### ✅ Backend supports multiple sessions per weekday

| Layer | Evidence | Status |
|-------|----------|--------|
| Database | `ix_schedule_doctor_day` is non-unique index | ✅ Supported |
| Model | No unique constraint on `doctor_id + day_of_week` | ✅ Supported |
| Pydantic Schema | `ScheduleCreate` has no weekday uniqueness check | ✅ Supported |
| Schedule Service | `create_schedule()` uses `assert_no_session_overlap()` instead of weekday uniqueness | ✅ Supported |
| Schedule Validator | `validate_replace_list()` groups by day and checks overlap within each group | ✅ Supported |
| Appointment Validator | `validate_doctor_schedule()` iterates all `day_schedules` and checks if appointment fits any active session | ✅ Supported |
| `MAX_SCHEDULE_ENTRIES_PER_DOCTOR` | 14 (allows 2 sessions × 7 days minus Sunday) | ✅ Sufficient |

**Confirmed: Wednesday with `10:00–13:00` and `17:00–21:00` can coexist.**

### Frontend multi-session compatibility

| Layer | Evidence | Status |
|-------|----------|--------|
| TypeScript type | `ScheduleResponse` is a flat object, no grouping by day | ✅ Compatible |
| `DoctorScheduleSection` | Renders each schedule as a separate table row | ✅ Shows multiple sessions |
| No `Record<DayOfWeek, Schedule>` | No `find(s => s.day_of_week === day)` pattern that would lose data | ✅ No data loss |
| Schedule sorting | `sort((a, b) => a.day_of_week - b.day_of_week)` preserves all rows | ✅ Compatible |

**The frontend correctly handles multiple sessions per day in display.**

---

## 6. Effective Schedule Precedence (Verified)

The appointment validator (`validators.py:validate_doctor_schedule`) implements this exact hierarchy:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SCHEDULE VALIDATION HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. ZERO DoctorSchedule rows → clinic default fallback              │
│     Mon-Sat: morning 10:00–13:00, evening 17:00–21:00              │
│                                                                     │
│  2. ANY explicit schedule rows → doctor schedule is AUTHORITATIVE   │
│                                                                     │
│  3. Active schedule for requested day → appointment must fit        │
│     inside at least one active session                              │
│                                                                     │
│  4. Schedule exists but inactive → doctor unavailable, no fallback  │
│                                                                     │
│  5. Doctor has schedules but none for this weekday → unavailable    │
│     No fallback                                                     │
│                                                                     │
│  6. Leave/availability rules → override BOTH clinic defaults        │
│     and custom schedules (checked in validate_doctor_profile)       │
│                                                                     │
│  7. Sunday → unavailable unless explicitly configured               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Edge case: "Zero schedule configuration"

**Current semantics:** `len(doctor.schedules) > 0` determines whether custom schedules are authoritative.

**Scenario analysis:**

| Scenario | `has_any_schedule` | Behavior |
|----------|-------------------|----------|
| Doctor has 0 rows | `False` | Clinic default fallback |
| Doctor has 1 inactive Monday row, no others | `True` | Custom mode — doctor unavailable Tue–Sun, Mon also unavailable (inactive) |
| Doctor has 1 active Monday row | `True` | Custom mode — doctor available Mon only |
| Admin deletes final schedule row | `False` | Falls back to clinic defaults |

**Assessment:** The implicit model works correctly. An inactive-only schedule correctly prevents booking (no fallback to clinic hours). Deleting all schedules correctly reverts to clinic defaults. This is safe.

**Classification: NOT NEEDED** — an explicit `schedule_mode` column is not required for production correctness.

---

## 7. Clinic Default Ownership Analysis

**Current location:** `backend/app/core/constants.py`

```python
CLINIC_WORKING_DAYS = {0, 1, 2, 3, 4, 5}  # Mon-Sat
CLINIC_MORNING_START = time(10, 0)
CLINIC_MORNING_END = time(13, 0)
CLINIC_EVENING_START = time(17, 0)
CLINIC_EVENING_END = time(21, 0)
```

**Consumer:** `backend/app/modules/appointments/validators.py` imports from `app.core.constants`.

**Duplication check:** No duplication found. The constants are defined once in `app.core.constants` and imported where needed.

**Architectural concern:** The Appointment module currently owns clinic-hour constants. This is acceptable for now but would become technical debt if other modules (e.g., billing hours, reporting) need clinic working hours.

**Recommendation:** Future enhancement — consider a `ClinicSettings` module or at minimum, document that `app.core.constants` is the single source of truth for clinic-wide working hours. **Not blocking.**

---

## 8. Availability / Leave / Schedule Separation

The `Doctor` model has three independent boolean flags:

| Field | Column | Purpose |
|-------|--------|---------|
| `is_active` | `doctors.is_active` | Doctor profile exists and is functional |
| `available_for_appointment` | `doctors.available_for_appointment` | Doctor accepts new appointments |
| `on_leave` | `doctors.on_leave` | Doctor is temporarily unavailable |

**Validation precedence (from `validate_doctor_profile`):**
1. `is_active` must be `true`
2. `available_for_appointment` must be `true`
3. `on_leave` must be `false`

**Then** schedule validation runs (from `validate_doctor_schedule`):
4. Schedule must exist for the day (or clinic fallback if zero schedules)
5. Appointment time must fit inside an active session

**Overlap check (from `validate_overlap`):**
6. No conflicting appointment for the dentist
7. No conflicting appointment for the patient

**✅ These are correctly separated and do NOT collapse into a single boolean.**

---

## 9. Doctor Profile Response Contract

**Endpoint:** `GET /doctors/{id}/profile`  
**Response schema:** `DoctorProfileResponse` (extends `DoctorResponse` + `schedules: ScheduleResponse[]`)

**Schedule data in response:**
- All schedule rows for the doctor are included
- Sorted by `day_of_week` ascending
- Each row includes: `id`, `doctor_id`, `day_of_week`, `start_time`, `end_time`, `is_active`

**Multi-session test:** If Wednesday has `10:00–13:00` and `17:00–21:00`, the response contains BOTH entries.

**Mapper:** `DoctorMapper.to_profile_response()` iterates `doctor.schedules` directly — no dictionary/grouping that would overwrite.

**✅ The profile response correctly returns all schedule rows including multiple sessions per day.**

---

## 10. Current Frontend Schedule Capability

| Capability | Status | Evidence |
|------------|--------|----------|
| Display schedule (read-only) | ✅ Implemented | `DoctorScheduleSection.tsx` |
| Multi-session display | ✅ Works | Table renders each row independently |
| Day sorting | ✅ Implemented | `sort((a, b) => a.day_of_week - b.day_of_week)` |
| Active/Inactive badge | ✅ Shows | `StatusBadge` component |
| Empty state | ✅ Shows | "No schedule set" message |
| Create schedule | ❌ Not implemented | No frontend service/hook for `POST /doctors/{id}/schedules` |
| Update schedule | ❌ Not implemented | No frontend service/hook for `PATCH /doctors/{id}/schedules/{sid}` |
| Delete schedule | ❌ Not implemented | No frontend service/hook for `DELETE /doctors/{id}/schedules/{sid}` |
| Replace weekly schedule | ❌ Not implemented | No frontend service/hook for `PUT /doctors/{id}/schedules` |
| Clinic-default indicator | ❌ Not shown | No UI to distinguish "Using clinic default" vs "Custom schedule" |
| Schedule CRUD mutations | ❌ Not implemented | `useDoctorMutations.ts` has no schedule hooks |
| API client methods | ❌ Not implemented | `doctorService.ts` has no schedule CRUD methods |

**The frontend `doctorService.ts` explicitly documents:**  
> "Schedule CRUD endpoints are intentionally NOT exposed yet (Phase 2)."

---

## 11. Frontend ↔ Backend Contract Mismatches

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | No schedule CRUD in frontend | P1 | Backend has full CRUD; frontend has zero mutation support |
| 2 | No clinic-default indicator | P2 | Doctor has zero schedules → should show "Using clinic default" |
| 3 | No "Not working" day display | P2 | Days without schedules are simply absent from the table |
| 4 | Appointment form has no schedule awareness | P1 | User can pick any time; only discovers invalid time after submit |
| 5 | `doctorService.ts` missing schedule methods | P1 | Need `createSchedule`, `updateSchedule`, `deleteSchedule`, `replaceWeekSchedule` |

**No contract mismatches exist for data shape.** The frontend types correctly mirror backend schemas.

---

## 12. Proposed Doctor Details UX

### Schedule Display

```
┌─────────────────────────────────────────────────────────┐
│  Working Schedule                                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ℹ️ Using clinic default schedule                  │   │
│  │ Mon–Sat: 10:00–13:00, 17:00–21:00               │   │
│  │ [Create Custom Schedule]                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  OR (when custom schedule exists):                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ℹ️ Custom schedule                                │   │
│  │ Monday     10:00 AM – 1:00 PM  ✅ Active         │   │
│  │            5:00 PM – 9:00 PM   ✅ Active         │   │
│  │ Tuesday    — Not working —                       │   │
│  │ Wednesday  9:00 AM – 2:00 PM   ✅ Active         │   │
│  │ Thursday   — Not working —                       │   │
│  │ Friday     10:00 AM – 1:00 PM  ✅ Active         │   │
│  │ Saturday   — Not working —                       │   │
│  │ [Edit Schedule] [Revert to Clinic Default]       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Implementation note:** The current `DoctorScheduleSection` renders each schedule as a table row. Days with no schedule simply don't appear. The proposed UX requires:
1. Rendering ALL 6 weekdays (Mon–Sat)
2. Showing "— Not working —" for days with no active schedule
3. Grouping multiple sessions under the same day
4. Showing a clinic-default indicator when zero custom schedules exist

---

## 13. Proposed Weekly Schedule Editor UX

```
┌─────────────────────────────────────────────────────────┐
│  Edit Weekly Schedule                                     │
│                                                          │
│  Monday                                                  │
│    10:00 AM ──── 1:00 PM  [Remove]                      │
│    5:00 PM ───── 9:00 PM  [Remove]                      │
│    [+ Add Session]                                       │
│                                                          │
│  Tuesday                                                 │
│    — Not working —                                       │
│    [+ Add Session]                                       │
│                                                          │
│  Wednesday                                               │
│    9:00 AM ───── 2:00 PM  [Remove]                      │
│    [+ Add Session]                                       │
│                                                          │
│  ... (Thursday, Friday, Saturday)                        │
│                                                          │
│  [Cancel]  [Save Schedule]                               │
└─────────────────────────────────────────────────────────┘
```

**Frontend validation (client-side, before submit):**
- `end_time > start_time`
- No overlapping sessions on same day
- Max sessions per day reasonable (prevent accidental duplication)

**Backend remains authoritative** — any violations are caught by `ScheduleValidator`.

---

## 14. Default → Custom Transition

**Proposed flow:**
1. Admin clicks "Create Custom Schedule" on doctor with zero schedules
2. Frontend pre-populates editor with clinic default hours (Mon–Sat: 10–13, 17–21)
3. Admin modifies the schedule as needed
4. On save, frontend sends `PUT /doctors/{id}/schedules` with the complete list
5. Backend atomically replaces all entries (currently empty → new entries)

**Safety:** The `PUT` endpoint uses `replace_week_schedule()` which:
1. Validates the entire list first
2. Locks existing rows (`SELECT ... FOR UPDATE`)
3. Deletes all existing entries
4. Creates all new entries
5. Commits atomically

**✅ Backend fully supports this flow today.**

---

## 15. Custom → Clinic Default Transition

**Proposed flow:**
1. Admin clicks "Revert to Clinic Default" on doctor with custom schedules
2. Confirmation dialog: "This will remove all custom schedule entries. The doctor will use clinic default hours."
3. On confirm, frontend sends `PUT /doctors/{id}/schedules` with **empty list**
4. Backend deletes all entries, doctor falls back to clinic defaults

**Current backend behavior with empty `PUT`:**
- `replace_week_schedule()` with empty list → deletes all entries → returns empty list
- Next appointment booking → `has_any_schedule = False` → clinic fallback applies

**⚠️ Concurrency concern:** Between the delete and the next booking, there's a brief window where the doctor has zero schedules. During this window, the clinic fallback applies — which is the correct behavior.

**✅ Safe. No intermediate invalid state.**

---

## 16. Atomic Weekly Replacement Assessment

**Backend `PUT /doctors/{id}/schedules` already implements this:**

```python
def replace_week_schedule(self, doctor_id, schedules, *, actor_id):
    def _replace():
        self._get_doctor_and_assert_active(doctor_id)
        ScheduleValidator.assert_entry_count_not_exceeded(len(schedules))
        ScheduleValidator.validate_replace_list(schedules)
        self.schedule_repo.get_schedules_for_update(doctor_id)  # SELECT FOR UPDATE
        self.schedule_repo.delete_all_for_doctor(doctor_id)
        created = []
        for entry in schedules:
            schedule = DoctorSchedule(...)
            created.append(self.schedule_repo.create(schedule))
        return created
    return self._run_in_transaction("replace_week_schedule", _replace, ...)
```

**Properties:**
- ✅ Validates entire list before any changes
- ✅ Uses row-level locking to prevent concurrent modification
- ✅ Deletes all then creates all within single transaction
- ✅ Rolls back on any failure
- ✅ Returns newly created entries

**✅ This is production-ready. The frontend can build a weekly editor using this endpoint.**

---

## 17. RBAC Review

| Action | Admin | Doctor (self) | Receptionist | Other |
|--------|-------|---------------|--------------|-------|
| View schedules | ✅ | ✅ | ✅ | ❌ |
| Create schedule | ✅ | ❌ | ❌ | ❌ |
| Update schedule | ✅ | ❌ | ❌ | ❌ |
| Delete schedule | ✅ | ❌ | ❌ | ❌ |
| Replace weekly | ✅ | ❌ | ❌ | ❌ |

**Schedule management is admin-only.** This is correct — doctors should not modify their own availability.

---

## 18. Appointment Integration Impact

| Concern | Status |
|---------|--------|
| Appointment validator imports clinic constants from `app.core.constants` | ✅ Single source of truth |
| Doctor module does NOT duplicate appointment schedule logic | ✅ Clean separation |
| Appointment module consumes `Doctor.schedules` relationship | ✅ Via `selectin` load |
| No circular dependency between Doctor and Appointment modules | ✅ Confirmed |
| Schedule CRUD stays in Doctor module | ✅ Correct ownership |

---

## 19. Future Slot Generation Boundary

**Slot generation would depend on:**
1. Effective doctor schedule (from Doctor module)
2. Doctor availability/leave status (from Doctor module)
3. Appointment duration (from Appointment request)
4. Existing appointments (from Appointment module)

**Recommended ownership:**
- Doctor module: "What hours does this doctor work on day X?" → returns schedule sessions
- Appointment module: "Given these sessions, duration, and existing appointments, what slots are available?" → returns free slots

**No new API is strictly required for basic slot generation.** The existing `GET /doctors/{id}/profile` returns schedules. The appointment module can derive valid time windows. A dedicated `GET /doctors/{id}/availability?date=&duration=` endpoint would be cleaner but is a future enhancement.

**Classification: FUTURE ENHANCEMENT**

---

## 20. Test Coverage Assessment

### Backend Tests

| Area | Test File | Coverage | Gaps |
|------|-----------|----------|------|
| Schedule CRUD (router) | `test_routers.py` | Good — list, create, update, delete, replace, auth, cross-doctor | Missing: overlap detection test in router |
| Schedule validation | `test_validators.py` | Good — time ordering, overlap, ownership, count | Missing: multiple same-day overlap test |
| Schedule service | `test_services.py` | Good — profile sorting, zero/one/multiple schedules | Missing: concurrent replace test |
| Schedule repositories | `test_repositories.py` | Basic CRUD | Missing: `get_schedules_for_update` lock test |
| Edge cases | `test_edge_cases.py` | Good — repeated replace, extra fields, empty list | Covered |
| Appointment schedule validation | `test_appointment_business_logic.py` | Good — valid/invalid, boundaries, inactive, multi-day | Missing: multi-session appointment test |

### Frontend Tests

| Area | Test File | Coverage | Gaps |
|------|-----------|----------|------|
| Schedule display | `DoctorScheduleSection.test.tsx` | Good — rows, sorting, empty state, semantics | Missing: multi-same-day display test |
| Doctor profile hook | `useDoctorProfile.test.tsx` | Exists | Not inspected in detail |
| Doctor mutations | `useDoctorMutations.test.tsx` | Exists (no schedule mutations) | N/A — no schedule CRUD yet |

### Missing Test Scenarios (Backend)

1. Multiple sessions same day: appointment fits inside session A → accepted
2. Multiple sessions same day: appointment crosses session boundary → rejected
3. Overlapping sessions: `10:00–14:00` and `12:00–18:00` → rejected on create
4. Adjacent sessions: `10:00–13:00` and `13:00–17:00` → allowed (no overlap)
5. Replace schedule with overlapping sessions → rejected atomically
6. Replace schedule with valid split sessions → accepted atomically
7. Clinic fallback: doctor with zero schedules, morning session → accepted
8. Clinic fallback: doctor with zero schedules, lunch break (13:00–17:00) → rejected
9. Custom schedule override: doctor with Mon schedule only, booking Fri → rejected

---

## 21. Contract Capability Matrix

| Feature | Backend | Frontend | Match? | Gap | Priority |
|---------|---------|----------|--------|-----|----------|
| Schedule read (profile) | ✅ `GET /doctors/{id}/profile` | ✅ `DoctorScheduleSection` | ✅ | — | — |
| Schedule read (list) | ✅ `GET /doctors/{id}/schedules` | ❌ Not called | ⚠️ | Frontend uses profile endpoint instead | P3 |
| Schedule create | ✅ `POST /doctors/{id}/schedules` | ❌ No service/hook | ❌ | Need `doctorService.createSchedule()` | P1 |
| Schedule update | ✅ `PATCH /doctors/{id}/schedules/{sid}` | ❌ No service/hook | ❌ | Need `doctorService.updateSchedule()` | P1 |
| Schedule delete | ✅ `DELETE /doctors/{id}/schedules/{sid}` | ❌ No service/hook | ❌ | Need `doctorService.deleteSchedule()` | P1 |
| Replace weekly | ✅ `PUT /doctors/{id}/schedules` | ❌ No service/hook | ❌ | Need `doctorService.replaceWeekSchedule()` | P1 |
| Multiple sessions/day | ✅ Overlap detection, not uniqueness | ✅ Table renders all rows | ✅ | — | — |
| Overlap validation | ✅ `assert_no_session_overlap()` | ❌ Not needed yet | ✅ | Will need client-side mirror in editor | P2 |
| Inactive sessions | ✅ `is_active` column + check | ✅ Shows Active/Inactive badge | ✅ | — | — |
| Clinic fallback | ✅ `validate_doctor_schedule()` | ❌ No indicator | ⚠️ | Need "Using clinic default" display | P2 |
| Custom schedule indicator | ✅ Implicit (rows exist) | ❌ Not shown | ⚠️ | Need "Custom schedule" label | P2 |
| Day "Not working" display | ✅ Implicit (no row) | ❌ Day absent from table | ⚠️ | Need all Mon–Sat rows, show "Not working" | P2 |
| Schedule editor | ✅ Full CRUD + atomic replace | ❌ Not implemented | ❌ | Need weekly schedule editor component | P1 |
| Clinic default → custom | ✅ Atomic replace works | ❌ Not implemented | ❌ | Need "Create Custom Schedule" flow | P1 |
| Custom → clinic default | ✅ Empty replace reverts | ❌ Not implemented | ❌ | Need "Revert to Clinic Default" button | P2 |
| Leave override | ✅ `validate_doctor_profile()` | ✅ `useDoctorAvailabilityCheck` | ✅ | — | — |
| Availability override | ✅ `validate_doctor_profile()` | ✅ Doctor list filter | ✅ | — | — |
| Appointment consumption | ✅ `validate_doctor_schedule()` | ❌ No time constraints | ⚠️ | Time picker should respect schedule | P2 |
| Future slot generation | ❌ Not implemented | ❌ Not implemented | — | Future enhancement | P3 |

---

## 22. Required Backend Changes

| # | Change | Priority | Justification |
|---|--------|----------|---------------|
| 1 | None for API contract | — | All needed endpoints exist |
| 2 | Add `get_active_schedule_for_day()` repository method | P2 | Convenience method for frontend availability check (optional optimization) |
| 3 | Add DB-level exclusion constraint for time overlap | P3 | Defense-in-depth for concurrency (current app-level check is sufficient) |

**The backend API is complete for the frontend schedule UI.** No new endpoints, no schema changes, no migrations required for the immediate implementation.

---

## 23. Required Frontend Changes

| # | Change | Priority | Files |
|---|--------|----------|-------|
| 1 | Add schedule CRUD methods to `doctorService.ts` | P1 | `services/doctorService.ts` |
| 2 | Add schedule mutation hooks to `useDoctorMutations.ts` | P1 | `hooks/doctors/useDoctorMutations.ts` |
| 3 | Update `DoctorScheduleSection` to show all days + clinic default indicator | P2 | `components/doctors/DoctorScheduleSection.tsx` |
| 4 | Create `DoctorScheduleEditor` component | P1 | New component |
| 5 | Create weekly schedule edit drawer/modal | P1 | New component |
| 6 | Add "Create Custom Schedule" / "Revert to Clinic Default" buttons | P2 | `DoctorScheduleSection.tsx` or details page |
| 7 | Add client-side overlap validation in editor | P2 | Schedule editor component |
| 8 | Add appointment form time constraints based on schedule | P2 | `AppointmentForm.tsx` + hooks |

---

## 24. Migration Impact

**None.** No database schema changes are required. The existing `doctor_schedules` table supports all needed operations:
- Multiple sessions per day ✅
- Active/inactive toggle ✅
- Atomic replace via application ✅
- Cascade delete ✅

---

## 25. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Concurrent schedule edits | Low | Medium | `SELECT FOR UPDATE` locking in `replace_week_schedule` |
| Clinic default constants drift | Low | Medium | Single definition in `app.core.constants` |
| Frontend stale schedule data | Medium | Low | React Query invalidation after mutations |
| Admin accidentally removes all schedules | Low | Low | Reverts to clinic defaults (safe fallback) |
| Overlapping sessions created via race condition | Very Low | Medium | App-level overlap check + row locking |

---

## 26. Prioritized Implementation Plan

### Sprint 1: Backend Hardening (Optional)
1. Add `get_active_schedule_for_day()` to `DoctorScheduleRepository`
2. Add test for multi-session appointment validation
3. Add test for adjacent session boundary semantics

### Sprint 2: Frontend Schedule API Client
1. Add `createSchedule`, `updateSchedule`, `deleteSchedule`, `replaceWeekSchedule` to `doctorService.ts`
2. Add `useCreateSchedule`, `useUpdateSchedule`, `useDeleteSchedule`, `useReplaceWeekSchedule` to `useDoctorMutations.ts`
3. Add tests for new service methods and hooks

### Sprint 3: Schedule Display Enhancement
1. Update `DoctorScheduleSection` to show all 6 weekdays
2. Show "— Not working —" for days without active schedules
3. Group multiple sessions under same day
4. Show "Using clinic default" indicator when zero custom schedules
5. Add "Custom schedule" label when schedules exist

### Sprint 4: Schedule Editor
1. Create `DoctorScheduleEditor` component with per-day session management
2. Add/remove session rows per day
3. Client-side validation (time ordering, overlap detection)
4. Wire to `PUT /doctors/{id}/schedules` for atomic save
5. Add "Create Custom Schedule" and "Revert to Clinic Default" flows

### Sprint 5: Appointment Form Enhancement (Optional)
1. Fetch doctor schedule when dentist + date selected
2. Show working sessions for selected day
3. Constrain time picker to valid slots
4. Show "Doctor not available on {day}" before submission

---

## 27. Final Verdict

### **Option B — Ready with minor backend hardening first**

**Rationale:**

1. **Backend is production-ready.** All schedule CRUD endpoints exist, atomic weekly replacement works, multi-session support is implemented, overlap validation is correct, and the scheduling precedence hierarchy is properly enforced.

2. **No backend API changes are required.** The frontend can build the complete schedule management UI against existing endpoints.

3. **Frontend gaps are all implementation, not contract issues.** The TypeScript types correctly mirror backend schemas. The API client just needs the missing CRUD methods.

4. **Minor backend hardening recommended** (P2-P3): additional test coverage for multi-session scenarios, optional convenience repository method, optional DB exclusion constraint for defense-in-depth.

5. **The schedule editor can be built entirely with existing `PUT /doctors/{id}/schedules`** — no new endpoints needed.

**GO recommendation for starting Doctor Schedule UI implementation** after adding the missing frontend API client methods (Sprint 2).
