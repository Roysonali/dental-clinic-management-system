from __future__ import annotations
from datetime import date
from app.modules.patient_records.exceptions import PatientRecordBusinessRule

class FollowupValidator:
    """Pure business validation for follow-up scheduling.

    Every method is a ``@staticmethod`` — no database access, no
    side effects, no state.

    Raises:
        PatientRecordBusinessRule: On every violation.
    """

    # ==================================================================
    # Date validation
    # ==================================================================

    @staticmethod
    def validate_followup_date(followup_date: date) -> None:
        """Raise if the follow-up date is in the past.

        A follow-up must be scheduled for today or a future date.
        Validation uses ``date.today()`` which is timezone-naive but
        safe for ``datetime.date`` comparisons — the model stores
        follow-up dates as ``Date`` (not ``DateTime``), so there is
        no timezone component to consider.

        Args:
            followup_date: The proposed follow-up date.

        Raises:
            PatientRecordBusinessRule: If ``followup_date`` is before
                today.
        """
        if followup_date >= date.today():
            return

        raise PatientRecordBusinessRule(
            message=(
                f"Follow-up date {followup_date.isoformat()} is in the "
                f"past.  Follow-ups must be scheduled for today or a "
                f"future date."
            ),
            details={
                "followup_date": followup_date.isoformat(),
                "today": date.today().isoformat(),
            },
        )
