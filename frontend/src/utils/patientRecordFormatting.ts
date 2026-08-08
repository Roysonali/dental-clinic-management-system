/**
 * Patient Record display helpers.
 *
 * Pure functions shared by the detail-page tabs and dialogs:
 * - audit action label prettifying (raw actions are opaque strings)
 * - human-readable file sizes (attachments metadata)
 * - empty-text fallback for nullable clinical fields
 */
import { AUDIT_ACTION_LABELS } from '../constants/patientRecord';

/** Prettify a raw audit action (e.g. PATIENT_RECORD_STATUS_CHANGED → "Record status changed"). */
export function auditActionLabel(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a byte count as a human-readable size ("—" for null/undefined).
 * Handles MB/GB as appropriate; always rounds to one decimal.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Render a nullable clinical/medical field with the standard "—" fallback. */
export function clinicalText(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : '—';
}
