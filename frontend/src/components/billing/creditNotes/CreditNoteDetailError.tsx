import { Button } from '../../common/Button/Button';
import { ResultState } from '../../common/ResultState';

interface CreditNoteDetailErrorProps {
  creditNoteNumber: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export const CreditNoteDetailError: React.FC<CreditNoteDetailErrorProps> = ({
  creditNoteNumber,
  onRetry,
  onBack,
}) => (
  <ResultState
    variant="error"
    title="Unable to load credit note"
    description={
      creditNoteNumber
        ? `We could not load credit note ${creditNoteNumber}. It may have been removed or you may not have access.`
        : 'We could not load this credit note. It may have been removed or you may not have access.'
    }
    actions={
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>Back to Invoices</Button>
        <Button variant="primary" onClick={onRetry}>Retry</Button>
      </div>
    }
  />
);
