"""add appointment_sequences table for atomic per-day number generation

Replaces the read-increment-write pattern with a pessimistic
locking approach (SELECT ... FOR UPDATE) to prevent duplicate
appointment numbers under concurrent requests.

Revision ID: f0b1c2d3e4f5
Revises: c3d4e5f6a7b8
Create Date: 2026-08-30 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f0b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the appointment_sequences table."""
    op.create_table(
        "appointment_sequences",
        sa.Column(
            "date_prefix",
            sa.String(length=12),
            nullable=False,
            comment="Date prefix, e.g. 'APT-20260830'.",
        ),
        sa.Column(
            "current_value",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Last assigned sequence number for this date.",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "current_value >= 0",
            name="ck_appointment_seq_current_nonneg",
        ),
        sa.PrimaryKeyConstraint("date_prefix"),
    )
    op.create_index(
        "ix_appointment_sequences_updated_at",
        "appointment_sequences",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the appointment_sequences table."""
    op.drop_index(
        "ix_appointment_sequences_updated_at",
        table_name="appointment_sequences",
    )
    op.drop_table("appointment_sequences")
