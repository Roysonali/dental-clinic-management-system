import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { TreatmentPlanDetailsContainer } from './TreatmentPlanDetailsContainer';
import { treatmentPlanService } from '../../../services/treatmentPlanService';
import { patientService } from '../../../services/patientService';
import { doctorService } from '../../../services/doctorService';
import { procedureService } from '../../../services/procedureService';
import type { TreatmentPlanResponse } from '../../../types/treatmentPlan';
import type { PatientResponse } from '../../../types/patient';
import type { DoctorResponse } from '../../../types/doctor';

vi.mock('../../../services/treatmentPlanService', () => ({
  treatmentPlanService: {
    getPlan: vi.fn(),
    updateItem: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    reorderItems: vi.fn(),
    submitForReview: vi.fn(),
    cancelPlan: vi.fn(),
    createVersion: vi.fn(),
    restoreVersion: vi.fn(),
    getVersion: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/doctorService', () => ({
  doctorService: { list: vi.fn(), getByUserId: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/procedureService', () => ({
  procedureService: {
    list: vi.fn(),
    search: vi.fn(),
    listActive: vi.fn(),
    get: vi.fn(),
    count: vi.fn(),
    getByCode: vi.fn(),
  },
}));

const getPlanMock = vi.mocked(treatmentPlanService.getPlan);
const updateItemMock = vi.mocked(treatmentPlanService.updateItem);
const patientGetMock = vi.mocked(patientService.get);
const doctorGetMock = vi.mocked(doctorService.get);
const listActiveMock = vi.mocked(procedureService.listActive);

const plan: TreatmentPlanResponse = {
  id: 'plan-1',
  plan_code: 'TXN-000001',
  patient_id: 'p1',
  doctor_id: 'd1',
  status: 'draft',
  current_version: 1,
  is_active: true,
  // NOTE: the detail aggregate deliberately has NO item_count /
  // total_estimated_cost — those are list-only fields (F-01 regression).
  created_by: 1,
  created_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-01T08:00:00Z',
  clinical_notes: 'Toothache',
  observations: null,
  dentist_recommendations: 'Root canal advised',
  valid_from: null,
  valid_to: null,
  items: [
    {
      id: 'item-1',
      plan_id: 'plan-1',
      procedure_id: 5,
      procedure: { id: 5, code: 'RCT', name: 'Root Canal', category: 'endodontic', default_cost: 1500, is_active: true },
      sequence_number: 1,
      tooth_number: 46,
      tooth_surface: 'MOD',
      quadrant: 'UR',
      arch: 'upper',
      estimated_cost: 1500,
      discount: 0,
      item_status: 'pending',
      notes: 'Existing note',
      appointment_id: null,
      diagnosis_id: null,
    },
  ],
  approval: null,
  versions: [{ id: 'v1', version_number: 1, change_reason: 'Initial', changed_by: 1, created_at: '2026-08-01T08:00:00Z' }],
  updated_by: null,
};

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/treatment-plans/:planId" element={<TreatmentPlanDetailsContainer planId="plan-1" />} />
    </Routes>,
    { route: '/treatment-plans/plan-1' },
  );
}

describe('TreatmentPlanDetailsContainer', () => {
  beforeEach(() => {
    getPlanMock.mockReset();
    updateItemMock.mockReset();
    patientGetMock.mockReset();
    doctorGetMock.mockReset();
    listActiveMock.mockReset();

    getPlanMock.mockResolvedValue(plan);
    patientGetMock.mockResolvedValue({
      id: 'p1',
      patient_code: 'PAT-000001',
      full_name: 'Juan Dela Cruz',
      date_of_birth: '1990-05-15',
      age: 36,
      gender: 'male',
      primary_contact_number: '+639123456789',
      emergency_contact_number: null,
      email: null,
      address: null,
      remarks: null,
      is_active: true,
      created_by: 1,
      updated_by: null,
      created_at: '2026-08-01T08:00:00Z',
      updated_at: '2026-08-01T08:00:00Z',
    } satisfies PatientResponse);
    doctorGetMock.mockResolvedValue({
      id: 'd1',
      doctor_code: 'DOC-000001',
      user_id: 3,
      user_full_name: 'Dr. Santos',
      user_email: null,
      date_of_birth: null,
      gender: null,
      primary_phone: '+639123456789',
      address: null,
      qualification: null,
      registration_number: null,
      years_of_experience: null,
      consultation_fee: null,
      consultation_duration: null,
      languages_known: null,
      profile_photo_url: null,
      biography: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      available_for_appointment: true,
      on_leave: false,
      is_active: true,
      specializations: [],
      created_by: 1,
      updated_by: null,
      created_at: '2026-08-01T08:00:00Z',
      updated_at: '2026-08-01T08:00:00Z',
    } satisfies DoctorResponse);
    listActiveMock.mockResolvedValue([]);
  });

  it('renders the plan aggregate (header, items, clinical info)', async () => {
    renderDetails();

    await waitFor(() => expect(screen.getByText('TXN-000001')).toBeInTheDocument());
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Root Canal')).toBeInTheDocument();
    expect(screen.getByText('Toothache')).toBeInTheDocument();
    // The header renders names joined in one text node — use a substring matcher.
    expect(await screen.findByText(/Juan Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Santos/)).toBeInTheDocument();
  });

  it('opens the item drawer on row click and saves notes (PATCH item)', async () => {
    updateItemMock.mockResolvedValue({ ...plan, items: plan.items.map((i) => (i.id === 'item-1' ? { ...i, notes: 'Updated note' } : i)) });
    renderDetails();

    await waitFor(() => expect(screen.getByText('Root Canal')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Root Canal'));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Item details' })).toBeInTheDocument());
    const notesField = screen.getByLabelText('Notes') as HTMLTextAreaElement;
    expect(notesField.value).toBe('Existing note');
    fireEvent.change(notesField, { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Notes' }));

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledWith('plan-1', 'item-1', { notes: 'Updated note' }));
  });

  it('shows the version history tab and its timeline', async () => {
    renderDetails();

    await waitFor(() => expect(screen.getByText('TXN-000001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /History/ }));

    expect(await screen.findByText('Version 1')).toBeInTheDocument();
    // "Initial" appears in both the timeline and the activity card — assert
    // the timeline's reason via the scoped query (both are on the page).
    expect(screen.getAllByText('Initial').length).toBeGreaterThan(0);
  });

  it('offers the draft actions (Submit for Review + Cancel)', async () => {
    renderDetails();

    await waitFor(() => expect(screen.getByText('TXN-000001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Submit for Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Plan' })).toBeInTheDocument();
  });

  // F-01 regression: the detail aggregate carries NO item_count /
  // total_estimated_cost — the Plan Summary card must derive both from the
  // embedded items (1 item × ₹1,500) instead of rendering blank / "₹—".
  it('derives the Plan Summary totals from plan.items (F-01 regression)', async () => {
    renderDetails();

    await waitFor(() => expect(screen.getByText('TXN-000001')).toBeInTheDocument());

    const summaryCard = screen.getByText('Plan Summary').closest('div.rounded-xl');
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getByText('1')).toBeInTheDocument();
    // formatCurrency renders INR with thousands grouping — "₹1,500.00".
    expect(within(summaryCard as HTMLElement).getByText('₹1,500.00')).toBeInTheDocument();
    // The pre-fix defect rendered a placeholder dash for an undefined total.
    expect(screen.queryByText('₹—')).not.toBeInTheDocument();
  });
});
