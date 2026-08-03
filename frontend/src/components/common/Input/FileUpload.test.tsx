import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('renders the drop zone with label and hint', () => {
    render(<FileUpload label="Attachments" />);
    expect(screen.getByRole('button', { name: 'Drop files here or click to browse' })).toBeInTheDocument();
    expect(screen.getByText('PNG, JPG, PDF up to 10MB')).toBeInTheDocument();
  });

  it('uploads files and reports them via onChange (uncontrolled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<FileUpload multiple onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(input, file);

    expect(onChange).toHaveBeenCalledWith([file]);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('supports controlled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const file = new File(['content'], 'doc.txt', { type: 'text/plain' });
    render(<FileUpload value={[file]} onChange={onChange} />);

    expect(screen.getByText('doc.txt')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Remove doc.txt'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('removes a single file and keeps the remaining ones with stable keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<FileUpload multiple onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const first = new File(['content'], 'dup.txt', { type: 'text/plain' });
    const second = new File(['content'], 'dup.txt', { type: 'text/plain' });
    await user.upload(input, [first, second]);

    expect(screen.getAllByText('dup.txt')).toHaveLength(2);

    // Removing the first entry must not break the second (identical name + size).
    const removeButtons = screen.getAllByLabelText('Remove dup.txt');
    await user.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([second]);
    expect(screen.getAllByText('dup.txt')).toHaveLength(1);
  });

  it('rejects oversized files with a message', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<FileUpload maxSizeMB={1} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const big = new File([new ArrayBuffer(2 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    await user.upload(input, big);

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.getByText(/exceeds 1MB limit/)).toBeInTheDocument();
  });

  it('is disabled and does not open the file dialog when disabled', async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload disabled />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Drop files here or click to browse' }));
    expect(input.files?.length ?? 0).toBe(0);
  });
});
