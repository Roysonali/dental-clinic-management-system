import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../context/auth/AuthProvider';
import { HeaderRight } from './HeaderRight';

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

const currentUser = {
  id: 1,
  full_name: 'Dr. Maria Santos',
  email: 'maria@denscare.clinic',
  status: 'active' as const,
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

function renderHeaderRight() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HeaderRight />
          <LocationProbe />
        </AuthProvider>
      </QueryClientProvider>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/auth/login" element={<div>Sign in</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HeaderRight', () => {
  beforeEach(() => {
    getMeMock.mockReset();
    getMeMock.mockResolvedValue(currentUser);
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('denscare_access_token', 'jwt-token');
  });

  it('renders the authenticated user name from the session', async () => {
    renderHeaderRight();

    expect(await screen.findByText('Dr. Maria Santos')).toBeInTheDocument();
  });

  it('opens the user menu and shows the email, Settings, Help and Sign out', async () => {
    const user = userEvent.setup();
    renderHeaderRight();

    await screen.findByText('Dr. Maria Santos');
    await user.click(screen.getByRole('button', { name: /Dr\. Maria Santos/ }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('maria@denscare.clinic')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('signs out: clears the persisted session and redirects to the login page', async () => {
    const user = userEvent.setup();
    renderHeaderRight();

    await screen.findByText('Dr. Maria Santos');
    await user.click(screen.getByRole('button', { name: /Dr\. Maria Santos/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    // Session cleared from both storage tiers.
    await waitFor(() => {
      expect(localStorage.getItem('denscare_access_token')).toBeNull();
      expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    });

    // Redirected to the login page.
    expect(screen.getByTestId('current-path')).toHaveTextContent('/auth/login');
  });

  it('removes the user identity from the header after logout', async () => {
    const user = userEvent.setup();
    renderHeaderRight();

    await screen.findByText('Dr. Maria Santos');
    await user.click(screen.getByRole('button', { name: /Dr\. Maria Santos/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.queryByText('Dr. Maria Santos')).not.toBeInTheDocument();
    });
  });
});
