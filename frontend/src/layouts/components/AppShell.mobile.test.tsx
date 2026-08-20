import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { createTestQueryClient } from '../../test/testUtils';
import { ROLES } from '../../constants/roles';

const authMock = {
  token: 'token',
  user: { id: 3, full_name: 'Dr. Jose Rizal', email: 'jose@clinic.com', status: 'active' },
  isAuthenticated: true,
  isInitializing: false,
  login: vi.fn(async () => {}),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('../../hooks/auth/useAuth', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../hooks/rbac/usePermission', () => ({
  usePermission: () => ({
    state: { status: 'admin', role: { role_id: 1, role_name: ROLES.ADMIN } },
    isAdmin: true,
    isResolved: true,
    role: ROLES.ADMIN,
    can: vi.fn(() => true),
  }),
}));

vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 }),
    get: vi.fn(),
  },
}));

vi.mock('../../services/authService', () => ({
  authService: {
    fetchPendingUsers: vi.fn().mockResolvedValue([]),
    register: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

vi.mock('../../services/appointmentService', () => ({
  appointmentService: {
    today: vi.fn().mockResolvedValue([]),
  },
}));

/** Force the mobile breakpoint so the global header hamburger opens the drawer. */
function stubMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderShell() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AppShell>
                <div>
                  <p>Dashboard content</p>
                  <input placeholder="Search the dashboard" />
                </div>
              </AppShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell — mobile navigation drawer overlay (Patient Records overlay bug)', () => {
  beforeEach(() => {
    stubMobileViewport();
  });

  it('opens the drawer ABOVE the page content with an inert main area behind it', () => {
    renderShell();

    // Global header hamburger (the /dashboard route keeps the global header).
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    // The drawer dialog is present and the hamburger reports it open.
    expect(screen.getByRole('dialog', { name: 'Navigation drawer' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The main area (containing the Workspace) is inert while the drawer is
    // open — underlying controls cannot be focused, clicked or scrolled.
    const mainContent = screen.getByLabelText('Main content');
    expect(mainContent.closest('[inert]')).not.toBeNull();
  });

  it('bounds the sidebar nav to the drawer height so the nav list is the scroll container', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    const dialog = screen.getByRole('dialog', { name: 'Navigation drawer' });
    // The Sidebar nav must be bounded to the drawer's viewport height
    // (h-full). Without this it grows to its full content height inside the
    // drawer's column flex layout, so the navigation area's flex-1
    // overflow-y-auto never becomes scrollable and lower items are cut off.
    expect(within(dialog).getByRole('navigation', { name: 'Sidebar navigation' })).toHaveClass('h-full');
  });

  it('restores interaction and clears aria-expanded when the drawer closes (Escape)', () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });

    fireEvent.click(toggle);
    const dialog = screen.getByRole('dialog', { name: 'Navigation drawer' });
    expect(dialog).toBeInTheDocument();

    // Dispatch on a real element (the Drawer listens on document via
    // bubbling; the global shortcut handler needs a tagName target).
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Navigation drawer' })).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Main content').closest('[inert]')).toBeNull();
  });

  it('closes the drawer from the backdrop', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.getByRole('dialog', { name: 'Navigation drawer' })).toBeInTheDocument();

// Backdrop is the aria-hidden first child of the drawer wrapper
    // (fireEvent does not hit-test, so click it directly).
    const wrapper = screen.getByRole('presentation');
    const backdrop = wrapper.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(screen.queryByRole('dialog', { name: 'Navigation drawer' })).not.toBeInTheDocument();
  });
});
