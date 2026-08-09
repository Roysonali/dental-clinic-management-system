import type { FC } from 'react';
import { Printer } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Icon } from '../../common/Icon/Icon';
import { formatReceiptDateTime } from '../../../utils/receiptFormatting';
import type { ReceiptRead } from '../../../types/billing';

interface ReceiptPrintMetadataCardProps {
  receipt: ReceiptRead;
}

/**
 * ReceiptPrintMetadataCard — right-column PRINT METADATA card
 * (reference spec §10) with a small printer icon in the heading.
 *
 * The current backend mapper always returns `print_metadata: null`, so the
 * rows render graceful placeholders ("—") until a future backend populates
 * print tracking. The card structure matches the reference exactly.
 */
export const ReceiptPrintMetadataCard: FC<ReceiptPrintMetadataCardProps> = ({ receipt }) => {
  const meta = receipt.print_metadata;

  return (
    <Card>
      <Card.Header
        title="Print Metadata"
        icon={<Icon icon={Printer} size="sm" className="text-neutral-400" />}
      />
      <Card.Body>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Print count</dt>
            <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
              {meta?.print_count != null ? meta.print_count : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Last printed</dt>
            <dd className="text-body-sm font-medium text-neutral-900">
              {meta?.last_printed_at ? formatReceiptDateTime(meta.last_printed_at) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Duplicate copy</dt>
            <dd className="text-body-sm font-medium text-neutral-900">
              {meta?.duplicate_copy === true ? 'Yes' : 'No'}
            </dd>
          </div>
        </dl>
      </Card.Body>
    </Card>
  );
};
