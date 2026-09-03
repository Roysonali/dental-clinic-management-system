"""
make patient record appointment_id nullable

Records can now be created without an appointment (walk-in clinical notes,
historical record entry, consultation without a booked appointment).

The FK constraint and unique index are preserved:
- FK allows NULL values by definition.
- PostgreSQL UNIQUE allows multiple NULLs, so the "one record per
  appointment" rule is maintained for non-null values.

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-09-03 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make appointment_id nullable. The FK constraint is preserved — FKs
    # allow NULL by definition. The unique index on appointment_id is
    # also preserved — PostgreSQL allows multiple NULLs in a UNIQUE
    # constraint, so the "at most one record per appointment" rule
    # continues to work for non-null values.
    op.alter_column(
        "patient_records",
        "appointment_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=True,
    )


def downgrade() -> None:
    # Before restoring NOT NULL, check that no NULL values exist.
    # This is a safety measure — a blanket SET NOT NULL would fail
    # unpredictably if appointment-less rows were created.
    #
    # Policy: if NULL rows exist, the downgrade raises an error rather
    # than silently dropping data. The operator must either assign
    # appointments to orphaned records or manually delete them.
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM patient_records WHERE appointment_id IS NULL
                ) THEN
                    RAISE EXCEPTION
                        'Cannot downgrade: patient_records contains rows with NULL appointment_id. '
                        'Assign an appointment to each record before restoring NOT NULL.';
                END IF;
            END $$;
            """
        )
    )
    op.alter_column(
        "patient_records",
        "appointment_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=False,
    )
