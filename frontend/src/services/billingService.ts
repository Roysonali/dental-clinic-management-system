import { api } from './api';
import type { BillingDashboardResponse } from '../types/billing';

/**
 * Billing API service.
 *
 * Endpoints mirror backend `app/modules/billing/routers/dashboard.py`:
 * - GET /billing/dashboard → full dashboard (system-wide totals + recent
 *   invoices/payments + optional patient-level summary via `patient_id`).
 *
 * Only the dashboard endpoint is consumed by Phase 1 (Billing Dashboard).
 * The invoice/payment/receipt/refund/credit-note endpoints are intentionally
 * NOT exposed until their respective UI phases land — the dashboard's quick
 * actions and "View all" links are disabled rather than wired to fake routes.
 *
 * The backend returns a plain object (no `{success, data}` envelope), so the
 * method returns `data` as-is. Errors bubble as Axios errors for
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
};
