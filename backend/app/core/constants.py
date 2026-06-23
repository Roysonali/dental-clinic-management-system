from enum import Enum

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

# ==========================================================
# User Status
# ==========================================================

USER_STATUS_PENDING = "pending"
USER_STATUS_ACTIVE = "active"
USER_STATUS_INACTIVE = "inactive"

# ==========================================================
# Shared Enums
# ==========================================================

class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"