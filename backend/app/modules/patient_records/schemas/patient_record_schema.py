from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.modules.patient_records.enums import (
    RecordStatus,
)

from .diagnosis_schema import (
    DiagnosisNestedResponse,
)

from .prescription_schema import (
    PrescriptionNestedResponse,
)

from .attachment_schema import (
    AttachmentNestedResponse,
)

from .followup_schema import (
    FollowupNestedResponse,
)

from .audit_schema import (
    AuditNestedResponse,
)

# ==========================================================
# BASE SCHEMA
# ==========================================================

class PatientRecordBase(BaseModel):
    """
    Base patient record schema containing
    common clinical and medical fields.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    chief_complaint: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Chief Complaint",
        description="Primary complaint reported by the patient",
        examples=["Pain in lower right molar"],
    )

    clinical_notes: Optional[str] = Field(
        default=None,
        max_length=10000,
        title="Clinical Notes",
        description="Clinical examination findings",
    )

    doctor_remarks: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Doctor Remarks",
        description="Doctor observations and remarks",
    )

    treatment_recommendation: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Treatment Recommendation",
        description="Recommended treatment plan",
    )

    systemic_diseases: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Systemic Diseases",
        description="Patient systemic diseases history",
    )

    surgeries: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Surgeries",
        description="Patient surgical history",
    )

    medications: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Medications",
        description="Current medications",
    )

    habits: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Habits",
        description="Smoking, alcohol, tobacco habits",
    )

    medical_alerts: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Medical Alerts",
        description="Important medical alerts",
    )

    allergies: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Allergies",
        description="Known allergies",
    )

    dental_history: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Dental History",
        description="Previous dental history",
    )

    @field_validator(
        "chief_complaint",
        "clinical_notes",
        "doctor_remarks",
        "treatment_recommendation",
        "systemic_diseases",
        "surgeries",
        "medications",
        "habits",
        "medical_alerts",
        "allergies",
        "dental_history",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None
    
# ==========================================================
# CREATE
# ==========================================================

class PatientRecordCreate(
    PatientRecordBase
):
    """
    Create patient record schema.
    """

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="Associated patient identifier",
    )

    appointment_id: UUID = Field(
        ...,
        title="Appointment ID",
        description="Associated appointment identifier",
    )

# ==========================================================
# UPDATE
# ==========================================================

class PatientRecordUpdate(
    PatientRecordBase
):
    """
    Update patient record schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    chief_complaint: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Chief Complaint",
        description="Primary complaint reported by the patient",
    )

    clinical_notes: Optional[str] = Field(
        default=None,
        max_length=10000,
        title="Clinical Notes",
        description="Clinical examination findings",
    )

    doctor_remarks: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Doctor Remarks",
        description="Doctor observations and remarks",
    )

    treatment_recommendation: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Treatment Recommendation",
        description="Recommended treatment plan",
    )

    systemic_diseases: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Systemic Diseases",
        description="Patient systemic diseases history",
    )

    surgeries: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Surgeries",
        description="Patient surgical history",
    )

    medications: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Medications",
        description="Current medications",
    )

    habits: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Habits",
        description="Smoking, alcohol, tobacco habits",
    )

    medical_alerts: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Medical Alerts",
        description="Important medical alerts",
    )

    allergies: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Allergies",
        description="Known allergies",
    )

    dental_history: Optional[str] = Field(
        default=None,
        max_length=5000,
        title="Dental History",
        description="Previous dental history",
    )


# ==========================================================
# FINALIZE REQUEST
# ==========================================================

class PatientRecordFinalizeRequest(
    BaseModel
):
    """
    Schema used to finalize
    a patient record.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    confirm: Literal[True] = Field(
        ...,
        title="Confirm",
        description="Must be true to finalize record",
        examples=[True],
    )

# ==========================================================
# SUMMARY RESPONSE
# ==========================================================

class PatientRecordSummaryResponse(BaseModel):
    """
    Summary patient record schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Unique patient record identifier",
    )

    status: RecordStatus = Field(
        ...,
        title="Record Status",
        description="Current patient record status",
    )

    chief_complaint: Optional[str] = Field(
        default=None,
        title="Chief Complaint",
        description="Primary complaint reported by the patient",
    )

    is_finalized: bool = Field(
        ...,
        title="Finalized",
        description="Whether the record has been finalized",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the record was created",
    )

    updated_at: datetime = Field(
    ...,
    title="Updated At",
    description="Timestamp when the record was last modified",
    )

# ==========================================================
# NESTED RESPONSE
# ==========================================================

class PatientRecordNestedResponse(BaseModel):
    """
    Nested patient record schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Unique patient record identifier",
    )

    status: RecordStatus = Field(
        ...,
        title="Record Status",
        description="Current record status",
    )

    is_finalized: bool = Field(
        ...,
        title="Finalized",
        description="Whether the record has been finalized",
    )

    chief_complaint: Optional[str] = Field(
        default=None,
        title="Chief Complaint",
        description="Primary complaint",
    )

# ==========================================================
# FULL RESPONSE
# ==========================================================

class PatientRecordResponse(
    PatientRecordBase
):
    """
    Complete patient record response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Unique patient record identifier",
    )

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="Associated patient identifier",
    )

    appointment_id: UUID = Field(
        ...,
        title="Appointment ID",
        description="Associated appointment identifier",
    )

    status: RecordStatus = Field(
        ...,
        title="Record Status",
        description="Current patient record status",
    )

    is_finalized: bool = Field(
        ...,
        title="Finalized",
        description="Whether the record has been finalized",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Record creation timestamp",
    )

    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Last update timestamp",
    )

    diagnoses: list[
        DiagnosisNestedResponse
    ] = Field(
        default_factory=list,
        title="Diagnoses",
        description="Patient diagnoses",
    )

    prescriptions: list[
        PrescriptionNestedResponse
    ] = Field(
        default_factory=list,
        title="Prescriptions",
        description="Patient prescriptions",
    )

    followups: list[
        FollowupNestedResponse
    ] = Field(
        default_factory=list,
        title="Followups",
        description="Scheduled followups",
    )

    attachments: list[
        AttachmentNestedResponse
    ] = Field(
        default_factory=list,
        title="Attachments",
        description="Patient attachments",
    )

    audit_logs: list[
        AuditNestedResponse
    ] = Field(
        default_factory=list,
        title="Audit Logs",
        description="Audit history",
    )

    diagnosis_count: int = Field(
    default=0,
    ge=0,
    )

    prescription_count: int = Field(
        default=0,
        ge=0,
    )

    attachment_count: int = Field(
        default=0,
        ge=0,
    )

    followup_count: int = Field(
        default=0,
        ge=0,
    )

# ==========================================================
# LIST ITEM
# ==========================================================

class PatientRecordListItem(BaseModel):
    """
    Patient record list item.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Unique patient record identifier",
    )

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="Associated patient identifier",
    )

    appointment_id: UUID = Field(
        ...,
        title="Appointment ID",
        description="Associated appointment identifier",
    )

    status: RecordStatus = Field(
        ...,
        title="Record Status",
        description="Current record status",
    )

    is_finalized: bool = Field(
        ...,
        title="Finalized",
        description="Whether the record has been finalized",
    )

    chief_complaint: Optional[str] = Field(
        default=None,
        title="Chief Complaint",
        description="Primary complaint",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Record creation timestamp",
    )

# ==========================================================
# LIST RESPONSE
# ==========================================================

class PatientRecordListResponse(BaseModel):
    """
    Paginated patient record response.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    items: list[
        PatientRecordListItem
    ] = Field(
        ...,
        title="Patient Records",
        description="Paginated patient record list",
    )

    total: int = Field(
        ...,
        ge=0,
        title="Total Records",
        description="Total number of records",
    )

    page: int = Field(
        ...,
        ge=1,
        title="Current Page",
        description="Current page number",
    )

    page_size: int = Field(
        ...,
        ge=1,
        title="Page Size",
        description="Number of records per page",
    )

    pages: int = Field(
        ...,
        ge=0,
        title="Total Pages",
        description="Total number of pages",
    )


