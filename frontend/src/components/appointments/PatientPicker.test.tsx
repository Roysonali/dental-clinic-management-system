import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PatientPicker } from './PatientPicker';
import { patientService } from '../../services/patientService';

vi.mock('../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

const listMock = vi.mocked(patientService.list);

const patients = [
  {
    id: 'p1',
    patient_code: 'PAT-000001',
    full_name: 'Juan Dela Cruz',
    age: 36,
    gender: 'male' as const,
    primary_contact_number: '+639123456789',
    is_active: true,
  },
  {
    id: 'p2',
    patient_code: 'PAT-000002',
    full_name: 'Maria Santos',
    age: 28,
    gender: 'female' as const,
    primary_contact_number: '+639987654321',
    is_active: true,
  },
];

describe('PatientPicker', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('searches patients after a debounce and shows results', async () => {
    listMock.mockResolvedValue({ items: patients, total: 2, page: 1, page_size: 10 });
    const onChange = vi.fn();
    renderWithProviders(<PatientPicker value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'juan' } });

    await waitFor(() => expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'juan', page_size: 10 }),
    ), { timeout: 2000 });

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('selects a patient and reports the change', async () => {
    listMock.mockResolvedValue({ items: patients, total: 2, page: 1, page_size: 10 });
    const onChange = vi.fn();
    const onSelectOption = vi.fn();
    renderWithProviders(
      <PatientPicker value="" onChange={onChange} onSelectOption={onSelectOption} />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'juan' } });
    const result = await screen.findByText('Juan Dela Cruz');
    fireEvent.click(result);

    expect(onChange).toHaveBeenCalledWith('p1');
    expect(onSelectOption).toHaveBeenCalledWith(patients[0]);
  });

  it('shows the selected patient and offers a clear button', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PatientPicker value="p1" selectedLabel="Juan Dela Cruz" onChange={onChange} />,
    );

    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected patient' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders the fixed patient label and no clear button when disabled', () => {
    renderWithProviders(
      <PatientPicker value="p1" selectedLabel="Juan Dela Cruz" disabled onChange={vi.fn()} />,
    );

    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear selected patient' }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty hint when no patients match', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No patients found.')).toBeInTheDocument();
  });
});
