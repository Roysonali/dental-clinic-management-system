"""
Doctor Management Module — Enums.

No module-specific enums are required for the MVP.
GenderEnum is reused from app.core.constants.

Future enums (CredentialType, LeaveType, LeaveStatus, CommissionType)
are deferred to Phase 18.
"""

# Re-export for convenience so consumers can import from either location.
from app.core.constants import GenderEnum  # noqa: F401
