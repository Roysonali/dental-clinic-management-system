"""
Doctor Management Module — Constants.

Defines module-specific constants for doctor code auto-generation,
validation rules, pagination defaults, and business configuration.

Clinic working days and GenderEnum are imported from app.core.constants
and are NOT redefined here.
"""

# ==========================================================
# Doctor Code Configuration
# ==========================================================

DOCTOR_CODE_PREFIX = "DOC"
DOCTOR_CODE_SEQUENCE_WIDTH = 6
DEFAULT_CONSULTATION_FEE = 500.00

# ==========================================================
# Schedule Constants
# ==========================================================

DEFAULT_CONSULTATION_DURATION = 30
MAX_SCHEDULE_ENTRIES_PER_DOCTOR = 14

# ==========================================================
# Validation Constants
# ==========================================================

PHONE_MAX_LENGTH = 20
PHONE_MIN_LENGTH = 10
PHONE_PATTERN = r"^\+?[1-9]\d{9,14}$"
PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}

# ==========================================================
# Pagination Constants
# ==========================================================

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_SORT_FIELD = "full_name"
ALLOWED_SORT_FIELDS = {"full_name", "years_of_experience"}

# ==========================================================
# Business Constants
# ==========================================================

MIN_YEARS_EXPERIENCE = 0
MAX_YEARS_EXPERIENCE = 50
MIN_CONSULTATION_FEE = 0.01
