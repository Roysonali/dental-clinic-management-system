import { useCallback, useEffect, useRef, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { IconButton } from '../Button/IconButton';
import { Icon } from '../Icon/Icon';

export interface PrintDocumentDialogProps {
  /** Open state — when true the print surface is mounted (portaled to body). */
  open: boolean;
  /**
   * Short document identifier shown in the header and used to derive the
   * browser's default PDF filename, e.g. "INV-01042" or "Prescription".
   */
  title: string;
  /** Document type for the accessible dialog name, e.g. "Invoice document". */
  documentType: string;
  onClose: () => void;
  /** The printable document content. Rendered twice: once for the on-screen
   *  A4 preview and once into the print surface. The component is purely
   *  presentational, so the two instances are guaranteed identical. */
  children: ReactNode;
}

/**
 * PrintDocumentDialog — shared printable-document surface (Task 4).
 *
 * Print architecture (approved): browser print with a print-optimized A4
 * layout. Both "Print" and "Download PDF" open the same document; the
 * browser print dialog is the PDF export mechanism ("Save as PDF").
 *
 * - The document preview renders on screen inside the modal (professional
 *   "viewable" experience) inside a white A4-sheet frame.
 * - A second instance of the same content is portaled to `document.body`
 *   inside `.print-document`. The global `@media print` rules in
 *   `index.css` hide the application chrome and print only that surface,
 *   with `@page { size: A4 }` margins and native pagination.
 * - While printing, `document.title` is set to the document title so the
 *   browser's default PDF filename is meaningful (e.g. "INV-01042 — DensCare").
 *
 * Download is implemented as browser Print → Save as PDF (zero new
 * dependencies). The footer hint tells the user exactly that, so the
 * capability is never presented as something it is not.
 */
export const PrintDocumentDialog: FC<PrintDocumentDialogProps> = ({
  open,
  title,
  documentType,
  onClose,
  children,
}) => {
  const printingRef = useRef(false);

  // Give the generated PDF a sensible default filename (browsers derive it
  // from document.title) and restore the app title afterwards.
  useEffect(() => {
    if (!open) return;
    const previousTitle = document.title;
    document.title = `${title} — DensCare`;
    return () => {
      document.title = previousTitle;
    };
  }, [open, title]);

  // Release the print guard when the browser closes the print dialog. In
  // Chromium/Firefox window.print() blocks and the rAF callback resets the
  // ref directly; Safari returns early, so `afterprint` is the reliable
  // reset path there (and harmless where print is blocking).
  useEffect(() => {
    if (!open) return;
    const resetGuard = () => {
      printingRef.current = false;
    };
    window.addEventListener('afterprint', resetGuard);
    return () => window.removeEventListener('afterprint', resetGuard);
  }, [open]);

  const handlePrint = useCallback(() => {
    // Guard against duplicate triggers (double-click / key repeat).
    if (printingRef.current) return;
    printingRef.current = true;
    // Give React a frame to commit the portal surface before the (blocking)
    // print dialog opens.
    requestAnimationFrame(() => {
      window.print();
      printingRef.current = false;
    });
  }, []);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        ariaLabel={`${documentType} document`}
      >
        <Modal.Header className="no-print">
          <div className="flex w-full items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">
                {title}
              </h2>
              <p className="mt-0.5 text-caption text-neutral-500">
                Printable {documentType.toLowerCase()} — preview
              </p>
            </div>
            <IconButton
              icon={<Icon icon={X} size="sm" />}
              aria-label="Close preview"
              title="Close preview"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        </Modal.Header>

        <Modal.Body className="no-print bg-neutral-100">
          {/* White A4-sheet preview frame (screen only — never printed). */}
          <div className="mx-auto w-full max-w-[820px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md">
            {children}
          </div>
        </Modal.Body>

        {/* `flex-wrap` lets the hint and the actions stack gracefully on
            narrow screens instead of squeezing the button labels; the shared
            Button now guarantees labels never wrap (whitespace-nowrap). */}
        <Modal.Footer className="no-print flex-wrap">
          <p className="mr-auto max-w-xs text-caption text-neutral-500">
            Download uses the browser print dialog — choose{' '}
            <span className="font-medium text-neutral-700">“Save as PDF”</span>{' '}
            to save a PDF file.
          </p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Icon icon={Printer} size="xs" />}
          >
            Print
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Icon icon={Download} size="xs" />}
            title="Opens the print dialog — choose “Save as PDF” to download"
          >
            Download PDF
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Print surface — portaled to <body> so the @media print rules can
          isolate it from the app chrome without any ancestor clipping. */}
      {open &&
        createPortal(
          <div className="print-document" aria-hidden="true">
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};
