import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { RecordPrescriptionsTab } from './RecordPrescriptionsTab';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientService } from '../../../services/patientService';
import { userService } from '../../../services/userService';
import type { PatientRecordListEnvelope, PrescriptionListItem } from '../../../types/patientRecord';
import type { PrescriptionResponse } from '../../../types/patientRecord';
import type { PatientResponse } from '../../../types/patient';

vi.mock('../../../services/patientRecordService', () => ({
  patientRecordService: {
    listPrescriptions: vi.fn(),
    getPrescription: vi.fn(),
    createPrescription: vi.fn(),
    updatePrescription: vi.fn(),
    deletePrescription: vi.fn(),
    createPrescriptionItem: vi.fn(),
    updatePrescriptionItem: vi.fn(),
    deletePrescriptionItem: vi.fn(),
    bulkCreatePrescriptionItems: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { get: vi.fn() },
}));

vi.mock('../../../services/userService', () => ({
  userService: { list: vi.fn(), get: vi.fn() },
}));

const listPrescriptionsMock = vi.mocked(patientRecordService.listPrescriptions);
const getPrescriptionMock = vi.mocked(patientRecordService.getPrescription);
const getPatientMock = vi.mocked(patientService.get);
const listUsersMock = vi.mocked(userService.list);

const rows: PrescriptionListItem[] = [
  { id: 'rx1', prescribed_at: '2026-08-09T19:55:02.605787+05:30', prescribed_by: 7, medicine_count: 2 },
  { id: 'rx2', prescribed_at: '2026-08-10T10:00:00Z', prescribed_by: 8, medicine_count: 1 },
];

function listEnvelope(items: PrescriptionListItem[]): PatientRecordListEnvelope<PrescriptionListItem> {
  return { items, total: items.length, page: 1, page_size: 10, pages: 1 };
}

const prescription: PrescriptionResponse = {
  id: 'rx1',
  patient_record_id: 'rec1',
  prescribed_by: 7,
  prescribed_at: '2026-08-09T19:55:02.605787+05:30',
  notes: null,
  created_at: '2026-08-09T19:55:02.605787+05:30',
  updated_at: '2026-08-09T19:55:02.605787+05:30',
  items: [
    {
      id: 'it1',
      prescription_id: 'rx1',
      medicine_name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TDS',
      duration: '5 days',
      instructions: null,
      created_at: '2026-08-09T19:55:02.605787+05:30',
      updated_at: '2026-08-09T19:55:02.605787+05:30',
    },
  ],
};

const patient: PatientResponse = {
  id: 'p1',
  patient_code: 'PAT-000012',
  first_name: 'Test',
  middle_name: null,
  last_name: 'Patient-Two',
  full_name: 'Test Patient-Two',
  date_of_birth: '1998-03-14',
  age: 28,
  gender: 'male',
  primary_contact_number: '9876543210',
  emergency_contact_number: null,
  email: null,
  address: null,
  remarks: null,
  is_active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderTab({ isFinalized = false }: { isFinalized?: boolean } = {}) {
  return renderWithProviders(
    <RecordPrescriptionsTab
      recordId="rec1"
      patientId="p1"
      patientName="Test Patient-Two"
      isFinalized={isFinalized}
      notify={() => {}}
    />,
  );
}

describe('RecordPrescriptionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPrescriptionsMock.mockResolvedValue(listEnvelope(rows));
    // The user-name resolver batches the directory (admin-only endpoint).
    listUsersMock.mockResolvedValue({
      items: [
        { id: 7, full_name: 'receptionist2', email: 'r@example.com', status: 'active', is_active: true, role_id: null, role_name: null, last_login_at: null, created_at: null },
        { id: 8, full_name: 'doctor1', email: 'd@example.com', status: 'active', is_active: true, role_id: null, role_name: null, last_login_at: null, created_at: null },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
  });

  it('opens the prescription document via an explicit, labeled action', async () => {
    getPrescriptionMock.mockResolvedValue(prescription);
    getPatientMock.mockResolvedValue(patient);
    renderTab();

    // Every row offers a labelled "View Prescription" action — never a bare,
    // attachment-like icon.
    const viewButtons = await screen.findAllByRole('button', { name: 'View Prescription' });
    expect(viewButtons).toHaveLength(2);

    // The labeled action also advertises the print/download capability and
    // carries a document icon (not a paperclip).
    expect(viewButtons[0]).toHaveAttribute(
      'title',
      'Open the prescription — view, print or download',
    );
    expect(viewButtons[0].textContent).toContain('View Prescription');

    // Mutating actions are available while the record is editable.
    expect(screen.getAllByRole('button', { name: 'Edit prescription notes' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete prescription' })).toHaveLength(2);

    // Opening a prescription immediately surfaces Print / Download PDF.
    fireEvent.click(viewButtons[0]);
    await screen.findByText('Amoxicillin');
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('keeps View Prescription for finalized records but hides mutating actions', async () => {
    renderTab({ isFinalized: true });

    // Viewing a locked prescription remains possible…
    const viewButtons = await screen.findAllByRole('button', { name: 'View Prescription' });
    expect(viewButtons).toHaveLength(2);

    // …but nothing that mutates the record is offered.
    expect(screen.queryByRole('button', { name: 'Edit prescription notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete prescription' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Prescription' })).not.toBeInTheDocument();
  });
});
