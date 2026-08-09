import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { ReceiptDetailsContainer } from './ReceiptDetailsContainer';
import { billingService } from '../../../../services/billingService';
import type { ReceiptRead, ReceiptStatus } from '../../../../types/billing';

// Regeneration is role-gated via PermissionGate (backend
// `_RECEIPT_WORKFLOW_ROLES`) — resolve the role probe as a proven admin so
// the regenerate action renders in the workflow tests.
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
    getReceipt: vi.fn(),
    getPayment: vi.fn(),
    regenerateReceipt: vi.fn(),
  },
}));

const getReceiptMock = vi.mocked(billingService.getReceipt);
const getPaymentMock = vi.mocked(billingService.getPayment);
const regenerateMock = vi.mocked(billingService.regenerateReceipt);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

function httpError(status: number, message: string): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { success: false, message },
  } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response);
}

function makeReceipt(status: ReceiptStatus = 'generated'): ReceiptRead {
  return {
    id: 'rct1',
    receipt_number: 'RCT-00612',
    document_type: 'receipt',
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
    creator: { id: 1, full_name: 'Dana Whitfield' },
    updater: null,
    receipt_date: '2026-07-09',
    amount: '1500.00',
    currency_code: 'INR',
    notes: null,
    cancellation_reason: null,
    receipt_invoices: [],
    financials: {
      currency_code: 'INR',
      total_amount: '1500.00',
      allocated_amount: '1500.00',
      unallocated_amount: '0.00',
    },
    print_metadata: null,
    document_metadata: {
      document_type: 'receipt',
      sequence_number: null,
      version: 1,
      doc_version: 1,
      issued_at: '2026-07-09T14:20:00Z',
      generated_at: '2026-07-09T14:20:00Z',
    },
    audit_trail: [],
    created_at: '2026-07-09T14:20:00Z',
    created_by: 1,
    updated_at: '2026-07-09T14:20:00Z',
    updated_by: null,
  };
}

function renderReceipt(receipt: ReceiptRead, queryClient?: QueryClient) {
  getReceiptMock.mockResolvedValue(receipt);
  getPaymentMock.mockResolvedValue({
    id: receipt.payment.id,
    status: 'completed',
  } as never);
  return renderWithProviders(<ReceiptDetailsContainer receiptId={receipt.id} />, {
    route: '/billing/receipts/rct1',
    queryClient,
  });
}

describe('ReceiptDetailsContainer', () => {
  beforeEach(() => {
    getReceiptMock.mockReset();
    getPaymentMock.mockReset();
    regenerateMock.mockReset();
  });

  it('renders the receipt header with number, status badge and generated state', async () => {
    renderReceipt(makeReceipt());

    // The number appears in the page title AND the document metadata card.
    expect(await screen.findAllByText('RCT-00612').then((els) => els.length)).toBeGreaterThan(0);
    expect(screen.getByText('Generated')).toBeInTheDocument();
    expect(screen.getByText('← Payment PAY-00869')).toBeInTheDocument();
  });

  it('renders the top information cards with real receipt data', async () => {
    renderReceipt(makeReceipt());

    await screen.findAllByText('RCT-00612');
    expect(screen.getByText('Amara Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('PT-00504')).toBeInTheDocument();
    // The date appears on both the overview card and the linked payment card.
    expect(screen.getAllByText('09 Jul 2026').length).toBeGreaterThan(0);
    expect(screen.getByText(/Issued by Dana Whitfield/)).toBeInTheDocument();
    // "No" (duplicate copy) appears on the overview card and the print metadata card.
    expect(screen.getAllByText('No').length).toBeGreaterThan(0);
    expect(screen.getByText('Document version 1')).toBeInTheDocument();
  });

  it('renders the financial summary with the emphasized receipt amount', async () => {
    renderReceipt(makeReceipt());

    await screen.findAllByText('RCT-00612');
    expect(screen.getByText('Financial Summary')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThan(0);
  });

  it('renders the linked payment card with the real payment status badge', async () => {
    renderReceipt(makeReceipt());

    await screen.findAllByText('RCT-00612');
    expect(screen.getByText('Linked Payment')).toBeInTheDocument();
    expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
    // Status badge comes from the linked payment aggregate (Completed).
    expect(await screen.findByText('Completed')).toBeInTheDocument();
  });

  it('renders the audit trail (derived from real creator/created_at) and metadata cards', async () => {
    renderReceipt(makeReceipt());

    await screen.findAllByText('RCT-00612');
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Receipt generated')).toBeInTheDocument();
    expect(screen.getByText(/Dana Whitfield ·/)).toBeInTheDocument();

    expect(screen.getByText('Print Metadata')).toBeInTheDocument();
    // Backend mapper returns null print metadata — placeholders render.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    expect(screen.getByText('Document Metadata')).toBeInTheDocument();
    expect(screen.getAllByText('RCT-00612').length).toBeGreaterThan(0);
  });

  it('regenerates through the confirm dialog (primary, non-destructive)', async () => {
    regenerateMock.mockResolvedValue(makeReceipt() as never);
    renderReceipt(makeReceipt());

    await screen.findAllByText('RCT-00612');
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate receipt' }));

    const dialog = await screen.findByRole('dialog', { name: 'Regenerate receipt' });
    expect(within(dialog).getByText('Regenerate this receipt?')).toBeInTheDocument();
    expect(within(dialog).getByText('RCT-00612')).toBeInTheDocument();
    expect(within(dialog).getByText('₹1,500.00')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(regenerateMock).toHaveBeenCalledWith('rct1'));
  });

  it('hides regeneration for a cancelled receipt (terminal state)', async () => {
    renderReceipt(makeReceipt('cancelled'));

    await screen.findAllByText('RCT-00612');
    expect(screen.queryByRole('button', { name: 'Regenerate receipt' })).not.toBeInTheDocument();
    expect(screen.getByText('No actions are available for this receipt status.')).toBeInTheDocument();
  });

  it('renders the permission-denied state on 403 and never retries', async () => {
    getReceiptMock.mockRejectedValue(httpError(403, 'Insufficient permissions'));
    renderWithProviders(<ReceiptDetailsContainer receiptId="rct1" />, {
      route: '/billing/receipts/rct1',
    });

    expect(await screen.findByText("You don't have permission")).toBeInTheDocument();
    expect(getReceiptMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('renders the error state with a working retry on a 500', async () => {
    getReceiptMock.mockRejectedValue(httpError(500, 'boom'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity, retryDelay: 0 },
      },
    });
    renderWithProviders(<ReceiptDetailsContainer receiptId="rct1" />, {
      route: '/billing/receipts/rct1',
      queryClient,
    });

    expect(await screen.findByText("Couldn't load this receipt")).toBeInTheDocument();

    getReceiptMock.mockClear();
    getReceiptMock.mockResolvedValue(makeReceipt());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect((await screen.findAllByText('RCT-00612')).length).toBeGreaterThan(0);
  });
});
