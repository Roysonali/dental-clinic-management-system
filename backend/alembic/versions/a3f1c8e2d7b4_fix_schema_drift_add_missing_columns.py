"""fix schema drift: add missing columns, rename misnamed column, add missing constraint

Revision ID: a3f1c8e2d7b4
Revises: f6a7b8c9d0e1
Create Date: 2026-08-22 00:00:00.000000

This migration closes every gap between the SQLAlchemy model definitions
and the actual production schema. It is strictly ADDITIVE (no DROP
COLUMN, no ALTER TYPE).

Every step checks information_schema first so the migration is
idempotent — safe to re-run on any database regardless of whether the
drift was already patched manually.

Drift discovered by auditing every model in:
  - app/modules/auth/models.py          (users, roles, password_reset_tokens)
  - app/modules/patients/models.py      (patients)
  - app/modules/appointments/model.py   (appointments)
  - app/modules/doctors/models.py       (doctors, specializations, …)
  - app/modules/treatment/models.py     (procedures, treatment_plans, …)
  - app/modules/patient_records/models/ (patient_records, diagnoses, …)
  - app/modules/billing/models/         (invoices, payments, receipts, …)

against every migration in alembic/versions/ up to f6a7b8c9d0e1.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a3f1c8e2d7b4"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col(bind, table: str, column: str) -> bool:
    """Check information_schema for a column."""
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).fetchone()
    )


def _chk(bind, table: str, name: str) -> bool:
    """Check information_schema for a check constraint."""
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_name = :t AND constraint_name = :n "
                "AND constraint_type = 'CHECK'"
            ),
            {"t": table, "n": name},
        ).fetchone()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1. users — add created_at
    if not _col(bind, "users", "created_at"):
        op.add_column(
            "users",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )

    # 2. users — add updated_at
    if not _col(bind, "users", "updated_at"):
        op.add_column(
            "users",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )

    # 3. users — add ck_users_status_valid check constraint
    if not _chk(bind, "users", "ck_users_status_valid"):
        op.create_check_constraint(
            "ck_users_status_valid",
            "users",
            "status IN ('pending', 'active', 'inactive')",
        )

    # 4. patient_record_diagnoses — rename diagnosis -> diagnosis_name
    if _col(bind, "patient_record_diagnoses", "diagnosis") and not _col(
        bind, "patient_record_diagnoses", "diagnosis_name"
    ):
        op.alter_column(
            "patient_record_diagnoses",
            "diagnosis",
            new_column_name="diagnosis_name",
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _col(bind, "patient_record_diagnoses", "diagnosis_name") and not _col(
        bind, "patient_record_diagnoses", "diagnosis"
    ):
        op.alter_column(
            "patient_record_diagnoses",
            "diagnosis_name",
            new_column_name="diagnosis",
        )

    if _chk(bind, "users", "ck_users_status_valid"):
        op.drop_constraint("ck_users_status_valid", "users", type_="check")

    if _col(bind, "users", "updated_at"):
        op.drop_column("users", "updated_at")

    if _col(bind, "users", "created_at"):
        op.drop_column("users", "created_at")
