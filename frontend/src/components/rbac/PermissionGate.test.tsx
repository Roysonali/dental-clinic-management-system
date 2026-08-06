import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from './PermissionGate';
import { ROLES, ADMIN_ROLES } from '../../constants/roles';
import type { Permission } from '../../hooks/rbac/usePermission';

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

function setPermission(overrides: Partial<Permission>) {
  permissionMock.value = {
    state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
    isAdmin: true,
    isResolved: true,
    role: ROLES.ADMIN,
    can: vi.fn(() => true),
    ...overrides,
  };
}

describe('PermissionGate', () => {
  beforeEach(() => {
    setPermission({});
  });

  it('renders children when the role is allowed', () => {
    render(
      <PermissionGate requiredRoles={ADMIN_ROLES}>
        <button>Deactivate</button>
      </PermissionGate>,
    );

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('renders nothing when denied in the default hide mode', () => {
    setPermission({ can: vi.fn(() => false) });

    render(
      <PermissionGate requiredRoles={ADMIN_ROLES}>
        <button>Deactivate</button>
      </PermissionGate>,
    );

    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('renders the fallback instead of nothing when denied in hide mode', () => {
    setPermission({ can: vi.fn(() => false) });

    render(
      <PermissionGate requiredRoles={ADMIN_ROLES} fallback={<span>Locked</span>}>
        <button>Deactivate</button>
      </PermissionGate>,
    );

    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('renders the control disabled when denied in disable mode', () => {
    setPermission({ can: vi.fn(() => false) });

    render(
      <PermissionGate requiredRoles={ADMIN_ROLES} mode="disable">
        <button>Deactivate</button>
      </PermissionGate>,
    );

    const button = screen.getByRole('button', { name: 'Deactivate' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('leaves children untouched when allowed in disable mode', () => {
    render(
      <PermissionGate requiredRoles={ADMIN_ROLES} mode="disable">
        <button>Deactivate</button>
      </PermissionGate>,
    );

    expect(screen.getByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });

  it('falls back to rendering nothing for non-element children in disable mode', () => {
    setPermission({ can: vi.fn(() => false) });

    // A string child cannot be cloned with `disabled` → falls back to null.
    render(
      <PermissionGate requiredRoles={ADMIN_ROLES} mode="disable">
        {'Deactivate'}
      </PermissionGate>,
    );

    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });

  it('denies conservatively while the role is unresolved', () => {
    setPermission({
      state: { status: 'loading', role: null },
      isAdmin: false,
      isResolved: false,
      role: null,
      can: vi.fn(() => false),
    });

    render(
      <PermissionGate requiredRoles={ADMIN_ROLES}>
        <button>Deactivate</button>
      </PermissionGate>,
    );

    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('denies non-admin-only requirements even for a proven admin', () => {
    setPermission({ can: vi.fn(() => false) });

    render(
      <PermissionGate requiredRoles={[ROLES.RECEPTIONIST]}>
        <button>Register</button>
      </PermissionGate>,
    );

    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });
});
