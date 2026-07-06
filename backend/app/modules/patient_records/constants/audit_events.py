"""
Centralised Audit Event Constants
==================================

Single source of truth for all audit action names used across the
patient records module.  Every service and workflow layer must import
these constants rather than defining them locally.

Naming convention
-----------------
Each constant uses a ``<DOMAIN>_<ACTION>`` pattern where ``DOMAIN`` is the
entity (e.g. ``PATIENT_RECORD``, ``DIAGNOSIS``) and ``ACTION`` is the
operation (e.g. ``CREATED``, ``UPDATED``, ``DELETED``).

Adding new events
-----------------
1. Add the constant here.
2. Add the constant to ``__all__`` below.
3. Import the constant in the service layer and use it in audit calls.

Immutability guarantee
----------------------
Once an audit log entry is written it must never be modified or deleted.
These constant values themselves are fixed at import time; renaming a
constant changes future entries but existing historical data is preserved.
"""

# ==================================================================
# Patient Record events
# ==================================================================
PATIENT_RECORD_CREATED: str = "PATIENT_RECORD_CREATED"
PATIENT_RECORD_UPDATED: str = "PATIENT_RECORD_UPDATED"
PATIENT_RECORD_STATUS_CHANGED: str = "PATIENT_RECORD_STATUS_CHANGED"
PATIENT_RECORD_FINALIZED: str = "PATIENT_RECORD_FINALIZED"
PATIENT_RECORD_DELETED: str = "PATIENT_RECORD_DELETED"

# ==================================================================
# Diagnosis events
# ==================================================================
DIAGNOSIS_CREATED: str = "DIAGNOSIS_CREATED"
DIAGNOSIS_BULK_CREATED: str = "DIAGNOSIS_BULK_CREATED"
DIAGNOSIS_UPDATED: str = "DIAGNOSIS_UPDATED"
DIAGNOSIS_DELETED: str = "DIAGNOSIS_DELETED"

# ==================================================================
# Prescription events
# ==================================================================
PRESCRIPTION_CREATED: str = "PRESCRIPTION_CREATED"
PRESCRIPTION_UPDATED: str = "PRESCRIPTION_UPDATED"
PRESCRIPTION_FINALIZED: str = "PRESCRIPTION_FINALIZED"
PRESCRIPTION_DELETED: str = "PRESCRIPTION_DELETED"

# ==================================================================
# Prescription Item events
# ==================================================================
PRESCRIPTION_ITEM_CREATED: str = "PRESCRIPTION_ITEM_CREATED"
PRESCRIPTION_ITEM_BULK_CREATED: str = "PRESCRIPTION_ITEM_BULK_CREATED"
PRESCRIPTION_ITEM_UPDATED: str = "PRESCRIPTION_ITEM_UPDATED"
PRESCRIPTION_ITEM_DELETED: str = "PRESCRIPTION_ITEM_DELETED"

# ==================================================================
# Attachment events
# ==================================================================
ATTACHMENT_UPLOADED: str = "ATTACHMENT_UPLOADED"
ATTACHMENT_BULK_UPLOADED: str = "ATTACHMENT_BULK_UPLOADED"
ATTACHMENT_UPDATED: str = "ATTACHMENT_UPDATED"
ATTACHMENT_DELETED: str = "ATTACHMENT_DELETED"

# ==================================================================
# Follow-up events
# ==================================================================
FOLLOWUP_CREATED: str = "FOLLOWUP_CREATED"
FOLLOWUP_UPDATED: str = "FOLLOWUP_UPDATED"
FOLLOWUP_DELETED: str = "FOLLOWUP_DELETED"

# ==================================================================
# Workflow events
# ==================================================================
WORKFLOW_RECORD_CREATED: str = "WORKFLOW_RECORD_CREATED"
WORKFLOW_RECORD_UPDATED: str = "WORKFLOW_RECORD_UPDATED"
WORKFLOW_STATUS_TRANSITIONED: str = "WORKFLOW_STATUS_TRANSITIONED"
WORKFLOW_RECORD_COMPLETED: str = "WORKFLOW_RECORD_COMPLETED"
WORKFLOW_RECORD_FINALIZED: str = "WORKFLOW_RECORD_FINALIZED"
WORKFLOW_RECORD_ROLLED_BACK: str = "WORKFLOW_RECORD_ROLLED_BACK"


__all__ = [
    # Patient Record
    "PATIENT_RECORD_CREATED",
    "PATIENT_RECORD_UPDATED",
    "PATIENT_RECORD_STATUS_CHANGED",
    "PATIENT_RECORD_FINALIZED",
    "PATIENT_RECORD_DELETED",
    # Diagnosis
    "DIAGNOSIS_CREATED",
    "DIAGNOSIS_BULK_CREATED",
    "DIAGNOSIS_UPDATED",
    "DIAGNOSIS_DELETED",
    # Prescription
    "PRESCRIPTION_CREATED",
    "PRESCRIPTION_UPDATED",
    "PRESCRIPTION_FINALIZED",
    "PRESCRIPTION_DELETED",
    # Prescription Item
    "PRESCRIPTION_ITEM_CREATED",
    "PRESCRIPTION_ITEM_BULK_CREATED",
    "PRESCRIPTION_ITEM_UPDATED",
    "PRESCRIPTION_ITEM_DELETED",
    # Attachment
    "ATTACHMENT_UPLOADED",
    "ATTACHMENT_BULK_UPLOADED",
    "ATTACHMENT_UPDATED",
    "ATTACHMENT_DELETED",
    # Follow-up
    "FOLLOWUP_CREATED",
    "FOLLOWUP_UPDATED",
    "FOLLOWUP_DELETED",
    # Workflow
    "WORKFLOW_RECORD_CREATED",
    "WORKFLOW_RECORD_UPDATED",
    "WORKFLOW_STATUS_TRANSITIONED",
    "WORKFLOW_RECORD_COMPLETED",
    "WORKFLOW_RECORD_FINALIZED",
    "WORKFLOW_RECORD_ROLLED_BACK",
]
