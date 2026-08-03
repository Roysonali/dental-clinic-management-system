import { useState, type FC } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import type { DataTableColumn, RowKey } from './types';

interface Person {
  id: string;
  name: string;
  age: number;
}

const columns: DataTableColumn<Person>[] = [
  { key: 'name', header: 'Name', accessor: 'name', sortable: true },
  { key: 'age', header: 'Age', accessor: 'age' },
];

const data: Person[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Carol', age: 35 },
];

describe('DataTable', () => {
  it('renders column headers and row data', () => {
    render(<DataTable columns={columns} data={data} rowKey={(p) => p.id} />);

    expect(screen.getByRole('table', { name: 'Data table' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Age' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('uses the custom aria-label for the table', () => {
    render(<DataTable columns={columns} data={data} rowKey={(p) => p.id} ariaLabel="Patients table" />);
    expect(screen.getByRole('table', { name: 'Patients table' })).toBeInTheDocument();
  });

  it('notifies the parent when a sortable header is clicked (controlled)', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        sortState={null}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
  });

  it('cycles asc → desc → cleared in uncontrolled mode and exposes aria-sort', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Name' });
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(header).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(header).toHaveAttribute('aria-sort', 'none');
  });

  it('reports row selection via onSelectionChange (controlled)', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Row checkboxes are visually hidden (sr-only) — fire the change directly.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('toggles row checkboxes in uncontrolled mode', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        selectable
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Select row 1' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('selects and deselects all rows via the header checkbox (controlled)', () => {
    const SelectionHarness: FC = () => {
      const [keys, setKeys] = useState<RowKey[]>([]);
      return (
        <DataTable
          columns={columns}
          data={data}
          rowKey={(p) => p.id}
          selectable
          selectedKeys={keys}
          onSelectionChange={setKeys}
        />
      );
    };
    render(<SelectionHarness />);

    // Header checkboxes are visually hidden (sr-only) — fire the change directly.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByRole('checkbox', { name: 'Deselect all rows' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Deselect all rows' }));
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
  });

  it('marks the header checkbox indeterminate on partial selection', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        selectable
        selectedKeys={['1']}
      />,
    );
    const headerCheckbox = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(headerCheckbox).toBePartiallyChecked();
  });

  it('renders the empty state when there is no data', () => {
    render(<DataTable columns={columns} data={[]} rowKey={(p) => p.id} />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument();
  });

  it('renders skeleton rows and marks the table body busy while loading', () => {
    render(<DataTable columns={columns} data={data} rowKey={(p) => p.id} loading loadingRows={3} />);

    const table = screen.getByRole('table');
    expect(table.querySelector('tbody')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('renders the error state with a working retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        error="Server exploded"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('Server exploded')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides columns that are not visible in the controlled visibility map', () => {
    const hideableColumns: DataTableColumn<Person>[] = [
      { key: 'name', header: 'Name', accessor: 'name', hideable: true },
      { key: 'age', header: 'Age', accessor: 'age', hideable: true },
    ];
    render(
      <DataTable
        columns={hideableColumns}
        data={data}
        rowKey={(p) => p.id}
        columnVisibility={{ name: true, age: false }}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Age' })).not.toBeInTheDocument();
  });

  it('renders a custom row actions header label', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        rowActions={() => <button type="button">Edit</button>}
        rowActionsHeader="Manage"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Manage' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
  });

  it('defaults the row actions header to "Actions"', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        rowActions={() => <button type="button">Edit</button>}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  });

  it('calls onRowClick with the clicked row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('passes column-visibility helpers to the toolbar render prop', () => {
    const toolbarSpy = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(p) => p.id}
        toolbar={(helpers) => {
          toolbarSpy(helpers);
          return <div>Custom toolbar</div>;
        }}
      />,
    );

    expect(screen.getByText('Custom toolbar')).toBeInTheDocument();
    expect(toolbarSpy).toHaveBeenCalledTimes(1);
    expect(toolbarSpy.mock.calls[0][0]).toHaveProperty('columnVisibility');
    expect(toolbarSpy.mock.calls[0][0]).toHaveProperty('setColumnVisibility');
  });
});
