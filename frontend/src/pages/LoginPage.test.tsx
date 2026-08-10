import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockAuth = {
  token: null,
  user: null,
  isAuthenticated: false,
  isInitializing: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('../hooks/auth/useAuth', () => ({
  useAuth: () => mockAuth,
}));

function renderLoginPage(initialEntries = ['/auth/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/patients" element={<div>Patients</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitCredentials(email = 'juan@example.com', password = 'Secret@1') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Email address/), email);
  await user.type(screen.getByLabelText(/Password/), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockAuth.login.mockReset();
    mockAuth.login.mockResolvedValue(undefined);
  });

  it('submits credentials to the auth provider and redirects to the dashboard', async () => {
    renderLoginPage();

    await submitCredentials();

    await waitFor(() =>
      expect(mockAuth.login).toHaveBeenCalledWith(
        'juan@example.com',
        'Secret@1',
        false,
      ),
    );
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('redirects to the originally requested route after login', async () => {
    renderLoginPage(['/auth/login']);

    await submitCredentials();

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('passes remember_me=true to login when "Keep me signed in" is checked', async () => {
    renderLoginPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email address/), 'juan@example.com');
    await user.type(screen.getByLabelText(/Password/), 'Secret@1');
    await user.click(
      screen.getByRole('checkbox', { name: /keep me signed in/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(mockAuth.login).toHaveBeenCalledWith(
        'juan@example.com',
        'Secret@1',
        true,
      ),
    );
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('surfaces backend error messages when login fails', async () => {
    mockAuth.login.mockRejectedValue(new Error('Invalid email or password'));
    renderLoginPage();

    await submitCredentials('juan@example.com', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
    // Still on the login page.
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps the submit button disabled until the form is valid', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
