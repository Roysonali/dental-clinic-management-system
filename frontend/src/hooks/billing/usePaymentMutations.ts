import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type {
  PaymentAllocatePayload,
  PaymentCreatePayload,
  PaymentDeallocatePayload,
  PaymentMetadataUpdatePayload,
  PaymentRead,
  PaymentStatusChangePayload,
  ReceiptGeneratePayload,
  ReceiptRead,
} from '../../types/billing';

/**
 * Payment lifecycle + allocation mutations (Sprint 14A.3).
 *
 * Every mutation changes payment/invoice/dashboard data, so the `'billing'`
 * ROOT is invalidated on success (the shared invalidation contract). The
 * payment detail key is also explicitly invalidated so an open detail page
 * refreshes immediately; allocation mutations additionally invalidate the
 * allocation key (the Allocate dialog reads it to disable already-allocated
 * invoices).
 *
 * Generate-receipt is a mutation with a meaningful payload: the backend has
 * no GET /receipts?payment_id lookup, so the returned `ReceiptRead` is
 * written into the query cache under `receiptForPayment(paymentId)` where the
 * Payment detail's Receipt card reads it back (no fake local state).
 */

/** POST /billing/payments — create a payment in Pending status. */
export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation<PaymentRead, Error, PaymentCreatePayload>({
    mutationFn: (payload) => billingService.createPayment(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
    },
  });
}

/** PATCH /billing/payments/{id} — update a Pending payment (reference/notes). */
export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation<PaymentRead, Error, { id: string; payload: PaymentMetadataUpdatePayload }>({
    mutationFn: ({ id, payload }) => billingService.updatePayment(id, payload),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(payment.id) });
    },
  });
}

/** POST /billing/payments/{id}/complete — Pending → Completed. */
export function useCompletePayment() {
  const queryClient = useQueryClient();
  return useMutation<PaymentRead, Error, string>({
    mutationFn: (id) => billingService.completePayment(id),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(payment.id) });
    },
  });
}

/** POST /billing/payments/{id}/fail — mark a payment as failed. */
export function useFailPayment() {
  const queryClient = useQueryClient();
  return useMutation<PaymentRead, Error, { id: string; payload: PaymentStatusChangePayload }>({
    mutationFn: ({ id, payload }) => billingService.failPayment(id, payload),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(payment.id) });
    },
  });
}

/** POST /billing/payments/{id}/void — void a payment. */
export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation<PaymentRead, Error, { id: string; payload: PaymentStatusChangePayload }>({
    mutationFn: ({ id, payload }) => billingService.voidPayment(id, payload),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(payment.id) });
    },
  });
}

/** POST /billing/payments/{id}/allocate — allocate to a payable invoice. */
export function useAllocatePayment() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string; payload: PaymentAllocatePayload }>({
    mutationFn: ({ id, payload }) => billingService.allocatePayment(id, payload),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      // The detail page renders allocations from the payment aggregate, and
      // the Allocate dialog reads GET /{id}/allocations to disable invoices
      // that already have an allocation — refresh both.
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(id) });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentAllocations(id) });
    },
  });
}

/** POST /billing/payments/{id}/deallocate — remove an allocation. */
export function useDeallocatePayment() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; payload: PaymentDeallocatePayload }>({
    mutationFn: ({ id, payload }) => billingService.deallocatePayment(id, payload),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentDetail(id) });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentAllocations(id) });
    },
  });
}

/** DELETE /billing/payments/{id} — permanently delete a Pending payment (admin-only). */
export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => billingService.deletePayment(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.removeQueries({ queryKey: billingQueryKeys.paymentDetail(id) });
    },
  });
}

/** POST /billing/receipts — generate a receipt for a completed payment. */
export function useGenerateReceipt() {
  const queryClient = useQueryClient();
  return useMutation<ReceiptRead, Error, ReceiptGeneratePayload>({
    mutationFn: (payload) => billingService.generateReceipt(payload),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      // The backend has no GET-by-payment lookup — cache the generated
      // receipt so the Payment detail's Receipt card can render it.
      void queryClient.setQueryData(
        billingQueryKeys.receiptForPayment(receipt.payment.id),
        receipt,
      );
    },
  });
}
