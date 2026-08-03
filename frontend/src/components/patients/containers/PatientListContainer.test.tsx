import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PatientListContainer } from './PatientListContainer';
import { patientService } from '../../../services/patientService';
import type { PatientListResponse } from '../../../types/patient';

vi.mock('../../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const listMock = vi.mocked(patientService.list);

const makeResponse = (total: number, page = 1): PatientListResponse => ({
  items: [
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
  ],
  total,
  page,
  page_size: 20,
});

describe('PatientListContainer', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(makeResponse(2));
  });

  it('renders patients fetched from the service', async () => {
    renderWithProviders(<PatientListContainer />);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 20 }),
    );
  });

  it('refetches with the debounced search term', async () => {
    renderWithProviders(<PatientListContainer />);

    await waitFor(() => expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Search patients...'), {
      target: { value: 'juan' },
    });

    // Debounce is 350ms — wait for the second call with the search term.
    await waitFor(
      () => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'juan' })),
      { timeout: 2000 },
    );
  });

  it('refetches when the status filter changes', async () => {
    renderWithProviders(<PatientListContainer />);

    await waitFor(() => expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ is_active: false })),
    );
  });

  it('paginates through results', async () => {
    listMock.mockResolvedValue(makeResponse(45, 1)); // 45 total → 3 pages
    renderWithProviders(<PatientListContainer />);

    await waitFor(() => expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('opens the register drawer from the toolbar', async () => {
    renderWithProviders(<PatientListContainer />);

    await waitFor(() => expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    expect(screen.getByRole('dialog', { name: 'Register Patient' })).toBeInTheDocument();
  });
});
