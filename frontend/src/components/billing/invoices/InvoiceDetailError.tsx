import type { FC } from 'react';
import { Button } from '../../common/Button/Button';
import { ResultState } from '../../common/ResultState/ResultState';

interface InvoiceDetailErrorProps {
  /** Invoice number for the copy (may be unknown on hard failures). */
  invoiceNumber: string | null;
  onRetry: () => void;
  onBack: () => void;
}

/**
 * InvoiceDetailError — error state for the invoice detail page.
 *
 * Safe copy only (no raw backend exceptions): the invoice may have been
 * removed, or the billing service is unavailable. Retry refetches the query
 * (no browser reload); Back returns to the invoice list.
 */
export const InvoiceDetailError: FC<InvoiceDetailErrorProps> = ({
  invoiceNumber,
  onRetry,
  onBack,
}) => {
  return (
    <ResultState
      variant="error"
      title="Couldn't load this invoice"
      description={
        invoiceNumber
          ? `${invoiceNumber} could not be retrieved. It may have been removed, or the billing service is unavailable.`
          : 'This invoice could not be retrieved. It may have been removed, or the billing service is unavailable.'
      }
      actions={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back to invoices
          </Button>
        </div>
      }
    />
  );
};
