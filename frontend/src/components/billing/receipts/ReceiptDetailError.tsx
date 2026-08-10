import type { FC } from 'react';
import { Button } from '../../common/Button/Button';
import { ResultState } from '../../common/ResultState/ResultState';

interface ReceiptDetailErrorProps {
  /** Receipt number for the copy (may be unknown on hard failures). */
  receiptNumber: string | null;
  onRetry: () => void;
  onBack: () => void;
}

/**
 * ReceiptDetailError — error state for the receipt detail page.
 * Safe copy only (no raw backend exceptions). Retry refetches the query;
 * Back returns to the linked payment.
 */
export const ReceiptDetailError: FC<ReceiptDetailErrorProps> = ({
  receiptNumber,
  onRetry,
  onBack,
}) => {
  return (
    <ResultState
      variant="error"
      title="Couldn't load this receipt"
      description={
        receiptNumber
          ? `${receiptNumber} could not be retrieved. It may have been removed, or the billing service is unavailable.`
          : 'This receipt could not be retrieved. It may have been removed, or the billing service is unavailable.'
      }
      actions={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back to payment
          </Button>
        </div>
      }
    />
  );
};
