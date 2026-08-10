import type { FC } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../test/testUtils';
import { AppointmentListContainer } from './AppointmentListContainer';
import { appointmentService } from '../../../services/appointmentService';
import { doctorService } from '../../../services/doctorService';

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    today: vi.fn(),
  },
}));

// The create drawer's dentist dropdown loads via useDoctors when open.
vi.mock('../../../services/doctorService', () => ({
  doctorService: {
    list: vi.fn(),
    getByUserId: vi.fn(),
  },
}));

const listMock = vi.mocked(appointmentService.list);
const doctorListMock = vi.mocked(doctorService.list);

/** Renders the current URL (pathname + query) for create-intent assertions. */
const LocationDisplay: FC = () => {
  const location = useLocation();
  return (
    <div data-testid="current-location">
      {location.pathname}
      {location.search}
    </div>
  );
};

function renderList(route = '/appointments') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/appointments"
        element={
          <>
            <AppointmentListContainer />
            <LocationDisplay />
          </>
        }
      />
      <Route path="/appointments/:appointmentId" element={<div>Appointment details page</div>} />
    </Routes>,
    { route },
  );
}

describe('AppointmentListContainer — dashboard create-intent handoff (?create=true)', () => {
  beforeEach(() => {
    listMock.mockReset();
    doctorListMock.mockReset();
    listMock.mockResolvedValue({ items: [], total: 0 });
    doctorListMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('automatically opens the create drawer when mounted with ?create=true (dashboard CTA handoff)', async () => {
    renderList('/appointments?create=true');

    expect(await screen.findByRole('dialog', { name: 'New Appointment' })).toBeInTheDocument();
  });

  it('does NOT auto-open the create drawer on the plain appointment list route', async () => {
    renderList();
    await screen.findByText('No appointments found');

    expect(screen.queryByRole('dialog', { name: 'New Appointment' })).not.toBeInTheDocument();
  });

  it('strips the create query param when the drawer is closed', async () => {
    renderList('/appointments?create=true');

    const dialog = await screen.findByRole('dialog', { name: 'New Appointment' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New Appointment' })).not.toBeInTheDocument();
    });
    const location = screen.getByTestId('current-location');
    expect(location).toHaveTextContent('/appointments');
    expect(location).not.toHaveTextContent('create=true');
  });
});
