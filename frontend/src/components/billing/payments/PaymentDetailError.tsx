import type { FC } from 'react';
import { Button } from '../../common/Button/Button';
import { ResultState } from '../../common/ResultState/ResultState';

interface PaymentDetailErrorProps {
  /** Payment number for the copy (may be unknown on hard failures). */
  paymentNumber: string | null;
  onRetry: () => void;
  onBack: () => void;
}

/**
 * PaymentDetailError — error state for the payment detail page.
 *
 * Safe copy only (no raw backend exceptions): the payment may have been
 * removed, or the billing service is unavailable. Retry refetches the query
 * (no browser reload); Back returns to the payment list.
 */
export const PaymentDetailError: FC<PaymentDetailErrorProps> = ({
  paymentNumber,
  onRetry,
  onBack,
}) => {
  return (
    <ResultState
      variant="error"
      title="Couldn't load this payment"
      description={
        paymentNumber
          ? `${paymentNumber} could not be retrieved. It may have been removed, or the billing service is unavailable.`
          : 'This payment could not be retrieved. It may have been removed, or the billing service is unavailable.'
      }
      actions={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back to payments
          </Button>
        </div>
      }
    />
  );
};
