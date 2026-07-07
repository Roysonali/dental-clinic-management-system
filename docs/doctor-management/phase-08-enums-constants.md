# Phase 8: Enums & Constants — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only enums and constants required for Doctor Profile, Specialization, and Schedule management.

---

## 1. Enums

### 1.1 GenderEnum (Reused)

Already defined in `app/core/constants.py`:

```python
class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"
```

Doctor module imports and reuses this enum rather than redefining it.

> **MVP Note:** Employment type and session type concepts were eliminated during Phase 1/2 refinement. The MVP schedule model uses simple `day_of_week`, `start_time`, `end_time` without session presets. No doctor-specific enums are required beyond the reused `GenderEnum`.

---

## 2. Constants

### 2.1 Doctor Code Configuration

```python
# Prefix for auto-generated doctor codes
DOCTOR_CODE_PREFIX = "DOC"
# Sequence padding width (e.g., DOC-00001)
DOCTOR_CODE_SEQUENCE_WIDTH = 6
# Default consultation fee for new doctors
DEFAULT_CONSULTATION_FEE = 500.00
```

### 2.2 Schedule Constants

```python
# Default consultation duration in minutes (aligned with Phase 5 Field(ge=15, le=240))
DEFAULT_CONSULTATION_DURATION = 30
# Maximum schedule entries per doctor (14 = 2 per day × 6 working days + buffer)
MAX_SCHEDULE_ENTRIES_PER_DOCTOR = 14
```

> **Clinic working days** are defined in `app/core/constants.py` as `CLINIC_WORKING_DAYS` (already exists). The Doctor module imports this constant rather than redefining it.

### 2.3 Validation Constants

```python
# Maximum length for phone numbers
PHONE_MAX_LENGTH = 20
# Minimum length for phone numbers
PHONE_MIN_LENGTH = 10
# Phone regex pattern
PHONE_PATTERN = r"^\+?[1-9]\d{9,14}$"
# Maximum file size for profile photo (bytes)
PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024  # 5MB
# Allowed image types for profile photo
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
```

### 2.4 Pagination Constants

```python
# Default page size for list endpoints
DEFAULT_PAGE_SIZE = 20
# Maximum allowed page size
MAX_PAGE_SIZE = 100
# Default sort field (resolved through User join — names are on User, not DoctorProfile)
DEFAULT_SORT_FIELD = "full_name"
# Allowed sort fields (aligned with Phase 6 GET /doctors sort_by specification)
ALLOWED_SORT_FIELDS = {"full_name", "years_of_experience"}
```

### 2.5 Business Constants

```python
# Minimum years of experience
MIN_YEARS_EXPERIENCE = 0
# Maximum years of experience (50 years career)
MAX_YEARS_EXPERIENCE = 50
# Minimum consultation fee (strictly positive per Phase 2 INV-7, Phase 4 CHECK(>0))
MIN_CONSULTATION_FEE = 0.01
# Doctor roles are imported from app.core.constants (not redefined here):
# from app.core.constants import DOCTOR_ROLES
```

---

## 3. Error Code Constants

```python
# Error codes
ERROR_DOCTOR_NOT_FOUND = "DOCTOR_NOT_FOUND"
ERROR_DUPLICATE_DOCTOR = "DUPLICATE_DOCTOR"
ERROR_DOCTOR_CREATION_FAILED = "DOCTOR_CREATION_FAILED"
ERROR_DOCTOR_UPDATE_FAILED = "DOCTOR_UPDATE_FAILED"
ERROR_DOCTOR_VALIDATION_FAILED = "DOCTOR_VALIDATION_FAILED"
ERROR_INVALID_DOCTOR_OPERATION = "INVALID_DOCTOR_OPERATION"
ERROR_NOT_A_DOCTOR_USER = "NOT_A_DOCTOR_USER"
ERROR_USER_NOT_FOUND = "USER_NOT_FOUND"
ERROR_SCHEDULE_OVERLAP = "SCHEDULE_OVERLAP"
ERROR_SPECIALIZATION_NOT_FOUND = "SPECIALIZATION_NOT_FOUND"
ERROR_PRIMARY_SPECIALIZATION_REQUIRED = "PRIMARY_SPECIALIZATION_REQUIRED"
ERROR_SELF_SERVICE_NOT_ALLOWED = "SELF_SERVICE_NOT_ALLOWED"
```

---

## 4. File Location Summary

| Symbol | File |
|---|---|
| `GenderEnum` | `app/core/constants.py` (reused — no new enums required for MVP) |
| Doctor code constants | `app/modules/doctors/constants.py` |
| Validation constants | `app/modules/doctors/constants.py` |
| Error code constants | `app/modules/doctors/exceptions.py` (embedded in exception constructors, matching existing module pattern) |

---

## 5. Enums Explicitly Excluded from MVP

The following enums are NOT part of the MVP and are documented in Phase 18:

| Enum | Purpose | Future Phase |
|---|---|---|
| `CredentialType` | License, certification, CE credit | Phase 18 |
| `LeaveType` | Vacation, sick, personal, other | Phase 18 |
| `LeaveStatus` | Pending, approved, rejected, cancelled | Phase 18 |
| `CommissionType` | Percentage, fixed, tiered | Phase 18 |
