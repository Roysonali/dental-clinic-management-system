import { describe, it, expect, vi, beforeEach } from 'vitest';
import { treatmentPlanService } from './treatmentPlanService';
import { api } from './api';
import { parseSnapshotMoney } from '../utils/treatmentPlanFormatting';
import type {
  AddItemRequest,
  CreatePlanRequest,
  ItemUpdateRequest,
  TreatmentPlanListItem,
} from '../types/treatmentPlan';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const putMock = vi.mocked(api.put);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const listItem: TreatmentPlanListItem = {
  id: 'plan-1',
  plan_code: 'TXN-000001',
  patient_id: 'patient-1',
  doctor_id: 'doctor-1',
  status: 'draft',
  current_version: 1,
  is_active: true,
  item_count: 0,
  total_estimated_cost: 0,
  created_by: 1,
  created_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-01T08:00:00Z',
};

const listResponse = {
  items: [listItem],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe('treatmentPlanService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  describe('listPlans', () => {
    it('GETs /treatment-plans with params and returns the paginated data', async () => {
      getMock.mockResolvedValue({ data: listResponse });
      const params = { page: 2, page_size: 20, status: 'draft' as const };

      await expect(treatmentPlanService.listPlans(params)).resolves.toEqual(listResponse);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans', { params });
    });

    it('passes search / is_active / date / sort query params verbatim', async () => {
      getMock.mockResolvedValue({ data: listResponse });
      const params = {
        search: 'TXN',
        is_active: true,
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        sort_by: 'plan_code' as const,
        sort_order: 'asc' as const,
        page: 1,
        page_size: 20,
      };

      await expect(treatmentPlanService.listPlans(params)).resolves.toEqual(listResponse);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans', { params });
    });

    it('passes is_active=false when filtering for inactive plans', async () => {
      getMock.mockResolvedValue({ data: listResponse });
      const params = { page: 1, page_size: 20, is_active: false };

      await treatmentPlanService.listPlans(params);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans', { params });
      expect((getMock.mock.calls[0][1] as { params: typeof params }).params.is_active).toBe(false);
    });
  });

  describe('createPlan', () => {
    it('POSTs the payload to /treatment-plans', async () => {
      postMock.mockResolvedValue({ data: listItem });
      const payload: CreatePlanRequest = {
        patient_id: 'patient-1',
        doctor_id: 'doctor-1',
        clinical_notes: 'Notes',
      };

      await expect(treatmentPlanService.createPlan(payload)).resolves.toEqual(listItem);
      expect(postMock).toHaveBeenCalledWith('/treatment-plans', payload);
    });
  });

  describe('searchPlans', () => {
    it('GETs /treatment-plans/search with term + limit', async () => {
      getMock.mockResolvedValue({ data: [listItem] });

      await expect(treatmentPlanService.searchPlans('TXN', 10)).resolves.toEqual([listItem]);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/search', { params: { term: 'TXN', limit: 10 } });
    });
  });

  describe('pending queues', () => {
    it('GETs /treatment-plans/pending-review with page params', async () => {
      getMock.mockResolvedValue({ data: listResponse });

      await expect(treatmentPlanService.listPendingReview(2, 50)).resolves.toEqual(listResponse);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/pending-review', { params: { page: 2, page_size: 50 } });
    });

    it('GETs /treatment-plans/pending-approval with page params', async () => {
      getMock.mockResolvedValue({ data: listResponse });

      await expect(treatmentPlanService.listPendingApproval(1, 20)).resolves.toEqual(listResponse);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/pending-approval', { params: { page: 1, page_size: 20 } });
    });
  });

  describe('dashboard', () => {
    it('GETs /treatment-plans/dashboard', async () => {
      const dashboard = {
        total_plans: 10,
        by_status: { draft: 3, under_review: 2, proposed: 1, rejected: 0, accepted: 1, in_progress: 2, on_hold: 0, completed: 1, cancelled: 0 },
        pending_review: 2,
        pending_approval: 1,
        pending_acknowledgment: 1,
        active_plans: 4,
      };
      getMock.mockResolvedValue({ data: dashboard });

      await expect(treatmentPlanService.getDashboard()).resolves.toEqual(dashboard);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/dashboard');
    });
  });

  describe('getPlan', () => {
    it('GETs /treatment-plans/{id}', async () => {
      getMock.mockResolvedValue({ data: listItem });

      await expect(treatmentPlanService.getPlan('plan-1')).resolves.toEqual(listItem);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/plan-1');
    });
  });

  describe('items', () => {
    it('POSTs /treatment-plans/{id}/items', async () => {
      postMock.mockResolvedValue({ data: listItem });
      const payload: AddItemRequest = { procedure_id: 5, sequence_number: 1, estimated_cost: 150 };

      await expect(treatmentPlanService.addItem('plan-1', payload)).resolves.toEqual(listItem);
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/items', payload);
    });

    it('PATCHes /treatment-plans/{id}/items/{itemId} with partial payload', async () => {
      patchMock.mockResolvedValue({ data: listItem });
      const payload: ItemUpdateRequest = { notes: 'Updated' };

      await expect(treatmentPlanService.updateItem('plan-1', 'item-1', payload)).resolves.toEqual(listItem);
      expect(patchMock).toHaveBeenCalledWith('/treatment-plans/plan-1/items/item-1', payload);
    });

    it('DELETEs /treatment-plans/{id}/items/{itemId}', async () => {
      deleteMock.mockResolvedValue({ data: listItem });

      await expect(treatmentPlanService.removeItem('plan-1', 'item-1')).resolves.toEqual(listItem);
      expect(deleteMock).toHaveBeenCalledWith('/treatment-plans/plan-1/items/item-1');
    });

    it('PUTs /treatment-plans/{id}/items/reorder with item_ids payload', async () => {
      putMock.mockResolvedValue({ data: listItem });

      await expect(treatmentPlanService.reorderItems('plan-1', ['item-2', 'item-1'])).resolves.toEqual(listItem);
      expect(putMock).toHaveBeenCalledWith('/treatment-plans/plan-1/items/reorder', { item_ids: ['item-2', 'item-1'] });
    });
  });

  describe('transitions (no body)', () => {
    it('POSTs each transition endpoint with no body', async () => {
      postMock.mockResolvedValue({ data: listItem });

      await treatmentPlanService.submitForReview('plan-1');
      await treatmentPlanService.approveReview('plan-1');
      await treatmentPlanService.rejectReview('plan-1');
      await treatmentPlanService.acceptPlan('plan-1');
      await treatmentPlanService.declinePlan('plan-1');
      await treatmentPlanService.cancelPlan('plan-1');
      await treatmentPlanService.startTreatment('plan-1');
      await treatmentPlanService.putOnHold('plan-1');
      await treatmentPlanService.resume('plan-1');
      await treatmentPlanService.complete('plan-1');

      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/submit-for-review');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/approve-review');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/reject-review');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/accept');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/decline');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/cancel');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/start-treatment');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/hold');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/resume');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/complete');
    });
  });

  describe('approval (no body)', () => {
    it('POSTs each approval endpoint with no body', async () => {
      postMock.mockResolvedValue({ data: listItem });

      await treatmentPlanService.doctorApprove('plan-1');
      await treatmentPlanService.doctorRevoke('plan-1');
      await treatmentPlanService.patientAcknowledge('plan-1');
      await treatmentPlanService.patientDecline('plan-1');

      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/doctor-approve');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/doctor-revoke');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/patient-acknowledge');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/patient-decline');
    });
  });

  describe('versions', () => {
    it('POSTs /treatment-plans/{id}/versions with change_reason', async () => {
      postMock.mockResolvedValue({ data: listItem });

      await treatmentPlanService.createVersion('plan-1', 'Initial snapshot');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/versions', { change_reason: 'Initial snapshot' });
    });

    it('GETs version list + detail', async () => {
      const versionList = { items: [{ id: 'v1', version_number: 1, change_reason: 'Init', changed_by: 1, created_at: '2026-08-01T08:00:00Z' }] };
      getMock.mockResolvedValue({ data: versionList });

      await expect(treatmentPlanService.listVersions('plan-1')).resolves.toEqual(versionList);
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/plan-1/versions');

      await treatmentPlanService.getVersion('plan-1', 'v1');
      expect(getMock).toHaveBeenCalledWith('/treatment-plans/plan-1/versions/v1');
    });

    it('POSTs restore with no body', async () => {
      postMock.mockResolvedValue({ data: listItem });

      await treatmentPlanService.restoreVersion('plan-1', 'v1');
      expect(postMock).toHaveBeenCalledWith('/treatment-plans/plan-1/versions/v1/restore');
    });
  });

  describe('error handling', () => {
    it('propagates axios errors to the caller', async () => {
      getMock.mockRejectedValue(new Error('Network Error'));

      await expect(treatmentPlanService.getPlan('plan-1')).rejects.toThrow('Network Error');
    });
  });

  describe('wire contract — F-01 / F-03', () => {
    it('detail aggregate does NOT carry item_count / total_estimated_cost (F-01)', async () => {
      // Exact shape the backend serializes for GET /treatment-plans/{id}
      // (schemas/treatment_plan.py TreatmentPlanResponse — no list fields).
      const wirePlan = {
        id: 'plan-1',
        plan_code: 'TXN-000001',
        patient_id: 'patient-1',
        doctor_id: 'doctor-1',
        clinical_notes: null,
        observations: null,
        dentist_recommendations: null,
        valid_from: null,
        valid_to: null,
        status: 'draft',
        current_version: 1,
        is_active: true,
        items: [
          {
            id: 'item-1',
            plan_id: 'plan-1',
            procedure_id: 5,
            procedure: null,
            sequence_number: 1,
            tooth_number: null,
            tooth_surface: null,
            quadrant: null,
            arch: null,
            estimated_cost: 1500.0,
            discount: 100.0,
            item_status: 'pending',
            notes: null,
            appointment_id: null,
            diagnosis_id: null,
          },
          {
            id: 'item-2',
            plan_id: 'plan-1',
            procedure_id: 6,
            procedure: null,
            sequence_number: 2,
            tooth_number: null,
            tooth_surface: null,
            quadrant: null,
            arch: null,
            estimated_cost: 500.0,
            discount: 0.0,
            item_status: 'pending',
            notes: null,
            appointment_id: null,
            diagnosis_id: null,
          },
        ],
        approval: null,
        versions: [],
        created_by: 1,
        updated_by: null,
        created_at: '2026-08-01T08:00:00Z',
        updated_at: '2026-08-01T08:00:00Z',
      };
      getMock.mockResolvedValue({ data: wirePlan });

      const detail = await treatmentPlanService.getPlan('plan-1');
      expect(detail).toEqual(wirePlan);
      // The two list-only fields must be ABSENT from the aggregate payload.
      expect('item_count' in detail).toBe(false);
      expect('total_estimated_cost' in detail).toBe(false);

      // Derived values — the same derivation the details container uses.
      expect(detail.items.length).toBe(2);
      const derivedTotal = detail.items.reduce((sum, item) => sum + Number(item.estimated_cost ?? 0), 0);
      expect(derivedTotal).toBe(2000);
    });

    it('serializes item Decimals as JSON numbers (Decimal-as-number — F-03)', async () => {
      getMock.mockResolvedValue({
        data: {
          id: 'plan-1',
          plan_code: 'TXN-000001',
          patient_id: 'patient-1',
          doctor_id: 'doctor-1',
          status: 'draft',
          current_version: 1,
          is_active: true,
          items: [{ id: 'i1', plan_id: 'plan-1', procedure_id: 5, procedure: null, sequence_number: 1, estimated_cost: 1500.0, discount: 0.0, item_status: 'pending', notes: null, appointment_id: null, diagnosis_id: null }],
          approval: null,
          versions: [],
          created_by: 1,
          updated_by: null,
          created_at: '2026-08-01T08:00:00Z',
          updated_at: '2026-08-01T08:00:00Z',
        },
      });

      const detail = await treatmentPlanService.getPlan('plan-1');
      expect(typeof detail.items[0].estimated_cost).toBe('number');
      expect(typeof detail.items[0].discount).toBe('number');
    });

    it('serializes version snapshot money as strings (str(Decimal) — F-03)', async () => {
      const snapshot = {
        id: 'v1',
        plan_id: 'plan-1',
        version_number: 1,
        change_reason: 'Initial',
        changed_by: 1,
        created_at: '2026-08-01T08:00:00Z',
        items_snapshot: {
          version_number: 1,
          captured_at: '2026-08-01T08:00:00Z',
          items: [
            {
              sequence_number: 1,
              procedure_id: 5,
              procedure_code: 'RCT',
              tooth_number: null,
              tooth_surface: null,
              quadrant: null,
              arch: null,
              estimated_cost: '15000.00',
              discount: '0.00',
              item_status: 'pending',
              notes: null,
            },
          ],
        },
      };
      getMock.mockResolvedValue({ data: snapshot });

      const version = await treatmentPlanService.getVersion('plan-1', 'v1');
      const money = version.items_snapshot.items[0];
      expect(typeof money.estimated_cost).toBe('string');
      expect(typeof money.discount).toBe('string');
      // Snapshots must be parsed through the string-aware helper before display.
      expect(parseSnapshotMoney(money.estimated_cost)).toBe(15000);
    });
  });
});
