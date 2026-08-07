import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type {
  AddItemRequest,
  ItemUpdateRequest,
  TreatmentPlanResponse,
} from '../../types/treatmentPlan';

/**
 * Item mutation hooks. All invalidate the `'treatment-plans'` root — the
 * item mutations change the item rows (and therefore the detail view's
 * DERIVED item count + estimated total, F-01) plus the list rows' computed
 * `item_count` / `total_estimated_cost` (architecture report §9
 * invalidation matrix).
 */

/** POST /treatment-plans/{id}/items (201) — editable statuses only. */
export function useAddItem() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, { planId: string; payload: AddItemRequest }>({
    mutationFn: ({ planId, payload }) => treatmentPlanService.addItem(planId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** PATCH /treatment-plans/{id}/items/{itemId} — partial update. */
export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation<
    TreatmentPlanResponse,
    Error,
    { planId: string; itemId: string; payload: ItemUpdateRequest }
  >({
    mutationFn: ({ planId, itemId, payload }) =>
      treatmentPlanService.updateItem(planId, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** DELETE /treatment-plans/{id}/items/{itemId} — editable statuses only. */
export function useRemoveItem() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, { planId: string; itemId: string }>({
    mutationFn: ({ planId, itemId }) => treatmentPlanService.removeItem(planId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** PUT /treatment-plans/{id}/items/reorder — all item ids exactly once. */
export function useReorderItems() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, { planId: string; itemIds: string[] }>({
    mutationFn: ({ planId, itemIds }) => treatmentPlanService.reorderItems(planId, itemIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}
