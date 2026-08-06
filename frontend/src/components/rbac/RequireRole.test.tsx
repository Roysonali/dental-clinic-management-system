import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireRole } from './RequireRole';
import { ROLES, ADMIN_ROLES } from '../../constants/roles';
import type { Permission } from '../../hooks/rbac/usePermission';

/**
 * Mutable permission mock — mirrors the `mockAuth` pattern used by the
 * route-guard tests. Each test sets the desired authorization surface.
 */
const permissionMock: { value: Permission } = {
  value: {
    state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
    isAdmin: true,
    isResolved: true,
    role: ROLES.ADMIN,
    can: vi.fn(() => true),
  },
};

vi.mock('../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock.value,
}));

function renderRequireRole(deniedFallback?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route
          element={
            <RequireRole
              requiredRoles={ADMIN_ROLES}
              deniedFallback={deniedFallback}
            />
          }
        >
          <Route path="/admin/users" element={<div>Users page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  beforeEach(() => {
    permissionMock.value = {
      state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
      isAdmin: true,
      isResolved: true,
      role: ROLES.ADMIN,
      can: vi.fn(() => true),
    };
  });

  it('renders the wrapped routes for a known admin with the role', () => {
    renderRequireRole();

    expect(screen.getByText('Users page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });

  it('redirects a known non-admin to the dashboard', () => {
    permissionMock.value = {
      state: { status: 'non-admin', role: null },
      isAdmin: false,
      isResolved: true,
      role: null,
      can: vi.fn(() => false),
    };

    renderRequireRole();

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Users page')).not.toBeInTheDocument();
  });

  it('redirects an admin who lacks the specific required role', () => {
    permissionMock.value = {
      state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
      isAdmin: true,
      isResolved: true,
      role: ROLES.ADMIN,
      can: vi.fn(() => false), // e.g. requiredRoles contains an unverifiable non-admin role
    };

    renderRequireRole();

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows the loader while the role probe is in flight', () => {
    permissionMock.value = {
      state: { status: 'loading', role: null },
      isAdmin: false,
      isResolved: false,
      role: null,
      can: vi.fn(() => false),
    };

    renderRequireRole();

    expect(
      screen.getByRole('status', { name: 'Checking your session' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Users page')).not.toBeInTheDocument();
  });

  it('fails open (renders children) when the role cannot be resolved', () => {
    // A transient probe failure must not lock an admin out — the backend
    // still enforces with 403.
    permissionMock.value = {
      state: { status: 'unknown', role: null },
      isAdmin: false,
      isResolved: true,
      role: null,
      can: vi.fn(() => false),
    };

    renderRequireRole();

    expect(screen.getByText('Users page')).toBeInTheDocument();
  });

  it('renders deniedFallback instead of redirecting when provided', () => {
    permissionMock.value = {
      state: { status: 'non-admin', role: null },
      isAdmin: false,
      isResolved: true,
      role: null,
      can: vi.fn(() => false),
    };

    renderRequireRole(<div>Insufficient permissions</div>);

    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });
});
