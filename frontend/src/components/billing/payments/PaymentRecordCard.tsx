import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatISODateTime } from '../../../utils/date';
import type { PaymentRead } from '../../../types/billing';

interface PaymentRecordCardProps {
  payment: PaymentRead;
}

/**
 * PaymentRecordCard — RECORD metadata card (reference spec §30). Uses the
 * backend aggregate's audit timestamps and versioning counters.
 */
export const PaymentRecordCard: FC<PaymentRecordCardProps> = ({ payment }) => {
  const rows: { label: string; value: string }[] = [
    { label: 'Created at', value: formatISODateTime(payment.created_at) },
    { label: 'Updated at', value: formatISODateTime(payment.updated_at) },
    { label: 'Version', value: String(payment.version) },
    { label: 'Document version', value: String(payment.doc_version) },
  ];

  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Record</h3>
        <dl className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">{row.label}</dt>
              <dd className="text-body-sm font-medium text-neutral-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card.Body>
    </Card>
  );
};
