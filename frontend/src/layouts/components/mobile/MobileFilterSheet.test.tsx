import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobileFilterSheet } from './MobileFilterSheet';

function renderSheet(props: { hasActiveFilters?: boolean } = {}) {
  const onClose = vi.fn();
  const onClearFilters = vi.fn();
  renderWithProviders(
    <MobileFilterSheet
      open
      onClose={onClose}
      title="Filter patients"
      hasActiveFilters={props.hasActiveFilters ?? false}
      onClearFilters={onClearFilters}
    >
      <div>Status control</div>
    </MobileFilterSheet>,
  );
  return { onClose, onClearFilters };
}

describe('MobileFilterSheet', () => {
  it('renders the sheet title, close button and body content', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Filter patients' });
    expect(within(dialog).getByText('Status control')).toBeInTheDocument();
  });

  it('closes from the close button', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears filters then closes from Clear filters (enabled only when active)', () => {
    const { onClose, onClearFilters } = renderSheet({ hasActiveFilters: true });
    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Clear filters when nothing is active', () => {
    renderSheet({ hasActiveFilters: false });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('closes from the Done button', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
