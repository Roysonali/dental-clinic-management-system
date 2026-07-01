from enum import StrEnum


class AllergySeverity(StrEnum):
    """
    Indicates allergy severity.
    """

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"