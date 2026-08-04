import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { useAuth } from '../../hooks/auth/useAuth';
import type { AuthContextValue } from './authContext';

// Keep the real authService implementation for `getMe` (it calls the real
// `api` instance) so the 401 integration test can exercise the global
// response interceptor end-to-end. Individual methods are still overridable
// via vi.mocked(...).mockResolvedValue(...) in each test.
// NOTE: any test that invokes a method WITHOUT setting a mock first will
// call the real `api` instance (network). Always set mockResolvedValue /
// mockRejectedValue before triggering a request.
vi.mock('../../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/authService')>();
  return {
    authService: {
      login: vi.fn(actual.authService.login),
      getMe: vi.fn(actual.authService.getMe),
      register: vi.fn(actual.authService.register),
      fetchPendingUsers: vi.fn(actual.authService.fetchPendingUsers),
      approveUser: vi.fn(actual.authService.approveUser),
      deactivateUser: vi.fn(actual.authService.deactivateUser),
    },
  };
});

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../../services/api';
import { authService } from '../../services/authService';

const loginMock = vi.mocked(authService.login);
const getMeMock = vi.mocked(authService.getMe);

const currentUser = {
  id: 1,
  full_name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  status: 'active' as const,
};

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  let captured: AuthContextValue | null = null;

  function Consumer() {
    const auth = useAuth();
    captured = auth;
    return (
      <div>
        <span data-testid="authed">
          {auth.isAuthenticated ? 'true' : 'false'}
        </span>
        <span data-testid="user">{auth.user?.email ?? 'none'}</span>
        <button
          onClick={() => void auth.login('Juan@Example.com', 'Secret@1', true)}
        >
          Login
        </button>
        <button onClick={() => auth.logout()}>Logout</button>
      </div>
    );
  }

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return () => captured;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    loginMock.mockReset();
    getMeMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    api.defaults.adapter = undefined;
  });

  it('starts signed out when no token is stored', () => {
    renderProvider();

    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('auto-restores the session from a stored token (browser refresh)', async () => {
    localStorage.setItem('denscare_access_token', 'jwt-token');
    getMeMock.mockResolvedValue(currentUser);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('authed')).toHaveTextContent('true'),
    );
    expect(getMeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user')).toHaveTextContent('juan@example.com');
  });

  it('login normalises the email, persists the token, and loads the profile', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      access_token: 'jwt-token',
      token_type: 'bearer',
    });
    getMeMock.mockResolvedValue(currentUser);

    renderProvider();
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() =>
      expect(screen.getByTestId('authed')).toHaveTextContent('true'),
    );

    // Email is lowercased/trimmed before hitting the API.
    expect(loginMock).toHaveBeenCalledWith('juan@example.com', 'Secret@1');
    // remember_me=true → token persisted to localStorage.
    expect(localStorage.getItem('denscare_access_token')).toBe('jwt-token');
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
  });

  it('logout clears the token from storage and signs the user out', async () => {
    const user = userEvent.setup();
    localStorage.setItem('denscare_access_token', 'jwt-token');
    getMeMock.mockResolvedValue(currentUser);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed')).toHaveTextContent('true'),
    );

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login propagates API errors so forms can surface backend messages', async () => {
    loginMock.mockRejectedValue(new Error('Invalid email or password'));

    const getAuth = renderProvider();

    // The provider must rethrow so the login form can surface the message.
    await expect(
      getAuth()?.login('juan@example.com', 'Secret@1', true),
    ).rejects.toThrow('Invalid email or password');

    // No partial session is left behind.
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(localStorage.getItem('denscare_access_token')).toBeNull();
  });

  it('clears the session when the me query returns 401 (expired/invalid token)', async () => {
    // Seed a stale token. getMe delegates to the REAL authService → the real
    // `api` instance → the response interceptor fires, which invokes the
    // provider's registered unauthorized handler (clears storage + state).
    localStorage.setItem('denscare_access_token', 'expired-token');
    api.defaults.adapter = async (config) => {
      const response = {
        data: { success: false, message: 'Not authenticated' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: config as InternalAxiosRequestConfig,
      } as AxiosResponse;
      throw new AxiosError(
        'Request failed with status code 401',
        'ERR_BAD_REQUEST',
        config as InternalAxiosRequestConfig,
        undefined,
        response,
      );
    };

    renderProvider();

    // The 401 → interceptor → provider handler clears the session. Wait on
    // the side effect itself: 'authed' reads "false" both before the query
    // resolves (token set, user null) and after the handler runs, so it
    // cannot be used to detect that the handler actually executed.
    await waitFor(() =>
      expect(localStorage.getItem('denscare_access_token')).toBeNull(),
    );
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
