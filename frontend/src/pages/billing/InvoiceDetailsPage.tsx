import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { InvoiceDetailsContainer } from '../../components/billing/invoices/containers/InvoiceDetailsContainer';

/**
 * InvoiceDetailsPage — /billing/invoices/:invoiceId route page (Sprint 14A.2).
 *
 * Thin route wrapper; the container owns loading, error, permission and the
 * lifecycle dialogs.
 */
export const InvoiceDetailsPage: FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();

  if (!invoiceId) return null;
  return <InvoiceDetailsContainer invoiceId={invoiceId} />;
};
