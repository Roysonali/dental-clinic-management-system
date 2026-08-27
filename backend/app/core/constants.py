from enum import Enum
from datetime import time

"""
Application-wide constants.

Contains:
- RBAC role identifiers
- User lifecycle statuses
- Shared enums

Only stable identifiers should be defined here.
Display names belong in the database or UI layer.
"""

# ==========================================================
# Roles
# ==========================================================

ROLE_ADMIN = "ADMIN"
ROLE_CHIEF_DOCTOR = "CHIEF_DOCTOR"
ROLE_GENERAL_DOCTOR = "GENERAL_DOCTOR"
ROLE_SPECIALIST_DOCTOR = "SPECIALIST_DOCTOR"
ROLE_CONSULTING_DOCTOR = "CONSULTING_DOCTOR"
ROLE_RECEPTIONIST = "RECEPTIONIST"
ROLE_DENTAL_ASSISTANT = "DENTAL_ASSISTANT"

ALL_ROLES = (
    ROLE_ADMIN,
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
)

DOCTOR_ROLES = (
    ROLE_CHIEF_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
)


USER_STATUS_PENDING = "pending"
USER_STATUS_ACTIVE = "active"
USER_STATUS_INACTIVE = "inactive"


class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class ProfileStatus(str, Enum):
    """Canonical patient profile lifecycle state.

    COMPLETE   — all required clinical fields are present.
    INCOMPLETE — one or more required fields (DOB, gender) are missing,
                 typically after a phone-call quick-create.
    """

    COMPLETE = "complete"
    INCOMPLETE = "incomplete"


# ==========================================================
# APPOINTMENT MODULE
# ==========================================================

# Monday=0 → Saturday=5
CLINIC_WORKING_DAYS = {
    0,
    1,
    2,
    3,
    4,
    5,
}


# Morning Session
CLINIC_MORNING_START = time(
    hour=10,
    minute=0,
)

CLINIC_MORNING_END = time(
    hour=13,
    minute=0,
)


# Evening Session
CLINIC_EVENING_START = time(
    hour=17,
    minute=0,
)

CLINIC_EVENING_END = time(
    hour=21,
    minute=0,
)


# Allowed durations
ALLOWED_APPOINTMENT_DURATIONS = (
    15,
    30,
    45,
    60,
)


DEFAULT_APPOINTMENT_DURATION = 30


APPOINTMENT_NUMBER_PREFIX = "APT"