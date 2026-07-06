"""add_recordstatus_enum_values

Revision ID: 2acc90fbcbf0
Revises: 43f93a7e590e
Create Date: 2026-07-06 19:14:35.372194

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2acc90fbcbf0'
down_revision: Union[str, Sequence[str], None] = '43f93a7e590e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing enum values for the recordstatus type.
    # PostgreSQL 9.3+ supports ALTER TYPE ... ADD VALUE (non-transactional).
    # IF NOT EXISTS is used so that re-running the migration is idempotent.
    op.execute(
        "ALTER TYPE recordstatus ADD VALUE IF NOT EXISTS 'UNDER_REVIEW'"
    )
    op.execute(
        "ALTER TYPE recordstatus ADD VALUE IF NOT EXISTS 'FINALIZED'"
    )


def downgrade() -> None:
    """Downgrade schema.

    PostgreSQL does not support removing individual values from an ENUM type.
    A full downgrade would require:
      1. Creating a new enum type without the values.
      2. ALTER TABLE ... ALTER COLUMN ... TYPE <new_enum>.
      3. Dropping the old enum type.

    This is a complex operation that is intentionally omitted because
    removing enum values is rarely needed and risky with existing data.
    """
    # Intentionally no-op — enum value removal requires a multi-step
    # process that is not safe to automate.
    pass
