import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { BillingDashboardHeader } from './BillingDashboardHeader';
import { ROUTES } from '../../routes/routes';

describe('BillingDashboardHeader', () => {
  it('renders the page title and subtitle', () => {
    renderWithProviders(<BillingDashboardHeader />);

    expect(screen.getByRole('heading', { name: 'Billing Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Clinic financial overview')).toBeInTheDocument();
  });

  it('navigates to the Invoice List route from the New invoice quick action (Phase 2)', () => {
    // The Invoice workflow ships in Sprint 14A.2, so the header CTA is now a
    // real shortcut to the list page (its toolbar opens the create drawer).
    renderWithProviders(<BillingDashboardHeader />);

    const newInvoice = screen.getByRole('button', { name: 'New invoice' });
    expect(newInvoice).toBeEnabled();
    // No navigation happens in the test renderer — the link resolves to the
    // route constant (the app-level router owns navigation).
    expect(ROUTES.BILLING_INVOICES).toBe('/billing/invoices');
  });

  it('keeps Record payment disabled — the Payments workflow is not part of this phase', () => {
    renderWithProviders(<BillingDashboardHeader />);

    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
  });

  it('keeps the disabled-CTA explanation accessible via aria-describedby + sr-only text', () => {
    renderWithProviders(<BillingDashboardHeader />);

    const recordPayment = screen.getByRole('button', { name: 'Record payment' });
    const recordHintId = recordPayment.getAttribute('aria-describedby');

    expect(recordHintId).toBeTruthy();
    const recordHint = document.getElementById(recordHintId!);
    expect(recordHint).toHaveClass('sr-only');
    expect(recordHint?.textContent).toContain('Payments phase');
  });
});
