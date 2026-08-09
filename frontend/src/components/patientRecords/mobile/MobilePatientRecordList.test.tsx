import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobilePatientRecordList } from './MobilePatientRecordList';
import type { EnrichedPatientRecord } from '../../../types/patientRecord';

const record: EnrichedPatientRecord = {
  id: 'r1',
  patient_id: 'p1',
  appointment_id: 'a1',
  status: 'IN_PROGRESS',
  is_finalized: false,
  chief_complaint: 'Persistent toothache in lower left molar',
  created_at: '2026-07-09T14:20:00Z',
  patient_name: 'Amara Okonkwo',
  appointment_number: 'APT-00142',
};

function renderList() {
  const onView = vi.fn();
  const onStatusChange = vi.fn();
  const onFinalizedChange = vi.fn();
  const onClearFilters = vi.fn();

  renderWithProviders(
    <MobilePatientRecordList
      records={[record]}
      loading={false}
      error={null}
      onRetry={() => undefined}
      searchValue=""
      onSearchChange={() => undefined}
      status="all"
      onStatusChange={onStatusChange}
      finalized="all"
      onFinalizedChange={onFinalizedChange}
      hasActiveFilters={false}
      onClearFilters={onClearFilters}
      onView={onView}
      page={1}
      totalPages={1}
      totalCount={1}
      pageSize={10}
      onPageChange={() => undefined}
    />,
  );

  return { onView, onStatusChange, onFinalizedChange, onClearFilters };
}

describe('MobilePatientRecordList', () => {
  it('renders record cards with patient, status, complaint and date', () => {
    renderList();
    expect(screen.getByText('APT-00142')).toBeInTheDocument();
    expect(screen.getByText('Amara Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Persistent toothache in lower left molar')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('navigates from a card tap', () => {
    const { onView } = renderList();
    fireEvent.click(screen.getByRole('button', { name: /View record for Amara Okonkwo/ }));
    expect(onView).toHaveBeenCalledWith(record);
  });

  it('exposes the status + finalized filters inside the sheet (never on the page)', () => {
    const { onStatusChange, onFinalizedChange } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

    const dialog = screen.getByRole('dialog', { name: 'Filter patient records' });
    fireEvent.change(within(dialog).getByLabelText('Status'), {
      target: { value: 'COMPLETED' },
    });
    expect(onStatusChange).toHaveBeenCalledWith('COMPLETED');

    fireEvent.change(within(dialog).getByLabelText('Finalized'), {
      target: { value: 'finalized' },
    });
    expect(onFinalizedChange).toHaveBeenCalledWith('finalized');
  });
});
