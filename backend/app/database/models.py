# Authentication
from app.modules.auth.models import User, Role, PasswordResetToken, RefreshToken

# Patients
from app.modules.patients.models import Patient

# Appointments
from app.modules.appointments.model import Appointment

# Patient Records
from app.modules.patient_records.models import (
    PatientRecord,
    PatientRecordDiagnosis,
    PatientRecordAttachment,
    PatientRecordAuditLog,
)

# Doctors
from app.modules.doctors.models import (
    Doctor,
    DoctorSchedule,
    DoctorSpecialization,
    Specialization,
)

# Treatment Plan
from app.modules.treatment.models import (
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanVersion,
    TreatmentPlanApproval,
    Procedure,
)

# Billing
from app.modules.billing.models import (
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
    Payment,
    PaymentAllocation,
    Receipt,
    ReceiptInvoice,
    CreditNote,
    PatientCredit,
    DocumentSequence,
    SequenceConsumptionLog,
    BillingAuditLog,
)