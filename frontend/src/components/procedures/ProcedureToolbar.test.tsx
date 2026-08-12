import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { ProcedureToolbar } from './ProcedureToolbar';

const defaultProps = {
  category: 'all' as const,
  onCategoryChange: vi.fn(),
  status: 'all' as const,
  onStatusChange: vi.fn(),
  onCreate: vi.fn(),
  searchValue: '',
  onSearchChange: vi.fn(),
  columnVisibility: {} as Record<string, boolean>,
  onColumnVisibilityChange: vi.fn(),
};

describe('ProcedureToolbar', () => {
  it('renders search, category/status filters, Columns menu and the New Procedure CTA', () => {
    renderWithProviders(<ProcedureToolbar {...defaultProps} />);

    expect(screen.getByRole('searchbox', { name: 'Search procedures…' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Procedure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
  });

  it('reports search input changes', () => {
    const onSearchChange = vi.fn();
    renderWithProviders(<ProcedureToolbar {...defaultProps} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search procedures…' }), {
      target: { value: 'RCT' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('RCT');
  });

  it('reports category and status filter changes', () => {
    const onCategoryChange = vi.fn();
    const onStatusChange = vi.fn();
    renderWithProviders(
      <ProcedureToolbar
        {...defaultProps}
        onCategoryChange={onCategoryChange}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), {
      target: { value: 'endodontic' },
    });
    expect(onCategoryChange).toHaveBeenCalledWith('endodontic');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'active' },
    });
    expect(onStatusChange).toHaveBeenCalledWith('active');
  });

  it('invokes onCreate from the primary CTA', () => {
    const onCreate = vi.fn();
    renderWithProviders(<ProcedureToolbar {...defaultProps} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'New Procedure' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('opens the columns visibility menu with the catalog column descriptors', () => {
    renderWithProviders(<ProcedureToolbar {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByText('Visible columns')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Default Cost' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Code' })).toBeInTheDocument();
  });
});
