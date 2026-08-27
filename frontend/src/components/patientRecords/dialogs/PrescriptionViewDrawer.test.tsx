import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PrescriptionViewDrawer } from './PrescriptionViewDrawer';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientService } from '../../../services/patientService';
import type { PrescriptionResponse } from '../../../types/patientRecord';
import type { PatientResponse } from '../../../types/patient';

vi.mock('../../../services/patientRecordService', () => ({
  patientRecordService: {
    getPrescription: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: {
    get: vi.fn(),
  },
}));

const getPrescriptionMock = vi.mocked(patientRecordService.getPrescription);
const getPatientMock = vi.mocked(patientService.get);

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
      medicine_name: 'ghjk',
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

function renderDrawer() {
  return renderWithProviders(
    <PrescriptionViewDrawer
      open
      prescriptionId="rx1"
      recordId="rec1"
      patientId="p1"
      patientName="Test Patient-Two"
      isFinalized={false}
      prescribedByName="receptionist2"
      notify={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('PrescriptionViewDrawer printable document actions (Task 4)', () => {
  let printMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPrescriptionMock.mockReset();
    getPatientMock.mockReset();
    getPrescriptionMock.mockResolvedValue(prescription);
    getPatientMock.mockResolvedValue(patient);
    printMock = vi.fn();
    vi.stubGlobal('print', printMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the prescription detail with Print and Download PDF actions', async () => {
    renderDrawer();

    // Drawer opens and loads the prescription.
    expect(await screen.findByText('ghjk')).toBeInTheDocument();
    expect(screen.getByText('500mg')).toBeInTheDocument();

    // Both document actions render in the drawer header (labeled).
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('groups the document actions separately from the drawer close control', async () => {
    renderDrawer();
    await screen.findByText('ghjk');

    // The title + metadata row is the drawer identity; Close sits at the
    // far-right edge per the DensCare Drawer pattern ([Title] … [Close]).
    expect(screen.getByRole('heading', { name: 'Prescription' })).toBeInTheDocument();
    expect(screen.getByText(/Prescribed .*· receptionist2/)).toBeInTheDocument();

    // Print and Download PDF are grouped under one labelled action group.
    const actions = screen.getByRole('group', { name: 'Document actions' });
    expect(within(actions).getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();

    // The drawer Close control is NOT part of the document-action group.
    expect(within(actions).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes the drawer via the header close control', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <PrescriptionViewDrawer
        open
        prescriptionId="rx1"
        recordId="rec1"
        patientId="p1"
        patientName="Test Patient-Two"
        isFinalized={false}
        prescribedByName="receptionist2"
        notify={() => {}}
        onClose={onClose}
      />,
    );
    await screen.findByText('ghjk');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the printable prescription document from the print action', async () => {
    renderDrawer();
    await screen.findByText('ghjk');

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    const dialog = await screen.findByRole('dialog', { name: 'Prescription document' });
    const doc = within(dialog);
    // Document content comes from the backend prescription + patient data.
    expect(doc.getByText('Test Patient-Two')).toBeInTheDocument();
    expect(doc.getByText('PAT-000012')).toBeInTheDocument();
    expect(doc.getByText('ghjk')).toBeInTheDocument();
    expect(doc.getByText('500mg')).toBeInTheDocument();
    expect(doc.getByText('TDS')).toBeInTheDocument();
    expect(doc.getByText('5 days')).toBeInTheDocument();
    expect(doc.getByText('receptionist2')).toBeInTheDocument();
  });

  it('triggers window.print from the dialog download action (Save-as-PDF mechanism)', async () => {
    renderDrawer();
    await screen.findByText('ghjk');

    // The drawer action opens the preview dialog; the dialog's own
    // Download PDF button triggers the print dialog (Save as PDF).
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Prescription document' });

    // Two "Download PDF" buttons now exist (drawer header + dialog footer) —
    // click the one inside the dialog.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('renders the document gracefully when patient data cannot be resolved', async () => {
    getPatientMock.mockRejectedValue(new Error('network'));
    renderWithProviders(
      <PrescriptionViewDrawer
        open
        prescriptionId="rx1"
        recordId="rec1"
        patientId="p1"
        patientName={null}
        isFinalized={false}
        prescribedByName="receptionist2"
        notify={() => {}}
        onClose={() => {}}
      />,
    );
    await screen.findByText('ghjk');

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    const dialog = await screen.findByRole('dialog', { name: 'Prescription document' });
    const doc = within(dialog);
    // Patient fallback placeholder, medicine still renders from the backend.
    expect(doc.getByText(/Patient #/)).toBeInTheDocument();
    expect(doc.getByText('ghjk')).toBeInTheDocument();
  });
});
