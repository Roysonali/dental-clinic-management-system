import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';
import { ROUTES } from '../../routes/routes';

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  it('renders the page heading and subtitle', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Forgot your password?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We're here to help you regain access/i),
    ).toBeInTheDocument();
  });

  it('shows the informational message directing users to their clinic administrator', () => {
    renderPage();

    // The alert communicates that no self-service reset exists (backend does
    // not expose a forgot/reset endpoint) and routes to an administrator.
    expect(
      screen.getByText('Password resets require administrator assistance'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact your clinic administrator/i),
    ).toBeInTheDocument();
  });

  it('renders the information alert with the correct role for screen readers', () => {
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Password resets require administrator assistance',
    );
  });

  it('is informational only — it renders no form inputs', () => {
    renderPage();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links back to the login page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      ROUTES.AUTH.LOGIN,
    );
  });
});
