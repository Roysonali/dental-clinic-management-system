import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobilePatientList } from './MobilePatientList';
import type { PatientListItem } from '../../../types/patient';

const patient: PatientListItem = {
  id: 'p1',
  patient_code: 'PAT-00001',
  full_name: 'Amara Okonkwo',
  age: 32,
  gender: 'female',
  primary_contact_number: '+91 98765 43210',
  is_active: true,
};

function renderList() {
  const onView = vi.fn();
  const onSearchChange = vi.fn();
  const onStatusChange = vi.fn();
  const onClearFilters = vi.fn();
  const onPageChange = vi.fn();

  renderWithProviders(
    <MobilePatientList
      patients={[patient]}
      loading={false}
      error={null}
      onRetry={() => undefined}
      searchValue=""
      onSearchChange={onSearchChange}
      status="all"
      onStatusChange={onStatusChange}
      hasActiveFilters={false}
      onClearFilters={onClearFilters}
      onView={onView}
      page={1}
      totalPages={1}
      totalCount={1}
      pageSize={10}
      onPageChange={onPageChange}
    />,
  );

  return { onView, onSearchChange, onStatusChange, onClearFilters, onPageChange };
}

describe('MobilePatientList', () => {
  it('renders patient cards with the reference field hierarchy', () => {
    renderList();
    expect(screen.getByText('PAT-00001')).toBeInTheDocument();
    expect(screen.getByText('Amara Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Female · 32 yrs')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('navigates from a card tap', () => {
    const { onView } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'View PAT-00001' }));
    expect(onView).toHaveBeenCalledWith(patient);
  });

  it('opens the filter sheet with the server-side status filter', () => {
    const { onStatusChange } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

    const dialog = screen.getByRole('dialog', { name: 'Filter patients' });
    const select = within(dialog).getByLabelText('Status');
    fireEvent.change(select, { target: { value: 'active' } });
    expect(onStatusChange).toHaveBeenCalledWith('active');
  });
});
