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
