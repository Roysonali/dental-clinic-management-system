import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Receipt,
  Banknote,
  Undo2,
  Wallet,
  BadgePercent,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  FilePlus2,
} from 'lucide-react';
import { BillingKpiCard } from './BillingKpiCard';
import { PAYMENT_CURRENCY_CODE } from '../../constants/billing';
import { formatCurrency, formatCount } from '../../utils/formatting';
import type { BillingTotals } from '../../types/billing';

interface BillingKpiGridProps {
  /** System-wide totals from GET /billing/dashboard. */
  totals?: BillingTotals | null;
  /** Skeleton placeholders (preserve final layout). */
  loading?: boolean;
  /** Error state — every card renders "— / Unavailable" (no stale data). */
  unavailable?: boolean;
}

interface KpiDefinition {
  key: string;
  label: string;
  /** Supporting copy — mirrors the backend field descriptions. */
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  value: (totals: BillingTotals) => string;
}

/**
 * KPI definitions. All ten metrics are fields of the backend
 * `BillingTotalsResponse` — nothing is derived or invented client-side.
 * Descriptions align with the backend schema `description`s (reference
 * screenshot copy used where the contract uses the same terminology).
 *
 * `BillingTotalsResponse` carries no currency code (the totals are
 * system-wide aggregates), so the monetary KPIs present in INR — the same
 * presentation currency as the Payments module (`PAYMENT_CURRENCY_CODE`),
 * matching the approved product requirement. The backend remains the
 * financial authority for the underlying amounts.
 */
const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: 'total-invoiced',
    label: 'Total Invoiced',
    description: 'All invoices',
    icon: Receipt,
    iconClassName: 'text-primary-600',
    value: (t) => formatCurrency(t.total_invoiced, PAYMENT_CURRENCY_CODE),
  },
  {
    key: 'total-collected',
    label: 'Total Collected',
    description: 'Non-refund allocations',
    icon: Banknote,
    iconClassName: 'text-success',
    value: (t) => formatCurrency(t.total_collected, PAYMENT_CURRENCY_CODE),
  },
  {
    key: 'total-refunded',
    label: 'Total Refunded',
    description: 'Refund allocations',
    icon: Undo2,
    iconClassName: 'text-danger',
    value: (t) => formatCurrency(t.total_refunded, PAYMENT_CURRENCY_CODE),
  },
  {
    key: 'total-outstanding',
    label: 'Total Outstanding',
    description: 'Invoiced − collected + refunded',
    icon: Wallet,
    iconClassName: 'text-warning',
    value: (t) => formatCurrency(t.total_outstanding, PAYMENT_CURRENCY_CODE),
  },
  {
    key: 'total-credited',
    label: 'Total Credited',
    description: 'Credit note amounts',
    icon: BadgePercent,
    iconClassName: 'text-info',
    value: (t) => formatCurrency(t.total_credited, PAYMENT_CURRENCY_CODE),
  },
  {
    key: 'paid-invoice-count',
    label: 'Paid Invoice Count',
    description: 'Invoices fully settled',
    icon: CheckCircle2,
    iconClassName: 'text-success',
    value: (t) => formatCount(t.paid_invoice_count),
  },
  {
    key: 'invoice-count',
    label: 'Invoice Count',
    description: 'Paid + outstanding invoices',
    icon: FileText,
    iconClassName: 'text-primary-600',
    value: (t) => formatCount(t.invoice_count),
  },
  {
    key: 'outstanding-invoice-count',
    label: 'Outstanding Invoices',
    description: 'Invoices with a positive balance',
    icon: Clock,
    iconClassName: 'text-warning',
    value: (t) => formatCount(t.outstanding_invoice_count),
  },
  {
    key: 'payment-count',
    label: 'Payment Count',
    description: 'Payments recorded',
    icon: CreditCard,
    iconClassName: 'text-info',
    value: (t) => formatCount(t.payment_count),
  },
  {
    key: 'credit-note-count',
    label: 'Credit Note Count',
    description: 'Credit notes issued',
    icon: FilePlus2,
    iconClassName: 'text-neutral-500',
    value: (t) => formatCount(t.credit_note_count),
  },
];

/**
 * BillingKpiGrid — the responsive KPI grid (10 cards).
 *
 * Desktop 4 columns → tablet 2 → mobile 1, matching the reference. Each card
 * is self-labelled, so the section uses an sr-only heading for screen readers.
 */
export const BillingKpiGrid: FC<BillingKpiGridProps> = ({
  totals = null,
  loading = false,
  unavailable = false,
}) => {
  return (
    <section
      aria-labelledby="billing-kpis-heading"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <h2 id="billing-kpis-heading" className="sr-only">
        Billing key performance indicators
      </h2>
      {KPI_DEFINITIONS.map((def) => (
        <BillingKpiCard
          key={def.key}
          icon={def.icon}
          label={def.label}
          description={def.description}
          iconClassName={def.iconClassName}
          value={totals ? def.value(totals) : ''}
          loading={loading}
          unavailable={unavailable}
        />
      ))}
    </section>
  );
};
