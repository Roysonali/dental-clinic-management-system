import { describe, it, expect } from 'vitest';
import { ROLES, ADMIN_ROLES } from './roles';
import { isRoleName, roleMeetsRequirement, RBAC_CURRENT_ROLE_STALE_TIME_MS } from './rbac';

describe('isRoleName', () => {
  it('accepts every canonical role name', () => {
    for (const role of Object.values(ROLES)) {
      expect(isRoleName(role)).toBe(true);
    }
  });

  it('rejects unknown, null and non-string values', () => {
    expect(isRoleName('SUPER_ADMIN')).toBe(false);
    expect(isRoleName('')).toBe(false);
    expect(isRoleName(null)).toBe(false);
    expect(isRoleName(undefined)).toBe(false);
  });
});

describe('roleMeetsRequirement', () => {
  it('returns true when the role is in the required list', () => {
    expect(roleMeetsRequirement(ROLES.ADMIN, ADMIN_ROLES)).toBe(true);
    expect(roleMeetsRequirement(ROLES.CHIEF_DOCTOR, ADMIN_ROLES)).toBe(true);
    expect(roleMeetsRequirement(ROLES.RECEPTIONIST, [ROLES.RECEPTIONIST, ROLES.ADMIN])).toBe(true);
  });

  it('returns false for a role outside the required list', () => {
    expect(roleMeetsRequirement(ROLES.GENERAL_DOCTOR, ADMIN_ROLES)).toBe(false);
    expect(roleMeetsRequirement(ROLES.ADMIN, [ROLES.RECEPTIONIST])).toBe(false);
  });

  it('returns false when the role is unknown', () => {
    expect(roleMeetsRequirement(null, ADMIN_ROLES)).toBe(false);
    expect(roleMeetsRequirement(undefined, ADMIN_ROLES)).toBe(false);
  });

  it('returns false for an empty requirement list (nothing satisfies nothing)', () => {
    expect(roleMeetsRequirement(ROLES.ADMIN, [])).toBe(false);
  });
});

describe('RBAC_CURRENT_ROLE_STALE_TIME_MS', () => {
  it('is a positive, sane stale window', () => {
    expect(RBAC_CURRENT_ROLE_STALE_TIME_MS).toBeGreaterThan(0);
    expect(RBAC_CURRENT_ROLE_STALE_TIME_MS).toBe(5 * 60_000);
  });
});
