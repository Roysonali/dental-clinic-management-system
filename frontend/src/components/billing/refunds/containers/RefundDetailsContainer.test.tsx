import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders, createTestQueryClient } from '../../../../test/testUtils';
import { RefundDetailsContainer } from './RefundDetailsContainer';
import { billingService } from '../../../../services/billingService';
import { billingQueryKeys } from '../../../../hooks/billing/billingQueryKeys';
import type { RefundRead, RefundStatus } from '../../../../types/billing';

// Refund workflow actions are role-gated via PermissionGate (backend
// `_REFUND_WORKFLOW_ROLES`) — resolve the role probe as a proven admin so
// the actions render in the workflow tests.
const permissionMock = {
  state: { status: 'admin' as const, role: { role_name: 'ADMIN', id: 1, label: 'Administrator' } },
  isAdmin: true,
  isResolved: true,
  role: 'ADMIN' as const,
  can: () => true,
};

vi.mock('../../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

vi.mock('../../../../services/billingService', () => ({
  billingService: {
    getPayment: vi.fn(),
    createRefund: vi.fn(),
    approveRefund: vi.fn(),
    rejectRefund: vi.fn(),
    completeRefund: vi.fn(),
  },
}));

const getPaymentMock = vi.mocked(billingService.getPayment);
const approveMock = vi.mocked(billingService.approveRefund);
const rejectMock = vi.mocked(billingService.rejectRefund);
const completeMock = vi.mocked(billingService.completeRefund);

function makeRefund(status: RefundStatus): RefundRead {
  return {
    id: 'rfd1',
    refund_number: 'RFD-00114',
    document_type: 'refund',
    status,
    patient: { id: 'p1', patient_code: 'PT-00504', full_name: 'Amara Okonkwo', is_active: true },
    payment: {
      id: 'pay1',
      payment_number: 'PAY-00869',
      payment_method: 'bank_transfer',
      total_amount: '1500.00',
      payment_date: '2026-07-09',
      currency_code: 'INR',
    },
    invoices: [],
    creator: { id: 1, full_name: 'Dana Whitfield' },
    updater: status === 'completed' ? { id: 1, full_name: 'Dana Whitfield' } : null,
    reviewer: status === 'approved' || status === 'completed' || status === 'rejected'
      ? { id: 2, full_name: 'Dr. Priya Raman' }
      : null,
    amount: '250.00',
    reason: 'Duplicate transfer received for the same treatment session.',
    currency_code: 'INR',
    notes: null,
    rejection_reason: status === 'rejected' ? 'No duplicate payment found.' : null,
    reviewed_by: status === 'pending' ? null : 2,
    reviewed_at: status === 'pending' ? null : '2026-07-11T09:40:00Z',
    financials: {
      currency_code: 'INR',
      refund_amount: '250.00',
      payment_total: '1500.00',
      remaining_on_payment: '1050.00',
      refund_count: 2,
    },
    gateway_metadata: null,
    document_metadata: {
      document_type: 'refund',
      sequence_number: null,
      issued_at: '2026-07-10T16:02:00Z',
      generated_at: '2026-07-10T16:02:00Z',
    },
    audit_trail: [],
    version: 1,
    doc_version: 1,
    created_at: '2026-07-10T16:02:00Z',
    created_by: 1,
    updated_at: status === 'completed' ? '2026-07-11T10:12:00Z' : '2026-07-10T16:02:00Z',
    updated_by: status === 'completed' ? 1 : null,
  };
}

function renderRefund(refund: RefundRead) {
  const client = createTestQueryClient();
  client.setQueryData(billingQueryKeys.refundDetail(refund.id), refund);
  getPaymentMock.mockResolvedValue({
    id: refund.payment.id,
    financials: { refunded_amount: '200.00' },
  } as never);
  return renderWithProviders(<RefundDetailsContainer refundId={refund.id} />, {
    route: '/billing/refunds/rfd1',
    queryClient: client,
  });
}

describe('RefundDetailsContainer', () => {
  beforeEach(() => {
    getPaymentMock.mockReset();
    approveMock.mockReset();
    rejectMock.mockReset();
    completeMock.mockReset();
  });

  it('renders the timeline, summary and reason from the cached refund (pending)', () => {
    renderRefund(makeRefund('pending'));

    expect(screen.getByText('RFD-00114')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Refund Timeline')).toBeInTheDocument();
    expect(screen.getByText('Pending — refund requested')).toBeInTheDocument();
    expect(screen.getByText('Refund Summary')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Duplicate transfer received for the same treatment session.')).toBeInTheDocument();
  });

  it('shows the "Previously refunded" total from the linked payment financials', async () => {
    renderRefund(makeRefund('pending'));
    expect(await screen.findByText('₹200.00')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThan(0);
  });

  it('exposes Approve + Reject for a pending refund (never Complete)', () => {
    renderRefund(makeRefund('pending'));

    expect(screen.getByRole('button', { name: 'Approve refund' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject refund' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete refund' })).not.toBeInTheDocument();
  });

  it('exposes only Complete for an approved refund', () => {
    renderRefund(makeRefund('approved'));

    expect(screen.getByRole('button', { name: 'Complete refund' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve refund' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject refund' })).not.toBeInTheDocument();
  });

  it('hides all actions for terminal (rejected/completed) refunds', () => {
    renderRefund(makeRefund('rejected'));
    expect(screen.getByText('No actions are available for this refund status.')).toBeInTheDocument();

    renderRefund(makeRefund('completed'));
    expect(screen.getAllByText('No actions are available for this refund status.')).toBeTruthy();
  });

  it('approves through the confirm dialog', async () => {
    approveMock.mockResolvedValue(makeRefund('approved') as never);
    renderRefund(makeRefund('pending'));

    fireEvent.click(screen.getByRole('button', { name: 'Approve refund' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve refund' });
    expect(within(dialog).getByText('Approve this refund?')).toBeInTheDocument();
    expect(within(dialog).getByText('PAY-00869')).toBeInTheDocument();
    expect(within(dialog).getByText('₹250.00')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve refund' }));
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('rfd1'));
  });

  it('rejects through the destructive dialog with a required reason', async () => {
    rejectMock.mockResolvedValue(makeRefund('rejected') as never);
    renderRefund(makeRefund('pending'));

    fireEvent.click(screen.getByRole('button', { name: 'Reject refund' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject refund' });

    // Reason required — confirm stays disabled.
    const confirm = within(dialog).getByRole('button', { name: 'Reject refund' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'No duplicate payment found.' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(rejectMock).toHaveBeenCalledWith('rfd1', { reason: 'No duplicate payment found.' }),
    );
  });

  it('completes through the confirm dialog', async () => {
    completeMock.mockResolvedValue(makeRefund('completed') as never);
    renderRefund(makeRefund('approved'));

    fireEvent.click(screen.getByRole('button', { name: 'Complete refund' }));
    const dialog = await screen.findByRole('dialog', { name: 'Complete refund' });
    expect(within(dialog).getByText('Complete this refund?')).toBeInTheDocument();
    expect(within(dialog).getByText(/will be created against PAY-00869/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Complete refund' }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledWith('rfd1'));
  });

  it('renders the empty state when no cached refund exists', () => {
    const client = createTestQueryClient();
    renderWithProviders(<RefundDetailsContainer refundId="rfd-missing" />, {
      route: '/billing/refunds/rfd-missing',
      queryClient: client,
    });

    expect(screen.getByText('Refund not available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to payments' })).toBeInTheDocument();
  });
});
