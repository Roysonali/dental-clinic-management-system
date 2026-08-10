import { describe, it, expect } from 'vitest';
import {
  getInvoiceActions,
  INVOICE_ACTION_LABELS,
  isDraftInvoice,
} from './invoiceStateMachine';

describe('invoiceStateMachine', () => {
  describe('getInvoiceActions — mirrors the backend state machine + router', () => {
    it('exposes issue / edit / cancel / delete on Draft', () => {
      // Backend INVOICE_TRANSITIONS: draft → issued | cancelled, plus the
      // router's PATCH (edit) and DELETE (admin-only) endpoints.
      expect(getInvoiceActions('draft')).toEqual(['issue', 'edit', 'cancel', 'delete']);
    });

    it('exposes only cancel on issued / partially_paid / overdue', () => {
      // Backend INVOICE_TRANSITIONS allow issued/partial/overdue → cancelled
      // via the cancel endpoint; no edit/issue/delete.
      expect(getInvoiceActions('issued')).toEqual(['cancel']);
      expect(getInvoiceActions('partially_paid')).toEqual(['cancel']);
      expect(getInvoiceActions('overdue')).toEqual(['cancel']);
    });

    it('exposes NO actions on paid (the only legal transition is void, and the router exposes no void endpoint)', () => {
      // Backend INVOICE_TRANSITIONS: paid → void only. routers/invoice.py has
      // no void endpoint, so a PAID invoice has no actionable lifecycle here.
      expect(getInvoiceActions('paid')).toEqual([]);
    });

    it('exposes NO actions on terminal statuses (cancelled / void)', () => {
      expect(getInvoiceActions('cancelled')).toEqual([]);
      expect(getInvoiceActions('void')).toEqual([]);
    });
  });

  describe('INVOICE_ACTION_LABELS', () => {
    it('labels every action id', () => {
      expect(INVOICE_ACTION_LABELS).toEqual({
        issue: 'Issue',
        edit: 'Edit',
        cancel: 'Cancel',
        delete: 'Delete',
      });
    });
  });

  describe('isDraftInvoice', () => {
    it('is true only for the draft status', () => {
      expect(isDraftInvoice('draft')).toBe(true);
      expect(isDraftInvoice('issued')).toBe(false);
      expect(isDraftInvoice('paid')).toBe(false);
      expect(isDraftInvoice('cancelled')).toBe(false);
    });
  });
});
