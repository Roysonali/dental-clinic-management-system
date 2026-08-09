import { describe, it, expect } from 'vitest';
import type { FC } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { BillingDashboardHeader } from './BillingDashboardHeader';
import { ROUTES, INVOICE_CREATE_QUERY_PARAM } from '../../routes/routes';

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
    renderWithProviders(<BillingDashboardHeader />);

    expect(screen.getByRole('heading', { name: 'Billing Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Clinic financial overview')).toBeInTheDocument();
  });

  it('navigates to the Invoice List WITH the create intent from the New invoice quick action (Sprint 14A.2.x)', () => {
    // The dashboard CTA carries the user's create intent through to the list
    // (`?create=true`), so the drawer opens without a second click.
    renderWithProviders(
      <Routes>
        <Route path="/billing" element={<BillingDashboardHeader />} />
        <Route
          path="/billing/invoices"
          element={
            <>
              <div>Invoices page</div>
              <LocationDisplay />
            </>
          }
        />
      </Routes>,
      { route: '/billing' },
    );

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    expect(screen.getByTestId('current-location')).toHaveTextContent(
      `${ROUTES.BILLING_INVOICES}?${INVOICE_CREATE_QUERY_PARAM}=true`,
    );
    expect(ROUTES.BILLING_INVOICES).toBe('/billing/invoices');
  });

  it('navigates to the Payment List route from the Record payment quick action (Phase 3)', () => {
    // The Payment workflow ships in Sprint 14A.3, so the header CTA is now a
    // real shortcut to the list page (its page header opens the drawer).
    renderWithProviders(<BillingDashboardHeader />);

    const recordPayment = screen.getByRole('button', { name: 'Record payment' });
    expect(recordPayment).toBeEnabled();
    expect(ROUTES.BILLING_PAYMENTS).toBe('/billing/payments');
  });
});
