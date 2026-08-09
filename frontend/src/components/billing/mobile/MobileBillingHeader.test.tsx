import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MobileBillingHeader } from './MobileBillingHeader';
import { MobileNavProvider, type MobileNavContextValue } from '../../../layouts/components/mobile/MobileNavContext';

function renderHeader(overrides: Partial<MobileNavContextValue> = {}) {
  const openNav = overrides.openNav ?? vi.fn();
  return {
    openNav,
    ...render(
      <MobileNavProvider value={{ openNav }}>
        <MobileBillingHeader title="Invoices" addLabel="New invoice" onAdd={vi.fn()} />
      </MobileNavProvider>,
    ),
  };
}

describe('MobileBillingHeader', () => {
  it('renders the page title', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
  });

  it('opens the app navigation drawer via the shared context from the hamburger', () => {
    const openNav = vi.fn();
    renderHeader({ openNav });

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(openNav).toHaveBeenCalledTimes(1);
  });

  it('fires the add action from the icon-only + button (no text label)', () => {
    const onAdd = vi.fn();
    render(
      <MobileNavProvider value={{ openNav: vi.fn() }}>
        <MobileBillingHeader title="Invoices" addLabel="New invoice" onAdd={onAdd} />
      </MobileNavProvider>,
    );

    const addButton = screen.getByRole('button', { name: 'New invoice' });
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledTimes(1);
    // Icon-only: the reference mobile + carries no visible text.
    expect(addButton).not.toHaveTextContent('New invoice');
  });
});
