"""merge patient and user audit branches

Revision ID: c0594e64fa77
Revises: e5f6a7b8c9d0, f1a2b3c4d5e6
Create Date: 2026-06-29 13:43:48.178896

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0594e64fa77'
down_revision: Union[str, Sequence[str], None] = ('e5f6a7b8c9d0', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
