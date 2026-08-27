import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { PatientDetailsContainer } from './PatientDetailsContainer';
import { patientService } from '../../../services/patientService';
import type { PatientResponse } from '../../../types/patient';

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

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: {
    listByPatient: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../../../services/doctorService', () => ({
  doctorService: {
    getByUserId: vi.fn().mockResolvedValue({ user_full_name: 'Dr. Test' }),
  },
}));

const getMock = vi.mocked(patientService.get);

const patient: PatientResponse = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Juan Dela Cruz',
  date_of_birth: '1990-05-15',
  age: 34,
  gender: 'male',
  primary_contact_number: '+639123456789',
  emergency_contact_number: '+639987654321',
  email: 'juan@example.com',
  address: '123 Rizal St.',
  remarks: 'Allergic to penicillin.',
  is_active: true,
  created_by: 1,
  updated_by: 1,
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-06-20T14:45:00Z',
};

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/patients/:patientId" element={<PatientDetailsContainer />} />
      <Route path="/patients" element={<div>Patients list page</div>} />
    </Routes>,
    { route: '/patients/p1' },
  );
}

describe('PatientDetailsContainer', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders the patient header once loaded', async () => {
    getMock.mockResolvedValue(patient);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
    });
    // PAT-000001 appears in both the header badge and the information card.
    expect(screen.getAllByText('PAT-000001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
  });

  it('renders the Overview tab content with information cards', async () => {
    getMock.mockResolvedValue(patient);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Patient Information')).toBeInTheDocument();
    });
    // Appears both as the info-card field label and the card title.
    expect(screen.getAllByText('Emergency Contact').length).toBeGreaterThan(0);
    expect(screen.getByText('Allergic to penicillin.')).toBeInTheDocument();
  });

  it('navigates back to the patients list from the Back control', async () => {
    getMock.mockResolvedValue(patient);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Patients' }));

    await waitFor(() => {
      expect(screen.getByText('Patients list page')).toBeInTheDocument();
    });
  });

  it('renders all detail tabs', async () => {
    getMock.mockResolvedValue(patient);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Patient Information')).toBeInTheDocument();
    });

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    for (const label of ['Overview', 'Records', 'Treatment Plans', 'Appointments', 'Billing', 'Timeline', 'Audit']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('shows a loading state while fetching', () => {
    getMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderDetails();
    expect(screen.getByRole('status', { name: 'Loading patient' })).toBeInTheDocument();
    // The Back control is available even while loading.
    expect(screen.getByRole('button', { name: 'Back to Patients' })).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    getMock.mockRejectedValueOnce(new Error('Patient does not exist'));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Unable to load patient')).toBeInTheDocument();
    });
    // The Back control is available even when the patient fails to load.
    expect(screen.getByRole('button', { name: 'Back to Patients' })).toBeInTheDocument();

    getMock.mockResolvedValue(patient);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Patient Information')).toBeInTheDocument();
    });
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});
