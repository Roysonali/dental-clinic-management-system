import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatReceiptDateTime } from '../../../utils/receiptFormatting';
import type { ReceiptRead } from '../../../types/billing';

interface ReceiptDocumentMetadataCardProps {
  receipt: ReceiptRead;
}

/**
 * ReceiptDocumentMetadataCard — right-column DOCUMENT METADATA card
 * (reference spec §11). Values are right-aligned, matching the other
 * metadata cards.
 */
export const ReceiptDocumentMetadataCard: FC<ReceiptDocumentMetadataCardProps> = ({ receipt }) => {
  const meta = receipt.document_metadata;

  return (
    <Card>
      <Card.Header title="Document Metadata" />
      <Card.Body>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Receipt number</dt>
            <dd className="font-mono text-body-sm font-medium text-neutral-900">
              {receipt.receipt_number}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Generated at</dt>
            <dd className="text-body-sm font-medium text-neutral-900">
              {formatReceiptDateTime(meta.generated_at)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Version</dt>
            <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
              {meta.doc_version}
            </dd>
          </div>
        </dl>
      </Card.Body>
    </Card>
  );
};
