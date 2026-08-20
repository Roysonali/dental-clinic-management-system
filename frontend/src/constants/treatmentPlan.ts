/**
 * Treatment Plan module constants.
 *
 * Maintains alignment with backend `app/modules/treatment/`:
 * - enums.py   (status / acknowledgment / quadrant / arch values)
 * - constants.py (FDI ranges 11–48 / 51–85)
 * - router.py  (default page size 20, max 100)
 */
import type { BadgeVariant } from '../components/common/Badge/badge.types';
import type {
  TreatmentPlanStatus,
  ToothArch,
  ToothQuadrant,
  TreatmentPlanActionId,
} from '../types/treatmentPlan';

/** Default page size for GET /treatment-plans (matches backend default 20). */
export const TREATMENT_PLAN_LIST_PAGE_SIZE = 20;

/** Max page size accepted by the backend. */
export const TREATMENT_PLAN_MAX_PAGE_SIZE = 100;

/** Page-size options offered in the list toolbar. */
export const TREATMENT_PLAN_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Treatment-module presentation currency (approved DensCare product
 * requirement — the clinic bills in INR).
 *
 * Cost displays (procedure catalog, treatment plan tables, item drawers,
 * summaries) render through the shared `formatCurrency(value, code)`
 * formatter, which maps INR → ₹ with thousands grouping, e.g.
 * `formatCurrency(15000, 'INR')` → "₹15,000.00". This code is the single
 * point of change for treatment/procedure currency presentation.
 */
export const TREATMENT_PLAN_CURRENCY_CODE = 'INR' as const;

/* ── Status presentation ─────────────────────────────────────────── */

/** Status → BadgeVariant map (approved styling, [P2.5 §3.4]). */
export const TREATMENT_PLAN_STATUS_VARIANTS: Record<TreatmentPlanStatus, BadgeVariant> = {
  draft: 'neutral',
  under_review: 'warning',
  proposed: 'info',
  rejected: 'danger',
  accepted: 'success',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

/** Human-readable status labels (display only). */
export const TREATMENT_PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  proposed: 'Proposed',
  rejected: 'Rejected',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Status filter option descriptors for the list toolbar. */
export const TREATMENT_PLAN_STATUS_FILTERS: readonly {
  value: TreatmentPlanStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All Status' },
  ...(Object.keys(TREATMENT_PLAN_STATUS_LABELS) as TreatmentPlanStatus[]).map((s) => ({
    value: s,
    label: TREATMENT_PLAN_STATUS_LABELS[s],
  })),
];

/** Sort option descriptors for the list toolbar (backend allowlist). */
export const TREATMENT_PLAN_SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'status', label: 'Status' },
  { value: 'plan_code', label: 'Plan Code' },
];

/* ── Tooth-level enums + FDI validation ──────────────────────────── */

/** Tooth quadrant values (ToothQuadrant enum). */
export const TOOTH_QUADRANTS: readonly ToothQuadrant[] = ['UR', 'UL', 'LL', 'LR'] as const;

/** Tooth arch values (ToothArch enum). */
export const TOOTH_ARCHES: readonly ToothArch[] = ['upper', 'lower'] as const;

/** FDI permanent range. */
const FDI_PERMANENT_MIN = 11;
const FDI_PERMANENT_MAX = 48;
/** FDI primary range. */
const FDI_PRIMARY_MIN = 51;
const FDI_PRIMARY_MAX = 85;

/** True when the value is a valid FDI tooth number (11–48 or 51–85). */
export function isValidFdiToothNumber(value: number): boolean {
  return (
    (value >= FDI_PERMANENT_MIN && value <= FDI_PERMANENT_MAX) ||
    (value >= FDI_PRIMARY_MIN && value <= FDI_PRIMARY_MAX)
  );
}

/* ── Status-driven action configuration ──────────────────────────── */

/** Human-readable label for each plan/approval action (action bar + confirm dialogs). */
export const TREATMENT_PLAN_ACTION_LABELS: Record<TreatmentPlanActionId, string> = {
  'submit-for-review': 'Submit for Review',
  'approve-review': 'Approve Review',
  'reject-review': 'Reject Review',
  accept: 'Accept Plan',
  decline: 'Decline Plan',
  cancel: 'Cancel Plan',
  'start-treatment': 'Start Treatment',
  hold: 'Put on Hold',
  resume: 'Resume Treatment',
  complete: 'Complete Treatment',
  'doctor-approve': 'Doctor Approve',
  'doctor-revoke': 'Revoke Doctor Approval',
  'patient-acknowledge': 'Patient Accepts',
  'patient-decline': 'Patient Declines',
};
