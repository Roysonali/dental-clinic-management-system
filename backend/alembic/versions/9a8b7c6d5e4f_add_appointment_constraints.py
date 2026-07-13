"""add appointment constraints and update patient schedule index

Revision ID: 9a8b7c6d5e4f
Revises: 239e5e25d211
Create Date: 2026-06-23 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, Sequence[str], None] = "239e5e25d211"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ── 1. Add end_time > start_time check constraint ───────────────────
    op.create_check_constraint(
        "ck_appointments_end_after_start",
        "appointments",
        "end_time > start_time",
    )

    # ── 2. Update patient schedule index to include start_time ──────────
    op.drop_index(
        "ix_appointments_patient_schedule",
        table_name="appointments",
    )

    op.create_index(
        "ix_appointments_patient_schedule",
        "appointments",
        [
            "patient_id",
            "appointment_date",
            "start_time",
        ],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema — reverse the upgrade."""

    # ── 1. Restore original patient schedule index ─────────────────────
    op.drop_index(
        "ix_appointments_patient_schedule",
        table_name="appointments",
    )

    op.create_index(
        "ix_appointments_patient_schedule",
        "appointments",
        [
            "patient_id",
            "appointment_date",
        ],
        unique=False,
    )

    # ── 2. Drop the end_time check constraint ───────────────────────────
    op.drop_constraint(
        "ck_appointments_end_after_start",
        "appointments",
        type_="check",
    )
