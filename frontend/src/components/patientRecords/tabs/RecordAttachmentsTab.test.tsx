import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { RecordAttachmentsTab } from './RecordAttachmentsTab';
import { patientRecordService } from '../../../services/patientRecordService';
import { userService } from '../../../services/userService';
import type { PatientRecordListEnvelope, AttachmentListItem } from '../../../types/patientRecord';

vi.mock('../../../services/patientRecordService', () => ({
  patientRecordService: {
    listAttachments: vi.fn(),
    getAttachment: vi.fn(),
    createAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    previewAttachment: vi.fn(),
  },
}));

vi.mock('../../../services/userService', () => ({
  userService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { get: vi.fn() },
}));

const listAttachmentsMock = vi.mocked(patientRecordService.listAttachments);
const downloadMock = vi.mocked(patientRecordService.downloadAttachment);
const previewMock = vi.mocked(patientRecordService.previewAttachment);
const listUsersMock = vi.mocked(userService.list);

const rows: AttachmentListItem[] = [
  {
    id: 'at1',
    attachment_type: 'PDF',
    file_name: 'report.pdf',
    mime_type: 'application/pdf',
    file_size: 2 * 1024 * 1024,
    created_at: '2026-08-10T08:00:00Z',
    uploaded_by: 7,
  },
  {
    id: 'at2',
    attachment_type: 'DOCUMENT',
    file_name: 'notes.txt',
    mime_type: 'text/plain',
    file_size: 512,
    created_at: '2026-08-09T08:00:00Z',
    uploaded_by: null,
  },
];

function listEnvelope(items: AttachmentListItem[]): PatientRecordListEnvelope<AttachmentListItem> {
  return { items, total: items.length, page: 1, page_size: 10, pages: 1 };
}

function renderTab({ isFinalized = false }: { isFinalized?: boolean } = {}) {
  return renderWithProviders(
    <RecordAttachmentsTab recordId="rec1" isFinalized={isFinalized} notify={() => {}} />,
  );
}

describe('RecordAttachmentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAttachmentsMock.mockResolvedValue(listEnvelope(rows));
    listUsersMock.mockResolvedValue({
      items: [
        {
          id: 7,
          full_name: 'receptionist2',
          email: 'r@example.com',
          status: 'active',
          is_active: true,
          role_id: null,
          role_name: null,
          last_login_at: null,
          created_at: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    // jsdom lacks blob/URL implementations.
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    window.open = vi.fn();
  });

  it('renders rows with type, size, uploader and date', async () => {
    renderTab();

    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    // Uploader name resolved from the user directory (fallback: User #id).
    expect(await screen.findByText('receptionist2')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // legacy row, no uploader
  });

  it('offers preview + download for PDF rows and download-only for text', async () => {
    previewMock.mockResolvedValue(new Blob(['%PDF-1.4']));
    downloadMock.mockResolvedValue(new Blob(['%PDF-1.4']));

    renderTab();
    await screen.findByText('report.pdf');

    // PDF row → Preview (Eye) + Download.
    expect(screen.getByRole('button', { name: 'Preview report.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report.pdf' })).toBeInTheDocument();
    // Text row → no preview; labelled N/A.
    expect(screen.getByText('Preview N/A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download notes.txt' })).toBeInTheDocument();
  });

  it('downloads via the authorized blob endpoint and preserves the filename', async () => {
    downloadMock.mockResolvedValue(new Blob(['%PDF-1.4']));

    renderTab();
    await screen.findByText('report.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));

    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith('at1'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('opens the preview in a new tab', async () => {
    previewMock.mockResolvedValue(new Blob(['%PDF-1.4']));

    renderTab();
    await screen.findByText('report.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Preview report.pdf' }));

    await waitFor(() => expect(previewMock).toHaveBeenCalledWith('at1'));
    expect(window.open).toHaveBeenCalledWith('blob:mock', '_blank', 'noopener,noreferrer');
  });

  it('hides mutating actions once the record is finalized', async () => {
    renderTab({ isFinalized: true });
    await screen.findByText('report.pdf');

    // Read actions remain — a locked chart is still readable.
    expect(screen.getByRole('button', { name: 'Preview report.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report.pdf' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Upload Attachment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit attachment report.pdf' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete attachment report.pdf' })).not.toBeInTheDocument();
  });

  it('shows an error message when a download fails', async () => {
    downloadMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { success: false, message: 'Attachment file not available', details: null } },
    });

    renderTab();
    await screen.findByText('report.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));

    expect(await screen.findByText('Attachment file not available')).toBeInTheDocument();
  });
});
