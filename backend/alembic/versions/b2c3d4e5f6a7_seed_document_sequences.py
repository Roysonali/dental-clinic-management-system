"""seed default document sequences for invoice, payment, receipt, refund, credit_note

This is a one-way configuration migration. It:
1. Makes ``document_sequences.updated_by`` nullable (system initialization
   has no user to record).
2. Seeds the 5 default document sequence rows required by billing services.

The investigation (Sprint 13.0 / Sprint 13.0A) confirmed:
- ``updated_by`` was manually designed, never inherited from AuditMixin.
- It is not read or written in production — detailed reservation audit is
  maintained by ``SequenceConsumptionLog`` (ADR-003).
- NULL is the semantically correct value for system-initialized sequences:
  "no user has triggered an increment yet."

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6 (add_billing_module)
Create Date: 2026-07-27 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEED_SEQUENCES: list[dict[str, object]] = [
    {"document_type": "invoice",     "prefix": "INV-",  "current_value": 0, "min_digits": 5, "start_value": 1},
    {"document_type": "payment",     "prefix": "PAY-",  "current_value": 0, "min_digits": 5, "start_value": 1},
    {"document_type": "receipt",     "prefix": "RCT-",  "current_value": 0, "min_digits": 5, "start_value": 1},
    {"document_type": "refund",      "prefix": "RFD-",  "current_value": 0, "min_digits": 5, "start_value": 1},
    {"document_type": "credit_note", "prefix": "CN-",   "current_value": 0, "min_digits": 5, "start_value": 1},
]


def upgrade() -> None:
    """Upgrade: make updated_by nullable, seed 5 default sequences."""

    # ------------------------------------------------------------------
    # Step 1 — Make updated_by nullable
    #
    # System-initialized sequences have no user who "triggered an
    # increment." NULL is semantically correct. The FK constraint to
    # users.id is preserved (FKs allow NULL).
    # ------------------------------------------------------------------
    op.alter_column(
        "document_sequences",
        "updated_by",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Step 2 — Seed 5 default document sequences
    #
    # Idempotent via ON CONFLICT (document_type) DO NOTHING.
    #
    # Safe for all deployment scenarios:
    #   fresh DB      → all 5 rows inserted
    #   partial       → only missing document types inserted
    #   fully seeded  → all 5 skipped (no-op)
    #
    # First generated document numbers:
    #   INV-00001, PAY-00001, RCT-00001, RFD-00001, CN-00001
    #
    # Configuration rationale:
    #   current_value = 0  → increment() produces value 1
    #   min_digits    = 5  → zero-padded to 5 digits (00001)
    #   start_value   = 1  → documents the configured starting point
    #   updated_by    = NULL (system initialization, no user)
    #   updated_at    = NOW()
    # ------------------------------------------------------------------
    for seq in SEED_SEQUENCES:
        op.execute(
            sa.text(
                """INSERT INTO document_sequences
                       (document_type, prefix, current_value, min_digits,
                        start_value, updated_at, updated_by)
                   VALUES (:document_type, :prefix, :current_value,
                           :min_digits, :start_value, NOW(), NULL)
                   ON CONFLICT (document_type) DO NOTHING"""
            ).bindparams(**seq)
        )


def downgrade() -> None:
    """Downgrade is intentionally non-reversible.

    This is a one-way configuration migration because:

    1. Schema — Reverting ``updated_by`` to NOT NULL would fail if any row
       carries a NULL value (which all seed rows do). To safely reverse the
       schema change, an operator would need to UPDATE NULL values to a valid
       user ID first — an operation that requires domain knowledge about which
       user to reference and violates the architectural decision that Billing
       migrations must not create or reference Auth users.

    2. Data — The 5 seed rows are production configuration, not transient
       test data. Deleting them on rollback (DELETE FROM document_sequences)
       would destroy sequence counters and audit trail, potentially causing
       data loss or duplicate numbering on re-application.

    To fully reverse this migration if ever required:
      1. Manually set updated_by = <user_id> WHERE updated_by IS NULL
      2. Run: ALTER TABLE document_sequences ALTER COLUMN updated_by SET NOT NULL
      3. Optionally DELETE seed rows (not recommended — counters will be lost)

    See Sprint 13.0A — Document Sequence Initialization Investigation for
    the complete architectural analysis.
    """
    pass
