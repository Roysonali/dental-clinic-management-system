import type { FC, ReactNode } from 'react';
import { formatISODate } from '../../../utils/date';
import type { InvoiceRead } from '../../../types/billing';

interface SummaryCardProps {
  label: string;
  children: ReactNode;
}

const SummaryCard: FC<SummaryCardProps> = ({ label, children }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
    <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
    <div className="mt-2">{children}</div>
  </div>
);

/**
 * InvoiceSummaryCards — patient / doctor / treatment plan / appointment
 * summary cards for the invoice detail page.
 *
 * Only fields actually present in the backend aggregate render — an invoice
 * without a linked treatment plan or appointment simply omits that card
 * (no fabricated relationships).
 */
export const InvoiceSummaryCards: FC<{ invoice: InvoiceRead }> = ({ invoice }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Patient">
        <p className="text-body font-semibold text-neutral-900">{invoice.patient.full_name}</p>
        <p className="mt-0.5 text-caption text-neutral-400">{invoice.patient.patient_code}</p>
      </SummaryCard>

      {invoice.doctor && (
        <SummaryCard label="Doctor">
          <p className="text-body font-semibold text-neutral-900">{invoice.doctor.user_full_name}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{invoice.doctor.doctor_code}</p>
        </SummaryCard>
      )}

      {invoice.treatment_plan && (
        <SummaryCard label="Treatment Plan">
          <p className="text-body font-semibold text-neutral-900">{invoice.treatment_plan.plan_code}</p>
          <p className="mt-0.5 text-caption capitalize text-neutral-400">
            {invoice.treatment_plan.status.replace(/_/g, ' ')}
          </p>
        </SummaryCard>
      )}

      {invoice.appointment && (
        <SummaryCard label="Appointment">
          <p className="text-body font-semibold text-neutral-900">{invoice.appointment.appointment_number}</p>
          <p className="mt-0.5 text-caption text-neutral-400">
            {formatISODate(invoice.appointment.appointment_date)}
          </p>
        </SummaryCard>
      )}
    </div>
  );
};
