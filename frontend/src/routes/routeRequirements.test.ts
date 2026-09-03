import { describe, it, expect } from 'vitest';
import { ROUTES } from './routes';
import { ADMIN_ROLES, REVENUE_READ_ROLES } from '../constants/roles';
import { ROUTE_ROLE_REQUIREMENTS, routeRequiresRole } from './routeRequirements';

describe('ROUTE_ROLE_REQUIREMENTS', () => {
  it('requires admin roles for the Users list and detail routes', () => {
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.USERS]).toEqual(ADMIN_ROLES);
    expect(ROUTE_ROLE_REQUIREMENTS[`${ROUTES.USERS}/:userId`]).toEqual(ADMIN_ROLES);
  });

  it('requires admin roles for the pending-approvals route', () => {
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.ADMIN.PENDING_USERS]).toEqual(ADMIN_ROLES);
  });

  it('requires revenue-read roles for the billing dashboard route', () => {
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.BILLING]).toEqual(REVENUE_READ_ROLES);
  });

  it('leaves open routes the backend allows for non-admin roles', () => {
    // Only the backend-restricted admin surfaces may be listed — the
    // frontend must not lock out roles the backend permits.
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.DASHBOARD]).toBeUndefined();
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.PATIENTS]).toBeUndefined();
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.DOCTORS]).toBeUndefined();
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.APPOINTMENTS]).toBeUndefined();
    // Invoice and payment routes are NOT admin-only — operational billing.
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.BILLING_INVOICES]).toBeUndefined();
    expect(ROUTE_ROLE_REQUIREMENTS[ROUTES.BILLING_PAYMENTS]).toBeUndefined();
  });
});

describe('routeRequiresRole', () => {
  it('returns the required roles for a restricted path', () => {
    expect(routeRequiresRole(ROUTES.USERS)).toEqual(ADMIN_ROLES);
    expect(routeRequiresRole(ROUTES.ADMIN.PENDING_USERS)).toEqual(ADMIN_ROLES);
    expect(routeRequiresRole(ROUTES.BILLING)).toEqual(REVENUE_READ_ROLES);
  });

  it('returns undefined for unrestricted paths', () => {
    expect(routeRequiresRole(ROUTES.DASHBOARD)).toBeUndefined();
    expect(routeRequiresRole(ROUTES.BILLING_INVOICES)).toBeUndefined();
    expect(routeRequiresRole(ROUTES.BILLING_PAYMENTS)).toBeUndefined();
    expect(routeRequiresRole('/unknown')).toBeUndefined();
  });
});
