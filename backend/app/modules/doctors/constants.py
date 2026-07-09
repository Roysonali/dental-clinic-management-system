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

# ==========================================================
# Consultation Duration (minutes)
# ==========================================================

# Business rule from Phase 10 §2.1 / INV-7:
# Consultation duration must be between 15 minutes (minimum
# meaningful slot) and 240 minutes (4-hour max session).
# The database CheckConstraint enforces this range at the
# schema level as defense-in-depth.
MIN_CONSULTATION_DURATION = 15
MAX_CONSULTATION_DURATION = 240


# ==========================================================
# Domain Error Messages
# ==========================================================

ERR_DOCTOR_NOT_FOUND = "Doctor does not exist"
ERR_USER_NOT_FOUND = "Referenced user does not exist"
ERR_USER_MUST_BE_ACTIVE = "User must be active to create a doctor profile"
ERR_NOT_A_DOCTOR_USER = "User does not have a doctor role"
ERR_ALREADY_HAS_PROFILE = "User already has a doctor profile"
ERR_REG_NUMBER_TAKEN = "Registration number is already assigned to another doctor"
ERR_ALREADY_ACTIVE = "Doctor is already active"
ERR_ALREADY_INACTIVE = "Doctor is already inactive"
ERR_CANNOT_MARK_INACTIVE_AVAILABLE = "Cannot mark an inactive doctor as available"
ERR_PRIMARY_SPEC_NOT_IN_LIST = "Primary specialization must be included in the list of specialization IDs"
ERR_SPEC_NOT_FOUND = "One or more specializations not found"
ERR_SPEC_NOT_ASSIGNED = "Specialization is not assigned to this doctor"
ERR_DOCTOR_CREATE_FAILED = "Doctor creation failed"
ERR_DOCTOR_UPDATE_FAILED = "Doctor update failed"
ERR_SPEC_NAME_TAKEN = "Specialization name is already in use"
ERR_SPEC_CODE_TAKEN = "Specialization code is already in use"
ERR_SPEC_ASSIGNED_TO_DOCTORS = "Cannot delete specialization that is assigned to doctors"
ERR_SPEC_ALREADY_ACTIVE = "Specialization is already active"
ERR_SPEC_ALREADY_INACTIVE = "Specialization is already inactive"
ERR_SPEC_CREATION_FAILED = "Specialization creation failed"
ERR_SPEC_UPDATE_FAILED = "Specialization update failed"
ERR_SPEC_VALIDATION_FAILED = "Specialization validation failed"
ERR_SCHEDULE_NOT_FOUND = "Schedule does not exist"
ERR_SCHEDULE_CREATION_FAILED = "Schedule creation failed"
ERR_SCHEDULE_UPDATE_FAILED = "Schedule update failed"
ERR_SCHEDULE_OVERLAP = "Schedule slot overlaps with an existing slot"
ERR_SCHEDULE_DUPLICATE_DAY = "A schedule entry already exists for this day"
ERR_SCHEDULE_END_BEFORE_START = "End time must be after start time"
ERR_SCHEDULE_MAX_EXCEEDED = "Cannot exceed maximum schedule entries"
ERR_SCHEDULE_CROSS_DOCTOR = "Schedule does not belong to the specified doctor"
ERR_DOCTOR_MUST_BE_ACTIVE = "Doctor must be active to manage schedules"
