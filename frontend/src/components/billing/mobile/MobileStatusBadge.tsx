import type { FC } from 'react';
import type { BadgeSize } from '../../common/Badge';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import {
  MOBILE_INVOICE_STATUS_VARIANTS,
  MOBILE_PAYMENT_STATUS_VARIANTS,
} from '../../../constants/billing';
import type { InvoiceStatus, PaymentStatus } from '../../../types/billing';

interface MobileInvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: BadgeSize;
}

/**
 * MobileStatusBadge (invoices) — reference mobile pill for invoice statuses
 * (ISSUED blue, DRAFT gray, OVERDUE amber, PAID green, PARTIALLY PAID blue).
 * Reuses the shared StatusBadge (dot + pastel pill + text label), so the
 * colour-blind-safe label guarantee holds and no badge system is duplicated.
 */
export const MobileInvoiceStatusBadge: FC<MobileInvoiceStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  return (
    <StatusBadge status={status} statusMap={MOBILE_INVOICE_STATUS_VARIANTS} size={size} showDot />
  );
};

interface MobilePaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: BadgeSize;
}

/**
 * MobileStatusBadge (payments) — reference mobile pill for payment statuses
 * (COMPLETED green, PENDING gray, REFUNDED violet, FAILED red).
 */
export const MobilePaymentStatusBadge: FC<MobilePaymentStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  return (
    <StatusBadge status={status} statusMap={MOBILE_PAYMENT_STATUS_VARIANTS} size={size} showDot />
  );
};
