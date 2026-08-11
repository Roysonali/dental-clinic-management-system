import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrintDocumentDialog } from './PrintDocumentDialog';

describe('PrintDocumentDialog', () => {
  let printMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    printMock = vi.fn();
    vi.stubGlobal('print', printMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // NOTE: do not manually remove `.print-document` portal nodes here —
    // RTL cleanup unmounts the tree and React removes the portal itself.
    // Removing it first would make React's cleanup throw a NotFoundError.
  });

  it('renders the preview dialog with title, document content and actions', () => {
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={() => {}}
      >
        <div>My printable content</div>
      </PrintDocumentDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Invoice document' })).toBeInTheDocument();
    expect(screen.getByText('Invoice INV-01042')).toBeInTheDocument();
    // The content renders twice: the on-screen preview and the print surface.
    expect(screen.getAllByText('My printable content').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    // The download mechanism is documented in the dialog itself.
    expect(screen.getByText(/Save as PDF/)).toBeInTheDocument();
    // Distinct accessible names for the two close affordances.
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument(); // footer
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeInTheDocument(); // header X
  });

  it('mounts the print surface to document.body when open', () => {
    render(
      <PrintDocumentDialog
        open
        title="Prescription"
        documentType="Prescription"
        onClose={() => {}}
      >
        <div>Rx content</div>
      </PrintDocumentDialog>,
    );

    const surface = document.body.querySelector('.print-document');
    expect(surface).not.toBeNull();
    expect(surface?.textContent).toContain('Rx content');
  });

  it('never leaks dialog chrome (actions, hint) into the print surface', () => {
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={() => {}}
      >
        <div>Only the document</div>
      </PrintDocumentDialog>,
    );

    // The portaled .print-document must contain ONLY the document children —
    // no Close / Print / Download buttons, no "Save as PDF" guidance and no
    // browser-print tips (headers/footers) either.
    const surface = document.body.querySelector('.print-document');
    expect(surface?.textContent).toContain('Only the document');
    expect(surface?.textContent).not.toContain('Download PDF');
    expect(surface?.textContent).not.toContain('Save as PDF');
    expect(surface?.textContent).not.toContain('Headers and footers');
    expect(surface?.textContent).not.toContain('Print');
    expect(surface?.textContent).not.toContain('Close');
  });

  it('guides the user to disable browser headers and footers for a clean document', () => {
    render(
      <PrintDocumentDialog
        open
        title="Prescription"
        documentType="Prescription"
        onClose={() => {}}
      >
        <div>Rx content</div>
      </PrintDocumentDialog>,
    );

    // The dialog teaches both the download mechanism and how to keep the
    // document free of browser chrome (title/URL/date) in the printed PDF.
    expect(screen.getByText(/Save as PDF/)).toBeInTheDocument();
    expect(screen.getByText(/Headers and footers/)).toBeInTheDocument();
  });

  it('renders nothing (dialog + surface) when closed', () => {
    render(
      <PrintDocumentDialog
        open={false}
        title="Prescription"
        documentType="Prescription"
        onClose={() => {}}
      >
        <div>Rx content</div>
      </PrintDocumentDialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.querySelector('.print-document')).toBeNull();
  });

  it('triggers window.print from the Print button', async () => {
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={() => {}}
      >
        <div>Content</div>
      </PrintDocumentDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('triggers window.print from the Download PDF button (Save-as-PDF mechanism)', async () => {
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={() => {}}
      >
        <div>Content</div>
      </PrintDocumentDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('guards against duplicate window.print invocations', async () => {
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={() => {}}
      >
        <div>Content</div>
      </PrintDocumentDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('calls onClose from the dialog close button', () => {
    const onClose = vi.fn();
    render(
      <PrintDocumentDialog
        open
        title="Invoice INV-01042"
        documentType="Invoice"
        onClose={onClose}
      >
        <div>Content</div>
      </PrintDocumentDialog>,
    );

    // The footer Close button (the header X has the distinct name
    // "Close preview").
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
