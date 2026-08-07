import { describe, it, expect } from 'vitest';
import {
  APPROVAL_ACTIONS,
  approvalActionsForSubState,
  ENDPOINT_BACKED_TRANSITIONS,
  isApprovalAction,
  isEditableStatus,
  isTerminalStatus,
  planActionsForStatus,
  TRANSITION_ENDPOINT,
} from './treatmentPlanStateMachine';
import type { ApprovalResponse } from '../types/treatmentPlan';

describe('treatmentPlanStateMachine', () => {
  describe('ENDPOINT_BACKED_TRANSITIONS', () => {
    it('matches the backend PLAN_TRANSITIONS map exactly', () => {
      expect(ENDPOINT_BACKED_TRANSITIONS).toEqual({
        draft: ['under_review', 'cancelled'],
        under_review: ['proposed', 'draft', 'cancelled'],
        proposed: ['accepted', 'cancelled', 'rejected'],
        rejected: ['cancelled'],
        accepted: ['in_progress', 'cancelled'],
        in_progress: ['on_hold', 'completed', 'cancelled'],
        on_hold: ['in_progress', 'completed', 'cancelled'],
        completed: [],
        cancelled: [],
      });
    });

    it('has no proposed→draft or rejected→draft (no endpoint — O12)', () => {
      expect(ENDPOINT_BACKED_TRANSITIONS.proposed).not.toContain('draft');
      expect(ENDPOINT_BACKED_TRANSITIONS.rejected).not.toContain('draft');
    });
  });

  describe('isEditableStatus', () => {
    it('allows editing in draft / under_review / proposed', () => {
      expect(isEditableStatus('draft')).toBe(true);
      expect(isEditableStatus('under_review')).toBe(true);
      expect(isEditableStatus('proposed')).toBe(true);
    });

    it('denies editing in accepted and later statuses (backend 409)', () => {
      expect(isEditableStatus('accepted')).toBe(false);
      expect(isEditableStatus('in_progress')).toBe(false);
      expect(isEditableStatus('on_hold')).toBe(false);
      expect(isEditableStatus('completed')).toBe(false);
      expect(isEditableStatus('cancelled')).toBe(false);
      expect(isEditableStatus('rejected')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('treats completed and cancelled as terminal', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('cancelled')).toBe(true);
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('proposed')).toBe(false);
    });
  });

  describe('planActionsForStatus', () => {
    it('offers submit + cancel in draft', () => {
      expect(planActionsForStatus('draft')).toEqual(['submit-for-review', 'cancel']);
    });

    it('offers review actions + cancel in under_review', () => {
      expect(planActionsForStatus('under_review')).toEqual(['approve-review', 'reject-review', 'cancel']);
    });

    it('offers the approval + accept/decline surface in proposed', () => {
      expect(planActionsForStatus('proposed')).toEqual([
        'doctor-approve',
        'patient-acknowledge',
        'patient-decline',
        'accept',
        'decline',
        'cancel',
      ]);
    });

    it('offers only cancel in rejected (correction is cancel → new plan, O12)', () => {
      expect(planActionsForStatus('rejected')).toEqual(['cancel']);
    });

    it('offers start-treatment + cancel in accepted', () => {
      expect(planActionsForStatus('accepted')).toEqual(['start-treatment', 'cancel']);
    });

    it('offers hold/complete/cancel in in_progress', () => {
      expect(planActionsForStatus('in_progress')).toEqual(['hold', 'complete', 'cancel']);
    });

    it('offers resume/complete/cancel in on_hold', () => {
      expect(planActionsForStatus('on_hold')).toEqual(['resume', 'complete', 'cancel']);
    });

    it('offers no actions in terminal statuses', () => {
      expect(planActionsForStatus('completed')).toEqual([]);
      expect(planActionsForStatus('cancelled')).toEqual([]);
    });

    it('never offers item-status actions (O2)', () => {
      for (const status of Object.keys(planActionsForStatus) as Array<keyof typeof planActionsForStatus>) {
        expect(planActionsForStatus(status).filter((a) => a.startsWith('item-'))).toEqual([]);
      }
    });
  });

  describe('TRANSITION_ENDPOINT', () => {
    it('maps every action id to the documented endpoint suffix (all 14)', () => {
      expect(TRANSITION_ENDPOINT).toEqual({
        'submit-for-review': 'submit-for-review',
        'approve-review': 'approve-review',
        'reject-review': 'reject-review',
        accept: 'accept',
        decline: 'decline',
        cancel: 'cancel',
        'start-treatment': 'start-treatment',
        hold: 'hold',
        resume: 'resume',
        complete: 'complete',
        'doctor-approve': 'doctor-approve',
        'doctor-revoke': 'doctor-revoke',
        'patient-acknowledge': 'patient-acknowledge',
        'patient-decline': 'patient-decline',
      });
    });

    it('covers every action id in the action-id union', () => {
      expect(Object.keys(TRANSITION_ENDPOINT).sort()).toEqual(
        [...APPROVAL_ACTIONS, 'submit-for-review', 'approve-review', 'reject-review', 'accept', 'decline', 'cancel', 'start-treatment', 'hold', 'resume', 'complete'].sort(),
      );
      expect(Object.keys(TRANSITION_ENDPOINT)).toHaveLength(14);
    });
  });

  describe('approvalActionsForSubState (F-02 gating)', () => {
    const signed: ApprovalResponse = {
      id: 'a1',
      approved_by: 3,
      approved_at: '2026-08-02T09:00:00Z',
      patient_status: 'pending',
      patient_acknowledged_at: null,
      approval_notes: null,
    };

    it('offers doctor-approve only while unsigned (null record)', () => {
      expect(approvalActionsForSubState(null)).toEqual(['doctor-approve']);
    });

    it('offers doctor-approve only while unsigned (pending record)', () => {
      expect(
        approvalActionsForSubState({ ...signed, approved_at: null, approved_by: null }),
      ).toEqual(['doctor-approve']);
    });

    it('offers revoke + patient buttons once signed and patient pending', () => {
      expect(approvalActionsForSubState(signed)).toEqual([
        'doctor-revoke',
        'patient-acknowledge',
        'patient-decline',
      ]);
    });

    it('offers revoke only once the patient has decided', () => {
      expect(approvalActionsForSubState({ ...signed, patient_status: 'accepted' })).toEqual(['doctor-revoke']);
      expect(approvalActionsForSubState({ ...signed, patient_status: 'rejected' })).toEqual(['doctor-revoke']);
    });

    it('isApprovalAction recognises exactly the four approval-record actions', () => {
      for (const action of APPROVAL_ACTIONS) expect(isApprovalAction(action)).toBe(true);
      expect(isApprovalAction('accept')).toBe(false);
      expect(isApprovalAction('cancel')).toBe(false);
      expect(isApprovalAction('complete')).toBe(false);
    });
  });
});
