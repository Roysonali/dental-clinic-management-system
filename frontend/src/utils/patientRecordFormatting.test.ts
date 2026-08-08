import { describe, it, expect } from 'vitest';
import {
  auditActionLabel,
  clinicalText,
  formatFileSize,
} from './patientRecordFormatting';

describe('auditActionLabel', () => {
  it('maps known actions to human labels', () => {
    expect(auditActionLabel('PATIENT_RECORD_STATUS_CHANGED')).toBe('Record status changed');
    expect(auditActionLabel('PRESCRIPTION_ITEM_CREATED')).toBe('Medicine added');
  });

  it('prettifies unknown actions', () => {
    expect(auditActionLabel('FOLLOWUP_DELETED')).toBe('Follow-up removed');
    expect(auditActionLabel('MYSTERY_ACTION')).toBe('Mystery Action');
  });
});

describe('formatFileSize', () => {
  it('renders bytes, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('renders — for null/undefined/negative', () => {
    expect(formatFileSize(null)).toBe('—');
    expect(formatFileSize(undefined)).toBe('—');
    expect(formatFileSize(-1)).toBe('—');
  });
});

describe('clinicalText', () => {
  it('falls back to — for empty values', () => {
    expect(clinicalText(null)).toBe('—');
    expect(clinicalText('')).toBe('—');
    expect(clinicalText('   ')).toBe('—');
  });

  it('returns the value unchanged when present', () => {
    expect(clinicalText('Pain in 36')).toBe('Pain in 36');
  });
});
