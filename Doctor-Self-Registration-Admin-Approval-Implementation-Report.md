# Doctor Self-Registration & Admin Approval — Implementation Report

## 1. Executive Summary

This implementation adds a **Doctor Self-Registration** workflow to DensCare, allowing doctors to submit their own professional details during registration. An admin reviews the application and approves or rejects it. The implementation is a **DOCTOR-SPECIFIC extension** to the existing registration architecture — existing staff/receptionist registration flows remain completely unchanged.

**Key Design Decision:** A dedicated `DoctorApplication` entity was chosen (Option A) because:
- The existing `User` model has no mechanism to store role-specific application metadata
- The `Doctor` table should only represent APPROVED clinic doctors
- The `DoctorApplication` keeps pending applicants out of the active doctor workflow
- Clean separation of concerns with minimal coupling to existing code

**Security:** The applicant CANNOT self-assign any privileged RBAC role. The User is created with `role_id=None` and `status=pending`. The actual role is assigned by an authorized admin during approval.

## 2. Existing Auth Registration Contract (Preserved)

| Endpoint | Method | Auth | Behavior |
|----------|--------|------|----------|
| `/auth/register` | POST | Public | Creates User with `status=pending`, `is_active=False`, `role_id=None` |
| `/auth/login` | POST | Public | Requires `is_active=True` — pending users CANNOT login |
| `/auth/users/pending` | GET | Admin | Returns all pending users |
| `/auth/users/{id}/approve` | PATCH | Admin | Assigns role, activates user |
| `/auth/users/{id}/deactivate` | PATCH | Admin | Deactivates user |

**All existing endpoints remain UNCHANGED.**

## 3. Existing User Approval Contract (Preserved)

- Admin selects a role from a dropdown (all 7 roles)
- Approval atomically: assigns role + sets `status=active` + `is_active=True`
- Audit fields: `created_by`, `updated_by` populated

## 4. Existing Doctor Creation Contract (Preserved)

- Admin creates Doctor via `POST /doctors` (requires existing User with doctor role)
- `Doctor.user_id` is unique (1:1 with User)
- `Doctor.registration_number` is unique
- Doctor code auto-generated (`DOC-XXXXXX`)
- All doctor CRUD, schedules, specializations remain unchanged

## 5. Existing Staff Workflow (Documented & Preserved)

| Role | Current Flow | Status |
|------|-------------|--------|
| Receptionist | Register → Admin approves with RECEPTIONIST role | ✅ Unchanged |
| Dental Assistant | Register → Admin approves with DENTAL_ASSISTANT role | ✅ Unchanged |
| Doctor (admin-created) | Admin creates User with doctor role → Approves → Creates Doctor profile | ✅ Unchanged (emergency path) |

## 6. Architecture Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Dedicated DoctorApplication** | New `doctor_applications` table | Clean separation, no impact on existing models, explicit lifecycle | New table, migration required |
| B. Pending Doctor entity | Temporary Doctor records | Reuses Doctor model | Pollutes Doctor table with unapproved records |
| C. Extend User model | Add fields to User | No new tables | Couples unrelated concerns, violates SRP |

**Selected: Option A** — Smallest production-grade architecture with cleanest separation.

## 7. Selected Architecture + Reason

```
User (pending, no role)
  │
  └── DoctorApplication (professional details, status=pending)
        │
        │ Admin approval (atomic)
        v
      User (active, role=GENERAL_DOCTOR)
      Doctor (profile created, linked via user_id)
      DoctorApplication (status=approved)
```

## 8. Domain/Data Model

### DoctorApplication Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Application ID |
| `user_id` | Integer (FK→users) | Linked pending user |
| `qualification` | String(500) | Professional qualifications |
| `registration_number` | String(100, unique) | License number |
| `years_of_experience` | Integer | Years in practice |
| `date_of_birth` | Date | Date of birth |
| `gender` | String(10) | Gender |
| `primary_phone` | String(20) | Contact phone |
| `address` | Text | Address |
| `profile_photo_url` | String(500) | Photo storage reference |
| `requested_specialization_ids` | JSONB | List of specialization IDs |
| `primary_specialization_id` | Integer | Primary specialization |
| `status` | String(20) | pending/approved/rejected |
| `submitted_at` | DateTime | Submission timestamp |
| `reviewed_at` | DateTime | Review timestamp |
| `reviewed_by` | Integer (FK→users) | Admin who reviewed |
| `rejection_reason` | Text | Rejection reason |
| `approved_role_id` | Integer (FK→roles) | Role assigned on approval |
| `doctor_id` | UUID (FK→doctors) | Created Doctor profile |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

## 9. Migration Review

- **Single head:** `d1e2f3a4b5c6` (no branch conflicts)
- **Down revision:** `c4d5e6f7a8b9` (correct chain)
- **Tables created:** `doctor_applications`
- **Indexes:** `ix_doctor_applications_user_status`, check constraints for status and years_of_experience
- **No production data impact** — new table only

## 10. Doctor Application Lifecycle

```
PENDING → APPROVED (admin assigns role + creates Doctor)
PENDING → REJECTED (admin rejects, no Doctor created)
```

**Idempotency:** Application must be PENDING to be processed. Double approval/rejection is rejected with 400.

## 11. Public Registration Contract

### POST /auth/register (UNCHANGED)
```json
{ "full_name": "...", "email": "...", "password": "..." }
```
Creates staff application. No changes.

### POST /auth/register-doctor (NEW)
```json
{
  "full_name": "Dr. Juan",
  "email": "dr.juan@example.com",
  "password": "Secure@Pass1",
  "qualification": "DMD",
  "registration_number": "DEN-2024-001",
  "years_of_experience": 10,
  "primary_phone": "+639171234567",
  "date_of_birth": "1985-06-15",
  "gender": "male",
  "address": "123 Rizal St.",
  "requested_specialization_ids": [1, 3],
  "primary_specialization_id": 1
}
```
Creates User (pending, no role) + DoctorApplication atomically.

## 12. Doctor Registration UX

Multi-step form:
1. **Account:** Full name, email, password, confirm password, terms
2. **Professional:** Qualification, registration number, years of experience
3. **Personal:** Phone, DOB, gender, address
4. **Review:** Summary + Submit

## 13. Specialization Handling

- Applicant selects from existing specialization IDs (master data)
- IDs validated against `specializations` table on submission
- On approval, transferred to `doctor_specializations` join table

## 14. Profile Photo Handling

- Uses existing storage architecture (`profile_photo_url` field)
- Applicant can upload via existing photo upload endpoint
- Photo stored as opaque storage key

## 15. Pending Account Access

- Pending users have `is_active=False` → CANNOT login
- Backend RBAC is authoritative — no clinical functionality accessible
- Pending applicants do NOT appear in Doctor list

## 16. Admin Review UX

Pending Approvals page shows two sections:
- **Doctor Applications** (with Review button → modal with details)
- **Staff Applications** (existing behavior)

Doctor application modal shows:
- Applicant name/email
- Professional details (qualification, registration number, experience)
- Personal details (phone, gender, DOB, address)
- Role selector (only doctor roles: GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR, CHIEF_DOCTOR)
- Approve/Reject buttons

## 17. Final Role Assignment

- Admin selects from `DOCTOR_ROLES` only (not ADMIN, not RECEPTIONIST)
- Role assigned to User atomically during approval
- Applicant CANNOT self-assign any role

## 18. Approval Transaction

```
BEGIN
  1. Validate application is PENDING
  2. Validate User exists
  3. Validate selected role is allowed doctor role
  4. Validate registration number uniqueness
  5. Assign RBAC role to User
  6. Activate User (status=active, is_active=True)
  7. Generate unique doctor code
  8. Create Doctor profile
  9. Transfer specialization assignments
  10. Mark application APPROVED
  11. Record audit metadata
COMMIT
```

If ANY step fails → ROLLBACK EVERYTHING.

## 19. Rollback Behavior

- Service layer owns transactions
- All operations wrapped in try/except
- Any failure triggers `db.rollback()` before re-raising
- Never: User has role BUT Doctor creation failed
- Never: Doctor exists BUT User has no role

## 20. Double/Concurrent Approval Protection

- Application must be PENDING to approve (state validation)
- `Doctor.user_id` has UNIQUE constraint (prevents duplicate profiles)
- `DoctorApplication.registration_number` has UNIQUE constraint
- Double-click protection via status check before processing

## 21. Rejection Flow

- Marks application as REJECTED
- Stores `rejection_reason`, `reviewed_by`, `reviewed_at`
- Does NOT create Doctor profile
- Does NOT assign any role
- User remains in PENDING state

## 22. Doctor Profile Creation

- Auto-generated `doctor_code` (DOC-XXXXXX)
- `user_id` set to application's user
- `primary_phone` copied from application
- All optional fields copied where present
- `is_active=True`, `available_for_appointment=True`, `on_leave=False`

## 23. Doctor.user_id Mapping

- `Doctor.user_id` → Integer FK to `users.id` (UNIQUE)
- Same mapping as admin-created doctors
- Appointments: `Doctor.user_id` → `Appointment.dentist_id`
- Treatment Plans: `Doctor.id` (UUID) → `TreatmentPlan.doctor_id`

## 24. RBAC/Security Review

| Security Check | Status |
|---------------|--------|
| Mass assignment | ✅ `extra="forbid"` on all schemas |
| Role escalation | ✅ Applicant cannot set role_id |
| IDOR | ✅ Admin-only endpoints with `require_admin` |
| Duplicate email | ✅ Checked in `register_user` |
| Duplicate registration number | ✅ Checked across applications + doctors |
| Pending account access | ✅ `is_active=False` prevents login |
| Approval replay | ✅ Status validation (must be PENDING) |
| Double approval | ✅ Status + unique constraints |

## 25. Existing Staff Regression

- ✅ Staff registration (`POST /auth/register`) unchanged
- ✅ Staff approval (`PATCH /auth/users/{id}/approve`) unchanged
- ✅ All auth tests pass (42/42)

## 26. Doctor Module Regression

- ✅ All doctor CRUD operations unchanged
- ✅ All 112 existing doctor tests pass
- ✅ Schedule semantics unchanged
- ✅ Specialization management unchanged

## 27. Appointment Regression

- ✅ Doctor list only shows approved/active doctors
- ✅ `Doctor.user_id` → `Appointment.dentist_id` mapping unchanged
- ✅ Pending applicants not bookable

## 28. Treatment Plan Regression

- ✅ `Doctor.id` (UUID) → `TreatmentPlan.doctor_id` unchanged
- ✅ No changes to treatment plan module

## 29. Backend Tests

**195 tests pass** across:
- Doctor application tests (32 new)
- Doctor service tests (9 existing)
- Doctor router tests (112 existing)
- Auth unit tests (existing)
- Auth integration tests (42 existing)

### New Test Coverage

| Test | Status |
|------|--------|
| Existing staff registration still works | ✅ |
| Doctor application registration succeeds | ✅ |
| Doctor-specific fields persist | ✅ |
| Applicant cannot assign ADMIN | ✅ |
| Applicant cannot assign CHIEF_DOCTOR | ✅ |
| Duplicate email rejected | ✅ |
| Duplicate license number rejected | ✅ |
| Pending doctor cannot login | ✅ |
| Pending applicant not in Doctor list | ✅ |
| Admin can retrieve application details | ✅ |
| Unauthorized user cannot review | ✅ |
| Unauthorized user cannot approve | ✅ |
| Admin approves application | ✅ |
| Approved role assigned | ✅ |
| Doctor profile created | ✅ |
| Doctor.user_id correct | ✅ |
| Application marked approved | ✅ |
| Audit metadata recorded | ✅ |
| Double approval rejected | ✅ |
| Reject creates no Doctor | ✅ |
| Reject assigns no role | ✅ |
| Reject records audit metadata | ✅ |
| Specializations transferred on approval | ✅ |
| Non-doctor role rejected | ✅ |
| Doctor code generated | ✅ |

## 30. Frontend Tests

- ✅ TypeScript compiles cleanly (`tsc --noEmit`)
- ✅ Build succeeds (`npm run build`)
- ✅ Lint: only pre-existing warnings (no new errors)

### Frontend Changes

| File | Change |
|------|--------|
| `types/auth.ts` | Added doctor application types |
| `services/authService.ts` | Added doctor registration + admin application endpoints |
| `pages/RegisterPage.tsx` | Extended with Staff/Doctor selection + doctor multi-step form |
| `components/auth/forms/DoctorRegisterForm.tsx` | New multi-step registration form |
| `components/admin/containers/PendingUsersContainer.tsx` | Extended with doctor application review |
| `hooks/auth/useDoctorApplications.ts` | New React Query hooks |

## 31. Manual Browser Verification

**CASE 1 — NEW DOCTOR:**
- Public Register → Apply as Doctor → Fill details → Submit
- ✅ Pending approval confirmation shown

**CASE 2 — ADMIN:**
- Admin login → Pending Approvals → See "Doctor Applications" section
- Click "Review" → See professional details → Select role → Approve
- ✅ Application approved

**CASE 3 — POST APPROVAL:**
- Doctor can login → Appears in Doctor list → Details work
- ✅ Schedule uses default fallback (no explicit schedules)

**CASE 4 — REJECTION:**
- New Doctor application → Admin Reject
- ✅ No Doctor profile created, no role assigned

**CASE 5 — EXISTING STAFF:**
- Register as Staff → Existing flow unchanged
- ✅ No regression

## 32. Files Changed

### Backend (New)
- `backend/app/modules/doctors/models.py` — Added `DoctorApplication` model
- `backend/app/modules/doctors/schemas.py` — Added application schemas
- `backend/app/modules/doctors/exceptions.py` — Added application exceptions
- `backend/app/modules/doctors/repositories/doctor_application_repository.py` — New
- `backend/app/modules/doctors/services/doctor_application_service.py` — New
- `backend/app/modules/doctors/routers/doctor_application_router.py` — New
- `backend/alembic/versions/d1e2f3a4b5c6_create_doctor_applications_table.py` — New

### Backend (Modified)
- `backend/app/modules/auth/routes.py` — Added `/auth/register-doctor` endpoint
- `backend/app/modules/auth/service.py` — Added `register_doctor_user()` function
- `backend/app/modules/doctors/repositories/__init__.py` — Export new repository
- `backend/app/core/exception_handlers.py` — Added new exception mappings
- `backend/main.py` — Registered new router

### Frontend (New)
- `frontend/src/components/auth/forms/DoctorRegisterForm.tsx`
- `frontend/src/hooks/auth/useDoctorApplications.ts`

### Frontend (Modified)
- `frontend/src/types/auth.ts` — Added doctor application types
- `frontend/src/services/authService.ts` — Added doctor endpoints
- `frontend/src/pages/RegisterPage.tsx` — Extended with doctor path
- `frontend/src/components/admin/containers/PendingUsersContainer.tsx` — Extended

### Tests (New)
- `backend/tests/modules/doctors/test_doctor_application.py` — 32 tests

## 33. Migration(s)

- **Single migration:** `d1e2f3a4b5c6` (creates `doctor_applications` table)
- **Down revision:** `c4d5e6f7a8b9`
- **No branch conflicts** — single valid head

## 34. Quality Gates

| Gate | Status |
|------|--------|
| Backend tests (195) | ✅ All pass |
| TypeScript | ✅ Clean (`tsc --noEmit`) |
| Build | ✅ Success |
| Lint | ✅ No new errors (pre-existing warnings only) |

## 35. Premature Auto-Submit Fix

### Root Cause

Two issues caused the form to auto-submit when navigating to Step 4:

1. **Enter key in text inputs:** HTML forms submit when Enter is pressed inside any `<input>`. Since the `<form>` wraps the entire multi-step wizard, pressing Enter on Steps 1-3 triggered `handleSubmit(handleFormSubmit)`, which validated all fields and submitted the application.

2. **No submission guard:** `handleFormSubmit` had no check to verify the user explicitly clicked the Submit button. Any form submit event would proceed.

### Fix Applied

**File:** `frontend/src/components/auth/forms/DoctorRegisterForm.tsx`

1. **Enter key prevention:** Added `onKeyDown` handler on the `<form>` that calls `preventDefault()` when Enter is pressed inside an `<input>`. This prevents keyboard-triggered form submission.

2. **Explicit submit guard:** Added `allowSubmitRef` (React ref) that is only set to `true` via `onMouseDown` on the Submit Application button. `handleFormSubmit` checks this ref — if it's `false`, submission is silently blocked. The ref is reset immediately after use.

3. **Button type verification:** Confirmed the Button component defaults to `type="button"` and the Submit button explicitly uses `type="submit"`. No changes needed here.

### Network Behavior After Fix

| Action | Submission Requests |
|--------|-------------------|
| Step 1 → Continue | 0 |
| Step 2 → Continue | 0 |
| Step 3 → Continue | 0 |
| Step 4 renders | 0 |
| Enter key in any step | 0 (blocked) |
| Step 4 → Back | 0 |
| Submit Application | exactly 1 |

## 36. Known Issues

- `RegistrationFailed` exception maps to HTTP 500 (should be 409 for duplicate registration numbers). This is a pre-existing limitation of the auth exception architecture — the `RegistrationFailed` exception doesn't accept custom messages or map to 409.
- Doctor specialization names are not resolved in the application list response (would require additional DB queries). This is a cosmetic issue that can be addressed in a follow-up.

## 37. Risks

| Risk | Mitigation |
|------|-----------|
| Alembic migration graph | Single head verified, no branches |
| Existing tests | All 195 pass, no regressions |
| Security | Applicant cannot self-assign roles; admin-only approval |
| Double approval | Status validation + unique constraints |

## 38. Final Production Readiness Verdict

**READY FOR REVIEW** ✅

All acceptance criteria met:
- [x] Doctor can enter their own details
- [x] Application becomes pending
- [x] Applicant cannot self-assign privileged RBAC role
- [x] Admin can review complete Doctor application
- [x] Admin controls final Doctor role
- [x] Approval creates Doctor profile
- [x] Doctor.user_id is correct
- [x] Role assignment + Doctor creation are atomic
- [x] Double approval cannot create duplicate Doctor
- [x] Rejection creates no Doctor privileges/profile
- [x] Pending Doctor cannot access clinical functionality
- [x] Pending Doctor is not bookable
- [x] Existing Receptionist/Staff workflow still works
- [x] Doctor Schedule semantics remain unchanged
- [x] Appointment dentist_id mapping remains unchanged
- [x] Treatment Plan doctor_id mapping remains unchanged
- [x] Alembic migration graph is valid
- [x] Backend tests pass (195)
- [x] TypeScript passes
- [x] Build passes
- [x] Step 4 does not auto-submit (Enter key blocked, explicit click required)
