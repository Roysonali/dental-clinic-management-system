import { describe, it, expect } from 'vitest';
import { buildRefundTimeline, type RefundTimelineItem } from '../../../utils/refundTimeline';
import type { RefundRead, RefundStatus } from '../../../types/billing';

const creator = { id: 1, full_name: 'Dana Whitfield' };
const reviewer = { id: 2, full_name: 'Dr. Priya Raman' };

function makeRefund(status: RefundStatus): RefundRead {
  return {
    id: 'rfd1',
    refund_number: 'RFD-00114',
    document_type: 'refund',
    status,
    patient: { id: 'p1', patient_code: 'PT-00504', full_name: 'Amara Okonkwo', is_active: true },
    payment: {
      id: 'pay1',
      payment_number: 'PAY-00869',
      payment_method: 'bank_transfer',
      total_amount: '1500.00',
      payment_date: '2026-07-09',
      currency_code: 'INR',
    },
    invoices: [],
    creator,
    updater: status === 'completed' ? creator : null,
    reviewer: status === 'approved' || status === 'completed' || status === 'rejected' ? reviewer : null,
    amount: '250.00',
    reason: 'Duplicate transfer received for the same treatment session.',
    currency_code: 'INR',
    notes: null,
    rejection_reason: status === 'rejected' ? 'No duplicate payment found.' : null,
    reviewed_by: reviewer.id,
    reviewed_at: status === 'approved' || status === 'completed' ? '2026-07-11T09:40:00Z' : status === 'rejected' ? '2026-07-11T09:45:00Z' : null,
    financials: {
      currency_code: 'INR',
      refund_amount: '250.00',
      payment_total: '1500.00',
      remaining_on_payment: '1050.00',
      refund_count: 2,
    },
    gateway_metadata: null,
    document_metadata: {
      document_type: 'refund',
      sequence_number: null,
      issued_at: '2026-07-10T16:02:00Z',
      generated_at: '2026-07-10T16:02:00Z',
    },
    audit_trail: [],
    version: 1,
    doc_version: 1,
    created_at: '2026-07-10T16:02:00Z',
    created_by: 1,
    updated_at: status === 'completed' ? '2026-07-11T10:12:00Z' : '2026-07-10T16:02:00Z',
    updated_by: status === 'completed' ? creator.id : null,
  };
}

function titles(items: RefundTimelineItem[]): string[] {
  return items.map((i) => i.title);
}

describe('buildRefundTimeline', () => {
  it('shows Pending as the current event for a pending refund with hollow future states', () => {
    const items = buildRefundTimeline(makeRefund('pending'));
    expect(titles(items)).toEqual(['Pending — refund requested', 'Approved', 'Completed', 'Rejected']);
    expect(items[0].marker).toBe('current');
    expect(items[1].marker).toBe('future');
    expect(items[2].marker).toBe('future');
    expect(items[3].marker).toBe('future');
  });

  it('marks Pending completed and Approved current for an approved refund', () => {
    const items = buildRefundTimeline(makeRefund('approved'));
    expect(titles(items)).toEqual([
      'Pending — refund requested',
      'Approved',
      'Completed',
      'Rejected',
    ]);
    expect(items[0].marker).toBe('completed');
    expect(items[1].marker).toBe('current');
    expect(items[1].actor).toBe('Dr. Priya Raman');
    // Rejected is no longer possible — hollow "not applicable".
    expect(items[3].marker).toBe('future');
    expect(items[3].description).toContain('Not applicable');
  });

  it('shows the full green-completed progression plus the current Completed event for a completed refund', () => {
    const items = buildRefundTimeline(makeRefund('completed'));
    expect(titles(items)).toEqual([
      'Pending — refund requested',
      'Approved',
      'Completed — refund allocation created',
      'Rejected',
    ]);
    expect(items[0].marker).toBe('completed');
    expect(items[1].marker).toBe('completed');
    expect(items[2].marker).toBe('current');
    expect(items[3].marker).toBe('future');
    expect(items[3].description).toContain('Not applicable');
  });

  it('marks Rejected as the current danger event with the stored rejection reason for a rejected refund', () => {
    const items = buildRefundTimeline(makeRefund('rejected'));
    expect(titles(items)).toEqual([
      'Pending — refund requested',
      'Rejected',
      'Approved',
      'Completed',
    ]);
    expect(items[0].marker).toBe('completed');
    expect(items[1].marker).toBe('current-danger');
    expect(items[1].description).toBe('No duplicate payment found.');
    expect(items[2].marker).toBe('future');
    expect(items[3].marker).toBe('future');
  });

  it('never exposes a future action for terminal states (no impossible states)', () => {
    for (const status of ['rejected', 'completed'] as const) {
      const items = buildRefundTimeline(makeRefund(status));
      const futureActions = items.filter((i) => i.marker === 'future');
      // Every future entry is labelled "Not applicable".
      for (const item of futureActions) {
        expect(item.description).toContain('Not applicable');
      }
    }
  });
});
