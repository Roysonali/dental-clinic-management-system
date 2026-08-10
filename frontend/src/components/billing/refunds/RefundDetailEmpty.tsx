import type { FC } from 'react';
import { FileQuestion } from 'lucide-react';
import { ResultState } from '../../common/ResultState';
import { Button } from '../../common/Button/Button';

interface RefundDetailEmptyProps {
  onBack: () => void;
}

/**
 * RefundDetailEmpty — state when the refund timeline page is opened directly
 * with no cached refund (the backend exposes no GET /billing/refunds/{id},
 * so the page renders from mutation-cached data).
 */
export const RefundDetailEmpty: FC<RefundDetailEmptyProps> = ({ onBack }) => (
  <ResultState
    variant="info"
    icon={FileQuestion}
    title="Refund not available"
    description="This refund has not been created yet in this session, or the data is not available from the backend."
    actions={
      <Button variant="secondary" onClick={onBack}>
        Back to payments
      </Button>
    }
  />
);
