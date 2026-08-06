import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ROLES, ADMIN_ROLES } from '../../constants/roles';
import { buildPermission, usePermission } from './usePermission';
import { AuthContext, type AuthContextValue } from '../../context/auth/authContext';
import { userService } from '../../services/userService';
import { renderWithProviders } from '../../test/testUtils';
import type { CurrentUserResponse } from '../../types/auth';

vi.mock('../../services/userService', () => ({
  userService: { get: vi.fn() },
}));

const adminState = {
  status: 'admin' as const,
  role: { role_id: 1, role_name: 'ADMIN' },
};

const chiefState = {
  status: 'admin' as const,
  role: { role_id: 2, role_name: 'CHIEF_DOCTOR' },
};

const unknownRoleNameState = {
  status: 'admin' as const,
  role: { role_id: 1, role_name: 'SOME_FUTURE_ROLE' },
};

const nonAdminState = { status: 'non-admin' as const, role: null };
const unknownState = { status: 'unknown' as const, role: null };
const loadingState = { status: 'loading' as const, role: null };

describe('buildPermission', () => {
  it('exposes admin identity and role for a proven admin', () => {
    const p = buildPermission(adminState);
    expect(p.isAdmin).toBe(true);
    expect(p.isResolved).toBe(true);
    expect(p.role).toBe(ROLES.ADMIN);
  });

  it('resolves a chief doctor role', () => {
    const p = buildPermission(chiefState);
    expect(p.isAdmin).toBe(true);
    expect(p.role).toBe(ROLES.CHIEF_DOCTOR);
  });

  it('falls back to ADMIN for a proven admin with an unrecognised role_name', () => {
    // A 200 on the admin-only probe proves admin membership; an unknown
    // role string must not lock the user out of admin surfaces.
    const p = buildPermission(unknownRoleNameState);
    expect(p.isAdmin).toBe(true);
    expect(p.role).toBe(ROLES.ADMIN);
  });

  it('denies everything for a known non-admin', () => {
    const p = buildPermission(nonAdminState);
    expect(p.isAdmin).toBe(false);
    expect(p.role).toBeNull();
    expect(p.can(ADMIN_ROLES)).toBe(false);
    expect(p.can([ROLES.RECEPTIONIST])).toBe(false);
  });

  it('is unresolved while loading, denies everything', () => {
    const p = buildPermission(loadingState);
    expect(p.isResolved).toBe(false);
    expect(p.can(ADMIN_ROLES)).toBe(false);
  });

  it('fails closed on unknown resolution state (availability over security)', () => {
    const p = buildPermission(unknownState);
    expect(p.isAdmin).toBe(false);
    expect(p.can(ADMIN_ROLES)).toBe(false);
  });

  describe('can() — backend require_roles equivalence', () => {
    it('passes admin-only requirements for an admin', () => {
      expect(buildPermission(adminState).can(ADMIN_ROLES)).toBe(true);
      expect(buildPermission(chiefState).can(ADMIN_ROLES)).toBe(true);
    });

    it('passes mixed requirements that include an admin role (backend semantics)', () => {
      expect(buildPermission(adminState).can([ROLES.ADMIN, ROLES.RECEPTIONIST])).toBe(true);
    });

    it('denies requirements satisfied only by non-admin roles', () => {
      expect(buildPermission(adminState).can([ROLES.RECEPTIONIST])).toBe(false);
      expect(buildPermission(adminState).can([ROLES.GENERAL_DOCTOR])).toBe(false);
    });

    it('denies an empty requirement list', () => {
      expect(buildPermission(adminState).can([])).toBe(false);
    });
  });
});

describe('usePermission (hook wiring)', () => {
  it('derives admin permissions from a successful probe', async () => {
    vi.mocked(userService.get).mockResolvedValue({
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active',
      is_active: true,
      role_id: 1,
      role_name: 'ADMIN',
      last_login_at: null,
      created_by: 1,
      created_at: null,
      updated_at: null,
      updated_by: null,
    });

    const user: CurrentUserResponse = {
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active',
    };
    const authValue: AuthContextValue = {
      token: 'token',
      user,
      isAuthenticated: true,
      isInitializing: false,
      login: vi.fn(async () => {}),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    function Harness() {
      const p = usePermission();
      return <span data-testid="perm">{`${p.isAdmin}:${p.role}:${p.can(ADMIN_ROLES)}`}</span>;
    }

    renderWithProviders(
      <AuthContext.Provider value={authValue}>
        <Harness />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('perm')).toHaveTextContent('true:ADMIN:true');
    });
  });
});
