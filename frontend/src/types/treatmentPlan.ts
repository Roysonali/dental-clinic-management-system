/* ============================================================
 * Treatment Plan Types
 *
 * Strictly mirrors backend `app/modules/treatment/`:
 * - enums.py   -> status / acknowledgment / quadrant / arch unions
 * - schemas/   -> request + response DTOs (snake_case, verbatim)
 * - pagination -> {items, total, page, page_size, total_pages}
 *
 * Backend enums are string-valued, so string-literal unions are used
 * (the project's `erasableSyntaxOnly` tsconfig forbids TS enums).
 * ============================================================ */
import type { ProcedureSummary } from './procedure';

/* ── Enums (string-literal unions) ──────────────────────────────── */

/** Backend `TreatmentPlanStatus` (enums.py) — sent/received verbatim. */
export type TreatmentPlanStatus =
  | 'draft'
  | 'under_review'
  | 'proposed'
  | 'rejected'
  | 'accepted'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

/** Backend `TreatmentPlanItemStatus`. Read-only: items are always `pending` via the API (O2). */
export type TreatmentPlanItemStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'deferred';

/** Backend `PatientAcknowledgmentStatus`. Only pending/accepted/rejected are reachable via the API. */
export type PatientAcknowledgmentStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'changes_requested';

/** Backend `ToothQuadrant`. */
export type ToothQuadrant = 'UR' | 'UL' | 'LL' | 'LR';

/** Backend `ToothArch`. */
export type ToothArch = 'upper' | 'lower';

/* ── Pagination (shared shape) ─────────────────────────────────── */

/** Paginated envelope returned by every treatment list endpoint. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/* ── List / detail DTOs ────────────────────────────────────────── */

/** Fields shared by every treatment-plan payload (list rows + the detail aggregate). */
export interface TreatmentPlanBase {
  id: string;
  plan_code: string;
  patient_id: string;
  doctor_id: string;
  status: TreatmentPlanStatus;
  current_version: number;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row returned by every plan list endpoint (TreatmentPlanListItem schema).
 *
 * `item_count` / `total_estimated_cost` are computed by the backend's list
 * mapper and exist ONLY on this list payload — the detail aggregate does
 * NOT carry them ([BCR §9.3]); the detail UI must derive them from the
 * embedded `items[]` collection instead.
 */
export interface TreatmentPlanListItem extends TreatmentPlanBase {
  item_count: number;
  total_estimated_cost: number;
}

/** Single plan item (TreatmentPlanItemResponse schema). */
export interface TreatmentPlanItemResponse {
  id: string;
  plan_id: string;
  procedure_id: number;
  /** Nested procedure summary — display-friendly (may be null if procedure was deleted). */
  procedure: ProcedureSummary | null;
  sequence_number: number;
  tooth_number: number | null;
  tooth_surface: string | null;
  quadrant: ToothQuadrant | null;
  arch: ToothArch | null;
  estimated_cost: number;
  discount: number;
  /** Always "pending" in practice — no item-transition endpoint exists (O2). */
  item_status: TreatmentPlanItemStatus;
  notes: string | null;
  /** Informational only — never settable via the API (R17). */
  appointment_id: string | null;
  diagnosis_id: string | null;
}

/** Doctor approval + patient acknowledgment (ApprovalResponse schema). */
export interface ApprovalResponse {
  id: string;
  approved_by: number | null;
  approved_at: string | null;
  patient_status: PatientAcknowledgmentStatus;
  patient_acknowledged_at: string | null;
  approval_notes: string | null;
}

/** Version list row (VersionListItem schema). */
export interface VersionListItem {
  id: string;
  version_number: number;
  change_reason: string;
  changed_by: number;
  created_at: string;
}

/**
 * Full plan aggregate (TreatmentPlanResponse schema).
 *
 * Deliberately does NOT extend `TreatmentPlanListItem`: the backend aggregate
 * (`schemas/treatment_plan.py`) carries no `item_count` / `total_estimated_cost`
 * — those are list-only derived fields. The frontend derives them from the
 * embedded `items[]` collection (F-01 regression-guarded in tests).
 */
export interface TreatmentPlanResponse extends TreatmentPlanBase {
  clinical_notes: string | null;
  observations: string | null;
  dentist_recommendations: string | null;
  valid_from: string | null;
  valid_to: string | null;
  items: TreatmentPlanItemResponse[];
  approval: ApprovalResponse | null;
  versions: VersionListItem[];
  updated_by: number | null;
}

/** Snapshot detail (VersionDetailResponse schema). */
export interface VersionDetailResponse extends VersionListItem {
  plan_id: string;
  items_snapshot: {
    version_number: number;
    captured_at: string;
    items: Array<{
      sequence_number: number;
      procedure_id: number;
      procedure_code: string;
      tooth_number: number | null;
      tooth_surface: string | null;
      quadrant: ToothQuadrant | null;
      arch: ToothArch | null;
      /** Monetary values inside snapshots are STRINGS (Decimal-as-string). */
      estimated_cost: string;
      discount: string;
      item_status: TreatmentPlanItemStatus;
      notes: string | null;
    }>;
  };
}

/** Version list response (VersionListResponse schema). */
export interface VersionListResponse {
  items: VersionListItem[];
}

/** Dashboard summary (DashboardSummaryResponse schema) — `by_status` is dense (all 9 keys). */
export interface DashboardSummaryResponse {
  total_plans: number;
  by_status: Record<TreatmentPlanStatus, number>;
  pending_review: number;
  pending_approval: number;
  pending_acknowledgment: number;
  active_plans: number;
}

/* ── Request DTOs (mirror schemas/treatment_plan.py, extra="forbid") ─ */

export interface CreatePlanRequest {
  patient_id: string;
  doctor_id: string;
  clinical_notes?: string | null;
  observations?: string | null;
  dentist_recommendations?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  plan_code?: string | null;
}

export interface AddItemRequest {
  procedure_id: number;
  sequence_number: number;
  estimated_cost?: number | null;
  discount?: number;
  tooth_number?: number | null;
  tooth_surface?: string | null;
  quadrant?: ToothQuadrant | null;
  arch?: ToothArch | null;
  notes?: string | null;
}

export interface ItemUpdateRequest {
  procedure_id?: number;
  sequence_number?: number;
  estimated_cost?: number | null;
  discount?: number;
  tooth_number?: number | null;
  tooth_surface?: string | null;
  quadrant?: ToothQuadrant | null;
  arch?: ToothArch | null;
  notes?: string | null;
}

/** All item ids exactly once — backend 409s on mismatch. */
export interface ReorderItemsRequest {
  item_ids: string[];
}

export interface VersionRequest {
  change_reason: string;
}

/* ── Query params ──────────────────────────────────────────────── */

export type PlanSortField = 'created_at' | 'updated_at' | 'status' | 'plan_code';
export type SortOrder = 'asc' | 'desc';

export interface PlanListParams {
  search?: string;
  patient_id?: string;
  doctor_id?: string;
  status?: TreatmentPlanStatus;
  is_active?: boolean;
  /** `YYYY-MM-DD` only — any other format 500s (O6). */
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: PlanSortField;
  sort_order?: SortOrder;
}

/* ── UI form values (never sent to the API as-is) ──────────────── */

/** Create-plan form model — presentational, transformed by treatmentPlanFormUtils. */
export interface PlanFormValues {
  patient_id: string;
  doctor_id: string;
  clinical_notes: string;
  observations: string;
  dentist_recommendations: string;
  /** ISO `YYYY-MM-DD` or '' */
  valid_from: string;
  valid_to: string;
  plan_code: string;
}

/** Add/update item form model — numeric inputs held as strings by the form. */
export interface ItemFormValues {
  procedure_id: string;
  sequence_number: string;
  tooth_number: string;
  tooth_surface: string;
  quadrant: string;
  arch: string;
  estimated_cost: string;
  discount: string;
  notes: string;
}

/* ── Workflow action ids (backend endpoint-backed, [MAP §4]) ─────── */

/** Every plan-level / approval action the UI may offer (no item-status actions — O2). */
export type TreatmentPlanActionId =
  | 'submit-for-review'
  | 'approve-review'
  | 'reject-review'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'start-treatment'
  | 'hold'
  | 'resume'
  | 'complete'
  | 'doctor-approve'
  | 'doctor-revoke'
  | 'patient-acknowledge'
  | 'patient-decline';

/* ── Enriched display types ────────────────────────────────────── */

/** Plan row enriched with resolved display names (backend returns only ids — R10). */
export interface EnrichedTreatmentPlan extends TreatmentPlanListItem {
  patient_name: string | null;
  doctor_name: string | null;
}
