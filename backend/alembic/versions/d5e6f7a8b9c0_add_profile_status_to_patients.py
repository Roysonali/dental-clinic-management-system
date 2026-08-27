"""add profile_status to patients and make DOB/gender nullable

Revision ID: d5e6f7a8b9c0
Revises: b7e8f9a0c1d2
Create Date: 2026-08-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "b7e8f9a0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create profile_status enum type
    # ------------------------------------------------------------------
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'profile_status_enum'
            ) THEN
                CREATE TYPE profile_status_enum AS ENUM (
                    'complete',
                    'incomplete'
                );
            END IF;
        END
        $$;
        """
    )

    # ------------------------------------------------------------------
    # 2. Add profile_status column
    #    server_default='complete' populates existing rows without a
    #    full table scan (PostgreSQL 11+ metadata-only operation).
    # ------------------------------------------------------------------
    op.add_column(
        "patients",
        sa.Column(
            "profile_status",
            sa.Enum(
                "complete",
                "incomplete",
                name="profile_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="complete",
        ),
    )

    # ------------------------------------------------------------------
    # 3. Add index for querying incomplete patients
    # ------------------------------------------------------------------
    op.create_index(
        "ix_patients_profile_status",
        "patients",
        ["profile_status"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 4. Make date_of_birth nullable (was NOT NULL)
    #    Metadata-only in PostgreSQL — no table rewrite.
    # ------------------------------------------------------------------
    op.alter_column(
        "patients",
        "date_of_birth",
        nullable=True,
    )

    # ------------------------------------------------------------------
    # 5. Make gender nullable (was NOT NULL)
    #    Metadata-only in PostgreSQL — no table rewrite.
    # ------------------------------------------------------------------
    op.alter_column(
        "patients",
        "gender",
        nullable=True,
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # WARNING: If any quick-created patients exist (DOB or gender NULL),
    # the NOT NULL constraint will fail. This is a documented limitation.
    # ------------------------------------------------------------------

    # 1. Restore NOT NULL on gender
    op.alter_column(
        "patients",
        "gender",
        nullable=False,
    )

    # 2. Restore NOT NULL on date_of_birth
    op.alter_column(
        "patients",
        "date_of_birth",
        nullable=False,
    )

    # 3. Drop index
    op.drop_index(
        "ix_patients_profile_status",
        table_name="patients",
    )

    # 4. Drop profile_status column
    op.drop_column("patients", "profile_status")

    # 5. Drop enum type
    op.execute("DROP TYPE IF EXISTS profile_status_enum;")
