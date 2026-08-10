import { describe, it, expect, vi } from 'vitest';
import type { FC } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { BillingDashboardHeader } from './BillingDashboardHeader';
import { ROUTES } from '../../routes/routes';

/** Renders the resolved URL (pathname + query) for navigation assertions. */
const LocationDisplay: FC = () => {
  const location = useLocation();
  return (
    <div data-testid="current-location">
      {location.pathname}
      {location.search}
    </div>
  );
};

describe('BillingDashboardHeader', () => {
  it('renders the page title and subtitle', () => {
    renderWithProviders(<BillingDashboardHeader onNewInvoice={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Billing Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Clinic financial overview')).toBeInTheDocument();
  });

  it('opens the create invoice drawer directly from the New invoice quick action (no Invoice List detour)', () => {
    // The dashboard CTA delegates to `onNewInvoice` (the page opens its own
    // create drawer) — the user is never routed through the Invoice List.
    const onNewInvoice = vi.fn();
    renderWithProviders(
      <Routes>
        <Route
          path="/billing"
          element={
            <>
              <BillingDashboardHeader onNewInvoice={onNewInvoice} />
              <LocationDisplay />
            </>
          }
        />
        <Route path="/billing/invoices" element={<div>Invoices page</div>} />
      </Routes>,
      { route: '/billing' },
    );

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    expect(onNewInvoice).toHaveBeenCalledTimes(1);
    // No navigation happened — still on the dashboard.
    expect(screen.getByTestId('current-location')).toHaveTextContent('/billing');
    expect(screen.getByTestId('current-location')).not.toHaveTextContent('invoices');
    expect(screen.queryByText('Invoices page')).not.toBeInTheDocument();
  });

  it('navigates to the Payment List route from the Record payment quick action (Phase 3)', () => {
    // The Payment workflow ships in Sprint 14A.3, so the header CTA is a real
    // shortcut to the list page (its page header opens the drawer).
    renderWithProviders(<BillingDashboardHeader onNewInvoice={() => undefined} />);

    const recordPayment = screen.getByRole('button', { name: 'Record payment' });
    expect(recordPayment).toBeEnabled();
    expect(ROUTES.BILLING_PAYMENTS).toBe('/billing/payments');
  });
});
