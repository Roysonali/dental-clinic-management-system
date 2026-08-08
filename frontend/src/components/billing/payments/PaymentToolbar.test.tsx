import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PaymentToolbar } from './PaymentToolbar';

/**
 * PaymentToolbar — layout & filter-control tests (Sprint 14A.3).
 *
 * jsdom does not perform layout, so wrapping behaviour is asserted through
 * the structure: the filters are split into two `flex-wrap` rows (entity/
 * status + date/sorting), the overflow-safe pattern established by the
 * Sprint 14A.2 invoice remediation. Reverting to a single unconstrained row
 * breaks this test.
 */
function renderToolbar(overrides: Partial<Parameters<typeof PaymentToolbar>[0]> = {}) {
  const props: Parameters<typeof PaymentToolbar>[0] = {
    patientId: '',
    onPatientChange: vi.fn(),
    method: 'all',
    onMethodChange: vi.fn(),
    status: 'all',
    onStatusChange: vi.fn(),
    dateFrom: '',
    onDateFromChange: vi.fn(),
    dateTo: '',
    onDateToChange: vi.fn(),
    sortBy: 'created_at',
    onSortByChange: vi.fn(),
    sortOrder: 'desc',
    onSortOrderChange: vi.fn(),
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<PaymentToolbar {...props} />) };
}

describe('PaymentToolbar', () => {
  it('renders every backend-supported filter with a visible label', () => {
    renderToolbar();

    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    // "Status" can also appear inside select option text — assert presence,
    // not uniqueness.
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getByText('Payment from')).toBeInTheDocument();
    expect(screen.getByText('Payment to')).toBeInTheDocument();
    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('groups the filters into two wrapping rows (entity/status + date/sorting)', () => {
    renderToolbar();

    const filterRows = document.querySelectorAll('div.flex.flex-wrap.items-end.gap-3');
    // Row 1 = Patient / Method / Status; Row 2 = Payment from / to / Sort / Order.
    expect(filterRows).toHaveLength(2);

    const [entityRow, dateSortRow] = Array.from(filterRows);
    expect(entityRow?.textContent).toContain('Patient');
    expect(entityRow?.textContent).toContain('Method');
    expect(entityRow?.textContent).toContain('Status');
    expect(dateSortRow?.textContent).toContain('Payment from');
    expect(dateSortRow?.textContent).toContain('Payment to');
    expect(dateSortRow?.textContent).toContain('Sort by');
    expect(dateSortRow?.textContent).toContain('Order');
  });

  it('makes the server-side filtering contract explicit to the user', () => {
    renderToolbar();

    expect(screen.getByText('Filters apply on the server')).toBeInTheDocument();
  });

  it('propagates filter changes through their labelled controls', () => {
    const onMethodChange = vi.fn();
    const onStatusChange = vi.fn();
    const onSortByChange = vi.fn();
    const onSortOrderChange = vi.fn();
    renderToolbar({ onMethodChange, onStatusChange, onSortByChange, onSortOrderChange });

    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'card' } });
    expect(onMethodChange).toHaveBeenCalledWith('card');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    expect(onStatusChange).toHaveBeenCalledWith('completed');

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'total_amount' } });
    expect(onSortByChange).toHaveBeenCalledWith('total_amount');

    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'asc' } });
    expect(onSortOrderChange).toHaveBeenCalledWith('asc');
  });

  it('shows Clear when filters are active and resets via onClearFilters', () => {
    const onClearFilters = vi.fn();
    renderToolbar({ onClearFilters, hasActiveFilters: true });

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('hides Clear when no filters are active', () => {
    renderToolbar({ hasActiveFilters: false });

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('is usable from a screen reader: every control is reachable by label', () => {
    renderToolbar();

    expect(screen.getByLabelText('Patient')).toBeInTheDocument();
    expect(screen.getByLabelText('Method')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment from')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment to')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByLabelText('Order')).toBeInTheDocument();
  });
});
