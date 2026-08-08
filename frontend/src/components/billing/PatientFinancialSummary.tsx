import type { FC } from 'react';
import { PatientPicker } from '../appointments/PatientPicker';
import { SectionHeader } from '../common/SectionHeader';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { formatCurrency } from '../../utils/formatting';
import type { PatientFinancialSummary as PatientFinancialSummaryData } from '../../types/billing';

interface PatientFinancialSummaryProps {
  /** Selected patient id ('' = system-wide — no patient filter). */
  patientId: string;
  /** Called with the selected patient id ('' clears the filter). */
  onPatientChange: (id: string) => void;
  /** Backend `patient_summary` — null when no patient is selected. */
  summary: PatientFinancialSummaryData | null;
  /** Skeleton rows while the dashboard refetches for a selected patient. */
  loading?: boolean;
}

/**
 * Row definitions. All values are fields of the backend
 * `PatientFinancialSummaryResponse` (schemas/dashboard.py) — `total_paid` is
 * the "Collected" figure (non-refund payment allocations). Nothing is
 * calculated client-side.
 */
const SUMMARY_ROWS = [
  { key: 'invoiced', label: 'Invoiced', value: (s: PatientFinancialSummaryData) => formatCurrency(s.total_invoiced) },
  { key: 'collected', label: 'Collected', value: (s: PatientFinancialSummaryData) => formatCurrency(s.total_paid) },
  { key: 'outstanding', label: 'Outstanding', value: (s: PatientFinancialSummaryData) => formatCurrency(s.total_outstanding) },
  { key: 'credited', label: 'Credited', value: (s: PatientFinancialSummaryData) => formatCurrency(s.total_credited) },
] as const;

/**
 * PatientFinancialSummary — per-patient billing snapshot card.
 *
 * The backend exposes this capability via the `patient_id` filter on
 * GET /billing/dashboard (the response's `patient_summary`). Selecting a
 * patient re-queries the dashboard with the filter; the existing
 * PatientPicker is reused for patient selection (no new selection
 * infrastructure). No patient selected → the card prompts instead of
 * showing invented data.
 */
export const PatientFinancialSummary: FC<PatientFinancialSummaryProps> = ({
  patientId,
  onPatientChange,
  summary,
  loading = false,
}) => {
  return (
    <section aria-labelledby="patient-financial-summary-heading">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <SectionHeader
          id="patient-financial-summary-heading"
          title="Patient Financial Summary"
        />

        <div className="mt-4 max-w-sm">
          <PatientPicker
            value={patientId}
            onChange={onPatientChange}
            helperText="Select a patient to scope the summary."
          />
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            {SUMMARY_ROWS.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4"
                role="status"
                aria-label={`Loading ${row.label}`}
              >
                <Skeleton variant="text" className="w-24" />
                <Skeleton variant="stat" className="w-20" />
              </div>
            ))}
          </div>
        ) : summary ? (
          <dl className="mt-4 divide-y divide-neutral-100">
            {SUMMARY_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-body-sm text-neutral-500">{row.label}</dt>
                <dd className="text-body font-semibold text-neutral-900 tabular-nums">
                  {row.value(summary)}
                </dd>
              </div>
            ))}
          </dl>
        ) : patientId ? (
          // A patient is selected but the backend returned no summary — do not
          // suggest "select a patient"; the patient simply has no activity yet.
          <p className="mt-5 text-body-sm text-neutral-500">
            No billing activity for this patient yet.
          </p>
        ) : (
          <p className="mt-5 text-body-sm text-neutral-500">
            Select a patient to see their billing summary.
          </p>
        )}
      </div>
    </section>
  );
};
