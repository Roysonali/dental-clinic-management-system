import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { PAYMENT_METHOD_LABELS } from '../../../constants/billing';
import { formatISODate } from '../../../utils/date';
import type { PaymentRead } from '../../../types/billing';

interface PaymentOverviewCardsProps {
  payment: PaymentRead;
}

/**
 * PaymentOverviewCards — three compact information cards at the top of the
 * detail page (reference spec §27): Patient + code, Method + reference,
 * Payment date + recorded by. Uppercase muted labels with strong right-side
 * values; no heavy decoration.
 */
export const PaymentOverviewCards: FC<PaymentOverviewCardsProps> = ({ payment }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Patient</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">{payment.patient.full_name}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{payment.patient.patient_code}</p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Method</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">
            {PAYMENT_METHOD_LABELS[payment.payment_method]}
          </p>
          <p className="mt-0.5 truncate text-caption text-neutral-400">
            {payment.reference_number ? `Reference · ${payment.reference_number}` : 'No reference number'}
          </p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Payment date</p>
          <p className="mt-2 text-body font-semibold text-neutral-900">{formatISODate(payment.payment_date)}</p>
          <p className="mt-0.5 truncate text-caption text-neutral-400">
            Recorded by {payment.creator?.full_name ?? `User #${payment.created_by}`}
          </p>
        </Card.Body>
      </Card>
    </div>
  );
};
