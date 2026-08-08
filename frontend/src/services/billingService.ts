import { api } from './api';
import type {
  BillingDashboardResponse,
  CancelInvoicePayload,
  InvoiceCreatePayload,
  InvoiceDraftUpdatePayload,
  InvoiceListParams,
  InvoiceListResponse,
  InvoiceRead,
} from '../types/billing';

/**
 * Billing API service.
 *
 * Endpoints mirror backend `app/modules/billing/routers/`:
 * - dashboard.py → GET /billing/dashboard
 * - invoice.py   → GET /billing/invoices, GET /{id}, POST '', PATCH /{id},
 *                  POST /{id}/issue, POST /{id}/cancel, DELETE /{id}
 *
 * Phase 1 (Billing Dashboard) consumed only the dashboard endpoint. Phase 2
 * (Sprint 14A.2 — Invoices) adds the invoice endpoints; payments/receipts/
 * refunds/credit-notes are intentionally NOT exposed until their phases land.
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
};
