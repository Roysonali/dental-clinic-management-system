import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type {
  CancelInvoicePayload,
  InvoiceCreatePayload,
  InvoiceDraftUpdatePayload,
  InvoiceRead,
} from '../../types/billing';

/**
 * Invoice lifecycle mutations (Sprint 14A.2).
 *
 * Every mutation changes invoice data that the list, the detail view and the
 * Billing Dashboard all derive from — so the `'billing'` ROOT is invalidated
 * on success (the shared invalidation contract established by the dashboard
 * phase; payments/refunds/credit-notes will reuse the same root later).
 * The detail key is also explicitly invalidated so an open detail page
 * refreshes immediately rather than waiting for staleness.
 */

/** POST /billing/invoices — create a Draft invoice. */
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation<InvoiceRead, Error, InvoiceCreatePayload>({
    mutationFn: (payload) => billingService.createInvoice(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    },
  });
}

/** PATCH /billing/invoices/{id} — update Draft metadata (notes/due_date). */
export function useUpdateDraftInvoice() {
  const queryClient = useQueryClient();
  return useMutation<InvoiceRead, Error, { id: string; payload: InvoiceDraftUpdatePayload }>({
    mutationFn: ({ id, payload }) => billingService.updateDraftInvoice(id, payload),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoiceDetail(invoice.id) });
    },
  });
}

/** POST /billing/invoices/{id}/issue — issue a Draft (permanent number). */
export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation<InvoiceRead, Error, string>({
    mutationFn: (id) => billingService.issueInvoice(id),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoiceDetail(invoice.id) });
    },
  });
}

/** POST /billing/invoices/{id}/cancel — cancel from any non-terminal status. */
export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation<InvoiceRead, Error, { id: string; payload: CancelInvoicePayload }>({
    mutationFn: ({ id, payload }) => billingService.cancelInvoice(id, payload),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoiceDetail(invoice.id) });
    },
  });
}

/** DELETE /billing/invoices/{id} — permanently delete a Draft (admin-only). */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => billingService.deleteInvoice(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.removeQueries({ queryKey: billingQueryKeys.invoiceDetail(id) });
    },
  });
}
