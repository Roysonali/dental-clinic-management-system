import { describe, it, expect } from 'vitest';
import {
  canTransitionTo,
  isTerminalStatus,
  isEditableStatus,
  creditNoteStatusLabel,
} from './creditNoteStateMachine';

describe('creditNoteStateMachine', () => {
  describe('canTransitionTo — mirrors backend CREDIT_NOTE_TRANSITIONS', () => {
    it('DRAFT → issued | void (never applied/expired directly)', () => {
      expect(canTransitionTo('draft', 'issued')).toBe(true);
      expect(canTransitionTo('draft', 'void')).toBe(true);
      expect(canTransitionTo('draft', 'applied')).toBe(false);
      expect(canTransitionTo('draft', 'expired')).toBe(false);
      expect(canTransitionTo('draft', 'draft')).toBe(false);
    });

    it('ISSUED → applied | void | expired (no re-issue)', () => {
      expect(canTransitionTo('issued', 'applied')).toBe(true);
      expect(canTransitionTo('issued', 'void')).toBe(true);
      expect(canTransitionTo('issued', 'expired')).toBe(true);
      expect(canTransitionTo('issued', 'issued')).toBe(false);
    });

    it('terminal statuses (applied / void / expired) have no outgoing transitions', () => {
      expect(canTransitionTo('applied', 'void')).toBe(false);
      expect(canTransitionTo('applied', 'expired')).toBe(false);
      expect(canTransitionTo('void', 'issued')).toBe(false);
      expect(canTransitionTo('expired', 'applied')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('is true only for applied / void / expired (backend terminal set)', () => {
      expect(isTerminalStatus('applied')).toBe(true);
      expect(isTerminalStatus('void')).toBe(true);
      expect(isTerminalStatus('expired')).toBe(true);
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('issued')).toBe(false);
    });
  });

  describe('isEditableStatus', () => {
    it('is true only for draft (backend CreditNoteStatus.editable_statuses)', () => {
      expect(isEditableStatus('draft')).toBe(true);
      expect(isEditableStatus('issued')).toBe(false);
      expect(isEditableStatus('applied')).toBe(false);
      expect(isEditableStatus('void')).toBe(false);
      expect(isEditableStatus('expired')).toBe(false);
    });
  });

  describe('creditNoteStatusLabel', () => {
    it('maps every status to a display label', () => {
      expect(creditNoteStatusLabel('draft')).toBe('Draft');
      expect(creditNoteStatusLabel('issued')).toBe('Issued');
      expect(creditNoteStatusLabel('applied')).toBe('Applied');
      expect(creditNoteStatusLabel('void')).toBe('Void');
      expect(creditNoteStatusLabel('expired')).toBe('Expired');
    });
  });
});
