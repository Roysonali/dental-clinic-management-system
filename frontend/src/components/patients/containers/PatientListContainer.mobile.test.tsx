import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { MobileNavProvider } from '../../../layouts/components/mobile/MobileNavContext';
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

vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => ({
    state: { status: 'admin' as const, role: { role_name: 'ADMIN', id: 1, label: 'Administrator' } },
    isAdmin: true,
    isResolved: true,
    role: 'ADMIN' as const,
    can: () => true,
  }),
}));

const listMock = vi.mocked(patientService.list);

const listResponse: PatientListResponse = {
  items: [
    {
      id: 'p1',
      patient_code: 'PAT-00001',
      full_name: 'Amara Okonkwo',
      age: 32,
      gender: 'female',
      primary_contact_number: '+91 98765 43210',
      is_active: true,
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
};

/** Force the phone breakpoint so the container selects the mobile presentation. */
function stubMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderMobile() {
  // The real AppShell provides the MobileNavProvider (which the compact
  // mobile header's hamburger consumes) — mirror that here.
  return renderWithProviders(
    <MobileNavProvider value={{ openNav: vi.fn() }}>
      <Routes>
        <Route path="/patients" element={<PatientListContainer />} />
        <Route path="/patients/:patientId" element={<div>Patient details page</div>} />
      </Routes>
    </MobileNavProvider>,
    { route: '/patients' },
  );
}

describe('PatientListContainer (mobile presentation)', () => {
  beforeEach(() => {
    stubMobileViewport();
    listMock.mockReset();
    listMock.mockResolvedValue(listResponse);
  });

  it('renders the compact mobile header, cards and bottom navigation instead of the desktop table', async () => {
    renderMobile();

    // Compact mobile header (hamburger + title + add) — the global header is hidden on this route.
    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register patient' })).toBeInTheDocument();

    // Card content from the same server data (await — the list query is async).
    expect(await screen.findByText('PAT-00001')).toBeInTheDocument();
    expect(screen.getByText('Amara Okonkwo')).toBeInTheDocument();

    // Search + filter button (filters hidden inside the sheet).
    expect(screen.getByPlaceholderText('Search patients')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open filters' })).toBeInTheDocument();

    // Consistent bottom navigation.
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();

    // Desktop toolbar CTA is not rendered on mobile.
    expect(screen.queryByRole('button', { name: 'Register Patient' })).not.toBeInTheDocument();
  });

  it('navigates to the patient detail page from a card tap', async () => {
    renderMobile();
    await screen.findByText('Amara Okonkwo');

    fireEvent.click(screen.getByRole('button', { name: 'View PAT-00001' }));
    expect(await screen.findByText('Patient details page')).toBeInTheDocument();
  });
});
