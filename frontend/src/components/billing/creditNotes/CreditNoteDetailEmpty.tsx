import { FileQuestion } from 'lucide-react';
import { ResultState } from '../../common/ResultState';
import { Button } from '../../common/Button/Button';

interface CreditNoteDetailEmptyProps {
  onBack: () => void;
  onCreateCreditNote: () => void;
}

export const CreditNoteDetailEmpty: React.FC<CreditNoteDetailEmptyProps> = ({
  onBack,
  onCreateCreditNote,
}) => (
  <ResultState
    variant="info"
    icon={FileQuestion}
    title="Credit note not available"
    description="This credit note has not been created yet or the data is not available from the backend."
    actions={
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>Back to Invoices</Button>
        <Button variant="primary" onClick={onCreateCreditNote}>Create Credit Note</Button>
      </div>
    }
  />
);
