import { api } from './api';
import type {
  BillingDashboardResponse,
  CancelInvoicePayload,
  InvoiceCreatePayload,
  InvoiceDraftUpdatePayload,
  InvoiceListParams,
  InvoiceListResponse,
  InvoiceRead,
  PaymentAllocatePayload,
  PaymentAllocationSummary,
  PaymentCreatePayload,
  PaymentDeallocatePayload,
  PaymentListParams,
  PaymentListResponse,
  PaymentMetadataUpdatePayload,
  PaymentRead,
  PaymentStatusChangePayload,
  ReceiptGeneratePayload,
  ReceiptRead,
} from '../types/billing';

/**
 * Billing API service.
 *
 * Endpoints mirror backend `app/modules/billing/routers/`:
 * - dashboard.py → GET /billing/dashboard
 * - invoice.py   → GET /billing/invoices, GET /{id}, POST '', PATCH /{id},
 *                  POST /{id}/issue, POST /{id}/cancel, DELETE /{id}
 * - payment.py   → GET /billing/payments, GET /{id}, POST '', PATCH /{id},
 *                  DELETE /{id}, POST /{id}/complete, /fail, /void, /allocate,
 *                  /deallocate, GET /{id}/allocations
 * - receipt.py   → POST /billing/receipts (generate for a completed payment)
 *
 * Phase 1 (Billing Dashboard) consumed only the dashboard endpoint. Phase 2
 * (Sprint 14A.2 — Invoices) added the invoice endpoints. Phase 3 (Sprint
 * 14A.3 — Payments) adds the payment + receipt-generation endpoints;
 * refunds/credit-notes remain intentionally NOT exposed until their phases
 * land.
 *
 * The backend returns plain objects (no `{success, data}` envelope), so the
 * methods return `data` as-is. Errors bubble as Axios errors for
 * `parseApiError`.
 */
export const billingService = {
  /** GET /billing/dashboard — `patient_id` optional (system-wide when omitted). */
  async getDashboard(patientId?: string): Promise<BillingDashboardResponse> {
    const { data } = await api.get<BillingDashboardResponse>('/billing/dashboard', {
      params: patientId ? { patient_id: patientId } : undefined,
    });
    return data;
  },

  /* ── Sprint 14A.2 — Invoice endpoints (backend routers/invoice.py) ── */

  /** GET /billing/invoices — paginated, filterable, sortable list. */
  async listInvoices(params: InvoiceListParams): Promise<InvoiceListResponse> {
    const { data } = await api.get<InvoiceListResponse>('/billing/invoices', { params });
    return data;
  },

  /** GET /billing/invoices/{id} — full invoice aggregate. */
  async getInvoice(id: string): Promise<InvoiceRead> {
    const { data } = await api.get<InvoiceRead>(`/billing/invoices/${id}`);
    return data;
  },

  /** POST /billing/invoices — create a Draft invoice (201). */
  async createInvoice(payload: InvoiceCreatePayload): Promise<InvoiceRead> {
    const { data } = await api.post<InvoiceRead>('/billing/invoices', payload);
    return data;
  },

  /** PATCH /billing/invoices/{id} — update Draft metadata (notes/due_date). */
  async updateDraftInvoice(id: string, payload: InvoiceDraftUpdatePayload): Promise<InvoiceRead> {
    const { data } = await api.patch<InvoiceRead>(`/billing/invoices/${id}`, payload);
    return data;
  },

  /** POST /billing/invoices/{id}/issue — issue a Draft (assigns permanent number). */
  async issueInvoice(id: string): Promise<InvoiceRead> {
    const { data } = await api.post<InvoiceRead>(`/billing/invoices/${id}/issue`);
    return data;
  },

  /** POST /billing/invoices/{id}/cancel — cancel from any non-terminal status. */
  async cancelInvoice(id: string, payload: CancelInvoicePayload): Promise<InvoiceRead> {
    const { data } = await api.post<InvoiceRead>(`/billing/invoices/${id}/cancel`, payload);
    return data;
  },

  /** DELETE /billing/invoices/{id} — permanently delete a Draft (204). */
  async deleteInvoice(id: string): Promise<void> {
    await api.delete(`/billing/invoices/${id}`);
  },

  /* ── Sprint 14A.3 — Payment endpoints (backend routers/payment.py) ── */

  /** GET /billing/payments — paginated, filterable, sortable list. */
  async listPayments(params: PaymentListParams): Promise<PaymentListResponse> {
    const { data } = await api.get<PaymentListResponse>('/billing/payments', { params });
    return data;
  },

  /** GET /billing/payments/{id} — full payment aggregate. */
  async getPayment(id: string): Promise<PaymentRead> {
    const { data } = await api.get<PaymentRead>(`/billing/payments/${id}`);
    return data;
  },

  /** POST /billing/payments — create a payment in Pending status (201). */
  async createPayment(payload: PaymentCreatePayload): Promise<PaymentRead> {
    const { data } = await api.post<PaymentRead>('/billing/payments', payload);
    return data;
  },

  /** PATCH /billing/payments/{id} — update a Pending payment (reference/notes). */
  async updatePayment(id: string, payload: PaymentMetadataUpdatePayload): Promise<PaymentRead> {
    const { data } = await api.patch<PaymentRead>(`/billing/payments/${id}`, payload);
    return data;
  },

  /**
   * GET /billing/payments/{id}/allocations — allocation summaries for a
   * payment. Used by the Allocate dialog to exclude invoices that already
   * have an allocation from this payment (the backend rejects duplicate
   * allocations with a 409).
   */
  async getPaymentAllocations(id: string): Promise<PaymentAllocationSummary[]> {
    const { data } = await api.get<PaymentAllocationSummary[]>(
      `/billing/payments/${id}/allocations`,
    );
    return data;
  },

  /** DELETE /billing/payments/{id} — permanently delete a Pending payment (204). */
  async deletePayment(id: string): Promise<void> {
    await api.delete(`/billing/payments/${id}`);
  },

  /** POST /billing/payments/{id}/complete — transition Pending → Completed. */
  async completePayment(id: string): Promise<PaymentRead> {
    const { data } = await api.post<PaymentRead>(`/billing/payments/${id}/complete`);
    return data;
  },

  /** POST /billing/payments/{id}/fail — mark a payment as failed. */
  async failPayment(id: string, payload: PaymentStatusChangePayload): Promise<PaymentRead> {
    const { data } = await api.post<PaymentRead>(`/billing/payments/${id}/fail`, payload);
    return data;
  },

  /** POST /billing/payments/{id}/void — void a payment. */
  async voidPayment(id: string, payload: PaymentStatusChangePayload): Promise<PaymentRead> {
    const { data } = await api.post<PaymentRead>(`/billing/payments/${id}/void`, payload);
    return data;
  },

  /** POST /billing/payments/{id}/allocate — allocate to a payable invoice (201). */
  async allocatePayment(id: string, payload: PaymentAllocatePayload): Promise<unknown> {
    const { data } = await api.post(`/billing/payments/${id}/allocate`, payload);
    return data;
  },

  /** POST /billing/payments/{id}/deallocate — remove an allocation (204). */
  async deallocatePayment(id: string, payload: PaymentDeallocatePayload): Promise<void> {
    await api.post(`/billing/payments/${id}/deallocate`, payload);
  },

  /* ── Sprint 14A.3 — Receipt generation (backend routers/receipt.py) ── */

  /** POST /billing/receipts — generate a receipt for a completed payment (201). */
  async generateReceipt(payload: ReceiptGeneratePayload): Promise<ReceiptRead> {
    const { data } = await api.post<ReceiptRead>('/billing/receipts', payload);
    return data;
  },
};
