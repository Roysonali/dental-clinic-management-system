import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../context/auth/AuthProvider';
import { Header } from './Header';

vi.mock('../../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getMe: vi.fn(),
    register: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

import { authService } from '../../../services/authService';

const getMeMock = vi.mocked(authService.getMe);

function renderHeader(props: Partial<Parameters<typeof Header>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Header
            pageTitle="Patients"
            onToggleSidebar={vi.fn()}
            onOpenCommandPalette={vi.fn()}
            {...props}
          />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Header — enterprise global header (Task 2)', () => {
  beforeEach(() => {
    getMeMock.mockReset();
    getMeMock.mockResolvedValue({
      id: 1,
      full_name: 'Dr. Maria Santos',
      email: 'maria@denscare.clinic',
      status: 'active',
    });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('denscare_access_token', 'jwt-token');
  });

  it('renders the DensCare branding block (logo + wordmark) as the left section', () => {
    renderHeader();

    const header = screen.getByLabelText('App header');
    // The shared Logo renders the "Dens" + "Care" wordmark (desktop variant).
    expect(within(header).getAllByText('Dens').length).toBeGreaterThan(0);
    expect(within(header).getAllByText('Care').length).toBeGreaterThan(0);
  });

  it('renders the dynamic page title from the current route', () => {
    renderHeader({ pageTitle: 'Invoices' });
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('renders sidebar toggle, global search, notifications and user profile', async () => {
    renderHeader();

    // Sidebar toggle (opens the drawer / collapses the sidebar).
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();

    // Global search trigger — desktop input-style control + mobile icon.
    const searchButtons = screen.getAllByRole('button', { name: 'Open search' });
    expect(searchButtons.length).toBeGreaterThan(0);
    // The desktop control carries the "Search" placeholder + ⌘K shortcut.
    expect(screen.getByText('Search')).toBeInTheDocument();

    // Notification bell with an accessible name.
    expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();

    // User profile driven by the authenticated session.
    expect(await screen.findByRole('button', { name: /Dr\. Maria Santos/ })).toBeInTheDocument();
  });

  it('keeps the sidebar toggle in the header for all pages', () => {
    const onToggleSidebar = vi.fn();
    renderHeader({ onToggleSidebar });
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
