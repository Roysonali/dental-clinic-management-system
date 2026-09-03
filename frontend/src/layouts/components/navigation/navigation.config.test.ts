import { describe, it, expect } from 'vitest';
import { ROLES } from '../../../constants/roles';
import { getNavGroups } from './navigation.config';

function itemIds(role?: Parameters<typeof getNavGroups>[0]): string[] {
  return getNavGroups(role).flatMap((g) => g.items.map((i) => i.id));
}

describe('getNavGroups — role-aware navigation (Sprint 11C)', () => {
  it('hides admin-only items when no role is resolved', () => {
    const ids = itemIds(null);

    expect(ids).toContain('dashboard');
    expect(ids).toContain('patients');
    expect(ids).not.toContain('users');
    expect(ids).not.toContain('pending-approvals');
  });

  it('hides admin-only items for a non-admin role', () => {
    const ids = itemIds(ROLES.GENERAL_DOCTOR);
    const receptionistIds = itemIds(ROLES.RECEPTIONIST);

    expect(ids).not.toContain('users');
    expect(ids).not.toContain('pending-approvals');
    expect(receptionistIds).not.toContain('users');
  });

  it('shows admin-only items for ADMIN and CHIEF_DOCTOR', () => {
    const adminIds = itemIds(ROLES.ADMIN);
    const chiefIds = itemIds(ROLES.CHIEF_DOCTOR);

    expect(adminIds).toContain('users');
    expect(adminIds).toContain('pending-approvals');
    expect(chiefIds).toContain('users');
    expect(chiefIds).toContain('pending-approvals');
  });

  it('keeps shared items visible for every role', () => {
    for (const role of [ROLES.ADMIN, ROLES.GENERAL_DOCTOR, ROLES.RECEPTIONIST]) {
      const ids = itemIds(role);
      expect(ids).toContain('dashboard');
      expect(ids).toContain('patients');
      expect(ids).toContain('doctors');
    }
  });

  it('hides Billing Dashboard for non-admin roles (revenue RBAC policy)', () => {
    // Revenue/financial analytics is ADMIN-only — the billing dashboard
    // nav item carries roles: REVENUE_READ_ROLES (ADMIN only).
    expect(itemIds(null)).not.toContain('billing');
    expect(itemIds(ROLES.GENERAL_DOCTOR)).not.toContain('billing');
    expect(itemIds(ROLES.RECEPTIONIST)).not.toContain('billing');
    expect(itemIds(ROLES.DENTAL_ASSISTANT)).not.toContain('billing');
    expect(itemIds(ROLES.CHIEF_DOCTOR)).not.toContain('billing');
  });

  it('shows Billing Dashboard only for ADMIN', () => {
    expect(itemIds(ROLES.ADMIN)).toContain('billing');
  });

  it('keeps Invoices and Payments visible for all roles (operational billing)', () => {
    for (const role of [ROLES.ADMIN, ROLES.GENERAL_DOCTOR, ROLES.RECEPTIONIST]) {
      const ids = itemIds(role);
      expect(ids).toContain('invoices');
      expect(ids).toContain('payments');
    }
  });

  it('never drops every group (dashboard group always survives)', () => {
    expect(itemIds(null).length).toBeGreaterThan(0);
    expect(itemIds(ROLES.ADMIN).length).toBeGreaterThan(0);
  });

  it('keeps disabled placeholder items visible to all roles', () => {
    const ids = itemIds(ROLES.RECEPTIONIST);
    expect(ids).toContain('inventory');
    expect(ids).toContain('reports');
  });

  it('does not mutate the shared NAV_GROUPS configuration', () => {
    getNavGroups(ROLES.ADMIN);
    getNavGroups(null);

    // Re-running with no role still hides admin items → config untouched.
    expect(itemIds(null)).not.toContain('users');
    expect(itemIds(ROLES.ADMIN)).toContain('users');
  });
});
