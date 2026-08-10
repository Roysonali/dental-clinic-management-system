import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type {
  RefundCreatePayload,
  RefundRead,
  RefundWorkflowPayload,
} from '../../types/billing';

/**
 * Refund lifecycle mutations (Sprint 14A.5).
 *
 * Every mutation changes payment/refund/dashboard financial data, so the
 * `'billing'` ROOT is invalidated on success (the shared invalidation
 * contract). The refund detail key is also set from each mutation response
 * because the backend exposes no GET /billing/refunds/{id} — the Refund
 * timeline page renders from this cache (same contract as credit notes).
 */

/** POST /billing/refunds — create a refund request in Pending status. */
export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation<RefundRead, Error, RefundCreatePayload>({
    mutationFn: (payload) => billingService.createRefund(payload),
    onSuccess: (refund) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(billingQueryKeys.refundDetail(refund.id), refund);
    },
  });
}

/** POST /billing/refunds/{id}/approve — approve a Pending refund. */
export function useApproveRefund() {
  const queryClient = useQueryClient();
  return useMutation<RefundRead, Error, string>({
    mutationFn: (id) => billingService.approveRefund(id),
    onSuccess: (refund) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(billingQueryKeys.refundDetail(refund.id), refund);
    },
  });
}

/** POST /billing/refunds/{id}/reject — reject a Pending refund (reason required). */
export function useRejectRefund() {
  const queryClient = useQueryClient();
  return useMutation<RefundRead, Error, { id: string; payload: RefundWorkflowPayload }>({
    mutationFn: ({ id, payload }) => billingService.rejectRefund(id, payload),
    onSuccess: (refund) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(billingQueryKeys.refundDetail(refund.id), refund);
    },
  });
}

/** POST /billing/refunds/{id}/complete — complete an Approved refund. */
export function useCompleteRefund() {
  const queryClient = useQueryClient();
  return useMutation<RefundRead, Error, string>({
    mutationFn: (id) => billingService.completeRefund(id),
    onSuccess: (refund) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(billingQueryKeys.refundDetail(refund.id), refund);
    },
  });
}
