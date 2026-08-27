"""fix profile_status_enum casing to lowercase

The PostgreSQL enum may have been created with uppercase labels
(COMPLETE, INCOMPLETE) from SQLAlchemy's default behavior (using Python
member names).  This migration safely renames the enum labels to
lowercase using ALTER TYPE ... RENAME VALUE, which preserves existing
column values and never drops/recreates columns or types.

Revision ID: e7f8a9b0c1d3
Revises: d5e6f7a8b9c0
Create Date: 2026-08-27

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d3"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename uppercase enum labels to lowercase if they exist.
    # This is a no-op when labels are already lowercase.
    # ALTER TYPE ... RENAME VALUE is a metadata-only operation —
    # it never drops columns, types, or indexes, and never resets data.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'profile_status_enum'
                  AND e.enumlabel = 'COMPLETE'
            ) THEN
                ALTER TYPE profile_status_enum RENAME VALUE 'COMPLETE' TO 'complete';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'profile_status_enum'
                  AND e.enumlabel = 'INCOMPLETE'
            ) THEN
                ALTER TYPE profile_status_enum RENAME VALUE 'INCOMPLETE' TO 'incomplete';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # Rename lowercase labels back to uppercase (for downgrade compatibility).
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'profile_status_enum'
                  AND e.enumlabel = 'complete'
            ) THEN
                ALTER TYPE profile_status_enum RENAME VALUE 'complete' TO 'COMPLETE';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'profile_status_enum'
                  AND e.enumlabel = 'incomplete'
            ) THEN
                ALTER TYPE profile_status_enum RENAME VALUE 'incomplete' TO 'INCOMPLETE';
            END IF;
        END
        $$;
        """
    )
