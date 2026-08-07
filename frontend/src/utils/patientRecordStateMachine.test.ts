import { describe, it, expect } from 'vitest';
import {
  isAdminOnlyTransition,
  isRecordEditable,
  isStatusTargetLegal,
  isTerminalRecordStatus,
  legalStatusTargets,
  RECORD_STATUS_TRANSITIONS,
  transitionRequiresChiefComplaint,
} from './patientRecordStateMachine';
import type { RecordStatus } from '../types/patientRecord';

describe('RECORD_STATUS_TRANSITIONS — the intended clinical flow', () => {
  it('follows DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED → FINALIZED', () => {
    expect(RECORD_STATUS_TRANSITIONS.DRAFT).toContain('IN_PROGRESS');
    expect(RECORD_STATUS_TRANSITIONS.IN_PROGRESS).toContain('UNDER_REVIEW');
    expect(RECORD_STATUS_TRANSITIONS.UNDER_REVIEW).toContain('COMPLETED');
    expect(RECORD_STATUS_TRANSITIONS.COMPLETED).toContain('FINALIZED');
  });

  it('never offers a direct DRAFT → FINALIZED jump (the backend would accept it — O1)', () => {
    expect(RECORD_STATUS_TRANSITIONS.DRAFT).not.toContain('FINALIZED');
    expect(RECORD_STATUS_TRANSITIONS.DRAFT).not.toContain('COMPLETED');
  });

  it('FINALIZED and LOCKED are terminal', () => {
    expect(RECORD_STATUS_TRANSITIONS.FINALIZED).toEqual([]);
    expect(RECORD_STATUS_TRANSITIONS.LOCKED).toEqual([]);
    expect(isTerminalRecordStatus('FINALIZED')).toBe(true);
    expect(isTerminalRecordStatus('LOCKED')).toBe(true);
  });
});

describe('legalStatusTargets — role awareness', () => {
  it('grants admins every designed transition', () => {
    expect(legalStatusTargets('UNDER_REVIEW', true)).toContain('COMPLETED');
    expect(legalStatusTargets('UNDER_REVIEW', true)).toContain('IN_PROGRESS');
    expect(legalStatusTargets('COMPLETED', true)).toContain('FINALIZED');
    expect(legalStatusTargets('COMPLETED', true)).toContain('IN_PROGRESS');
  });

  it('withholds admin-only moves from non-admins', () => {
    expect(legalStatusTargets('UNDER_REVIEW', false)).not.toContain('COMPLETED');
    expect(legalStatusTargets('UNDER_REVIEW', false)).not.toContain('IN_PROGRESS');
    expect(legalStatusTargets('COMPLETED', false)).not.toContain('FINALIZED');
    expect(legalStatusTargets('COMPLETED', false)).not.toContain('IN_PROGRESS');
  });

  it('keeps write-role moves available to non-admins', () => {
    expect(legalStatusTargets('DRAFT', false)).toContain('IN_PROGRESS');
    expect(legalStatusTargets('IN_PROGRESS', false)).toContain('UNDER_REVIEW');
    expect(legalStatusTargets('IN_PROGRESS', false)).toContain('DRAFT');
  });

  it('isStatusTargetLegal mirrors legalStatusTargets', () => {
    expect(isStatusTargetLegal('COMPLETED', 'FINALIZED', true)).toBe(true);
    expect(isStatusTargetLegal('COMPLETED', 'FINALIZED', false)).toBe(false);
    expect(isStatusTargetLegal('DRAFT', 'IN_PROGRESS', false)).toBe(true);
  });
});

describe('transition prerequisites', () => {
  it('requires a chief complaint only for IN_PROGRESS → UNDER_REVIEW', () => {
    expect(transitionRequiresChiefComplaint('IN_PROGRESS', 'UNDER_REVIEW')).toBe(true);
    expect(transitionRequiresChiefComplaint('DRAFT', 'IN_PROGRESS')).toBe(false);
  });

  it('flags the four admin-only transitions', () => {
    expect(isAdminOnlyTransition('UNDER_REVIEW', 'COMPLETED')).toBe(true);
    expect(isAdminOnlyTransition('COMPLETED', 'FINALIZED')).toBe(true);
    expect(isAdminOnlyTransition('UNDER_REVIEW', 'IN_PROGRESS')).toBe(true);
    expect(isAdminOnlyTransition('COMPLETED', 'IN_PROGRESS')).toBe(true);
    expect(isAdminOnlyTransition('DRAFT', 'IN_PROGRESS')).toBe(false);
    expect(isAdminOnlyTransition('IN_PROGRESS', 'UNDER_REVIEW')).toBe(false);
  });
});

describe('isRecordEditable', () => {
  it('tracks finalization (the backend immutability gate)', () => {
    expect(isRecordEditable(false)).toBe(true);
    expect(isRecordEditable(true)).toBe(false);
  });
});

// Guard: every transition target must be a known status value.
describe('matrix integrity', () => {
  it('only references known statuses', () => {
    const known: RecordStatus[] = ['DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'FINALIZED', 'LOCKED'];
    for (const targets of Object.values(RECORD_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(known).toContain(target);
      }
    }
  });
});
