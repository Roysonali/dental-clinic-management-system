"""
create patients module

Revision ID: 3733f4eaa564
Revises: 652824d3ff1f
Create Date: 2026-06-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "3733f4eaa564"
down_revision: Union[str, Sequence[str], None] = "652824d3ff1f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create Patients module database objects.
    """

    # ------------------------------------------------------------------
    # Create Gender Enum (PostgreSQL)
    # ------------------------------------------------------------------

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'gender_enum'
            ) THEN
                CREATE TYPE gender_enum AS ENUM (
                    'male',
                    'female',
                    'other'
                );
            END IF;
        END
        $$;
        """
    )

    # ------------------------------------------------------------------
    # Create Patient Code Sequence
    # ------------------------------------------------------------------

    op.execute(
        """
        CREATE SEQUENCE IF NOT EXISTS patient_code_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;
        """
    )

    # ------------------------------------------------------------------
    # Create Patients Table
    # ------------------------------------------------------------------

    op.create_table(
        "patients",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),

        sa.Column(
            "patient_code",
            sa.String(length=20),
            nullable=False,
        ),

        sa.Column(
            "first_name",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "middle_name",
            sa.String(length=100),
            nullable=True,
        ),

        sa.Column(
            "last_name",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "date_of_birth",
            sa.Date(),
            nullable=False,
        ),

        sa.Column(
            "gender",
            postgresql.ENUM(
                "male",
                "female",
                "other",
                name="gender_enum",
                create_type=False,
            ),
            nullable=False,
        ),

        sa.Column(
            "primary_contact_number",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "emergency_contact_number",
            sa.String(length=30),
            nullable=True,
        ),

        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "address",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "remarks",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),

        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint(
            "patient_code",
            name="uq_patients_patient_code",
        ),
    )

        # ------------------------------------------------------------------
    # Create Indexes
    # ------------------------------------------------------------------

    op.create_index(
        "ix_patients_patient_code",
        "patients",
        ["patient_code"],
        unique=False,
    )

    op.create_index(
        "ix_patients_phone",
        "patients",
        ["primary_contact_number"],
        unique=False,
    )

    op.create_index(
        "ix_patients_email",
        "patients",
        ["email"],
        unique=False,
    )

    op.create_index(
        "ix_patients_created_at",
        "patients",
        ["created_at"],
        unique=False,
    )

    op.create_index(
        "ix_patients_name",
        "patients",
        [
            "last_name",
            "first_name",
        ],
        unique=False,
    )

    def downgrade() -> None:
        """
        Drop Patients module database objects.
        """

        # ------------------------------------------------------------------
        # Drop Indexes
        # ------------------------------------------------------------------

        op.drop_index(
            "ix_patients_name",
            table_name="patients",
        )

        op.drop_index(
            "ix_patients_created_at",
            table_name="patients",
        )

        op.drop_index(
            "ix_patients_email",
            table_name="patients",
        )

        op.drop_index(
            "ix_patients_phone",
            table_name="patients",
        )

        op.drop_index(
            "ix_patients_patient_code",
            table_name="patients",
        )

        # ------------------------------------------------------------------
        # Drop Table
        # ------------------------------------------------------------------

        op.drop_table("patients")

        # ------------------------------------------------------------------
        # Drop Sequence
        # ------------------------------------------------------------------

        op.execute(
            """
            DROP SEQUENCE IF EXISTS patient_code_seq;
            """
        )

        # ------------------------------------------------------------------
        # Drop Enum
        # ------------------------------------------------------------------

        op.execute(
            """
            DROP TYPE IF EXISTS gender_enum;
            """
        )

