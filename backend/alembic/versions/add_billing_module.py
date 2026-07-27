"""add billing module

Revision ID: a1b2c3d4e5f6
Revises: 3e904edeca5a
Create Date: 2026-07-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3e904edeca5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ----------------------------------------------------------------
    # 1. document_sequences  (no billing FKs)
    # ----------------------------------------------------------------
    op.create_table(
        'document_sequences',
        sa.Column('document_type', sa.String(length=20), nullable=False),
        sa.Column('prefix', sa.String(length=10), nullable=False),
        sa.Column('current_value', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('min_digits', sa.Integer(), nullable=False, server_default=sa.text('5')),
        sa.Column('start_value', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=False),
        sa.CheckConstraint("current_value >= 0", name='ck_document_sequence_current_nonneg'),
        sa.CheckConstraint("min_digits >= 1", name='ck_document_sequence_min_digits'),
        sa.CheckConstraint("prefix ~ '^[A-Z-]+$'", name='ck_document_sequence_prefix_format'),
        sa.CheckConstraint("start_value >= 1", name='ck_document_sequence_start_value'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('document_type'),
    )
    op.create_index('ix_document_sequences_updated_at', 'document_sequences', ['updated_at'], unique=False)

    # ----------------------------------------------------------------
    # 2. invoices  (FK: patients, treatment_plans, appointments, doctors, users)
    # ----------------------------------------------------------------
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('treatment_plan_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('invoice_number', sa.String(length=30), nullable=False),
        sa.Column('invoice_date', sa.Date(), server_default=sa.text('current_date'), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void',
                    name='invoicestatus', native_enum=False, length=30),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column('currency_code', sa.String(length=3), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('doc_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.CheckConstraint("cancellation_reason IS NOT NULL OR status != 'cancelled'", name='ck_invoice_cancel_reason_required'),
        sa.CheckConstraint("currency_code ~ '^[A-Z]{3}$'", name='ck_invoice_currency_format'),
        sa.CheckConstraint("due_date >= invoice_date", name='ck_invoice_due_after_date'),
        sa.CheckConstraint("status IN ('cancelled', 'draft', 'issued', 'overdue', 'paid', 'partially_paid', 'void')", name='ck_invoice_status'),
        sa.CheckConstraint("version >= 1", name='ck_invoice_version'),
        sa.CheckConstraint("void_reason IS NOT NULL OR status != 'void'", name='ck_invoice_void_reason_required'),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['treatment_plan_id'], ['treatment_plans.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number'),
    )
    op.create_index('ix_invoices_active_status', 'invoices', ['status', 'created_at'], unique=False)
    op.create_index('ix_invoices_appointment', 'invoices', ['appointment_id'], unique=False)
    op.create_index('ix_invoices_created_at', 'invoices', ['created_at'], unique=False)
    op.create_index('ix_invoices_currency', 'invoices', ['currency_code'], unique=False)
    op.create_index('ix_invoices_doctor', 'invoices', ['doctor_id'], unique=False)
    op.create_index('ix_invoices_due_date', 'invoices', ['due_date'], unique=False)
    op.create_index('ix_invoices_invoice_date', 'invoices', ['invoice_date'], unique=False)
    op.create_index('ix_invoices_patient', 'invoices', ['patient_id'], unique=False)
    op.create_index('ix_invoices_patient_status', 'invoices', ['patient_id', 'status'], unique=False)
    op.create_index('ix_invoices_status', 'invoices', ['status'], unique=False)
    op.create_index('ix_invoices_treatment_plan', 'invoices', ['treatment_plan_id'], unique=False)

    # ----------------------------------------------------------------
    # 3. invoice_line_items  (FK: invoices, treatment_plan_items, patient_record_diagnoses, users)
    # ----------------------------------------------------------------
    op.create_table(
        'invoice_line_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('plan_item_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('diagnosis_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sequence_number', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('discount_type', sa.String(length=20), nullable=True),
        sa.Column('discount_value', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('net_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('tax_rate_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('original_price', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('override_reason', sa.String(length=500), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('doc_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.CheckConstraint("discount_type IS NULL OR discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')", name='ck_invoice_item_discount_type'),
        sa.CheckConstraint("discount_value IS NULL OR discount_value >= 0", name='ck_invoice_item_discount_nonneg'),
        sa.CheckConstraint("net_amount >= 0", name='ck_invoice_item_net_amount'),
        sa.CheckConstraint("quantity >= 1", name='ck_invoice_item_quantity'),
        sa.CheckConstraint("unit_price >= 0", name='ck_invoice_item_unit_price'),
        sa.CheckConstraint("version >= 1", name='ck_invoice_item_version'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['diagnosis_id'], ['patient_record_diagnoses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_item_id'], ['treatment_plan_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_id', 'sequence_number', name='uq_invoice_item_sequence'),
    )
    op.create_index('ix_invoice_item_diagnosis', 'invoice_line_items', ['diagnosis_id'], unique=False)
    op.create_index('ix_invoice_item_invoice', 'invoice_line_items', ['invoice_id'], unique=False)
    op.create_index('ix_invoice_item_plan_item', 'invoice_line_items', ['plan_item_id'], unique=False)
    op.create_index('ix_invoice_item_tax_rate', 'invoice_line_items', ['tax_rate_id'], unique=False)

    # ----------------------------------------------------------------
    # 4. invoice_status_history  (FK: invoices, users)
    # ----------------------------------------------------------------
    op.create_table(
        'invoice_status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=True),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('changed_by', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invoice_status_history_invoice', 'invoice_status_history', ['invoice_id', 'changed_at'], unique=False)

    # ----------------------------------------------------------------
    # 5. payments  (FK: patients, users)
    # ----------------------------------------------------------------
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payment_number', sa.String(length=30), nullable=False),
        sa.Column(
            'payment_method',
            sa.Enum('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'insurance', 'wallet',
                    name='paymentmethod', native_enum=False, length=30),
            nullable=False,
        ),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_date', sa.Date(), server_default=sa.text('current_date'), nullable=False),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column(
            'status',
            sa.Enum('pending', 'completed', 'failed', 'refunded', 'reversed', 'void',
                    name='paymentstatus', native_enum=False, length=30),
            nullable=False,
            server_default=sa.text("'completed'"),
        ),
        sa.Column('is_reversed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('reversal_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('doc_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.CheckConstraint("reversal_reason IS NOT NULL OR is_reversed = FALSE", name='ck_payment_reversal_reason_required'),
        sa.CheckConstraint("status IN ('completed', 'failed', 'pending', 'refunded', 'reversed', 'void')", name='ck_payment_status'),
        sa.CheckConstraint("total_amount > 0", name='ck_payment_amount_positive'),
        sa.CheckConstraint("version >= 1", name='ck_payment_version'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_number'),
    )
    op.create_index('ix_payments_created_at', 'payments', ['created_at'], unique=False)
    op.create_index('ix_payments_method_status', 'payments', ['payment_method', 'status'], unique=False)
    op.create_index('ix_payments_patient', 'payments', ['patient_id'], unique=False)
    op.create_index('ix_payments_patient_status', 'payments', ['patient_id', 'status'], unique=False)
    op.create_index('ix_payments_payment_date', 'payments', ['payment_date'], unique=False)
    op.create_index('ix_payments_status', 'payments', ['status'], unique=False)

    # ----------------------------------------------------------------
    # 6. payment_allocations  (FK: payments, invoices, payment_allocations, users)
    # ----------------------------------------------------------------
    op.create_table(
        'payment_allocations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('allocated_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('is_refund', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('refund_reason', sa.Text(), nullable=True),
        sa.Column('original_allocation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("allocated_amount > 0", name='ck_payment_allocation_amount_positive'),
        sa.CheckConstraint("refund_reason IS NOT NULL OR is_refund = FALSE", name='ck_payment_allocation_refund_reason_required'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['original_allocation_id'], ['payment_allocations.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payment_allocation_invoice', 'payment_allocations', ['invoice_id'], unique=False)
    op.create_index('ix_payment_allocation_original', 'payment_allocations', ['original_allocation_id'], unique=False)
    op.create_index('ix_payment_allocation_payment', 'payment_allocations', ['payment_id'], unique=False)
    op.create_index(
        'uq_payment_allocation_active',
        'payment_allocations',
        ['payment_id', 'invoice_id'],
        unique=True,
        postgresql_where=sa.text("is_refund = FALSE AND invoice_id IS NOT NULL"),
    )

    # ----------------------------------------------------------------
    # 7. receipts  (FK: payments, users)
    # ----------------------------------------------------------------
    op.create_table(
        'receipts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('receipt_number', sa.String(length=30), nullable=False),
        sa.Column('receipt_date', sa.Date(), server_default=sa.text('current_date'), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            'status',
            sa.Enum('generated', 'cancelled',
                    name='receiptstatus', native_enum=False, length=20),
            nullable=False,
            server_default=sa.text("'generated'"),
        ),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('cancelled', 'generated')", name='ck_receipt_status'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_id'),
        sa.UniqueConstraint('receipt_number'),
    )
    op.create_index('ix_receipts_created_at', 'receipts', ['created_at'], unique=False)
    op.create_index('ix_receipts_date', 'receipts', ['receipt_date'], unique=False)
    op.create_index('ix_receipts_status', 'receipts', ['status'], unique=False)

    # ----------------------------------------------------------------
    # 8. receipt_invoices  (FK: receipts, invoices)
    # ----------------------------------------------------------------
    op.create_table(
        'receipt_invoices',
        sa.Column('receipt_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['receipt_id'], ['receipts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('receipt_id', 'invoice_id'),
    )

    # ----------------------------------------------------------------
    # 9. credit_notes  (FK: invoices, patients, users)
    # ----------------------------------------------------------------
    op.create_table(
        'credit_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('credit_note_number', sa.String(length=30), nullable=False),
        sa.Column('issue_date', sa.Date(), server_default=sa.text('current_date'), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('remaining_balance', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('draft', 'issued', 'applied', 'void', 'expired',
                    name='creditnotestatus', native_enum=False, length=30),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('doc_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.CheckConstraint("amount > 0", name='ck_credit_note_amount_positive'),
        sa.CheckConstraint("remaining_balance <= amount", name='ck_credit_note_remaining_le_amount'),
        sa.CheckConstraint("remaining_balance >= 0", name='ck_credit_note_remaining_nonneg'),
        sa.CheckConstraint("status IN ('applied', 'draft', 'expired', 'issued', 'void')", name='ck_credit_note_status'),
        sa.CheckConstraint("version >= 1", name='ck_credit_note_version'),
        sa.CheckConstraint("void_reason IS NOT NULL OR status != 'void'", name='ck_credit_note_void_reason_required'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('credit_note_number'),
    )
    op.create_index('ix_credit_notes_created_at', 'credit_notes', ['created_at'], unique=False)
    op.create_index('ix_credit_notes_expiry', 'credit_notes', ['expiry_date'], unique=False)
    op.create_index('ix_credit_notes_invoice', 'credit_notes', ['invoice_id'], unique=False)
    op.create_index('ix_credit_notes_patient', 'credit_notes', ['patient_id'], unique=False)
    op.create_index('ix_credit_notes_status', 'credit_notes', ['status'], unique=False)

    # ----------------------------------------------------------------
    # 10. patient_credits  (FK: patients, payment_allocations, credit_notes, users)
    # ----------------------------------------------------------------
    op.create_table(
        'patient_credits',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_allocation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('source_credit_note_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('original_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('remaining_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("original_amount > 0", name='ck_patient_credit_original_positive'),
        sa.CheckConstraint("remaining_amount <= original_amount", name='ck_patient_credit_remaining_le_original'),
        sa.CheckConstraint("remaining_amount >= 0", name='ck_patient_credit_remaining_nonneg'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['source_allocation_id'], ['payment_allocations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_credit_note_id'], ['credit_notes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_patient_credits_expiry', 'patient_credits', ['expiry_date'], unique=False)
    op.create_index('ix_patient_credits_patient', 'patient_credits', ['patient_id'], unique=False)
    op.create_index('ix_patient_credits_source_allocation', 'patient_credits', ['source_allocation_id'], unique=False)
    op.create_index('ix_patient_credits_source_credit_note', 'patient_credits', ['source_credit_note_id'], unique=False)

    # ----------------------------------------------------------------
    # 11. sequence_consumption_log  (FK: document_sequences, users)
    # ----------------------------------------------------------------
    op.create_table(
        'sequence_consumption_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_type', sa.String(length=20), nullable=False),
        sa.Column('number_assigned', sa.Integer(), nullable=False),
        sa.Column('reserved_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reserved_by', sa.Integer(), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default=sa.text("'completed'")),
        sa.CheckConstraint("number_assigned >= 1", name='ck_sequence_consumption_number_positive'),
        sa.CheckConstraint("status IN ('completed', 'failed', 'rolled_back')", name='ck_sequence_consumption_status'),
        sa.ForeignKeyConstraint(['document_type'], ['document_sequences.document_type'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reserved_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sequence_consumption_document_type', 'sequence_consumption_log', ['document_type'], unique=False)
    op.create_index('ix_sequence_consumption_reserved_at', 'sequence_consumption_log', ['reserved_at'], unique=False)
    op.create_index('ix_sequence_consumption_reserved_by', 'sequence_consumption_log', ['reserved_by'], unique=False)

    # ----------------------------------------------------------------
    # 12. refunds  (FK: payments, users)
    # ----------------------------------------------------------------
    op.create_table(
        'refunds',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('refund_number', sa.String(length=30), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'approved', 'rejected', 'completed',
                    name='refundstatus', native_enum=False, length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('doc_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.CheckConstraint("amount > 0", name='ck_refund_amount_positive'),
        sa.CheckConstraint("rejection_reason IS NOT NULL OR status != 'rejected'", name='ck_refund_rejection_reason_required'),
        sa.CheckConstraint("status IN ('approved', 'completed', 'pending', 'rejected')", name='ck_refund_status'),
        sa.CheckConstraint("version >= 1", name='ck_refund_version'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('refund_number'),
    )
    op.create_index('ix_refunds_created_at', 'refunds', ['created_at'], unique=False)
    op.create_index('ix_refunds_payment', 'refunds', ['payment_id'], unique=False)
    op.create_index('ix_refunds_payment_status', 'refunds', ['payment_id', 'status'], unique=False)
    op.create_index('ix_refunds_status', 'refunds', ['status'], unique=False)

    # ----------------------------------------------------------------
    # 13. billing_audit_logs  (FK: users)
    # ----------------------------------------------------------------
    op.create_table(
        'billing_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=30), nullable=False),
        sa.Column('old_value', postgresql.JSONB(), nullable=True),
        sa.Column('new_value', postgresql.JSONB(), nullable=True),
        sa.Column('changed_by', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_billing_audit_logs_action', 'billing_audit_logs', ['action'], unique=False)
    op.create_index('ix_billing_audit_logs_changed_at', 'billing_audit_logs', ['changed_at'], unique=False)
    op.create_index('ix_billing_audit_logs_changed_by', 'billing_audit_logs', ['changed_by'], unique=False)
    op.create_index('ix_billing_audit_logs_entity', 'billing_audit_logs', ['entity_type', 'entity_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # ----------------------------------------------------------------
    # Drop in reverse dependency order
    # ----------------------------------------------------------------

    # 13. billing_audit_logs
    op.drop_index('ix_billing_audit_logs_entity', table_name='billing_audit_logs')
    op.drop_index('ix_billing_audit_logs_changed_by', table_name='billing_audit_logs')
    op.drop_index('ix_billing_audit_logs_changed_at', table_name='billing_audit_logs')
    op.drop_index('ix_billing_audit_logs_action', table_name='billing_audit_logs')
    op.drop_table('billing_audit_logs')

    # 12. refunds
    op.drop_index('ix_refunds_status', table_name='refunds')
    op.drop_index('ix_refunds_payment_status', table_name='refunds')
    op.drop_index('ix_refunds_payment', table_name='refunds')
    op.drop_index('ix_refunds_created_at', table_name='refunds')
    op.drop_table('refunds')

    # 11. sequence_consumption_log
    op.drop_index('ix_sequence_consumption_reserved_by', table_name='sequence_consumption_log')
    op.drop_index('ix_sequence_consumption_reserved_at', table_name='sequence_consumption_log')
    op.drop_index('ix_sequence_consumption_document_type', table_name='sequence_consumption_log')
    op.drop_table('sequence_consumption_log')

    # 10. patient_credits
    op.drop_index('ix_patient_credits_source_credit_note', table_name='patient_credits')
    op.drop_index('ix_patient_credits_source_allocation', table_name='patient_credits')
    op.drop_index('ix_patient_credits_patient', table_name='patient_credits')
    op.drop_index('ix_patient_credits_expiry', table_name='patient_credits')
    op.drop_table('patient_credits')

    # 9. credit_notes
    op.drop_index('ix_credit_notes_status', table_name='credit_notes')
    op.drop_index('ix_credit_notes_patient', table_name='credit_notes')
    op.drop_index('ix_credit_notes_invoice', table_name='credit_notes')
    op.drop_index('ix_credit_notes_expiry', table_name='credit_notes')
    op.drop_index('ix_credit_notes_created_at', table_name='credit_notes')
    op.drop_table('credit_notes')

    # 8. receipt_invoices
    op.drop_table('receipt_invoices')

    # 7. receipts
    op.drop_index('ix_receipts_status', table_name='receipts')
    op.drop_index('ix_receipts_date', table_name='receipts')
    op.drop_index('ix_receipts_created_at', table_name='receipts')
    op.drop_table('receipts')

    # 6. payment_allocations
    op.drop_index('uq_payment_allocation_active', table_name='payment_allocations')
    op.drop_index('ix_payment_allocation_payment', table_name='payment_allocations')
    op.drop_index('ix_payment_allocation_original', table_name='payment_allocations')
    op.drop_index('ix_payment_allocation_invoice', table_name='payment_allocations')
    op.drop_table('payment_allocations')

    # 5. payments
    op.drop_index('ix_payments_status', table_name='payments')
    op.drop_index('ix_payments_payment_date', table_name='payments')
    op.drop_index('ix_payments_patient_status', table_name='payments')
    op.drop_index('ix_payments_patient', table_name='payments')
    op.drop_index('ix_payments_method_status', table_name='payments')
    op.drop_index('ix_payments_created_at', table_name='payments')
    op.drop_table('payments')

    # 4. invoice_status_history
    op.drop_index('ix_invoice_status_history_invoice', table_name='invoice_status_history')
    op.drop_table('invoice_status_history')

    # 3. invoice_line_items
    op.drop_index('ix_invoice_item_tax_rate', table_name='invoice_line_items')
    op.drop_index('ix_invoice_item_plan_item', table_name='invoice_line_items')
    op.drop_index('ix_invoice_item_invoice', table_name='invoice_line_items')
    op.drop_index('ix_invoice_item_diagnosis', table_name='invoice_line_items')
    op.drop_table('invoice_line_items')

    # 2. invoices
    op.drop_index('ix_invoices_treatment_plan', table_name='invoices')
    op.drop_index('ix_invoices_status', table_name='invoices')
    op.drop_index('ix_invoices_patient_status', table_name='invoices')
    op.drop_index('ix_invoices_patient', table_name='invoices')
    op.drop_index('ix_invoices_invoice_date', table_name='invoices')
    op.drop_index('ix_invoices_due_date', table_name='invoices')
    op.drop_index('ix_invoices_doctor', table_name='invoices')
    op.drop_index('ix_invoices_currency', table_name='invoices')
    op.drop_index('ix_invoices_created_at', table_name='invoices')
    op.drop_index('ix_invoices_appointment', table_name='invoices')
    op.drop_index('ix_invoices_active_status', table_name='invoices')
    op.drop_table('invoices')

    # 1. document_sequences
    op.drop_index('ix_document_sequences_updated_at', table_name='document_sequences')
    op.drop_table('document_sequences')

    # ----------------------------------------------------------------
    # Drop enum types
    # ----------------------------------------------------------------
    sa.Enum(name='refundstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='receiptstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='creditnotestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='paymentstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='paymentmethod').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='invoicestatus').drop(op.get_bind(), checkfirst=True)
