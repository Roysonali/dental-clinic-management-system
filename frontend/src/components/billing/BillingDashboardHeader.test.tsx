import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingDashboardHeader } from './BillingDashboardHeader';

describe('BillingDashboardHeader', () => {
  it('renders the page title and subtitle', () => {
    render(<BillingDashboardHeader />);

    expect(screen.getByRole('heading', { name: 'Billing Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Clinic financial overview')).toBeInTheDocument();
  });

  it('renders quick actions as disabled — the workflows are not part of this phase', () => {
    render(<BillingDashboardHeader />);

    // RBAC/capability-aware CTAs: the Invoice and Payment workflows do not
    // exist yet, so the buttons must not be actionable or navigate anywhere.
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New invoice' })).toBeDisabled();
  });

  it('keeps the disabled-CTA explanations accessible via aria-describedby + sr-only text', () => {
    render(<BillingDashboardHeader />);

    // Natively disabled buttons cannot receive focus, so the hover Tooltip is
    // unreachable by keyboard/screen reader. The reason must be discoverable
    // through aria-describedby → sr-only text (the established hint pattern).
    const recordPayment = screen.getByRole('button', { name: 'Record payment' });
    const newInvoice = screen.getByRole('button', { name: 'New invoice' });

    const recordHintId = recordPayment.getAttribute('aria-describedby');
    const invoiceHintId = newInvoice.getAttribute('aria-describedby');

    expect(recordHintId).toBeTruthy();
    expect(invoiceHintId).toBeTruthy();

    const recordHint = document.getElementById(recordHintId!);
    const invoiceHint = document.getElementById(invoiceHintId!);

    expect(recordHint).toHaveClass('sr-only');
    expect(invoiceHint).toHaveClass('sr-only');
    expect(recordHint?.textContent).toContain('Payments phase');
    expect(invoiceHint?.textContent).toContain('Invoices phase');
  });
});
