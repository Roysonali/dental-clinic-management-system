import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

const mockAuth = {
  isAuthenticated: false,
  isInitializing: false,
};

vi.mock('../hooks/auth/useAuth', () => ({
  useAuth: () => mockAuth,
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected content</div>} />
        </Route>
        <Route path="/auth/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPublicOnly() {
  return render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <Routes>
        <Route
          path="/auth/login"
          element={
            <PublicOnlyRoute>
              <div>Login page</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockAuth.isAuthenticated = false;
    mockAuth.isInitializing = false;
  });

  it('renders the protected content when authenticated', () => {
    mockAuth.isAuthenticated = true;

    renderProtected();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects to the login page when unauthenticated', () => {
    renderProtected();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is initialising', () => {
    mockAuth.isInitializing = true;
    mockAuth.isAuthenticated = false;

    renderProtected();

    expect(
      screen.getByRole('status', { name: 'Checking your session' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    mockAuth.isAuthenticated = false;
    mockAuth.isInitializing = false;
  });

  it('renders the public page when signed out', () => {
    renderPublicOnly();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects authenticated users away from the login page', () => {
    mockAuth.isAuthenticated = true;

    renderPublicOnly();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is initialising', () => {
    mockAuth.isInitializing = true;

    renderPublicOnly();

    expect(
      screen.getByRole('status', { name: 'Checking your session' }),
    ).toBeInTheDocument();
  });
});
