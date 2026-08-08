/**
 * Patient Record status transition map (client-side).
 *
 * The backend's `PATCH /patient-records/{id}/status` accepts ANY enum value
 * from any status-change role — the designed state machine is NOT enforced
 * over HTTP (BCR O1). The UI therefore hardcodes the intended clinical flow
 * (UI spec §2.5) and disables illegal moves in the status dialog; the
 * backend remains the final authority.
 *
 * Design intent:
 * ```
 * DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED → FINALIZED (terminal)
 * ```
 * Backward moves: IN_PROGRESS → DRAFT (write roles); UNDER_REVIEW →
 * IN_PROGRESS and COMPLETED → IN_PROGRESS (admin revision/reopen).
 * Direct DRAFT → FINALIZED is intentionally NOT offered.
 *
 * Role gates (as far as the client can prove — the probe only
 * distinguishes admin vs non-admin; doctor-only vs receptionist moves are
 * shown to everyone and the backend 403s where it must):
 * - admin (ADMIN/CHIEF_DOCTOR) → every forward + admin-backward move.
 * - non-admin/unknown → forward write-role moves only
 *   (DRAFT→IN_PROGRESS, IN_PROGRESS→UNDER_REVIEW/→DRAFT).
 */
import type { RecordStatus } from '../types/patientRecord';

/** Full design-intent map (all roles). Admin-only moves flagged separately. */
export const RECORD_STATUS_TRANSITIONS: Record<RecordStatus, readonly RecordStatus[]> = {
  DRAFT: ['IN_PROGRESS'],
  IN_PROGRESS: ['UNDER_REVIEW', 'DRAFT'],
  UNDER_REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: ['FINALIZED', 'IN_PROGRESS'],
  FINALIZED: [],
  LOCKED: [],
};

/** "FROM→TO" keys only admins may perform (revision/reopen/final-approve). */
const ADMIN_ONLY_KEYS = new Set<string>([
  'UNDER_REVIEW→COMPLETED',
  'COMPLETED→FINALIZED',
  'UNDER_REVIEW→IN_PROGRESS',
  'COMPLETED→IN_PROGRESS',
]);

const transitionKey = (from: RecordStatus, to: RecordStatus): string => `${from}→${to}`;

/**
 * Legal target statuses for the status dialog, given whether the current
 * user is a proven admin. Illegal targets are not rendered (or are shown
 * disabled with an explanation in the dialog).
 */
export function legalStatusTargets(
  status: RecordStatus,
  isAdmin: boolean,
): readonly RecordStatus[] {
  const targets = RECORD_STATUS_TRANSITIONS[status] ?? [];
  if (isAdmin) return targets;
  return targets.filter((target) => !ADMIN_ONLY_KEYS.has(transitionKey(status, target)));
}

/** True when the target is a legal move for the user's resolved role. */
export function isStatusTargetLegal(
  status: RecordStatus,
  target: RecordStatus,
  isAdmin: boolean,
): boolean {
  return legalStatusTargets(status, isAdmin).includes(target);
}

/** True when the transition requires a non-empty chief complaint (IN_PROGRESS → UNDER_REVIEW). */
export function transitionRequiresChiefComplaint(
  status: RecordStatus,
  target: RecordStatus,
): boolean {
  return status === 'IN_PROGRESS' && target === 'UNDER_REVIEW';
}

/** True when the transition is admin-only (revision / reopen / final approve). */
export function isAdminOnlyTransition(status: RecordStatus, target: RecordStatus): boolean {
  return ADMIN_ONLY_KEYS.has(transitionKey(status, target));
}

/** True when the record may still be edited (finalized records are immutable). */
export function isRecordEditable(isFinalized: boolean): boolean {
  return !isFinalized;
}

/** Terminal states — no outgoing transitions (FINALIZED; LOCKED is legacy). */
export function isTerminalRecordStatus(status: RecordStatus): boolean {
  return status === 'FINALIZED' || status === 'LOCKED';
}
