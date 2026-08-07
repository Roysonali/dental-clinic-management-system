import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { useSubmitForReview, useCancelPlan } from './useTreatmentPlanTransitionMutations';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

vi.mock('../../services/treatmentPlanService', () => ({
  treatmentPlanService: {
    submitForReview: vi.fn(),
    cancelPlan: vi.fn(),
  },
}));

const submitMock = vi.mocked(treatmentPlanService.submitForReview);
const cancelMock = vi.mocked(treatmentPlanService.cancelPlan);

const plan: TreatmentPlanResponse = {
  id: 'plan-1',
  plan_code: 'TXN-000001',
  patient_id: 'p1',
  doctor_id: 'd1',
  status: 'under_review',
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

describe('treatment plan transition mutation hooks', () => {
  beforeEach(() => {
    submitMock.mockReset();
    cancelMock.mockReset();
  });

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it('useSubmitForReview calls the service with the plan id', async () => {
    submitMock.mockResolvedValue({ ...plan, status: 'under_review' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSubmitForReview(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate('plan-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitMock).toHaveBeenCalledWith('plan-1');
  });

  it('useCancelPlan calls the service with the plan id', async () => {
    cancelMock.mockResolvedValue({ ...plan, status: 'cancelled' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCancelPlan(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate('plan-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelMock).toHaveBeenCalledWith('plan-1');
  });

  it('invalidates the treatment-plans root on success (invalidation contract §9)', async () => {
    submitMock.mockResolvedValue({ ...plan, status: 'under_review' });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['treatment-plans', 'list', {}], { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitForReview(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate('plan-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans'] });
  });

  it('does not auto-retry failed mutations (retry: 0)', async () => {
    submitMock.mockRejectedValue(new Error('Request failed with status code 409'));
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSubmitForReview(), { wrapper: makeWrapper(queryClient) });

    result.current.mutate('plan-1');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(submitMock).toHaveBeenCalledTimes(1);
  });
});
