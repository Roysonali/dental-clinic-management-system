import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppRouter from './AppRouter';
import { createTestQueryClient } from '../test/testUtils';
import { ROLES } from '../constants/roles';
import type { AuthContextValue } from '../context/auth/authContext';
import type { Permission } from '../hooks/rbac/usePermission';

// AppShell's responsive hooks (useMediaQuery) require matchMedia — stub it.
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

// Services consumed by the Dashboard, Users, Appointments and the lazy
// Treatment Plan / Procedure pages — all resolve empty so the tests verify
// ROUTING (not data) and the pages still render their chrome.
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
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10, total_pages: 0 }),
  },
}));

vi.mock('../services/treatmentPlanService', () => ({
  treatmentPlanService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    getDashboard: vi.fn().mockResolvedValue({
      total_plans: 0,
      by_status: { draft: 0, under_review: 0, proposed: 0, rejected: 0, accepted: 0, in_progress: 0, on_hold: 0, completed: 0, cancelled: 0 },
      pending_review: 0,
      pending_approval: 0,
      pending_acknowledgment: 0,
      active_plans: 0,
    }),
    getPlan: vi.fn().mockRejectedValue(new Error('Request failed with status code 404')),
    listByDoctor: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5, total_pages: 0 }),
    searchPlans: vi.fn().mockResolvedValue([]),
    listPendingReview: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    listPendingApproval: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
  },
}));

vi.mock('../services/procedureService', () => ({
  procedureService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    search: vi.fn().mockResolvedValue([]),
    listActive: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
  },
}));

vi.mock('../services/doctorService', () => ({
  doctorService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    get: vi.fn().mockRejectedValue(new Error('Request failed with status code 404')),
    getByUserId: vi.fn().mockRejectedValue(new Error('Request failed with status code 404')),
  },
}));

vi.mock('../services/patientService', () => ({
  patientService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    get: vi.fn().mockRejectedValue(new Error('Request failed with status code 404')),
  },
}));

function renderApp(route: string) {
  window.history.pushState({}, '', route);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppRouter />
    </QueryClientProvider>,
  );
}

// The full suite runs many jsdom files in parallel (Windows), so lazy chunk
// loads + renders can exceed Testing Library's default 1 s wait — use a
// generous timeout for the async route assertions.
const WAIT_MS = 8000;

describe('Treatment module — navigation & routing (Sprint 12A.2)', () => {
  beforeEach(() => {
    permissionMock.value = {
      state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
      isAdmin: true,
      isResolved: true,
      role: ROLES.ADMIN,
      can: vi.fn(() => true),
    };
    authMock.isAuthenticated = true;
  });

  it('navigates away from the Dashboard when Treatment Plans is selected in the sidebar', async () => {
    renderApp('/dashboard');

    // Dashboard rendered first.
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: WAIT_MS })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');

    // Click the sidebar entry — must leave the Dashboard.
    fireEvent.click(screen.getByRole('link', { name: 'Treatment Plans' }));

    await waitFor(() => expect(window.location.pathname).toBe('/treatment-plans'), { timeout: WAIT_MS });
    // Page chrome for the lazy list page renders.
    expect(await screen.findByRole('heading', { name: 'Treatment Plans' }, { timeout: WAIT_MS })).toBeInTheDocument();
    expect(screen.getByText('Search, filter and manage patient treatment plans.')).toBeInTheDocument();
  });

  it('highlights the active sidebar item after navigation (aria-current)', async () => {
    renderApp('/treatment-plans');

    await waitFor(() => expect(window.location.pathname).toBe('/treatment-plans'), { timeout: WAIT_MS });
    const navLink = await screen.findByRole('link', { name: 'Treatment Plans' }, { timeout: WAIT_MS });
    await waitFor(() => expect(navLink).toHaveAttribute('aria-current', 'page'), { timeout: WAIT_MS });
  });

  it('supports direct URL access + refresh for /treatment-plans', async () => {
    renderApp('/treatment-plans');

    expect(await screen.findByRole('heading', { name: 'Treatment Plans' }, { timeout: WAIT_MS })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/treatment-plans');
  });

  it('resolves the detail route /treatment-plans/:planId', async () => {
    renderApp('/treatment-plans/plan-1');

    // The details container mounts for the matched route; with getPlan mocked
    // as 404 it renders the error ResultState (proves route match + guards).
    await waitFor(() => expect(window.location.pathname).toBe('/treatment-plans/plan-1'), { timeout: WAIT_MS });
    expect(
      await screen.findByRole('heading', { name: 'Treatment plan unavailable' }, { timeout: WAIT_MS }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Treatment Plans' })).toBeInTheDocument();
  });

  it('resolves the Procedure Catalog route /procedures', async () => {
    renderApp('/procedures');

    expect(await screen.findByRole('heading', { name: 'Procedure Catalog' }, { timeout: WAIT_MS })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/procedures');
  });

  it('navigates between Treatment Plans and the Dashboard via browser back/forward', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: WAIT_MS });

    fireEvent.click(screen.getByRole('link', { name: 'Treatment Plans' }));
    await waitFor(() => expect(window.location.pathname).toBe('/treatment-plans'), { timeout: WAIT_MS });

    // Back → dashboard.
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'), { timeout: WAIT_MS });
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: WAIT_MS })).toBeInTheDocument();

    // Forward → treatment plans again (chunk cached, immediate render).
    window.history.forward();
    await waitFor(() => expect(window.location.pathname).toBe('/treatment-plans'), { timeout: WAIT_MS });
    expect(await screen.findByRole('heading', { name: 'Treatment Plans' }, { timeout: WAIT_MS })).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from treatment routes to the login page', async () => {
    authMock.isAuthenticated = false;
    renderApp('/treatment-plans');

    await waitFor(() => expect(window.location.pathname).toBe('/auth/login'), { timeout: WAIT_MS });
  });

  it('opens Procedure Catalog from the Administration sidebar group', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: WAIT_MS });

    fireEvent.click(screen.getByRole('link', { name: 'Procedure Catalog' }));

    await waitFor(() => expect(window.location.pathname).toBe('/procedures'), { timeout: WAIT_MS });
    expect(await screen.findByRole('heading', { name: 'Procedure Catalog' }, { timeout: WAIT_MS })).toBeInTheDocument();
  });
});
