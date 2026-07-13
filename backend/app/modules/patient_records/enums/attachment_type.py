from enum import StrEnum


class AttachmentType(StrEnum):
    """
    Supported patient record attachments.
    """

    IMAGE = "IMAGE"
    PDF = "PDF"
    REPORT = "REPORT"
    SCAN = "SCAN"
    DOCUMENT = "DOCUMENT"