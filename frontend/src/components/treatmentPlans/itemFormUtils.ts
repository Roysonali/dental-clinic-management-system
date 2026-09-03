import type {
  AddItemRequest,
  ItemFormValues,
  ItemUpdateRequest,
  TreatmentPlanItemResponse,
} from '../../types/treatmentPlan';

/** Parse a numeric form string into a finite number (0 when empty/invalid). */
function toFiniteNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Optional number: null when empty (clears tooth fields — explicit null semantics). */
function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Optional string: null when empty. */
function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Item form → AddItemRequest transformer (create mode).
 *
 * NOTE: `procedure_id` is kept as a number in the request (the form holds it
 * as a string for the select value). `tooth_surface` soft-validated only
 * (O8) — the raw string is passed through when present.
 */
export function itemFormValuesToAddRequest(values: ItemFormValues): AddItemRequest {
  const request: AddItemRequest = {
    procedure_id: Number(values.procedure_id),
    sequence_number: toFiniteNumber(values.sequence_number),
  };

  // Quantity: default to 1 when empty
  const qty = values.quantity.trim() === '' ? 1 : Math.max(1, Math.floor(toFiniteNumber(values.quantity)));
  request.quantity = qty;

  const cost = toNullableNumber(values.estimated_cost);
  if (cost !== null) request.estimated_cost = cost;
  if (values.discount.trim() !== '') request.discount = toFiniteNumber(values.discount);
  request.tooth_number = toNullableNumber(values.tooth_number);
  request.tooth_surface = toNullableString(values.tooth_surface);
  request.quadrant = toNullableString(values.quadrant) as AddItemRequest['quadrant'];
  request.arch = toNullableString(values.arch) as AddItemRequest['arch'];
  request.notes = toNullableString(values.notes);

  return request;
}

/**
 * Item form → ItemUpdateRequest transformer (edit mode — partial).
 *
 * `notes` follows the backend quirk (R14): empty string is INVALID
 * (`min_length=1`), and `notes: null` is silently IGNORED — so the notes
 * field is simply omitted when untouched, and only sent when the user typed
 * a non-empty value. There is deliberately NO "clear notes" affordance.
 */
export function itemFormValuesToUpdateRequest(
  values: ItemFormValues,
  original: TreatmentPlanItemResponse,
): ItemUpdateRequest {
  const request: ItemUpdateRequest = {};

  if (Number(values.procedure_id) !== original.procedure_id) {
    request.procedure_id = Number(values.procedure_id);
  }
  const sequence = toFiniteNumber(values.sequence_number);
  if (sequence !== original.sequence_number) request.sequence_number = sequence;

  const qty = values.quantity.trim() === '' ? 1 : Math.max(1, Math.floor(toFiniteNumber(values.quantity)));
  if (qty !== original.quantity) request.quantity = qty;

  const cost = toNullableNumber(values.estimated_cost);
  if (cost !== (original.estimated_cost ?? null)) {
    if (cost !== null) request.estimated_cost = cost;
    else request.estimated_cost = null;
  }
  const discount = values.discount.trim() === '' ? 0 : toFiniteNumber(values.discount);
  if (discount !== original.discount) request.discount = discount;

  const toothNumber = toNullableNumber(values.tooth_number);
  if (toothNumber !== original.tooth_number) request.tooth_number = toothNumber;
  const toothSurface = toNullableString(values.tooth_surface);
  if (toothSurface !== original.tooth_surface) request.tooth_surface = toothSurface;
  const quadrant = toNullableString(values.quadrant);
  if (quadrant !== original.quadrant) request.quadrant = quadrant as AddItemRequest['quadrant'];
  const arch = toNullableString(values.arch);
  if (arch !== original.arch) request.arch = arch as AddItemRequest['arch'];

  const notes = values.notes.trim();
  if (notes.length > 0 && notes !== (original.notes ?? '')) request.notes = notes;

  return request;
}

/** Build empty form values from an existing item (edit mode). */
export function itemResponseToFormValues(item: TreatmentPlanItemResponse): ItemFormValues {
  return {
    procedure_id: String(item.procedure_id),
    sequence_number: String(item.sequence_number),
    quantity: String(item.quantity ?? 1),
    tooth_number: item.tooth_number != null ? String(item.tooth_number) : '',
    tooth_surface: item.tooth_surface ?? '',
    quadrant: item.quadrant ?? '',
    arch: item.arch ?? '',
    estimated_cost: item.estimated_cost != null ? String(item.estimated_cost) : '',
    discount: item.discount != null ? String(item.discount) : '',
    notes: item.notes ?? '',
  };
}
