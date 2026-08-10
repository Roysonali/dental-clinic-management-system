/**
 * Receipt audit-trail construction (Sprint 14A.5).
 *
 * The backend currently returns `audit_trail: []` and `print_metadata:
 * null` (see receipt_mapper.to_read), so the trail is derived from the real
 * aggregate data the endpoint DOES provide:
 * - "Receipt generated" — the receipt's own creator at created_at.
 * - "Marked as printed" — only when print metadata carries a last-printed
 *   timestamp (the current backend never populates it, so it stays hidden).
 * If a future backend starts returning `audit_trail` events, they render
 * verbatim — no invented data either way.
 */
import type { ReceiptAuditSummary, ReceiptRead } from '../types/billing';

export interface ReceiptAuditTimelineItem {
  /** Event title, e.g. "Receipt generated". */
  title: string;
  /** Actor + optional reason, e.g. "Dana Whitfield". */
  actor: string | null;
  /** ISO datetime for the muted timestamp. */
  timestamp: string;
  /** Green fill for completed events. */
  completed?: boolean;
}

/** Build the ordered audit timeline for a receipt. */
export function buildReceiptAuditTimeline(receipt: ReceiptRead): ReceiptAuditTimelineItem[] {
  const items: ReceiptAuditTimelineItem[] = [
    {
      title: 'Receipt generated',
      actor: receipt.creator?.full_name ?? null,
      timestamp: receipt.created_at,
      completed: true,
    },
  ];

  const lastPrintedAt = receipt.print_metadata?.last_printed_at;
  if (lastPrintedAt) {
    items.push({
      title: 'Marked as printed',
      actor: receipt.print_metadata?.printed_by != null ? `User #${receipt.print_metadata.printed_by}` : null,
      timestamp: lastPrintedAt,
      completed: true,
    });
  }

  // A future backend populating the real audit trail renders it verbatim.
  if (Array.isArray(receipt.audit_trail) && receipt.audit_trail.length > 0) {
    return receipt.audit_trail.map((event: ReceiptAuditSummary) => ({
      title: event.action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      actor: event.performed_by?.full_name ?? null,
      timestamp: event.occurred_at,
      completed: true,
    }));
  }

  return items;
}
