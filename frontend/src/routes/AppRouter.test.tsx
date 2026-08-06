import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppRouter from './AppRouter';
import { createTestQueryClient } from '../test/testUtils';

// AppShell's responsive hooks (useMediaQuery) require matchMedia, which the
// jsdom test environment does not provide — stub it for the full-app render.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
import { ROLES, ADMIN_ROLES } from '../constants/roles';
import type { AuthContextValue } from '../context/auth/authContext';
import type { Permission } from '../hooks/rbac/usePermission';

const authMock: AuthContextValue = {
  token: 'token',
  user: { id: 3, full_name: 'Dr. Jose Rizal', email: 'jose@clinic.com', status: 'active' },
  isAuthenticated: true,
  isInitializing: false,
  login: vi.fn(async () => {}),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

const permissionMock: { value: Permission } = {
  value: {
    state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
    isAdmin: true,
    isResolved: true,
    role: ROLES.ADMIN,
    can: vi.fn(() => true),
  },
};

vi.mock('../hooks/auth/useAuth', () => ({
  useAuth: () => authMock,
}));

vi.mock('../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock.value,
}));

vi.mock('../services/userService', () => ({
  userService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 }),
    get: vi.fn(),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    fetchPendingUsers: vi.fn().mockResolvedValue([]),
    register: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

vi.mock('../services/appointmentService', () => ({
  appointmentService: {
    today: vi.fn().mockResolvedValue([]),
  },
}));

function renderApp(route: string) {
  // AppRouter renders its own BrowserRouter — drive the URL directly. The
  // QueryClientProvider (normally in App.tsx) is provided here because the
  // wrapped pages use React Query hooks.
  window.history.pushState({}, '', route);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppRouter />
    </QueryClientProvider>,
  );
}

function setNonAdmin() {
  permissionMock.value = {
    state: { status: 'non-admin', role: null },
    isAdmin: false,
    isResolved: true,
    role: null,
    can: vi.fn(() => false),
  };
}

function setAdmin() {
  permissionMock.value = {
    state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
    isAdmin: true,
    isResolved: true,
    role: ROLES.ADMIN,
    can: vi.fn(() => true),
  };
}

describe('AppRouter — protected-route role enforcement (Sprint 11C)', () => {
  beforeEach(() => {
    setAdmin();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('redirects a non-admin away from the Users list to the dashboard', () => {
    setNonAdmin();
    renderApp('/users');

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('lets an admin into the Users list', () => {
    renderApp('/users');

    // Page-subtitle marker unique to the Users page (the sidebar always
    // renders a Dashboard link, so it cannot be used for absence checks).
    expect(
      screen.getByText('Search, filter and manage user accounts.'),
    ).toBeInTheDocument();
  });

  it('redirects a non-admin away from pending approvals to the dashboard', () => {
    setNonAdmin();
    renderApp('/admin/users/pending');

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pending Approvals')).not.toBeInTheDocument();
  });

  it('lets an admin into the pending approvals screen', () => {
    renderApp('/admin/users/pending');

    expect(screen.getAllByText('Pending Approvals').length).toBeGreaterThan(0);
  });

  it('keeps shared routes open for non-admin roles (no over-gating)', () => {
    setNonAdmin();
    renderApp('/patients');

    expect(screen.getAllByText('Patients').length).toBeGreaterThan(0);
  });

  it('keeps the admin group consistent with the route policy map', () => {
    expect(ADMIN_ROLES).toEqual(['ADMIN', 'CHIEF_DOCTOR']);
  });
});
