import { useState, type FC } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTableToolbar } from './DataTableToolbar';

describe('DataTableToolbar', () => {
  it('renders the search input with the given placeholder', () => {
    render(<DataTableToolbar searchValue="" searchPlaceholder="Search patients..." />);
    expect(screen.getByRole('searchbox', { name: 'Search patients...' })).toBeInTheDocument();
  });

  it('notifies on search input changes', async () => {
    // The search input is controlled, so the parent must reflect keystrokes
    // back into searchValue for typing to accumulate.
    const onSearchChange = vi.fn();
    const Harness: FC = () => {
      const [value, setValue] = useState('');
      return (
        <DataTableToolbar
          searchValue={value}
          onSearchChange={(next) => {
            onSearchChange(next);
            setValue(next);
          }}
          searchPlaceholder="Search..."
        />
      );
    };
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('searchbox', { name: 'Search...' }), 'abc');
    expect(screen.getByRole('searchbox', { name: 'Search...' })).toHaveValue('abc');
    expect(onSearchChange).toHaveBeenLastCalledWith('abc');
  });

  it('shows a loading spinner inside the search input when searchLoading is set', () => {
    render(<DataTableToolbar searchValue="q" searchLoading searchPlaceholder="Search..." />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders extra children alongside the search input', () => {
    render(
      <DataTableToolbar searchValue="" searchPlaceholder="Search...">
        <button type="button">Export</button>
      </DataTableToolbar>,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('renders primaryActions separately from table controls', () => {
    render(
      <DataTableToolbar
        searchValue=""
        searchPlaceholder="Search..."
        primaryActions={<button type="button">Register Patient</button>}
      >
        <button type="button">Export</button>
      </DataTableToolbar>,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register Patient' })).toBeInTheDocument();
  });

  it('renders primaryActions even when no search or children are provided', () => {
    render(<DataTableToolbar primaryActions={<button type="button">Register</button>} />);
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('renders the column-visibility menu in the right action stack', async () => {
    render(
      <DataTableToolbar
        columns={[{ key: 'name', label: 'Name', hideable: true }]}
        columnVisibility={{ name: true }}
        onColumnVisibilityChange={vi.fn()}
        primaryActions={<button type="button">Register</button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('keeps the Columns menu and the primary CTA in one right-side row cluster, Columns first', () => {
    render(
      <DataTableToolbar
        columns={[{ key: 'name', label: 'Name', hideable: true }]}
        columnVisibility={{ name: true }}
        onColumnVisibilityChange={vi.fn()}
        primaryActions={<button type="button">Register Patient</button>}
      />,
    );

    const columnsButton = screen.getByRole('button', { name: 'Columns' });
    const cta = screen.getByRole('button', { name: 'Register Patient' });

    // Columns precedes the CTA in the DOM (renders to its left), so the
    // single-row desktop layout is [Columns][Primary CTA] rather than the
    // old stack with Columns beneath the CTA.
    expect(columnsButton.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Both controls are direct children of the same right-side cluster
    // (the Dropdown wrapper is the only element between Columns and it).
    expect(columnsButton.parentElement?.parentElement).toBe(cta.parentElement);
  });

  it('opens the column-visibility menu and toggles a column', async () => {
    const user = userEvent.setup();
    const onColumnVisibilityChange = vi.fn();
    render(
      <DataTableToolbar
        columns={[
          { key: 'name', label: 'Name', hideable: true },
          { key: 'age', label: 'Age', hideable: true },
        ]}
        columnVisibility={{ name: true, age: true }}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Age' }));

    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ name: true, age: false });
  });

  it('omits the column menu when no columns are provided', () => {
    render(<DataTableToolbar searchValue="" searchPlaceholder="Search..." />);
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
  });

  it('omits the search input when neither search props are provided', () => {
    render(<DataTableToolbar />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
