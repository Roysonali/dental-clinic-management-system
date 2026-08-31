"""add appointment slot exclusion constraints (dentist + patient)

Prevents double-booking at the database level using PostgreSQL EXCLUDE
constraints with GiST indexes. This is the definitive protection against
concurrent appointment creation race conditions.

Two constraints are added:
1. excl_dentist_slot   — prevents two overlapping active appointments
                         for the same dentist
2. excl_patient_slot   — prevents a patient from having overlapping
                         active appointments

Both constraints use a WHERE clause to exclude CANCELLED and NO_SHOW
appointments, so cancelling/no-showing a reservation frees the slot.

Requires the btree_gist extension for GiST support of scalar = operator.
The extension is installed idempotently (CREATE EXTENSION IF NOT EXISTS).

Pre-migration data cleanup: any existing active appointments that overlap
(dentist or patient) are cancelled so the EXCLUDE constraints can be
added safely.  Only the earliest-created appointment in each overlapping
group is preserved.

Revision ID: c3d4e5f6a7b8
Revises: e7f8a9b0c1d3
Create Date: 2026-08-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Statuses that do NOT occupy a slot (freed for rebooking).
_SLOT_FREED_STATUSES = ("Cancelled", "No Show")


def upgrade() -> None:
    """Add EXCLUDE constraints for dentist and patient slot protection."""

    # ── 1. Ensure btree_gist extension is available ────────────────
    # btree_gist adds GiST operator classes for scalar types (= operator)
    # which EXCLUDE constraints need for the integer/UUID columns.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # ── 2. Cancel overlapping dentist appointments ────────────────
    # Before adding EXCLUDE constraints, cancel any conflicting
    # active appointments.  For each group of overlapping active
    # appointments sharing the same dentist, only the earliest-created
    # one is kept; all others are cancelled.
    #
    # NOTE: We use created_at (timestamp) instead of id (UUID) for
    # the MIN() comparison because PostgreSQL does not support
    # aggregate functions on UUID types.
    op.execute(
        sa.text("""
            UPDATE appointments
            SET status = 'Cancelled',
                updated_at = NOW()
            WHERE id IN (
                SELECT a.id
                FROM appointments a
                WHERE a.status NOT IN ('Cancelled', 'No Show')
                  AND EXISTS (
                    SELECT 1
                    FROM appointments b
                    WHERE b.id != a.id
                      AND b.dentist_id = a.dentist_id
                      AND b.appointment_date = a.appointment_date
                      AND b.start_time < a.end_time
                      AND a.start_time < b.end_time
                      AND b.status NOT IN ('Cancelled', 'No Show')
                  )
                  -- Keep only the earliest-created in each overlap group.
                  -- Using created_at (timestamp) instead of id (UUID)
                  -- because PostgreSQL MIN() does not support UUIDs.
                  AND a.created_at > (
                    SELECT MIN(c.created_at)
                    FROM appointments c
                    WHERE c.dentist_id = a.dentist_id
                      AND c.appointment_date = a.appointment_date
                      AND c.start_time < a.end_time
                      AND a.start_time < c.end_time
                      AND c.status NOT IN ('Cancelled', 'No Show')
                  )
            )
        """)
    )

    # ── 3. Cancel overlapping patient appointments ────────────────
    op.execute(
        sa.text("""
            UPDATE appointments
            SET status = 'Cancelled',
                updated_at = NOW()
            WHERE id IN (
                SELECT a.id
                FROM appointments a
                WHERE a.status NOT IN ('Cancelled', 'No Show')
                  AND EXISTS (
                    SELECT 1
                    FROM appointments b
                    WHERE b.id != a.id
                      AND b.patient_id = a.patient_id
                      AND b.appointment_date = a.appointment_date
                      AND b.start_time < a.end_time
                      AND a.start_time < b.end_time
                      AND b.status NOT IN ('Cancelled', 'No Show')
                  )
                  AND a.created_at > (
                    SELECT MIN(c.created_at)
                    FROM appointments c
                    WHERE c.patient_id = a.patient_id
                      AND c.appointment_date = a.appointment_date
                      AND c.start_time < a.end_time
                      AND a.start_time < c.end_time
                      AND c.status NOT IN ('Cancelled', 'No Show')
                  )
            )
        """)
    )

    # ── 4. Dentist slot exclusion ──────────────────────────────────
    # Prevents two overlapping active appointments for the same dentist.
    # The WHERE clause excludes Cancelled/No Show so those slots are freed.
    # Uses tsrange (without timezone) to match the clinic wall-clock
    # semantics of the Date + Time columns.
    op.execute(
        sa.text(
            """
            ALTER TABLE appointments
            ADD CONSTRAINT excl_dentist_slot
            EXCLUDE USING gist (
                dentist_id WITH =,
                tsrange(
                    appointment_date::timestamp + start_time,
                    appointment_date::timestamp + end_time,
                    '[)'
                ) WITH &&
            )
            WHERE (
                status NOT IN :freed_statuses
            )
            """
        ).bindparams(freed_statuses=_SLOT_FREED_STATUSES)
    )

    # ── 5. Patient slot exclusion ──────────────────────────────────
    # Prevents a patient from having overlapping active appointments.
    op.execute(
        sa.text(
            """
            ALTER TABLE appointments
            ADD CONSTRAINT excl_patient_slot
            EXCLUDE USING gist (
                patient_id WITH =,
                tsrange(
                    appointment_date::timestamp + start_time,
                    appointment_date::timestamp + end_time,
                    '[)'
                ) WITH &&
            )
            WHERE (
                status NOT IN :freed_statuses
            )
            """
        ).bindparams(freed_statuses=_SLOT_FREED_STATUSES)
    )


def downgrade() -> None:
    """Remove EXCLUDE constraints (extension remains installed)."""
    op.drop_constraint(
        "excl_patient_slot",
        "appointments",
        type_="exclude",
    )
    op.drop_constraint(
        "excl_dentist_slot",
        "appointments",
        type_="exclude",
    )
