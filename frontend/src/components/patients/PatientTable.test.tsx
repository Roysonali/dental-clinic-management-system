import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PatientTable } from './PatientTable';
import type { PatientListItem } from '../../types/patient';

const patients: PatientListItem[] = [
  {
    id: 'p1',
    patient_code: 'PAT-000001',
    full_name: 'Juan Dela Cruz',
    age: 34,
    gender: 'male',
    primary_contact_number: '+639123456789',
    is_active: true,
  },
  {
    id: 'p2',
    patient_code: 'PAT-000002',
    full_name: 'Maria Santos',
    age: 28,
    gender: 'female',
    primary_contact_number: '+639987654321',
    is_active: false,
  },
];

const defaultProps = {
  patients,
  status: 'all' as const,
  onStatusChange: vi.fn(),
  onRegister: vi.fn(),
};

describe('PatientTable', () => {
  it('renders patient rows with code, name, age, phone and status', () => {
    renderWithProviders(<PatientTable {...defaultProps} />);

    expect(screen.getByText('PAT-000001')).toBeInTheDocument();
    expect(screen.getByText('PAT-000002')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('+639123456789')).toBeInTheDocument();
    // "Active"/"Inactive" appear both as status badges and as filter toggles.
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
  });

  it('is accessible via the table aria-label', () => {
    renderWithProviders(<PatientTable {...defaultProps} ariaLabel="Patients table" />);
    expect(screen.getByRole('table', { name: 'Patients table' })).toBeInTheDocument();
  });

  it('sorts client-side when a sortable header is clicked', () => {
    renderWithProviders(<PatientTable {...defaultProps} />);

    const nameHeader = screen.getByRole('button', { name: 'Patient' });
    expect(nameHeader).toBeInTheDocument();

    // First click → ascending
    fireEvent.click(nameHeader);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Juan Dela Cruz');

    // Second click → descending
    fireEvent.click(nameHeader);
    const rowsAfter = screen.getAllByRole('row').slice(1);
    expect(rowsAfter[0].textContent).toContain('Maria Santos');
  });

  it('renders the empty state when there are no patients', () => {
    renderWithProviders(<PatientTable {...defaultProps} patients={[]} />);
    expect(screen.getByText('No patients found')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    renderWithProviders(<PatientTable {...defaultProps} loading />);
    // aria-busy is set on the <tbody> by DataTable while loading.
    const tbody = screen.getByRole('table', { name: 'Patients table' }).querySelector('tbody');
    expect(tbody).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the error state and calls onRetry', () => {
    const onRetry = vi.fn();
    renderWithProviders(<PatientTable {...defaultProps} error="Failed to load data" onRetry={onRetry} />);

    // The DataTable error panel renders the message as title + description.
    expect(screen.getAllByText('Failed to load data').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invokes row action callbacks', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDeactivate = vi.fn();
    renderWithProviders(
      <PatientTable {...defaultProps} onView={onView} onEdit={onEdit} onDeactivate={onDeactivate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Juan Dela Cruz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Juan Dela Cruz' }));
    // Only active patients get a deactivate action
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Juan Dela Cruz' }));

    expect(onView).toHaveBeenCalledWith(patients[0]);
    expect(onEdit).toHaveBeenCalledWith(patients[0]);
    expect(onDeactivate).toHaveBeenCalledWith(patients[0]);
  });

  it('shows reactivate (not deactivate) for inactive patients', () => {
    const onReactivate = vi.fn();
    renderWithProviders(<PatientTable {...defaultProps} onReactivate={onReactivate} />);

    expect(screen.getByRole('button', { name: 'Reactivate Maria Santos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate Maria Santos' })).not.toBeInTheDocument();
  });

  it('supports controlled bulk selection', () => {
    const onSelectionChange = vi.fn();
    renderWithProviders(
      <PatientTable {...defaultProps} selectable selectedKeys={[]} onSelectionChange={onSelectionChange} />,
    );

    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    fireEvent.click(selectAll);
    expect(onSelectionChange).toHaveBeenCalledWith(['p1', 'p2']);
  });
});
