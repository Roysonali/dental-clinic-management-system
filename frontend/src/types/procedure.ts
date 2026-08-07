/* ============================================================
 * Procedure Catalog Types
 *
 * Strictly mirrors backend `app/modules/treatment/`:
 * - enums.py  -> ProcedureCategory (11 values)
 * - schemas/  -> ProcedureCreate/Update/Response/Summary
 * ============================================================ */

/** Backend `ProcedureCategory` (enums.py) — 11 values, invalid → 422. */
export type ProcedureCategory =
  | 'diagnostic'
  | 'preventive'
  | 'restorative'
  | 'endodontic'
  | 'periodontic'
  | 'prosthodontic'
  | 'oral_surgery'
  | 'orthodontic'
  | 'cosmetic'
  | 'implant'
  | 'other';

/** Nested summary inside plan items (ProcedureSummary schema). */
export interface ProcedureSummary {
  id: number;
  code: string;
  name: string;
  category: ProcedureCategory;
  default_cost: number;
  is_active: boolean;
}

/** Full procedure record (ProcedureResponse schema). */
export interface ProcedureResponse extends ProcedureSummary {
  description: string | null;
}

/** Payload for POST /procedures (ProcedureCreate — code uppercased by the backend). */
export interface ProcedureCreateRequest {
  code: string;
  name: string;
  default_cost: number;
  category: ProcedureCategory;
  description?: string | null;
}

/** Payload for PATCH /procedures/{id} — `code` is intentionally ABSENT (immutable). */
export interface ProcedureUpdateRequest {
  name?: string;
  default_cost?: number;
  category?: ProcedureCategory;
  description?: string | null;
}

/** Query params accepted by GET /procedures. */
export type ProcedureSortField = 'code' | 'name' | 'category' | 'default_cost';
export type ProcedureSortOrder = 'asc' | 'desc';

export interface ProcedureListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  category?: ProcedureCategory;
  sort_by?: ProcedureSortField;
  sort_order?: ProcedureSortOrder;
}

/* ── UI form values (never sent to the API as-is) ──────────────── */

/** Procedure form model — cost held as a string by the currency input. */
export interface ProcedureFormValues {
  code: string;
  name: string;
  description: string;
  default_cost: string;
  category: string;
}
