"""fix profile_status_enum casing to lowercase

The PostgreSQL enum was created with uppercase labels (COMPLETE, INCOMPLETE)
from SQLAlchemy's default behavior (using Python member names). The Python
ProfileStatus enum uses lowercase values ("complete", "incomplete"), causing
a LookupError when reading rows. This migration recreates the enum with
lowercase labels.

Revision ID: e7f8a9b0c1d3
Revises: d5e6f7a8b9c0
Create Date: 2026-08-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d3"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the old index on profile_status
    op.drop_index("ix_patients_profile_status", table_name="patients")

    # 2. Drop the column (this removes the column from the table but NOT the enum type)
    op.drop_column("patients", "profile_status")

    # 3. Drop the old enum type (uppercase labels)
    op.execute("DROP TYPE IF EXISTS profile_status_enum;")

    # 4. Recreate the enum type with lowercase labels
    op.execute(
        "CREATE TYPE profile_status_enum AS ENUM ('complete', 'incomplete');"
    )

    # 5. Recreate the column with the corrected enum
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

    # 6. Recreate the index
    op.create_index(
        "ix_patients_profile_status",
        "patients",
        ["profile_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_patients_profile_status", table_name="patients")
    op.drop_column("patients", "profile_status")
    op.execute("DROP TYPE IF EXISTS profile_status_enum;")

    # Restore the old uppercase enum (for downgrade compatibility)
    op.execute(
        "CREATE TYPE profile_status_enum AS ENUM ('COMPLETE', 'INCOMPLETE');"
    )
    op.add_column(
        "patients",
        sa.Column(
            "profile_status",
            sa.Enum(
                "COMPLETE",
                "INCOMPLETE",
                name="profile_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="COMPLETE",
        ),
    )
    op.create_index(
        "ix_patients_profile_status",
        "patients",
        ["profile_status"],
        unique=False,
    )
