import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { CreditNoteDetailsContainer } from '../../components/billing/creditNotes/containers/CreditNoteDetailsContainer';

export const CreditNoteDetailsPage: FC = () => {
  const { creditNoteId } = useParams<{ creditNoteId: string }>();

  if (!creditNoteId) return null;
  return <CreditNoteDetailsContainer creditNoteId={creditNoteId} />;
};
