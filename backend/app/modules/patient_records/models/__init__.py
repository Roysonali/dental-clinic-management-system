# Import User first so SQLAlchemy can resolve the ``prescriber`` relationship
# on ``PatientRecordPrescription``.  Without this, the mapper builder raises
# ``InvalidRequestError`` when it encounters the string reference ``"User"``.
from app.modules.auth.models import User

from .patient_record import PatientRecord
from .diagnosis import PatientRecordDiagnosis
from .prescription import PatientRecordPrescription
from .prescription_item import PatientRecordPrescriptionItem
from .attachment import PatientRecordAttachment
from .followup import PatientRecordFollowup
from .audit_log import PatientRecordAuditLog

__all__ = [
    "PatientRecord",
    "PatientRecordDiagnosis",
    "PatientRecordPrescription",
    "PatientRecordAttachment",
    "PatientRecordFollowup",
    "PatientRecordAuditLog",
    "PatientRecordPrescriptionItem",
    "User",
]