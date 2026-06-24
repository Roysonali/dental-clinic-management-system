from enum import Enum


class AppointmentStatus(str, Enum):
    """
    Represents lifecycle stages of an appointment.
    Stored as string values in DB.
    """

    SCHEDULED = "Scheduled"
    CONFIRMED = "Confirmed"
    CHECKED_IN = "Checked In"
    IN_TREATMENT = "In Treatment"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    NO_SHOW = "No Show"


class AppointmentType(str, Enum):
    """
    Represents appointment classification.
    """

    CONSULTATION = "Consultation"
    FOLLOW_UP = "Follow-Up"
    EMERGENCY = "Emergency"
    PROCEDURE = "Procedure"
    REVIEW = "Review"
    OTHER = "Other"