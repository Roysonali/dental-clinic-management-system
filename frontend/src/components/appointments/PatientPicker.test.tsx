import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PatientPicker } from './PatientPicker';
import { patientService } from '../../services/patientService';

vi.mock('../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    quickCreate: vi.fn(),
  },
}));

const listMock = vi.mocked(patientService.list);
const quickCreateMock = vi.mocked(patientService.quickCreate);

const patients = [
  {
    id: 'p1',
    patient_code: 'PAT-000001',
    full_name: 'Juan Dela Cruz',
    age: 36,
    gender: 'male' as const,
    primary_contact_number: '+639123456789',
    is_active: true,
    profile_status: 'complete' as const,
  },
  {
    id: 'p2',
    patient_code: 'PAT-000002',
    full_name: 'Maria Santos',
    age: 28,
    gender: 'female' as const,
    primary_contact_number: '+639987654321',
    is_active: true,
    profile_status: 'complete' as const,
  },
];

const mockQuickCreateResponse = (overrides: {
  patient?: Record<string, unknown>;
  potential_matches?: typeof patients;
  warnings?: string[];
} = {}) => ({
  patient: {
    id: 'p3',
    patient_code: 'PAT-000015',
    first_name: 'New',
    middle_name: null,
    last_name: 'Person',
    full_name: 'New Person',
    date_of_birth: null,
    age: null,
    gender: null,
    primary_contact_number: '9999999999',
    emergency_contact_number: null,
    email: null,
    address: null,
    remarks: null,
    is_active: true,
    profile_status: 'incomplete' as const,
    created_by: 1,
    updated_by: null,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
    ...(overrides.patient ?? {}),
  },
  potential_matches: [...(overrides.potential_matches ?? [])],
  warnings: [...(overrides.warnings ?? [])],
});

async function openQuickCreate(phone: string) {
  listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
  renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: phone } });
  fireEvent.click(await screen.findByText('Create New Patient'));
  await screen.findByLabelText('First Name *');
}

describe('PatientPicker', () => {
  beforeEach(() => {
    listMock.mockReset();
    quickCreateMock.mockReset();
  });

  // ── Existing regression tests ──────────────────────────

  it('searches patients after a debounce and shows results', async () => {
    listMock.mockResolvedValue({ items: patients, total: 2, page: 1, page_size: 10 });
    const onChange = vi.fn();
    renderWithProviders(<PatientPicker value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'juan' } });

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

  // ── Quick-create tests ─────────────────────────────────

  it('shows Create New Patient button when no results found', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9999999999' } });
    expect(await screen.findByText('Create New Patient')).toBeInTheDocument();
  });

  it('shows Create New Patient button when results exist', async () => {
    listMock.mockResolvedValue({ items: patients, total: 2, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'juan' } });
    expect(await screen.findByText('Create New Patient')).toBeInTheDocument();
  });

  it('opens quick-create form when Create New Patient is clicked', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9999999999' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    expect(screen.getByText('Quick Patient Registration')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone *')).toBeInTheDocument();
  });

  it('prefills phone from search query', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9999999999' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;
    expect(phoneInput.value).toBe('9999999999');
  });

  it('validates required fields before submission', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'newpatient' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    fireEvent.change(screen.getByLabelText('Phone *'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Phone number is required')).toBeInTheDocument();
  });

  it('creates patient and auto-selects on success', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse());
    await openQuickCreate('9999999999');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(quickCreateMock).toHaveBeenCalledTimes(1);
    });
    const payload = quickCreateMock.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload).toMatchObject({
      first_name: 'New',
      last_name: 'Person',
      primary_contact_number: '9999999999',
    });
  });

  it('shows T2 confirmation when T1 found matches', async () => {
    // Use a valid phone number so that the quick-create form phone field passes validation
    const phonePatient = { ...patients[0], primary_contact_number: '09991234567' };
    listMock.mockResolvedValue({ items: [phonePatient], total: 1, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '09991234567' } });
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getByText('Create New Patient'));
    await screen.findByLabelText('First Name *');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Abc' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Dhf' } });
    // Phone is pre-filled with '09991234567' from search query — valid
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(screen.getByText('Potential Duplicates Found')).toBeInTheDocument();
    });
    // Two Cancel buttons exist: one in T2 dialog, one at the bottom of the form
    expect(screen.getAllByText('Cancel').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Select Existing')).toBeInTheDocument();
    expect(screen.getByText('Create Anyway')).toBeInTheDocument();
  });

  it('skips T2 when T1 found no matches', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse());
    await openQuickCreate('9999999999');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(quickCreateMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Potential Duplicates Found')).not.toBeInTheDocument();
  });

  it('displays T3 warnings after creation', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse({
      potential_matches: [patients[0]],
      warnings: ['A patient with this phone number already exists.'],
    }));

    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9876543210' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(screen.getByText('Potential matches found')).toBeInTheDocument();
    });
    expect(screen.getByText('Juan Dela Cruz (PAT-000001)')).toBeInTheDocument();
  });

  it('shows error on network failure', async () => {
    quickCreateMock.mockRejectedValue(new Error('Network error'));
    await openQuickCreate('9999999999');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    expect(await screen.findByText('Failed to create patient. Please try again.')).toBeInTheDocument();
  });

  it('shows incomplete tag after quick-create', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse());

    // Use a stateful wrapper so controlled value updates after onChange
    let pickerValue = '';
    function StatefulPicker() {
      const [val, setVal] = useState(pickerValue);
      return (
        <PatientPicker
          value={val}
          onChange={(v) => { pickerValue = v; setVal(v); }}
        />
      );
    }

    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<StatefulPicker />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9999999999' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    const fnInput = await screen.findByLabelText('First Name *');
    fireEvent.change(fnInput, { target: { value: 'Incomplete' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(quickCreateMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Incomplete')).toBeInTheDocument();
    });
  });

  // ── AUD-05: Gender placeholder regression tests ──────────────

  it('shows "Select gender" placeholder initially (AUD-05)', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<PatientPicker value="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9999999999' } });
    fireEvent.click(await screen.findByText('Create New Patient'));

    const genderSelect = screen.getByLabelText('Gender') as HTMLSelectElement;
    // Placeholder option should be selected (empty value)
    expect(genderSelect.value).toBe('');
    expect(screen.getByText('Select gender')).toBeInTheDocument();
  });

  it('no gender selected results in no accidental "Male" in payload (AUD-05)', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse());
    await openQuickCreate('9999999999');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    // Do NOT change gender — leave on placeholder
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(quickCreateMock).toHaveBeenCalledTimes(1);
    });
    const payload = quickCreateMock.mock.calls[0][0] as unknown as Record<string, unknown>;
    // Gender should be undefined (omitted), not 'male'
    expect(payload.gender === undefined || payload.gender === null || payload.gender === '').toBe(true);
    expect(payload.gender).not.toBe('male');
  });

  it('gender selected results in correct payload value (AUD-05)', async () => {
    quickCreateMock.mockResolvedValue(mockQuickCreateResponse());
    await openQuickCreate('9999999999');

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Person' } });
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'female' } });
    fireEvent.click(screen.getByText('Create & Continue'));

    await waitFor(() => {
      expect(quickCreateMock).toHaveBeenCalledTimes(1);
    });
    const payload = quickCreateMock.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.gender).toBe('female');
  });

  // ── Phone input sanitization tests ──────────────────────

  it('strips alphabetic characters from phone input', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: 'abc1234567' } });
    expect(phoneInput.value).toBe('1234567');
  });

  it('strips special characters from phone input', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: '98-765-43210' } });
    expect(phoneInput.value).toBe('9876543210');
  });

  it('allows leading + and strips subsequent + signs', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: '+919876543210' } });
    expect(phoneInput.value).toBe('+919876543210');

    fireEvent.change(phoneInput, { target: { value: '++919876543210' } });
    expect(phoneInput.value).toBe('+919876543210');
  });

  it('rejects + not at start', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: '91+9876543210' } });
    expect(phoneInput.value).toBe('919876543210');
  });

  it('handles paste of mixed invalid content', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: 'abc+919876xyz' } });
    expect(phoneInput.value).toBe('+919876');
  });

  it('uses type tel and inputMode tel for phone field', async () => {
    await openQuickCreate('9999999999');
    const phoneInput = screen.getByLabelText('Phone *') as HTMLInputElement;

    expect(phoneInput.type).toBe('tel');
    expect(phoneInput.inputMode).toBe('tel');
  });
});
