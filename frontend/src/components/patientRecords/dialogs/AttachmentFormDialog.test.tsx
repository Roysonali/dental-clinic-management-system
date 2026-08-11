import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/testUtils';
import { AttachmentFormDialog } from './AttachmentFormDialog';
import type { AttachmentListItem } from '../../../types/patientRecord';

const attachment: AttachmentListItem = {
  id: 'at1',
  attachment_type: 'PDF',
  file_name: 'report.pdf',
  mime_type: 'application/pdf',
  file_size: 2048,
  created_at: '2026-08-10T08:00:00Z',
  uploaded_by: 7,
};

function renderDialog(props: Partial<Parameters<typeof AttachmentFormDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const utils = renderWithProviders(
    <AttachmentFormDialog
      open
      attachment={null}
      submitting={false}
      serverErrors={{}}
      serverMessage={null}
      onSubmit={onSubmit}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSubmit, onClose, ...utils };
}

/** The shared FileUpload renders a hidden (sr-only, aria-hidden) input. */
function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('file input not found');
  }
  return input;
}

describe('AttachmentFormDialog — create (file upload)', () => {
  it('lets the user pick a file and reports its name + size', async () => {
    const { container } = renderDialog();
    const user = userEvent.setup();

    const file = new File(['%PDF-1.4 fake'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(fileInput(container), file);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    // 13 bytes → human-readable size.
    expect(screen.getByText('13 B')).toBeInTheDocument();
  });

  it('submits the selected file with the attachment type', async () => {
    const { onSubmit, container } = renderDialog();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Attachment Type/i), 'PDF');
    const file = new File(['%PDF-1.4 fake'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(fileInput(container), file);

    await user.click(screen.getByRole('button', { name: 'Upload Attachment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as { attachment_type: string; file: File };
    expect(values.attachment_type).toBe('PDF');
    expect(values.file).toBe(file);
  });

  it('blocks submission when no file is chosen', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Attachment Type/i), 'PDF');
    await user.click(screen.getByRole('button', { name: 'Upload Attachment' }));

    expect(onSubmit).not.toHaveBeenCalled();
    // Rendered both inline (field) and in the validation summary.
    expect(screen.getAllByText('Choose a file to upload').length).toBeGreaterThan(0);
  });

  it('rejects files outside the picker accept allowlist', async () => {
    const { onSubmit, container } = renderDialog();
    const user = userEvent.setup();

    // The picker's accept attribute (.pdf/images/docs/txt) filters this out.
    const exe = new File(['MZ'], 'script.exe', { type: 'application/x-msdownload' });
    await user.upload(fileInput(container), exe);
    await user.click(screen.getByRole('button', { name: 'Upload Attachment' }));

    expect(screen.queryByText('script.exe')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // No file entered the form → the required-file error shows.
    expect(screen.getAllByText('Choose a file to upload').length).toBeGreaterThan(0);
  });

  it('rejects files over the 10 MB limit at the picker', async () => {
    const { onSubmit, container } = renderDialog();
    const user = userEvent.setup();

    const big = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput(container), big);

    // The shared FileUpload surfaces the size rejection message and never
    // adds the file, so the form cannot be submitted with it.
    expect(screen.getByText(/1 file skipped — exceeds 10MB limit/)).toBeInTheDocument();
    expect(screen.queryByText('big.pdf')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Upload Attachment' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AttachmentFormDialog — edit', () => {
  it('shows the file as immutable and only submits a category change', async () => {
    const { onSubmit } = renderDialog({ attachment });

    // The file is rendered read-only (no picker), with size metadata.
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf · 2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be changed after upload/)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a file/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Attachment Type/i), 'SCAN');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as { attachment_type: string; file: File | null };
    expect(values.attachment_type).toBe('SCAN');
    // The file is immutable in edit mode — always null in the payload.
    expect(values.file).toBeNull();
  });
});
