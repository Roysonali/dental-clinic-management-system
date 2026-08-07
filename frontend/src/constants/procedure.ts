/**
 * Procedure catalog module constants.
 *
 * Maintains alignment with backend `app/modules/treatment/`:
 * - enums.py   (ProcedureCategory values)
 * - router.py  (default page size 20, max 100)
 */
import type { ProcedureCategory } from '../types/procedure';

/** Default page size for GET /procedures (matches backend default 20). */
export const PROCEDURE_LIST_PAGE_SIZE = 20;

/** Max page size accepted by the backend. */
export const PROCEDURE_MAX_PAGE_SIZE = 100;

/** Page-size options offered in the list toolbar. */
export const PROCEDURE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** All 11 procedure categories (ProcedureCategory enum — invalid → 422). */
export const PROCEDURE_CATEGORIES: readonly ProcedureCategory[] = [
  'diagnostic',
  'preventive',
  'restorative',
  'endodontic',
  'periodontic',
  'prosthodontic',
  'oral_surgery',
  'orthodontic',
  'cosmetic',
  'implant',
  'other',
] as const;

/** Human-readable category labels (display only). */
export const PROCEDURE_CATEGORY_LABELS: Record<ProcedureCategory, string> = {
  diagnostic: 'Diagnostic',
  preventive: 'Preventive',
  restorative: 'Restorative',
  endodontic: 'Endodontic',
  periodontic: 'Periodontic',
  prosthodontic: 'Prosthodontic',
  oral_surgery: 'Oral Surgery',
  orthodontic: 'Orthodontic',
  cosmetic: 'Cosmetic',
  implant: 'Implant',
  other: 'Other',
};

/** Category filter option descriptors for the list toolbar. */
export const PROCEDURE_CATEGORY_FILTERS: readonly {
  value: ProcedureCategory | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All Categories' },
  ...PROCEDURE_CATEGORIES.map((c) => ({ value: c, label: PROCEDURE_CATEGORY_LABELS[c] })),
];

/** Active-filter option descriptors for the list toolbar. */
export const PROCEDURE_STATUS_FILTERS: readonly {
  value: 'all' | 'active' | 'inactive';
  label: string;
}[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

/** Sort option descriptors for the list toolbar (backend allowlist). */
export const PROCEDURE_SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'code', label: 'Code' },
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'default_cost', label: 'Default Cost' },
];
