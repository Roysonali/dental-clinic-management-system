from enum import StrEnum


class DiagnosisType(StrEnum):
    """
    Represents diagnosis certainty.
    """

    PROVISIONAL = "PROVISIONAL"
    CONFIRMED = "CONFIRMED"