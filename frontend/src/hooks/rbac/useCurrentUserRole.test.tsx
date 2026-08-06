import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AuthContext, type AuthContextValue } from '../../context/auth/authContext';
import { userService } from '../../services/userService';
import { useCurrentUserRole } from './useCurrentUserRole';
import type { CurrentUserResponse, UserStatus } from '../../types/auth';
import type { UserDetailResponse } from '../../types/user';

vi.mock('../../services/userService', () => ({
  userService: { get: vi.fn() },
}));

const getMock = vi.mocked(userService.get);

const makeAuth = (user: CurrentUserResponse | null): AuthContextValue => ({
  token: user ? 'token' : null,
  user,
  isAuthenticated: user != null,
  isInitializing: false,
  login: vi.fn(async () => {}),
  logout: vi.fn(),
  refreshUser: vi.fn(),
});

const me = (id: number): CurrentUserResponse => ({
  id,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
});

const detail = (roleId: number, roleName: string): UserDetailResponse => ({
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active' as UserStatus,
  is_active: true,
  role_id: roleId,
  role_name: roleName,
  last_login_at: null,
  created_by: 1,
  created_at: null,
  updated_at: null,
  updated_by: null,
});

function renderState(user: CurrentUserResponse | null) {
  function Harness() {
    const state = useCurrentUserRole();
    return <div data-testid="state">{state.status}</div>;
  }
  return renderWithProviders(
    <AuthContext.Provider value={makeAuth(user)}>
      <Harness />
    </AuthContext.Provider>,
  );
}

describe('useCurrentUserRole', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('reports admin with the resolved role when GET /users/{id} succeeds', async () => {
    getMock.mockResolvedValue(detail(2, 'CHIEF_DOCTOR'));

    renderState(me(3));

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('admin');
    });
    expect(getMock).toHaveBeenCalledWith(3);
  });

  it('reports non-admin when the self-probe returns 403 (admin-only endpoint)', async () => {
    getMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Insufficient permissions' } },
    });

    renderState(me(3));

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('non-admin');
    });
  });

  it('reports unknown for non-403 failures (fail-open on transient errors)', async () => {
    getMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'boom' } },
    });

    renderState(me(3));

    // `shouldRetryQuery` allows one retry for non-403 failures (with the
    // default 1s backoff), so allow the final error state to settle.
    await waitFor(
      () => {
        expect(screen.getByTestId('state')).toHaveTextContent('unknown');
      },
      { timeout: 4000 },
    );
  });

  it('never fires the probe without a resolved user id (loading instead)', async () => {
    renderState(null);

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('does not throw when rendered outside an AuthProvider (conservative unknown)', () => {
    function OutsideHarness() {
      const state = useCurrentUserRole();
      return <span data-testid="outside">{state.status}</span>;
    }

    renderWithProviders(<OutsideHarness />);

    expect(screen.getByTestId('outside')).toHaveTextContent('unknown');
  });
});
