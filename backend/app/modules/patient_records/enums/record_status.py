from enum import StrEnum

class RecordStatus(StrEnum):
    
    """
    Represents the lifecycle of a patient record.
    """
    DRAFT ="DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    LOCKED = "LOCKED"