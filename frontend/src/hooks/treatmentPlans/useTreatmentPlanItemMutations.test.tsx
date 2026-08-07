import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { useAddItem, useReorderItems } from './useTreatmentPlanItemMutations';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

vi.mock('../../services/treatmentPlanService', () => ({
  treatmentPlanService: {
    addItem: vi.fn(),
    reorderItems: vi.fn(),
  },
}));

const addMock = vi.mocked(treatmentPlanService.addItem);
const reorderMock = vi.mocked(treatmentPlanService.reorderItems);

const plan: TreatmentPlanResponse = {
  id: 'plan-1',
  plan_code: 'TXN-000001',
  patient_id: 'p1',
  doctor_id: 'd1',
  status: 'draft',
  current_version: 1,
  is_active: true,
  created_by: 1,
  created_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-01T08:00:00Z',
  clinical_notes: null,
  observations: null,
  dentist_recommendations: null,
  valid_from: null,
  valid_to: null,
  items: [],
  approval: null,
  versions: [],
  updated_by: null,
};

describe('treatment plan item mutation hooks', () => {
  beforeEach(() => {
    addMock.mockReset();
    reorderMock.mockReset();
  });

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it('useAddItem calls the service with plan id + payload', async () => {
    addMock.mockResolvedValue(plan);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAddItem(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate({ planId: 'plan-1', payload: { procedure_id: 5, sequence_number: 1 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addMock).toHaveBeenCalledWith('plan-1', { procedure_id: 5, sequence_number: 1 });
  });

  it('useReorderItems sends the ordered item_ids', async () => {
    reorderMock.mockResolvedValue(plan);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useReorderItems(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate({ planId: 'plan-1', itemIds: ['b', 'a'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reorderMock).toHaveBeenCalledWith('plan-1', ['b', 'a']);
  });

  it('invalidates the treatment-plans root on success', async () => {
    addMock.mockResolvedValue(plan);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['treatment-plans', 'list', {}], { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddItem(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate({ planId: 'plan-1', payload: { procedure_id: 5, sequence_number: 1 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans'] });
  });
});
