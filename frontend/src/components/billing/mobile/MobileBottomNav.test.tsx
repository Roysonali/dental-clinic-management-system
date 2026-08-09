import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobileBottomNav } from './MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders the four reference items: Dashboard, Invoices, Payments, Receipts', () => {
    renderWithProviders(<MobileBottomNav />, { route: '/billing/invoices' });

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Invoices',
      'Payments',
      'Receipts',
    ]);
  });

  it('marks the current screen active and others inactive', () => {
    renderWithProviders(<MobileBottomNav />, { route: '/billing/invoices' });

    expect(screen.getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Payments' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('does NOT highlight Receipts (which routes to /billing) when on the invoice list', () => {
    // Prefix-matching guard: /billing/invoices must not activate the
    // /billing-based Receipts item.
    renderWithProviders(<MobileBottomNav />, { route: '/billing/invoices' });

    expect(screen.getByRole('link', { name: 'Receipts' })).not.toHaveAttribute('aria-current');
  });
});
