import { describe, it, expect } from 'vitest';
import {
  canTransitionTo,
  isTerminalStatus,
  isEditableStatus,
  refundStatusLabel,
} from './refundStateMachine';
import type { RefundStatus } from '../types/billing';

/**
 * Mirrors backend `REFUND_TRANSITIONS` (billing/constants.py):
 * PENDING → {APPROVED, REJECTED}; APPROVED → {COMPLETED};
 * REJECTED / COMPLETED terminal.
 */
describe('refundStateMachine', () => {
  describe('canTransitionTo', () => {
    it('allows PENDING → APPROVED and PENDING → REJECTED', () => {
      expect(canTransitionTo('pending', 'approved')).toBe(true);
      expect(canTransitionTo('pending', 'rejected')).toBe(true);
    });

    it('allows APPROVED → COMPLETED only', () => {
      expect(canTransitionTo('approved', 'completed')).toBe(true);
      expect(canTransitionTo('approved', 'approved')).toBe(false);
      expect(canTransitionTo('approved', 'rejected')).toBe(false);
    });

    it('blocks every transition from the terminal states', () => {
      const statuses: RefundStatus[] = ['pending', 'approved', 'rejected', 'completed'];
      for (const target of statuses) {
        expect(canTransitionTo('rejected', target)).toBe(false);
        expect(canTransitionTo('completed', target)).toBe(false);
      }
    });

    it('prevents invalid transitions: cannot approve a rejected/completed refund, cannot complete a pending/rejected refund', () => {
      expect(canTransitionTo('rejected', 'approved')).toBe(false);
      expect(canTransitionTo('completed', 'approved')).toBe(false);
      expect(canTransitionTo('pending', 'completed')).toBe(false);
      expect(canTransitionTo('rejected', 'completed')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('marks only rejected and completed as terminal', () => {
      expect(isTerminalStatus('rejected')).toBe(true);
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('pending')).toBe(false);
      expect(isTerminalStatus('approved')).toBe(false);
    });
  });

  describe('isEditableStatus', () => {
    it('marks only pending as editable (backend rule)', () => {
      expect(isEditableStatus('pending')).toBe(true);
      expect(isEditableStatus('approved')).toBe(false);
      expect(isEditableStatus('rejected')).toBe(false);
      expect(isEditableStatus('completed')).toBe(false);
    });
  });

  describe('refundStatusLabel', () => {
    it('maps every status to a display label', () => {
      expect(refundStatusLabel('pending')).toBe('Pending');
      expect(refundStatusLabel('approved')).toBe('Approved');
      expect(refundStatusLabel('rejected')).toBe('Rejected');
      expect(refundStatusLabel('completed')).toBe('Completed');
    });
  });
});
