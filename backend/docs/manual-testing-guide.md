# DensCare Backend — Manual Testing Guide

> **Version:** 1.0  
> **Stack:** FastAPI + SQLAlchemy + SQLite (test) / PostgreSQL (prod)  
> **Base URL:** `http://localhost:8000`  
> **Swagger UI:** `http://localhost:8000/docs`  
> **Redoc:** `http://localhost:8000/redoc`

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Running the Server](#2-running-the-server)
3. [Testing Flow Overview (Workflow)](#3-testing-flow-overview)
4. [Module 1: Authentication & Users](#4-authentication--users)
5. [Module 2: Patients](#5-patients)
6. [Module 3: Doctors & Specializations & Schedules](#6-doctors--specializations--schedules)
7. [Module 4: Appointments](#7-appointments)
8. [Module 5: Treatment Plans & Procedures](#8-treatment-plans--procedures)
9. [Module 6: Patient Records](#9-patient-records)
10. [Module 7: Billing (Invoices, Payments, Receipts, Credit Notes, Refunds)](#10-billing)
11. [Testing Error Responses](#11-testing-error-responses)
12. [Testing RBAC / Authorization](#12-testing-rbac--authorization)
13. [Quick Reference Table](#13-quick-reference-table)

---

## 1. Prerequisites & Setup

### 1.1. Required tools

| Tool | Purpose |
|------|---------|
| **Python 3.11+** | Runtime |
| **pip / pipenv** | Package management |
| **cURL** or **Postman** or **Insomnia** | API testing |
| **jq** (optional) | Pretty-print JSON responses |

### 1.2. Environment variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=sqlite:///./test_db.sqlite3
JWT_SECRET=my32characterslongsupersecretkeyforjwt
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

> **Note:** For PostgreSQL, change `DATABASE_URL` to `postgresql://user:pass@localhost:5432/denscare`.

### 1.3. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 1.4. Run database migrations

```bash
alembic upgrade head
```

### 1.5. Seed roles

```bash
python -m app.database.seed_roles
```

This creates the following roles in the database:

| ID | Name |
|----|------|
| 1 | ADMIN |
| 2 | CHIEF_DOCTOR |
| 3 | GENERAL_DOCTOR |
| 4 | SPECIALIST_DOCTOR |
| 5 | CONSULTING_DOCTOR |
| 6 | RECEPTIONIST |
| 7 | DENTAL_ASSISTANT |

### 1.6. Test database connection

```bash
python -m app.database.test_connection
```

Expected output: `Database Connected Successfully`

---

## 2. Running the Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Verify:** Open `http://localhost:8000` in browser.  
Expected response:

```json
{ "message": "DensCare Backend Running" }
```

---

## 3. Testing Flow Overview (Workflow)

The business flows in this order:

```
1. Register User ──► Admin Approves User ──► Login ──► Get Token
                                                      │
2. Create Patient ◄───────────────────────────────────┤
   Create Doctor (linked to User)                     │
   Create Specialization                              │
   Assign Specialization to Doctor                    │
   Create Doctor Schedule                             │
                                                      │
3. Create Appointment ◄───────────────────────────────┤
   (links patient + doctor + date/time)                │
                                                      │
4. Create Procedure (master catalog) ◄────────────────┤
   Create Treatment Plan                               │
   Add Items to Treatment Plan                         │
   Submit for Review → Approve → Accept                │
                                                      │
5. Create Patient Record ◄────────────────────────────┤
   Add Diagnoses, Prescriptions, Attachments           │
                                                      │
6. Create Invoice ◄───────────────────────────────────┤
   (link to patient, treatment plan, appointment)      │
   Issue Invoice                                       │
   Create Payment                                      │
   Complete Payment                                    │
   Allocate Payment to Invoice                         │
   Generate Receipt                                    │
   (Optional) Create Credit Note / Refund              │
```

---

## 4. Authentication & Users

### 4.1. Register a new user

**Endpoint:** `POST /auth/register`  
**Auth:** None (public)  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `full_name` | string | 2–100 chars |
| `email` | string (email) | Valid email, will be lowercase'd |
| `password` | string | 8–128 chars; must have uppercase, lowercase, digit, and special char |

**Example request:**

```bash
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Admin User",
    "email": "admin@denscare.com",
    "password": "Secure@Pass1"
  }' | jq
```

**Expected response (201):**

```json
{
  "message": "Registration submitted. Waiting for admin approval."
}
```

**Test cases:**
- ✅ Valid registration returns 201
- ❌ Duplicate email returns 409
- ❌ Weak password returns 422 (e.g. `"password"`)
- ❌ Missing fields returns 422

---

### 4.2. List pending users

**Endpoint:** `GET /auth/users/pending`  
**Auth:** Admin only (see section 12 to get token)

```bash
curl -s http://localhost:8000/auth/users/pending \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq
```

**Expected response (200):**

```json
[
  {
    "id": 1,
    "full_name": "Admin User",
    "email": "admin@denscare.com",
    "status": "pending"
  }
]
```

---

### 4.3. Approve a user (assign role)

**Endpoint:** `PATCH /auth/users/{user_id}/approve`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `role_id` | integer | Must exist in roles table (1 = ADMIN, 2–5 = doctors, 6 = RECEPTIONIST, 7 = DENTAL_ASSISTANT) |

```bash
curl -s -X PATCH http://localhost:8000/auth/users/1/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role_id": 1}' | jq
```

**Expected response (200):**

```json
{ "message": "User approved successfully." }
```

> **Important:** You need at least one **admin user** to bootstrap the system.
>
> 1. Register a user with `admin@denscare.com`
> 2. Manually update their role in the database: `UPDATE users SET role_id = 1, status = 'active' WHERE email = 'admin@denscare.com';`
> 3. Then use this admin to approve other users

---

### 4.4. Login

**Endpoint:** `POST /auth/login`  
**Auth:** None  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `username` | string (form field) | The user's email |
| `password` | string (form field) | The password |

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=admin@denscare.com&password=Secure@Pass1' | jq
```

**Expected response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

Save the `access_token` for subsequent requests. Set it as:

```bash
TOKEN="<paste access_token here>"
```

**Test cases:**
- ✅ Valid credentials → 200 with token
- ❌ Wrong password → 401
- ❌ Inactive user → 403
- ❌ Pending user (not yet approved) → 401

---

### 4.5. Get current user profile

**Endpoint:** `GET /auth/me`  
**Auth:** Any authenticated user

```bash
curl -s http://localhost:8000/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected response (200):**

```json
{
  "id": 1,
  "full_name": "Admin User",
  "email": "admin@denscare.com",
  "status": "active"
}
```

---

### 4.6. Deactivate a user

**Endpoint:** `PATCH /auth/users/{user_id}/deactivate`  
**Auth:** Admin only (cannot deactivate self)

```bash
curl -s -X PATCH http://localhost:8000/auth/users/2/deactivate \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 4.7. List / Search users (admin)

**Endpoint:** `GET /users`  
**Auth:** Admin only  
**Optional query params:** `search`, `role_id`, `status`, `page`, `page_size`

```bash
curl -s "http://localhost:8000/users?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 4.8. Get user details (admin)

**Endpoint:** `GET /users/{user_id}`  
**Auth:** Admin only

```bash
curl -s http://localhost:8000/users/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 4.9. Change user role (admin)

**Endpoint:** `PATCH /users/{user_id}/role`  
**Auth:** Admin only (cannot change own role)

```bash
curl -s -X PATCH http://localhost:8000/users/2/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_id": 6}' | jq
```

---

### 4.10. Activate user (admin)

**Endpoint:** `PATCH /users/{user_id}/activate`  
**Auth:** Admin only (cannot activate self)

```bash
curl -s -X PATCH http://localhost:8000/users/2/activate \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 5. Patients

### 5.1. Create patient

**Endpoint:** `POST /patients`  
**Auth:** Admin, Receptionist  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `first_name` | string | 2–100 chars, alphabetic only |
| `last_name` | string | 2–100 chars, alphabetic only |
| `date_of_birth` | date | YYYY-MM-DD, not in future |
| `gender` | string | `"male"`, `"female"`, or `"other"` |
| `primary_contact_number` | string | 10–15 digits, optional leading `+` |

**Optional fields:**

| Field | Type | Rules |
|-------|------|-------|
| `middle_name` | string | nullable, max 100 chars |
| `emergency_contact_number` | string | 10–15 digits, optional leading `+` |
| `email` | string (email) | nullable |
| `address` | string | max 500 chars |
| `remarks` | string | max 1000 chars |

```bash
curl -s -X POST http://localhost:8000/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Juan",
    "middle_name": "Reyes",
    "last_name": "Dela Cruz",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "primary_contact_number": "+639123456789",
    "email": "juan@example.com",
    "address": "123 Rizal St., Manila"
  }' | jq
```

**Expected response (201):**

```json
{
  "id": "a1b2c3d4-e5f6-...",
  "patient_code": "PAT-000001",
  "full_name": "Juan Reyes Dela Cruz",
  "date_of_birth": "1990-05-15",
  "age": 36,
  "gender": "male",
  "primary_contact_number": "+639123456789",
  ...
}
```

> Save the patient `id` (UUID) for later use: `PATIENT_ID="<uuid>"`

**Test cases:**
- ✅ Valid patient → 201
- ❌ Missing required fields → 422
- ❌ Future date_of_birth → 422
- ❌ Duplicate (exact match) → 409
- ❌ Non-admin/receptionist → 403

---

### 5.2. List patients

**Endpoint:** `GET /patients`  
**Auth:** Admin, Receptionist, Doctor roles  
**Optional query params:** `page`, `page_size`, `search`, `is_active`

```bash
curl -s "http://localhost:8000/patients?page=1&page_size=10&search=Juan" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 5.3. Get patient

**Endpoint:** `GET /patients/{patient_id}`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s http://localhost:8000/patients/$PATIENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 5.4. Update patient

**Endpoint:** `PATCH /patients/{patient_id}`  
**Auth:** Admin, Receptionist  
**All fields optional** (partial update)

```bash
curl -s -X PATCH http://localhost:8000/patients/$PATIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Juan Carlos", "remarks": "Updated remarks"}' | jq
```

---

### 5.5. Activate / Deactivate patient

**Endpoints:**  
`PATCH /patients/{patient_id}/activate`  
`PATCH /patients/{patient_id}/deactivate`  
**Auth:** Admin only

```bash
curl -s -X PATCH http://localhost:8000/patients/$PATIENT_ID/deactivate \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 5.6. Patient profile

**Endpoint:** `GET /patients/{patient_id}/profile`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s http://localhost:8000/patients/$PATIENT_ID/profile \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 6. Doctors, Specializations & Schedules

### 6.1. Create specialization (master data)

**Endpoint:** `POST /specializations`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Unique |
| `code` | string | Unique |

```bash
curl -s -X POST http://localhost:8000/specializations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Orthodontics",
    "code": "ORTHO",
    "description": "Braces and alignment"
  }' | jq
```

**Expected response (201):** The specialization object. Save its `id` for later: `SPEC_ID=<id>`

---

### 6.2. List specializations

**Endpoint:** `GET /specializations`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s "http://localhost:8000/specializations?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 6.3. Create doctor

**Endpoint:** `POST /doctors`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `user_id` | integer | Must be an existing user with a doctor role (2–5) |
| `registration_number` | string | Unique, uppercase + digits + hyphens only |
| `primary_phone` | string | 10–15 digits, optional leading `+` |
| `date_of_birth` | date | YYYY-MM-DD, not in future |
| `gender` | string | `"male"`, `"female"`, or `"other"` |

**Optional fields:** `qualification`, `years_of_experience`, `consultation_fee`, `biography`, `languages_known`, `emergency_contact_name`, `emergency_contact_phone`, `profile_photo_url`, `address`

```bash
curl -s -X POST http://localhost:8000/doctors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "registration_number": "DOC-2024-001",
    "primary_phone": "+639171234567",
    "date_of_birth": "1985-03-20",
    "gender": "male",
    "qualification": "DMD, University of the Philippines",
    "years_of_experience": 10,
    "consultation_fee": 800.00,
    "biography": "Experienced orthodontist",
    "languages_known": ["English", "Filipino"]
  }' | jq
```

**Expected response (201):** The doctor object. Save its `id` (UUID) for later: `DOCTOR_ID="<uuid>"`

---

### 6.4. Assign specialization to doctor

**Endpoint:** `POST /doctors/{doctor_id}/specializations`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `specialization_id` | integer | Must exist |
| `is_primary` | boolean | Whether this is the primary specialization |

```bash
curl -s -X POST http://localhost:8000/doctors/$DOCTOR_ID/specializations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"specialization_id": 1, "is_primary": true}' | jq
```

---

### 6.5. Create doctor schedule

**Endpoint:** `POST /doctors/{doctor_id}/schedules`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `day_of_week` | integer | 0 = Monday, 1 = Tuesday, ... 5 = Saturday |
| `start_time` | string | HH:MM (24-hour) |
| `end_time` | string | HH:MM (24-hour), must be after start_time |
| `is_available` | boolean | |

**Optional fields:** `max_patients`, `notes`, `consultation_duration_minutes` (default: 30)

```bash
curl -s -X POST http://localhost:8000/doctors/$DOCTOR_ID/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "day_of_week": 0,
    "start_time": "10:00",
    "end_time": "13:00",
    "is_available": true,
    "consultation_duration_minutes": 30
  }' | jq
```

---

### 6.6. List doctor schedules

**Endpoint:** `GET /doctors/{doctor_id}/schedules`  
**Auth:** Doctor (self) or Admin/Receptionist (all)

```bash
curl -s http://localhost:8000/doctors/$DOCTOR_ID/schedules \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 6.7. Other doctor operations

| Operation | Endpoint | Auth | Notes |
|-----------|----------|------|-------|
| List doctors | `GET /doctors` | Admin, Receptionist | Supports `search`, `specialization_id`, `is_active`, `is_available` filters |
| Get doctor | `GET /doctors/{doctor_id}` | Doctor (self) or Admin/Receptionist | |
| Get doctor by user | `GET /doctors/user/{user_id}` | | |
| Update doctor | `PATCH /doctors/{doctor_id}` | Admin | Partial update |
| Delete doctor | `DELETE /doctors/{doctor_id}` | Admin | Hard delete |
| Activate doctor | `PATCH /doctors/{doctor_id}/activate` | Admin | |
| Deactivate doctor | `PATCH /doctors/{doctor_id}/deactivate` | Admin | |
| Toggle leave | `PATCH /doctors/{doctor_id}/leave` | Admin | |
| Toggle availability | `PATCH /doctors/{doctor_id}/availability` | Admin | Cannot mark inactive doctor as available |
| Doctor profile | `GET /doctors/{doctor_id}/profile` | Doctor (self) or Admin/Receptionist | Includes specializations + schedules |
| Replace weekly schedule | `PUT /doctors/{doctor_id}/schedules` | Admin | Atomically replaces all schedules |
| Update schedule | `PATCH /doctors/{doctor_id}/schedules/{schedule_id}` | Admin | |
| Delete schedule | `DELETE /doctors/{doctor_id}/schedules/{schedule_id}` | Admin | |

---

## 7. Appointments

### 7.1. Create appointment

**Endpoint:** `POST /appointments`  
**Auth:** Admin, Receptionist, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `patient_id` | UUID | Must exist |
| `dentist_id` | integer | User ID of the doctor |
| `appointment_date` | string (date) | YYYY-MM-DD |
| `start_time` | string (time) | HH:MM (24-hour) |
| `appointment_type` | string | One of: `"Consultation"`, `"Follow-Up"`, `"Emergency"`, `"Procedure"`, `"Review"`, `"Other"` |
| `reason_for_visit` | string | 3–500 chars |

**Optional fields:**

| Field | Type | Rules |
|-------|------|-------|
| `duration_minutes` | integer | Default 30, must be >= 1 |
| `notes` | string | nullable, max 5000 chars |

```bash
curl -s -X POST http://localhost:8000/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "'"$PATIENT_ID"'",
    "dentist_id": 2,
    "appointment_date": "2026-08-15",
    "start_time": "10:00",
    "appointment_type": "Consultation",
    "reason_for_visit": "Regular dental checkup",
    "duration_minutes": 30,
    "notes": "Patient mentioned tooth sensitivity"
  }' | jq
```

**Expected response (201):** The appointment object. Save its `id` (UUID): `APPT_ID="<uuid>"`

---

### 7.2. List appointments

**Endpoint:** `GET /appointments`  
**Auth:** Admin, Receptionist, Doctor roles  
**Optional query params:** `skip`, `limit`

```bash
curl -s "http://localhost:8000/appointments?skip=0&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 7.3. Get today's appointments

**Endpoint:** `GET /appointments/today`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s http://localhost:8000/appointments/today \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 7.4. Get appointment

**Endpoint:** `GET /appointments/{appointment_id}`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s http://localhost:8000/appointments/$APPT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 7.5. Update appointment

**Endpoint:** `PUT /appointments/{appointment_id}`  
**Auth:** Admin, Receptionist, Doctor roles  
**All fields optional** except those you want to change.

```bash
curl -s -X PUT http://localhost:8000/appointments/$APPT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"start_time": "11:00", "notes": "Rescheduled to 11 AM"}' | jq
```

---

### 7.6. Cancel appointment

**Endpoint:** `PATCH /appointments/{appointment_id}/cancel`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s -X PATCH http://localhost:8000/appointments/$APPT_ID/cancel \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Appointment statuses:** `Scheduled`, `Confirmed`, `Checked In`, `In Treatment`, `Completed`, `Cancelled`, `No Show`

---

## 8. Treatment Plans & Procedures

### 8.1. Create procedure (master catalog)

**Endpoint:** `POST /procedures`  
**Auth:** Admin only  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `code` | string | Unique, will be uppercased |
| `name` | string | Display name |
| `default_cost` | decimal | Must be >= 0 |
| `category` | string | One of: `diagnostic`, `preventive`, `restorative`, `endodontic`, `periodontic`, `prosthodontic`, `oral_surgery`, `orthodontic`, `cosmetic`, `implant`, `other` |

**Optional fields:** `description` (max 2000 chars)

```bash
curl -s -X POST http://localhost:8000/procedures \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "RCT001",
    "name": "Root Canal Treatment - Molar",
    "default_cost": 15000.00,
    "category": "endodontic",
    "description": "Complete RCT for molar tooth"
  }' | jq
```

Save the procedure `id`: `PROC_ID=<id>`

---

### 8.2. List / Search procedures

```bash
# List with filters
curl -s "http://localhost:8000/procedures?page=1&page_size=20&category=endodontic" \
  -H "Authorization: Bearer $TOKEN" | jq

# Search by code or name
curl -s "http://localhost:8000/procedures/search?term=RCT" \
  -H "Authorization: Bearer $TOKEN" | jq

# Active procedures only (for dropdowns)
curl -s http://localhost:8000/procedures/active \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 8.3. Create treatment plan

**Endpoint:** `POST /treatment-plans`  
**Auth:** Admin, Receptionist, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `patient_id` | UUID | Must exist and be active |
| `doctor_id` | UUID | Must exist |

**Optional fields:**

| Field | Type | Rules |
|-------|------|-------|
| `clinical_notes` | string | |
| `observations` | string | |
| `dentist_recommendations` | string | |
| `valid_from` | date | |
| `valid_to` | date | Must be >= `valid_from` if provided |
| `plan_code` | string | Auto-generated as TXN-XXXXXX if omitted |

```bash
curl -s -X POST http://localhost:8000/treatment-plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "'"$PATIENT_ID"'",
    "doctor_id": "'"$DOCTOR_ID"'",
    "clinical_notes": "Patient needs RCT on tooth 36",
    "observations": "Deep caries detected",
    "dentist_recommendations": "RCT followed by crown"
  }' | jq
```

Save the plan ID: `PLAN_ID="<uuid>"`

---

### 8.4. Add item to treatment plan

**Endpoint:** `POST /treatment-plans/{plan_id}/items`  
**Auth:** Admin, Receptionist, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `procedure_id` | integer | Must exist |
| `sequence_number` | integer | >= 1, unique per plan |

**Optional fields:**

| Field | Type | Rules |
|-------|------|-------|
| `estimated_cost` | decimal | Override procedure default cost |
| `discount` | decimal | Default 0.00 |
| `tooth_number` | integer | FDI tooth number (11–48 permanent, 51–85 primary) |
| `tooth_surface` | string | e.g. "MOD", "BOL" |
| `quadrant` | string | `UR`, `UL`, `LL`, `LR` |
| `arch` | string | `upper`, `lower` |
| `notes` | string | |

```bash
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "procedure_id": 1,
    "sequence_number": 1,
    "estimated_cost": 15000.00,
    "tooth_number": 36,
    "notes": "Upper left first molar"
  }' | jq
```

---

### 8.5. Treatment plan workflow (state machine)

The plan goes through these statuses:

```
DRAFT ──► UNDER_REVIEW ──► PROPOSED ──► ACCEPTED ──► IN_PROGRESS ──► COMPLETED
  │                            │            │
  └── CANCELLED ◄──────────────┼────────────┘
                  REJECTED ◄───┘
                              ON_HOLD ◄───► IN_PROGRESS
```

**Transition endpoints (all `POST`):**

| Step | Endpoint | From → To |
|------|----------|-----------|
| Submit for review | `/treatment-plans/{plan_id}/submit-for-review` | DRAFT → UNDER_REVIEW |
| Approve review | `/treatment-plans/{plan_id}/approve-review` | UNDER_REVIEW → PROPOSED |
| Reject review | `/treatment-plans/{plan_id}/reject-review` | UNDER_REVIEW → DRAFT |
| Accept plan | `/treatment-plans/{plan_id}/accept` | PROPOSED → ACCEPTED |
| Decline plan | `/treatment-plans/{plan_id}/decline` | PROPOSED → REJECTED |
| Cancel plan | `/treatment-plans/{plan_id}/cancel` | Any non-terminal → CANCELLED |
| Start treatment | `/treatment-plans/{plan_id}/start-treatment` | ACCEPTED → IN_PROGRESS |
| Put on hold | `/treatment-plans/{plan_id}/hold` | IN_PROGRESS → ON_HOLD |
| Resume | `/treatment-plans/{plan_id}/resume` | ON_HOLD → IN_PROGRESS |
| Complete | `/treatment-plans/{plan_id}/complete` | IN_PROGRESS/ON_HOLD → COMPLETED |

```bash
# Step 1: Submit for review
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/submit-for-review \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 2: Approve review
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/approve-review \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 3: Doctor approve
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/doctor-approve \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 4: Patient acknowledge
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/patient-acknowledge \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 5: Accept plan
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/accept \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 6: Start treatment
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/start-treatment \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 7: Complete treatment
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/complete \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

### 8.6. Version management

```bash
# Create a version snapshot
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "Cost adjustment after consultation"}' | jq

# List versions
curl -s http://localhost:8000/treatment-plans/$PLAN_ID/versions \
  -H "Authorization: Bearer $TOKEN" | jq

# Get a specific version
curl -s http://localhost:8000/treatment-plans/$PLAN_ID/versions/<VERSION_ID> \
  -H "Authorization: Bearer $TOKEN" | jq

# Restore a version
curl -s -X POST http://localhost:8000/treatment-plans/$PLAN_ID/versions/<VERSION_ID>/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

---

## 9. Patient Records

> Patient Records have sub-resources: diagnoses, prescriptions, attachments, follow-ups, and audit logs.

### 9.1. Create patient record

**Endpoint:** `POST /patient-records`  
**Auth:** Admin, Doctor roles

```bash
curl -s -X POST http://localhost:8000/patient-records \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "'"$PATIENT_ID"'",
    "record_type": "consultation",
    "notes": "Initial consultation notes"
  }' | jq
```

Save the record ID: `RECORD_ID="<uuid>"`

**Record statuses:** `DRAFT`, `IN_PROGRESS`, `UNDER_REVIEW`, `COMPLETED`, `FINALIZED`, `LOCKED`

---

## 10. Billing

### 10.1. Invoice Management

#### 10.1.1. Create invoice (Draft)

**Endpoint:** `POST /billing/invoices`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `patient_id` | UUID | Must exist |
| `items` | array | At least one item required |

**Per item (required):**

| Field | Type | Rules |
|-------|------|-------|
| `description` | string | |
| `quantity` | integer | >= 1 |
| `unit_price` | decimal | >= 0 |
| `sequence_number` | integer | >= 1 |

**Optional fields:** `treatment_plan_id`, `appointment_id`, `doctor_id`, `notes`, `due_date`, `invoice_date`, `currency_code` (default: "PHP")

```bash
curl -s -X POST http://localhost:8000/billing/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "'"$PATIENT_ID"'",
    "treatment_plan_id": "'"$PLAN_ID"'",
    "doctor_id": "'"$DOCTOR_ID"'",
    "items": [
      {
        "description": "Root Canal Treatment",
        "quantity": 1,
        "unit_price": 15000.00,
        "sequence_number": 1
      },
      {
        "description": "Dental Crown",
        "quantity": 1,
        "unit_price": 8000.00,
        "sequence_number": 2
      }
    ],
    "notes": "Payment due within 30 days",
    "due_date": "2026-09-15"
  }' | jq
```

Save the invoice ID: `INVOICE_ID="<uuid>"`

**Invoice statuses:** `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `cancelled`, `void`

---

#### 10.1.2. Issue invoice (Draft → Issued)

**Endpoint:** `POST /billing/invoices/{invoice_id}/issue`  
**Auth:** Admin, Receptionist, Doctor roles  
**Note:** Once issued, the invoice becomes **immutable** (no further edits).

```bash
curl -s -X POST http://localhost:8000/billing/invoices/$INVOICE_ID/issue \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.1.3. List invoices

**Endpoint:** `GET /billing/invoices`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles  
**Optional query params:** `query` (search), `patient_id`, `doctor_id`, `status`, `date_from`, `date_to`, `page`, `page_size`, `sort_by`, `sort_order`

```bash
curl -s "http://localhost:8000/billing/invoices?page=1&page_size=20&status=issued" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.1.4. Get invoice

**Endpoint:** `GET /billing/invoices/{invoice_id}`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles

```bash
curl -s http://localhost:8000/billing/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.1.5. Update draft invoice

**Endpoint:** `PATCH /billing/invoices/{invoice_id}`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles  
**Only works for Draft invoices!**

```bash
curl -s -X PATCH http://localhost:8000/billing/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Updated notes", "due_date": "2026-10-15"}' | jq
```

---

#### 10.1.6. Cancel invoice

**Endpoint:** `POST /billing/invoices/{invoice_id}/cancel`  
**Auth:** Admin, Receptionist, Doctor roles  
**Required:** `cancellation_reason` in body

```bash
curl -s -X POST http://localhost:8000/billing/invoices/$INVOICE_ID/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancellation_reason": "Patient requested cancellation"}' | jq
```

---

#### 10.1.7. Delete draft invoice

**Endpoint:** `DELETE /billing/invoices/{invoice_id}`  
**Auth:** Admin only  
**Only works for Draft invoices!**

```bash
curl -s -X DELETE http://localhost:8000/billing/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

### 10.2. Payment Management

#### 10.2.1. Create payment (Pending)

**Endpoint:** `POST /billing/payments`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `patient_id` | UUID | Must exist |
| `total_amount` | decimal | > 0 |
| `payment_method` | string | One of: `cash`, `card`, `upi`, `bank_transfer`, `cheque`, `insurance`, `wallet` |
| `payment_date` | date | |

**Optional fields:** `reference_number`, `notes`

```bash
curl -s -X POST http://localhost:8000/billing/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "'"$PATIENT_ID"'",
    "total_amount": 23000.00,
    "payment_method": "cash",
    "payment_date": "2026-08-15",
    "reference_number": "CASH-001",
    "notes": "Full payment for RCT"
  }' | jq
```

Save the payment ID: `PAYMENT_ID="<uuid>"`

**Payment statuses:** `pending`, `completed`, `failed`, `refunded`, `reversed`, `void`

---

#### 10.2.2. Complete payment (Pending → Completed)

**Endpoint:** `POST /billing/payments/{payment_id}/complete`  
**Auth:** Admin, Receptionist, Doctor roles

```bash
curl -s -X POST http://localhost:8000/billing/payments/$PAYMENT_ID/complete \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.2.3. Allocate payment to invoice

**Endpoint:** `POST /billing/payments/{payment_id}/allocate`  
**Auth:** Admin, Receptionist, Doctor roles  
**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `invoice_id` | UUID | Must be Issued/Partially Paid/Overdue |
| `amount` | decimal | Must be <= unallocated balance |

```bash
curl -s -X POST http://localhost:8000/billing/payments/$PAYMENT_ID/allocate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "'"$INVOICE_ID"'",
    "amount": 23000.00
  }' | jq
```

---

#### 10.2.4. List payments

**Endpoint:** `GET /billing/payments`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles

```bash
curl -s "http://localhost:8000/billing/payments?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.2.5. Get payment

**Endpoint:** `GET /billing/payments/{payment_id}`  
**Auth:** Admin, Receptionist, Dental Assistant, Doctor roles

```bash
curl -s http://localhost:8000/billing/payments/$PAYMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

#### 10.2.6. Other payment operations

| Operation | Endpoint | Auth | Notes |
|-----------|----------|------|-------|
| Update payment | `PATCH /billing/payments/{payment_id}` | Write roles | Only Pending payments |
| Delete payment | `DELETE /billing/payments/{payment_id}` | Admin only | Only Pending payments |
| Fail payment | `POST /billing/payments/{payment_id}/fail` | Workflow roles | Optional reason |
| Void payment | `POST /billing/payments/{payment_id}/void` | Workflow roles | Optional reason |
| Deallocate | `POST /billing/payments/{payment_id}/deallocate` | Workflow roles | Removes allocation |
| List allocations | `GET /billing/payments/{payment_id}/allocations` | Read roles | |

---

## 11. Testing Error Responses

For each endpoint, test the following error scenarios:

| Scenario | Expected HTTP Status |
|----------|---------------------|
| Missing required field | **422** Unprocessable Entity |
| Invalid field type | **422** |
| Non-existent resource ID (UUID) | **404** Not Found |
| Duplicate resource (email, code, etc.) | **409** Conflict |
| Missing or invalid JWT token | **401** Unauthorized |
| Insufficient role/permission | **403** Forbidden |
| Business rule violation (e.g. inactive user login) | **400** or **409** |
| Invalid status transition | **409** or **400** |

**Example: Missing required field**

```bash
curl -s -X POST http://localhost:8000/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Juan"}' | jq
```

Expected: 422 with validation details.

**Example: Invalid token**

```bash
curl -s http://localhost:8000/patients \
  -H "Authorization: Bearer INVALID_TOKEN" | jq
```

Expected: 401 `{ "detail": "Could not validate credentials" }`

**Example: Non-admin accessing admin endpoint**

```bash
# Register a receptionist, login, get RECEP_TOKEN
curl -s http://localhost:8000/auth/users/pending \
  -H "Authorization: Bearer $RECEP_TOKEN" | jq
```

Expected: 403 `{ "detail": "Not enough permissions" }`

---

## 12. Testing RBAC / Authorization

The system has 7 roles with different permissions:

| Role | Patients | Doctors | Appointments | Treatment Plans | Procedures | Billing (Read) | Billing (Write) | Billing (Workflow) | Billing (Delete) |
|------|----------|---------|--------------|-----------------|------------|----------------|-----------------|--------------------|-------------------|
| ADMIN | CRUD | CRUD | CRUD | CRUD | CRUD | ✅ | ✅ | ✅ | ✅ |
| CHIEF_DOCTOR | R | Self | CRUD | CRUD | R | ✅ | ✅ | ✅ | ❌ |
| GENERAL_DOCTOR | R | Self | CRUD | CRUD | R | ✅ | ✅ | ✅ | ❌ |
| SPECIALIST_DOCTOR | R | Self | CRUD | CRUD | R | ✅ | ✅ | ✅ | ❌ |
| CONSULTING_DOCTOR | R | Self | CRUD | CRUD | R | ✅ | ✅ | ✅ | ❌ |
| RECEPTIONIST | CRU | R | CRUD | CRUD | R | ✅ | ✅ | ✅ | ❌ |
| DENTAL_ASSISTANT | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

**Test each role at least once** to ensure correct authorization.

---

## 13. Quick Reference Table

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login, get JWT token |
| GET | `/auth/me` | Any | Current user profile |
| GET | `/auth/users/pending` | Admin | List pending users |
| PATCH | `/auth/users/{id}/approve` | Admin | Approve user |
| PATCH | `/auth/users/{id}/deactivate` | Admin | Deactivate user |
| GET | `/users` | Admin | List/search users |
| GET | `/users/{id}` | Admin | User details |
| PATCH | `/users/{id}/role` | Admin | Change role |
| PATCH | `/users/{id}/activate` | Admin | Activate user |
| PATCH | `/users/{id}/deactivate` | Admin | Deactivate user |

### Patients
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/patients` | Admin, Receptionist | Create patient |
| GET | `/patients` | Admin, Receptionist, Doctors | List patients |
| GET | `/patients/{id}` | Admin, Receptionist, Doctors | Get patient |
| PATCH | `/patients/{id}` | Admin, Receptionist | Update patient |
| PATCH | `/patients/{id}/activate` | Admin | Activate patient |
| PATCH | `/patients/{id}/deactivate` | Admin | Deactivate patient |
| GET | `/patients/{id}/profile` | Admin, Receptionist, Doctors | Patient profile |

### Doctors
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/doctors` | Admin | Create doctor |
| GET | `/doctors` | Admin, Receptionist | List doctors |
| GET | `/doctors/{id}` | Varies | Get doctor |
| PATCH | `/doctors/{id}` | Admin | Update doctor |
| DELETE | `/doctors/{id}` | Admin | Delete doctor |
| PATCH | `/doctors/{id}/activate` | Admin | Activate doctor |
| PATCH | `/doctors/{id}/deactivate` | Admin | Deactivate doctor |
| PATCH | `/doctors/{id}/leave` | Admin | Toggle leave |
| PATCH | `/doctors/{id}/availability` | Admin | Toggle availability |
| GET | `/doctors/{id}/profile` | Varies | Doctor profile |

### Specializations
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/specializations` | Admin | Create |
| GET | `/specializations` | Clinical roles | List |
| GET | `/specializations/{id}` | Clinical roles | Get |
| PATCH | `/specializations/{id}` | Admin | Update |
| DELETE | `/specializations/{id}` | Admin | Delete |
| PATCH | `/specializations/{id}/activate` | Admin | Activate |
| PATCH | `/specializations/{id}/deactivate` | Admin | Deactivate |

### Schedules
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctors/{id}/schedules` | Varies | List schedules |
| POST | `/doctors/{id}/schedules` | Admin | Create schedule |
| PATCH | `/doctors/{id}/schedules/{sid}` | Admin | Update schedule |
| DELETE | `/doctors/{id}/schedules/{sid}` | Admin | Delete schedule |
| PUT | `/doctors/{id}/schedules` | Admin | Replace weekly schedule |

### Appointments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/appointments` | Clinical roles | Create |
| GET | `/appointments` | Clinical roles | List |
| GET | `/appointments/today` | Clinical roles | Today's appointments |
| GET | `/appointments/{id}` | Clinical roles | Get |
| PUT | `/appointments/{id}` | Clinical roles | Update |
| PATCH | `/appointments/{id}/cancel` | Clinical roles | Cancel |

### Procedures
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/procedures` | Admin | Create |
| GET | `/procedures` | Clinical roles | List |
| GET | `/procedures/search` | Clinical roles | Search |
| GET | `/procedures/active` | Clinical roles | Active (dropdown) |
| GET | `/procedures/count` | Clinical roles | Count |
| GET | `/procedures/{id}` | Clinical roles | Get |
| GET | `/procedures/by-code/{code}` | Clinical roles | Get by code |
| PATCH | `/procedures/{id}` | Admin | Update |
| PATCH | `/procedures/{id}/activate` | Admin | Activate |
| PATCH | `/procedures/{id}/deactivate` | Admin | Deactivate |
| DELETE | `/procedures/{id}` | Admin | Delete |

### Treatment Plans
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/treatment-plans` | Clinical roles | Create |
| GET | `/treatment-plans` | Clinical roles | List |
| GET | `/treatment-plans/search` | Clinical roles | Search |
| GET | `/treatment-plans/dashboard` | Clinical roles | Dashboard summary |
| GET | `/treatment-plans/{id}` | Clinical roles | Get |
| POST | `/treatment-plans/{id}/items` | Clinical roles | Add item |
| PATCH | `/treatment-plans/{id}/items/{iid}` | Clinical roles | Update item |
| DELETE | `/treatment-plans/{id}/items/{iid}` | Clinical roles | Remove item |
| PUT | `/treatment-plans/{id}/items/reorder` | Clinical roles | Reorder items |
| POST | `/treatment-plans/{id}/submit-for-review` | Clinical roles | DRAFT → UNDER_REVIEW |
| POST | `/treatment-plans/{id}/approve-review` | Clinical roles | UNDER_REVIEW → PROPOSED |
| POST | `/treatment-plans/{id}/reject-review` | Clinical roles | UNDER_REVIEW → DRAFT |
| POST | `/treatment-plans/{id}/accept` | Clinical roles | PROPOSED → ACCEPTED |
| POST | `/treatment-plans/{id}/decline` | Clinical roles | PROPOSED → REJECTED |
| POST | `/treatment-plans/{id}/cancel` | Clinical roles | Cancel (any → CANCELLED) |
| POST | `/treatment-plans/{id}/start-treatment` | Clinical roles | ACCEPTED → IN_PROGRESS |
| POST | `/treatment-plans/{id}/hold` | Clinical roles | IN_PROGRESS → ON_HOLD |
| POST | `/treatment-plans/{id}/resume` | Clinical roles | ON_HOLD → IN_PROGRESS |
| POST | `/treatment-plans/{id}/complete` | Clinical roles | IN_PROGRESS → COMPLETED |
| POST | `/treatment-plans/{id}/doctor-approve` | Clinical roles | Doctor approval |
| POST | `/treatment-plans/{id}/doctor-revoke` | Clinical roles | Revoke approval |
| POST | `/treatment-plans/{id}/patient-acknowledge` | Clinical roles | Patient accept |
| POST | `/treatment-plans/{id}/patient-decline` | Clinical roles | Patient decline |
| POST | `/treatment-plans/{id}/versions` | Clinical roles | Create version |
| GET | `/treatment-plans/{id}/versions` | Clinical roles | List versions |
| GET | `/treatment-plans/{id}/versions/{vid}` | Clinical roles | Get version |
| POST | `/treatment-plans/{id}/versions/{vid}/restore` | Clinical roles | Restore version |

### Billing — Invoices
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/billing/invoices` | Write roles | Create (Draft) |
| GET | `/billing/invoices` | Read roles | List |
| GET | `/billing/invoices/{id}` | Read roles | Get |
| PATCH | `/billing/invoices/{id}` | Write roles | Update (Draft only) |
| POST | `/billing/invoices/{id}/issue` | Workflow roles | Issue (Draft → Issued) |
| POST | `/billing/invoices/{id}/cancel` | Workflow roles | Cancel |
| DELETE | `/billing/invoices/{id}` | Admin only | Delete (Draft only) |

### Billing — Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/billing/payments` | Write roles | Create (Pending) |
| GET | `/billing/payments` | Read roles | List |
| GET | `/billing/payments/{id}` | Read roles | Get |
| PATCH | `/billing/payments/{id}` | Write roles | Update (Pending only) |
| DELETE | `/billing/payments/{id}` | Admin only | Delete (Pending only) |
| POST | `/billing/payments/{id}/complete` | Workflow roles | Complete |
| POST | `/billing/payments/{id}/fail` | Workflow roles | Fail |
| POST | `/billing/payments/{id}/void` | Workflow roles | Void |
| POST | `/billing/payments/{id}/allocate` | Workflow roles | Allocate to invoice |
| POST | `/billing/payments/{id}/deallocate` | Workflow roles | Remove allocation |
| GET | `/billing/payments/{id}/allocations` | Read roles | List allocations |

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

### Authentication Module
- [ ] Register new user with valid data → 201
- [ ] Register with duplicate email → 409
- [ ] Register with weak password → 422
- [ ] Login with valid credentials → 200 + token
- [ ] Login with wrong password → 401
- [ ] Login with unapproved (pending) user → 401
- [ ] Login with deactivated user → 403
- [ ] Get current user profile → 200
- [ ] Admin approves pending user → 200
- [ ] Admin deactivates user → 200
- [ ] List pending users → 200
- [ ] List users with filters → 200
- [ ] Change user role → 200
- [ ] Activate user → 200

### Patients Module
- [ ] Create patient with all required fields → 201
- [ ] Create patient with all optional fields → 201
- [ ] Create patient with missing fields → 422
- [ ] Create patient with future DOB → 422
- [ ] List patients with pagination → 200
- [ ] Search patients by name → 200
- [ ] Get patient by UUID → 200
- [ ] Get non-existent patient → 404
- [ ] Update patient (partial) → 200
- [ ] Activate/deactivate patient → 200
- [ ] Get patient profile → 200

### Doctors Module
- [ ] Create specialization → 201
- [ ] Create doctor linked to user → 201
- [ ] Create doctor with duplicate reg. number → 409
- [ ] Assign specialization to doctor → 201
- [ ] Create doctor schedule → 201
- [ ] List doctors with filters → 200
- [ ] Get doctor profile (with specializations + schedules) → 200
- [ ] Activate/deactivate doctor → 200
- [ ] Toggle leave/availability → 200
- [ ] Replace weekly schedule → 200

### Appointments Module
- [ ] Create appointment → 201
- [ ] Create appointment with time conflict → 409
- [ ] List appointments → 200
- [ ] Get today's appointments → 200
- [ ] Get appointment by ID → 200
- [ ] Update appointment → 200
- [ ] Cancel appointment → 200

### Treatment Module
- [ ] Create procedure → 201
- [ ] Create treatment plan → 201
- [ ] Add item to plan → 201
- [ ] Submit for review → 200
- [ ] Approve review → 200
- [ ] Accept plan → 200
- [ ] Start treatment → 200
- [ ] Complete treatment → 200
- [ ] Cancel plan → 200
- [ ] Create version snapshot → 201
- [ ] List/Get versions → 200
- [ ] Restore version → 200

### Billing Module
- [ ] Create invoice (Draft) → 201
- [ ] Issue invoice (Draft → Issued) → 200
- [ ] Update draft invoice → 200
- [ ] Update issued invoice → 409 (immutable)
- [ ] Cancel invoice → 200
- [ ] Delete draft invoice → 204
- [ ] Create payment (Pending) → 201
- [ ] Complete payment (Pending → Completed) → 200
- [ ] Allocate payment to invoice → 201
- [ ] List payments with filters → 200
- [ ] Get payment with allocations → 200
- [ ] Fail payment → 200
- [ ] Void payment → 200
- [ ] Deallocate payment → 204

### Authorization / RBAC
- [ ] Non-admin accessing admin endpoint → 403
- [ ] Unauthenticated request → 401
- [ ] Expired token → 401
- [ ] Receptionist creating patient → 201
- [ ] Doctor only reading own profile → 200
- [ ] Dental assistant reading billing → 200
- [ ] Dental assistant CANNOT delete invoice → 403
