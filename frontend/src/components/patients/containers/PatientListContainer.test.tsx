import type { FC } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../test/testUtils';
import { PatientListContainer } from './PatientListContainer';
import { patientService } from '../../../services/patientService';

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

// Activate/deactivate are ADMIN-gated via usePermission (backend
// require_roles([ADMIN])) — resolve as non-admin so the row actions stay
// hidden and the tests focus on the create-intent handoff.
vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => ({ can: vi.fn(() => false) }),
}));

const listMock = vi.mocked(patientService.list);

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

function renderList(route = '/patients') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/patients"
        element={
          <>
            <PatientListContainer />
            <LocationDisplay />
          </>
        }
      />
      <Route path="/patients/:patientId" element={<div>Patient details page</div>} />
    </Routes>,
    { route },
  );
}

describe('PatientListContainer — dashboard create-intent handoff (?create=true)', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
  });

  it('automatically opens the create drawer when mounted with ?create=true (dashboard CTA handoff)', async () => {
    renderList('/patients?create=true');

    expect(await screen.findByRole('dialog', { name: 'Register Patient' })).toBeInTheDocument();
  });

  it('does NOT auto-open the create drawer on the plain patient list route', async () => {
    renderList();
    await screen.findByText('No patients found');

    expect(screen.queryByRole('dialog', { name: 'Register Patient' })).not.toBeInTheDocument();
  });

  it('strips the create query param when the drawer is closed', async () => {
    renderList('/patients?create=true');

    const dialog = await screen.findByRole('dialog', { name: 'Register Patient' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Register Patient' })).not.toBeInTheDocument();
    });
    const location = screen.getByTestId('current-location');
    expect(location).toHaveTextContent('/patients');
    expect(location).not.toHaveTextContent('create=true');
  });
});
