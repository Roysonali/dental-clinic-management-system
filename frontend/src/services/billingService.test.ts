import { describe, it, expect, vi, beforeEach } from 'vitest';
import { billingService } from './billingService';
import { api } from './api';
import type { InvoiceRead } from '../types/billing';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const invoice: InvoiceRead = {
  id: 'inv1',
  invoice_number: 'INV-01042',
  document_type: 'invoice',
  status: 'issued',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
  doctor: null,
  treatment_plan: null,
  appointment: null,
  creator: { id: 1, full_name: 'Admin' },
  updater: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  currency_code: 'USD',
  notes: null,
  cancellation_reason: null,
  void_reason: null,
  items: [],
  financials: {
    currency_code: 'USD',
    subtotal: '3000.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '3000.00',
    paid_amount: '0.00',
    outstanding_amount: '3000.00',
  },
  version: 1,
  doc_version: 1,
  created_at: '2026-07-23T08:00:00Z',
  updated_at: '2026-07-23T08:00:00Z',
  created_by: 1,
  updated_by: null,
};

describe('billingService invoice endpoints (Sprint 14A.2)', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  describe('listInvoices', () => {
    it('GETs /billing/invoices with the server-side params', async () => {
      const response = { items: [invoice], total: 1, page: 1, page_size: 20 };
      getMock.mockResolvedValue({ data: response });
      const params = {
        page: 2,
        page_size: 20,
        sort_by: 'created_at' as const,
        sort_order: 'desc' as const,
        status: 'issued' as const,
        query: 'INV',
        patient_id: 'p1',
        doctor_id: 'd1',
        date_from: '2026-07-01',
        date_to: '2026-07-31',
      };

      await expect(billingService.listInvoices(params)).resolves.toEqual(response);
      expect(getMock).toHaveBeenCalledWith('/billing/invoices', { params });
    });
  });

  describe('getInvoice', () => {
    it('GETs /billing/invoices/{id}', async () => {
      getMock.mockResolvedValue({ data: invoice });

      await expect(billingService.getInvoice('inv1')).resolves.toEqual(invoice);
      expect(getMock).toHaveBeenCalledWith('/billing/invoices/inv1');
    });
  });

  describe('createInvoice', () => {
    it('POSTs /billing/invoices with the create payload', async () => {
      postMock.mockResolvedValue({ data: invoice });
      const payload = {
        patient_id: 'p1',
        invoice_date: '2026-07-23',
        due_date: '2026-08-22',
        currency_code: 'USD',
        items: [],
      };

      await expect(billingService.createInvoice(payload)).resolves.toEqual(invoice);
      expect(postMock).toHaveBeenCalledWith('/billing/invoices', payload);
    });
  });

  describe('updateDraftInvoice', () => {
    it('PATCHes /billing/invoices/{id} with the draft-update payload', async () => {
      patchMock.mockResolvedValue({ data: invoice });
      const payload = { notes: 'Reminder', due_date: '2026-08-30' };

      await expect(billingService.updateDraftInvoice('inv1', payload)).resolves.toEqual(invoice);
      expect(patchMock).toHaveBeenCalledWith('/billing/invoices/inv1', payload);
    });
  });

  describe('issueInvoice', () => {
    it('POSTs /billing/invoices/{id}/issue with no body', async () => {
      postMock.mockResolvedValue({ data: invoice });

      await expect(billingService.issueInvoice('inv1')).resolves.toEqual(invoice);
      expect(postMock).toHaveBeenCalledWith('/billing/invoices/inv1/issue');
    });
  });

  describe('cancelInvoice', () => {
    it('POSTs /billing/invoices/{id}/cancel with the reason', async () => {
      postMock.mockResolvedValue({ data: invoice });
      const payload = { cancellation_reason: 'Duplicate' };

      await expect(billingService.cancelInvoice('inv1', payload)).resolves.toEqual(invoice);
      expect(postMock).toHaveBeenCalledWith('/billing/invoices/inv1/cancel', payload);
    });
  });

  describe('deleteInvoice', () => {
    it('DELETEs /billing/invoices/{id} (204)', async () => {
      deleteMock.mockResolvedValue({ data: undefined });

      await expect(billingService.deleteInvoice('inv1')).resolves.toBeUndefined();
      expect(deleteMock).toHaveBeenCalledWith('/billing/invoices/inv1');
    });
  });
});

describe('billingService payment endpoints (Sprint 14A.3)', () => {
  const payment = {
    id: 'pay1',
    payment_number: 'PAY-00001',
    document_type: 'payment',
    status: 'pending',
    patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
    creator: { id: 1, full_name: 'Admin' },
    updater: null,
    payment_method: 'card',
    total_amount: '1500.00',
    payment_date: '2026-07-23',
    currency_code: 'USD',
    reference_number: null,
    is_reversed: false,
    reversal_reason: null,
    notes: null,
    allocations: [],
    financials: {
      currency_code: 'USD',
      total_amount: '1500.00',
      allocated_amount: '0.00',
      refunded_amount: '0.00',
      unallocated_amount: '1500.00',
    },
    gateway_metadata: null,
    version: 1,
    doc_version: 1,
    created_at: '2026-07-23T09:22:00Z',
    updated_at: '2026-07-23T09:22:00Z',
    created_by: 1,
    updated_by: null,
  };

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it('listPayments GETs /billing/payments with the server-side params', async () => {
    const response = { items: [payment], total: 1, page: 1, page_size: 20 };
    getMock.mockResolvedValue({ data: response });
    const params = {
      page: 1,
      page_size: 20,
      sort_by: 'created_at' as const,
      sort_order: 'desc' as const,
      patient_id: 'p1',
      payment_method: 'card' as const,
      status: 'completed' as const,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    };

    await expect(billingService.listPayments(params)).resolves.toEqual(response);
    expect(getMock).toHaveBeenCalledWith('/billing/payments', { params });
  });

  it('getPayment GETs /billing/payments/{id}', async () => {
    getMock.mockResolvedValue({ data: payment });

    await expect(billingService.getPayment('pay1')).resolves.toEqual(payment);
    expect(getMock).toHaveBeenCalledWith('/billing/payments/pay1');
  });

  it('createPayment POSTs /billing/payments with the create payload', async () => {
    postMock.mockResolvedValue({ data: payment });
    const payload = {
      patient_id: 'p1',
      payment_method: 'card' as const,
      total_amount: '1500.00',
      payment_date: '2026-07-23',
    };

    await expect(billingService.createPayment(payload)).resolves.toEqual(payment);
    expect(postMock).toHaveBeenCalledWith('/billing/payments', payload);
  });

  it('updatePayment PATCHes /billing/payments/{id} with metadata', async () => {
    patchMock.mockResolvedValue({ data: payment });
    const payload = { notes: 'Reminder', reference_number: 'REF-2' };

    await expect(billingService.updatePayment('pay1', payload)).resolves.toEqual(payment);
    expect(patchMock).toHaveBeenCalledWith('/billing/payments/pay1', payload);
  });

  it('completePayment POSTs /billing/payments/{id}/complete', async () => {
    postMock.mockResolvedValue({ data: payment });

    await expect(billingService.completePayment('pay1')).resolves.toEqual(payment);
    expect(postMock).toHaveBeenCalledWith('/billing/payments/pay1/complete');
  });

  it('failPayment POSTs /billing/payments/{id}/fail with the reason', async () => {
    postMock.mockResolvedValue({ data: payment });
    const payload = { reason: 'Gateway declined' };

    await expect(billingService.failPayment('pay1', payload)).resolves.toEqual(payment);
    expect(postMock).toHaveBeenCalledWith('/billing/payments/pay1/fail', payload);
  });

  it('voidPayment POSTs /billing/payments/{id}/void with the reason', async () => {
    postMock.mockResolvedValue({ data: payment });
    const payload = { reason: 'Entered by mistake' };

    await expect(billingService.voidPayment('pay1', payload)).resolves.toEqual(payment);
    expect(postMock).toHaveBeenCalledWith('/billing/payments/pay1/void', payload);
  });

  it('allocatePayment POSTs /billing/payments/{id}/allocate', async () => {
    postMock.mockResolvedValue({ data: { id: 'alloc1' } });
    const payload = { invoice_id: 'inv1', amount: '300.00' };

    await expect(billingService.allocatePayment('pay1', payload)).resolves.toEqual({ id: 'alloc1' });
    expect(postMock).toHaveBeenCalledWith('/billing/payments/pay1/allocate', payload);
  });

  it('deallocatePayment POSTs /billing/payments/{id}/deallocate (204)', async () => {
    postMock.mockResolvedValue({ data: undefined });
    const payload = { invoice_id: 'inv1' };

    await expect(billingService.deallocatePayment('pay1', payload)).resolves.toBeUndefined();
    expect(postMock).toHaveBeenCalledWith('/billing/payments/pay1/deallocate', payload);
  });

  it('getPaymentAllocations GETs /billing/payments/{id}/allocations', async () => {
    const allocations = [
      {
        id: 'alloc1',
        invoice: {
          id: 'inv1',
          invoice_number: 'INV-01039',
          patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
          invoice_date: '2026-07-20',
          currency_code: 'INR',
          grand_total: '3120.75',
        },
        allocated_amount: '300.00',
        is_refund: false,
        created_at: '2026-07-23T14:16:00Z',
      },
    ];
    getMock.mockResolvedValue({ data: allocations });

    await expect(billingService.getPaymentAllocations('pay1')).resolves.toEqual(allocations);
    expect(getMock).toHaveBeenCalledWith('/billing/payments/pay1/allocations');
  });

  it('generateReceipt POSTs /billing/receipts with the payment id', async () => {
    const receipt = {
      id: 'rct1',
      receipt_number: 'RCT-00001',
      status: 'generated',
      amount: '1500.00',
      currency_code: 'USD',
      receipt_date: '2026-07-23',
      payment: { id: 'pay1' },
      created_at: '2026-07-23T14:20:00Z',
    };
    postMock.mockResolvedValue({ data: receipt });

    await expect(billingService.generateReceipt({ payment_id: 'pay1' })).resolves.toEqual(receipt);
    expect(postMock).toHaveBeenCalledWith('/billing/receipts', { payment_id: 'pay1' });
  });
});
