import type { FC } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/testUtils';
import { DashboardPage } from './DashboardPage';

// The live dashboard widgets (Upcoming Appointments + My Treatment Plans)
// fetch real data; these tests verify the Quick Action NAVIGATION, so the
// widgets resolve to their empty states (mirrors treatmentRouting.test.tsx).

vi.mock('../../hooks/auth/useAuth', () => ({
  useAuth: () => ({
    token: 'token',
    user: { id: 1, full_name: 'Dr. Test', email: 'test@clinic.com', status: 'active' },
    isAuthenticated: true,
    isInitializing: false,
    login: vi.fn(async () => {}),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../../hooks/appointments/useTodayAppointments', () => ({
  useTodayAppointments: () => ({ isLoading: false, isError: false, data: [] }),
}));

vi.mock('../../hooks/appointments/useAppointmentNames', () => ({
  useAppointmentNames: () => ({
    data: { patientNames: new Map(), dentistNames: new Map() },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../hooks/treatmentPlans/useMyActiveTreatmentPlans', () => ({
  useMyActiveTreatmentPlans: () => ({ data: { items: [] }, isPending: false }),
}));

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    getByUserId: vi.fn().mockResolvedValue({ id: 'doc-1' }),
  },
}));

/** Renders the current URL (pathname + query) for navigation assertions. */
const LocationDisplay: FC = () => {
  const location = useLocation();
  return (
    <div data-testid="current-location">
      {location.pathname}
      {location.search}
    </div>
  );
};

const DESTINATION_MARKERS: Record<string, string> = {
  '/patients': 'PATIENTS_PAGE',
  '/appointments': 'APPOINTMENTS_PAGE',
  '/billing/invoices': 'INVOICES_PAGE',
};

function renderDashboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      {Object.entries(DESTINATION_MARKERS).map(([path, marker]) => (
        <Route
          key={path}
          path={path}
          element={
            <>
              <div data-testid="destination-page">{marker}</div>
              <LocationDisplay />
            </>
          }
        />
      ))}
    </Routes>,
    { route: '/dashboard' },
  );
}

describe('DashboardPage — quick actions', () => {
  it('renders all four quick-action CTAs', () => {
    renderDashboard();

    expect(screen.getByRole('button', { name: 'New Patient' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule Appointment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Appointments' })).toBeInTheDocument();
  });

  it('navigates to the patient create flow (deep-linked drawer) from New Patient', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'New Patient' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/patients?create=true');
    });
    expect(screen.getByTestId('destination-page')).toHaveTextContent('PATIENTS_PAGE');
  });

  it('navigates to the appointment create flow (deep-linked drawer) from Schedule Appointment', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Appointment' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/appointments?create=true');
    });
    expect(screen.getByTestId('destination-page')).toHaveTextContent('APPOINTMENTS_PAGE');
  });

  it('navigates to the invoice create flow (deep-linked drawer) from Create Invoice', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/billing/invoices?create=true');
    });
    expect(screen.getByTestId('destination-page')).toHaveTextContent('INVOICES_PAGE');
  });

  it('navigates to the appointments list from View Appointments (no create intent)', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'View Appointments' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/appointments');
    });
    expect(screen.getByTestId('destination-page')).toHaveTextContent('APPOINTMENTS_PAGE');
    expect(screen.getByTestId('current-location')).not.toHaveTextContent('create=true');
  });
});
