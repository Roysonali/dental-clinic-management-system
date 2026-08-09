import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ResultState } from '../../common/ResultState';
import { Button } from '../../common/Button/Button';
import { ROUTES } from '../../../routes/routes';

export const CreditNoteDetailPermission: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ResultState
      variant="error"
      icon={ShieldAlert}
      title="Permission denied"
      description="You do not have permission to view this credit note. Contact an administrator if you believe this is an error."
      actions={
        <Button variant="secondary" onClick={() => navigate(ROUTES.BILLING_INVOICES)}>
          Back to Invoices
        </Button>
      }
    />
  );
};
