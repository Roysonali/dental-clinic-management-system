import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatReceiptDate } from '../../../utils/receiptFormatting';
import type { ReceiptRead } from '../../../types/billing';

interface ReceiptOverviewCardsProps {
  receipt: ReceiptRead;
}

/**
 * ReceiptOverviewCards — three compact information cards at the top of the
 * receipt detail page (reference spec §7): Patient + code, Receipt date +
 * issued by, Duplicate copy + document version. Uppercase muted labels with
 * strong right-side values; no heavy decoration.
 */
export const ReceiptOverviewCards: FC<ReceiptOverviewCardsProps> = ({ receipt }) => {
  const issuedBy = receipt.creator?.full_name ?? `User #${receipt.created_by}`;
  const duplicateCopy = receipt.print_metadata?.duplicate_copy === true ? 'Yes' : 'No';

  return (
    <>
      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Patient</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">{receipt.patient.full_name}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{receipt.patient.patient_code}</p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Receipt date</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">{formatReceiptDate(receipt.receipt_date)}</p>
          <p className="mt-0.5 truncate text-caption text-neutral-400">Issued by {issuedBy}</p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Duplicate copy</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">{duplicateCopy}</p>
          <p className="mt-0.5 truncate text-caption text-neutral-400">
            Document version {receipt.document_metadata.doc_version}
          </p>
        </Card.Body>
      </Card>
    </>
  );
};
