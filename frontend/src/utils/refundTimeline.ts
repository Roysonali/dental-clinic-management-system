/**
 * Refund timeline construction (Sprint 14A.5).
 *
 * The backend returns no refund audit trail (`audit_trail: []` — see
 * refund_mapper.to_read), so the timeline is derived from the refund's own
 * real fields: creator/created_at (pending), reviewer/reviewed_at
 * (approved/rejected), updater/updated_at (completed). Future/not-applicable
 * states render as hollow gray entries so the lifecycle progression is
 * always visible.
 */
import type { RefundRead } from '../types/billing';

export type RefundTimelineMarker = 'completed' | 'current' | 'current-danger' | 'future';

export interface RefundTimelineItem {
  /** Event title, e.g. "Pending — refund requested". */
  title: string;
  /** Actor (muted secondary text) — absent for future/not-applicable entries. */
  actor?: string | null;
  /** ISO datetime for the muted timestamp. */
  timestamp?: string;
  /** Marker style: green (completed), blue (current), red (current rejected), hollow gray (future/n/a). */
  marker: RefundTimelineMarker;
  /** Secondary description (e.g. rejection reason / "Not applicable…"). */
  description?: string;
}

/**
 * Build the refund timeline from the actual refund aggregate.
 */
export function buildRefundTimeline(refund: RefundRead): RefundTimelineItem[] {
  const status = refund.status;
  const items: RefundTimelineItem[] = [];

  // ── Pending — the creation event is always present ──────────────
  items.push({
    title: 'Pending — refund requested',
    actor: refund.creator?.full_name ?? null,
    timestamp: refund.created_at,
    marker: status === 'pending' ? 'current' : 'completed',
  });

  if (status === 'approved' || status === 'completed') {
    items.push({
      title: 'Approved',
      actor: refund.reviewer?.full_name ?? null,
      timestamp: refund.reviewed_at ?? undefined,
      marker: status === 'approved' ? 'current' : 'completed',
    });
  }

  if (status === 'completed') {
    items.push({
      title: 'Completed — refund allocation created',
      actor: refund.updater?.full_name ?? refund.reviewer?.full_name ?? null,
      timestamp: refund.updated_at,
      marker: 'current',
    });
    items.push({
      title: 'Rejected',
      description: 'Not applicable — this refund was approved',
      marker: 'future',
    });
  }

  if (status === 'pending') {
    items.push(
      { title: 'Approved', marker: 'future' },
      { title: 'Completed', marker: 'future' },
      { title: 'Rejected', marker: 'future' },
    );
  }

  if (status === 'approved') {
    items.push(
      { title: 'Completed', marker: 'future' },
      { title: 'Rejected', description: 'Not applicable — this refund was approved', marker: 'future' },
    );
  }

  if (status === 'rejected') {
    items.push({
      title: 'Rejected',
      actor: refund.reviewer?.full_name ?? null,
      timestamp: refund.reviewed_at ?? undefined,
      description: refund.rejection_reason ?? undefined,
      marker: 'current-danger',
    });
    items.push(
      { title: 'Approved', description: 'Not applicable — this refund was rejected', marker: 'future' },
      { title: 'Completed', description: 'Not applicable — this refund was rejected', marker: 'future' },
    );
  }

  return items;
}
