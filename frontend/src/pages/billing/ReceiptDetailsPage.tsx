import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { ReceiptDetailsContainer } from '../../components/billing/receipts/containers/ReceiptDetailsContainer';

/**
 * ReceiptDetailsPage — /billing/receipts/:receiptId route page (Sprint 14A.5).
 *
 * Thin route wrapper; the container owns loading, error, permission and the
 * regenerate dialog.
 */
export const ReceiptDetailsPage: FC = () => {
  const { receiptId } = useParams<{ receiptId: string }>();

  if (!receiptId) return null;
  return <ReceiptDetailsContainer receiptId={receiptId} />;
};
