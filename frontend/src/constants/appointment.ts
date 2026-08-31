/**
 * Appointment module constants.
 *
 * Maintains alignment with backend `app/modules/appointments/`:
 * - enums.py   (status / type literal values)
 * - router.py  (default page size 20, max 100)
 */
import type { BadgeVariant } from '../components/common/Badge/badge.types';
import type { AppointmentStatus, AppointmentType } from '../types/appointment';

/** Default page size for GET /appointments (matches backend default 20). */
export const APPOINTMENT_LIST_PAGE_SIZE = 20;

/** Max page size accepted by the backend. */
export const APPOINTMENT_MAX_PAGE_SIZE = 100;

/** Page-size options offered in the list toolbar. */
export const APPOINTMENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Appointment status -> BadgeVariant map.
 * Keys are lowercased (StatusBadge lowercases before lookup); multi-word
 * statuses ("Checked In", "In Treatment", "No Show") are keyed with spaces.
 */
export const APPOINTMENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  scheduled: 'info',
  confirmed: 'warning',
  'checked in': 'info',
  'in treatment': 'warning',
  completed: 'success',
  cancelled: 'danger',
  'no show': 'danger',
};

/** Human-readable labels for appointment types (display only). */
export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  Consultation: 'Consultation',
  'Follow-Up': 'Follow-Up',
  Emergency: 'Emergency',
  Procedure: 'Procedure',
  Review: 'Review',
  Other: 'Other',
};

/** Status filter option descriptors for the list toolbar. */
export const APPOINTMENT_STATUS_FILTERS: readonly {
  value: AppointmentStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Checked In', label: 'Checked In' },
  { value: 'In Treatment', label: 'In Treatment' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'No Show', label: 'No Show' },
];

export type AppointmentStatusFilter = 'all' | AppointmentStatus;

/* ── Form constants (mirror backend core/constants.py + schema.py) ── */

/** Backend-allowed durations (ALLOWED_APPOINTMENT_DURATIONS). */
export const APPOINTMENT_DURATION_OPTIONS = [15, 30, 45, 60] as const;

/** Backend default duration (DEFAULT_APPOINTMENT_DURATION). */
export const APPOINTMENT_DEFAULT_DURATION = 30;

/** Appointment types offered in the form (AppointmentType enum). */
export const APPOINTMENT_TYPE_OPTIONS: readonly AppointmentType[] = [
  'Consultation',
  'Follow-Up',
  'Emergency',
  'Procedure',
  'Review',
  'Other',
] as const;

/**
 * Statuses from which the backend allows PATCH /appointments/{id}/cancel
 * (AppointmentValidator.validate_status_transition). Terminal statuses and
 * in-progress statuses cannot be cancelled.
 */
export const APPOINTMENT_CANCELLABLE_STATUSES: readonly AppointmentStatus[] = [
  'Scheduled',
  'Confirmed',
] as const;

/** True when the backend will accept a cancel transition for this status. */
export function canCancelAppointment(status: AppointmentStatus): boolean {
  return (APPOINTMENT_CANCELLABLE_STATUSES as readonly AppointmentStatus[]).includes(status);
}

/* ── Status lifecycle transitions (mirror backend validators.py) ──── */

/**
 * Allowed forward transitions from the backend transition map.
 * Used to show only valid action buttons in the appointment detail view.
 */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  'Scheduled': ['Confirmed', 'Cancelled', 'No Show'],
  'Confirmed': ['Checked In', 'Cancelled', 'No Show'],
  'Checked In': ['In Treatment'],
  'In Treatment': ['Completed'],
  'Completed': [],
  'Cancelled': [],
  'No Show': [],
};

/** Statuses that are terminal — cannot be edited or transitioned. */
export const APPOINTMENT_TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  'Completed',
  'Cancelled',
  'No Show',
] as const;

/** True when the appointment is in a terminal state (no edits or transitions allowed). */
export function isTerminalStatus(status: AppointmentStatus): boolean {
  return (APPOINTMENT_TERMINAL_STATUSES as readonly AppointmentStatus[]).includes(status);
}

/**
 * Target statuses that have a dedicated UI workflow (dialog, confirmation,
 * etc.) and should NOT be rendered as generic lifecycle-action buttons.
 *
 * For example, CANCELLED has a dedicated "Cancel Appointment" button that
 * opens CancelAppointmentDialog — the generic renderer must not also render
 * a plain "Cancelled" button for the same transition.
 */
export const DEDICATED_ACTION_STATUSES: readonly AppointmentStatus[] = [
  'Cancelled',
] as const;

/** True when a target status has a dedicated UI workflow. */
export function hasDedicatedAction(status: AppointmentStatus): boolean {
  return (DEDICATED_ACTION_STATUSES as readonly AppointmentStatus[]).includes(status);
}

/**
 * Return the list of valid next statuses for a given current status,
 * excluding any target statuses that have a dedicated UI workflow.
 *
 * Use this for the generic lifecycle-action renderer so that statuses
 * like CANCELLED (which has "Cancel Appointment" + dialog) are not
 * rendered as a plain button.
 */
export function getGenericNextStatuses(current: AppointmentStatus): readonly AppointmentStatus[] {
  return (APPOINTMENT_STATUS_TRANSITIONS[current] ?? []).filter(
    (s) => !hasDedicatedAction(s),
  );
}

/**
 * Action button labels keyed by the TARGET status of the transition.
 *
 * When rendering a button that transitions the appointment TO
 * ``targetStatus``, use ``STATUS_ACTION_LABELS[targetStatus]``.
 */
export const STATUS_ACTION_LABELS: Record<AppointmentStatus, string> = {
  'Scheduled': 'Confirm',
  'Confirmed': 'Confirm',
  'Checked In': 'Check In',
  'In Treatment': 'Start Treatment',
  'Completed': 'Complete',
  'Cancelled': 'Cancel',
  'No Show': 'Mark No Show',
};
