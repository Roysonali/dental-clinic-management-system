import { describe, it, expect } from 'vitest';
import { ROUTES } from './routes';
import { getRouteMeta } from './routeMeta';

describe('routeMeta — global header page titles', () => {
  it('maps every top-level module route to its enterprise title', () => {
    expect(getRouteMeta(ROUTES.DASHBOARD).title).toBe('Dashboard');
    expect(getRouteMeta(ROUTES.PATIENTS).title).toBe('Patients');
    expect(getRouteMeta(ROUTES.DOCTORS).title).toBe('Doctors');
    expect(getRouteMeta(ROUTES.APPOINTMENTS).title).toBe('Appointments');
    expect(getRouteMeta(ROUTES.TREATMENT_PLANS).title).toBe('Treatment Plans');
    expect(getRouteMeta(ROUTES.PATIENT_RECORDS).title).toBe('Patient Records');
    expect(getRouteMeta(ROUTES.BILLING).title).toBe('Billing Dashboard');
    expect(getRouteMeta(ROUTES.USERS).title).toBe('Users');
    expect(getRouteMeta(ROUTES.ADMIN.PENDING_USERS).title).toBe('Pending Approvals');
  });

  it('maps billing sub-routes to their own titles, not the parent module', () => {
    expect(getRouteMeta(ROUTES.BILLING_INVOICES).title).toBe('Invoices');
    expect(getRouteMeta(ROUTES.BILLING_PAYMENTS).title).toBe('Payments');
    expect(getRouteMeta(ROUTES.BILLING_CREDIT_NOTES).title).toBe('Credit Notes');
    expect(getRouteMeta(ROUTES.BILLING_RECEIPTS).title).toBe('Receipts');
    expect(getRouteMeta(ROUTES.BILLING_REFUNDS).title).toBe('Refunds');
  });

  it('resolves detail pages to their module title via prefix matching', () => {
    expect(getRouteMeta(`${ROUTES.PATIENTS}/123`).title).toBe('Patients');
    expect(getRouteMeta(`${ROUTES.PATIENT_RECORDS}/abc`).title).toBe('Patient Records');
    expect(getRouteMeta(`${ROUTES.BILLING_INVOICES}/42`).title).toBe('Invoices');
    expect(getRouteMeta(`${ROUTES.BILLING_PAYMENTS}/42`).title).toBe('Payments');
  });
});
