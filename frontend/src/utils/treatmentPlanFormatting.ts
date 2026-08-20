/**
 * Treatment Plan display formatting helpers.
 *
 * Covers the backend quirks verified in the contract review:
 * - Version snapshot monetary values are STRINGS (`"15000.00"`), unlike
 *   top-level responses where they are JSON numbers ([BCR §6.6]).
 * - Money is formatted with the shared `formatCurrency` + the module
 *   presentation currency code (INR → ₹, grouped) ([P2.5 §2.3]).
 */
import { formatCurrency } from './formatting';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../constants/treatmentPlan';

/** Parse a snapshot monetary value (string or number) into a number. NaN-safe. */
export function parseSnapshotMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Format a cost for display in the module presentation currency (₹). */
export function formatTreatmentCost(value: number | string | null | undefined): string {
  return formatCurrency(value, TREATMENT_PLAN_CURRENCY_CODE);
}

/** Tooth label, e.g. "#46 (MOD)" or "#36" or "—" when unset. */
export function formatToothLabel(
  toothNumber: number | null | undefined,
  toothSurface: string | null | undefined,
): string {
  if (toothNumber === null || toothNumber === undefined) return '—';
  return toothSurface ? `#${toothNumber} (${toothSurface})` : `#${toothNumber}`;
}

/** Snapshot item → compact tooth label (snapshot shape uses the same fields). */
export function formatSnapshotTooth(
  toothNumber: number | null | undefined,
  toothSurface: string | null | undefined,
): string {
  return formatToothLabel(toothNumber, toothSurface);
}
