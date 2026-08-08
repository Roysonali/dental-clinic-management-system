import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { InvoiceToolbar } from './InvoiceToolbar';

/**
 * InvoiceToolbar — layout & filter-control tests (Sprint 14A.2 remediation).
 *
 * jsdom does not perform layout, so wrapping behaviour is asserted through
 * the structure: the search field is width-bounded on desktop
 * (`lg:max-w-[440px]`) and the seven filters are split into two
 * `flex-wrap` rows (entity/status + date/sorting). These classes are the
 * regression guards for the horizontal-overflow remediation — reverting to
 * a single unconstrained row (or an unbounded search) breaks this test.
 */
function renderToolbar(overrides: Partial<Parameters<typeof InvoiceToolbar>[0]> = {}) {
  const props: Parameters<typeof InvoiceToolbar>[0] = {
    searchValue: '',
    onSearchChange: vi.fn(),
    searchLoading: false,
    status: 'all',
    onStatusChange: vi.fn(),
    patientId: '',
    onPatientChange: vi.fn(),
    doctorId: '',
    onDoctorChange: vi.fn(),
    doctorOptions: [],
    doctorsLoading: false,
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
    onCreate: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<InvoiceToolbar {...props} />) };
}

describe('InvoiceToolbar', () => {
  it('renders the invoice search with its accessible placeholder', () => {
    renderToolbar();

    const search = screen.getByPlaceholderText('Search invoice number or patient name…');
    expect(search).toBeInTheDocument();
    expect(search.getAttribute('aria-label')).toBe('Search invoice number or patient name…');
  });

  it('bounds the desktop search width so it can never push the page wider than the viewport', () => {
    renderToolbar();

    const search = screen.getByPlaceholderText('Search invoice number or patient name…');
    // The SearchBar root is `relative`; its parent carries the bounded width.
    const wrapper = search.closest('div')?.parentElement;
    expect(wrapper?.className).toContain('lg:max-w-[440px]');
  });

  it('renders every backend-supported filter with a visible label', () => {
    renderToolbar();

    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();
    // "Status" also appears as a sort option label — assert presence, not uniqueness.
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoice from')).toBeInTheDocument();
    expect(screen.getByText('Invoice to')).toBeInTheDocument();
    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('groups the filters into two wrapping rows (entity/status + date/sorting)', () => {
    renderToolbar();

    const filterRows = document.querySelectorAll('div.flex.flex-wrap.items-end.gap-3');
    // Row 1 = Patient / Doctor / Status; Row 2 = Invoice from / to / Sort / Order.
    expect(filterRows).toHaveLength(2);

    const [entityRow, dateSortRow] = Array.from(filterRows);
    expect(entityRow?.textContent).toContain('Patient');
    expect(entityRow?.textContent).toContain('Doctor');
    expect(entityRow?.textContent).toContain('Status');
    expect(dateSortRow?.textContent).toContain('Invoice from');
    expect(dateSortRow?.textContent).toContain('Invoice to');
    expect(dateSortRow?.textContent).toContain('Sort by');
    expect(dateSortRow?.textContent).toContain('Order');
  });

  it('keeps the "New invoice" primary action wired to onCreate', () => {
    const onCreate = vi.fn();
    renderToolbar({ onCreate });

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows Clear when filters are active and resets via onClearFilters', () => {
    const onClearFilters = vi.fn();
    renderToolbar({ onClearFilters, hasActiveFilters: true });

    const clear = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(clear);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('hides Clear when no filters are active', () => {
    renderToolbar({ hasActiveFilters: false });

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('propagates search input to the debounced handler', () => {
    const onSearchChange = vi.fn();
    renderToolbar({ onSearchChange });

    fireEvent.change(screen.getByPlaceholderText('Search invoice number or patient name…'), {
      target: { value: 'INV-010' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('INV-010');
  });

  it('propagates filter changes through their labelled controls', () => {
    const onStatusChange = vi.fn();
    const onSortByChange = vi.fn();
    const onSortOrderChange = vi.fn();
    renderToolbar({ onStatusChange, onSortByChange, onSortOrderChange });

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paid' } });
    expect(onStatusChange).toHaveBeenCalledWith('paid');

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'grand_total' } });
    expect(onSortByChange).toHaveBeenCalledWith('grand_total');

    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'asc' } });
    expect(onSortOrderChange).toHaveBeenCalledWith('asc');
  });

  it('disables the Doctor filter while the doctor list is loading', () => {
    renderToolbar({ doctorsLoading: true });

    expect(screen.getByLabelText('Doctor')).toBeDisabled();
  });

  it('is usable from a screen reader: every control is reachable by label', () => {
    renderToolbar();

    expect(screen.getByLabelText('Patient')).toBeInTheDocument();
    expect(screen.getByLabelText('Doctor')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice from')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice to')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByLabelText('Order')).toBeInTheDocument();
  });
});
