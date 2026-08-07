import type {
  ProcedureCreateRequest,
  ProcedureFormValues,
  ProcedureUpdateRequest,
} from '../../types/procedure';

/** Parse a currency input string into a finite number (0 when empty/invalid). */
function toFiniteNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Optional string: null when empty. */
function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Procedure form → ProcedureCreateRequest (create mode; code uppercased by backend). */
export function procedureFormValuesToCreate(values: ProcedureFormValues): ProcedureCreateRequest {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    default_cost: toFiniteNumber(values.default_cost),
    category: values.category as ProcedureCreateRequest['category'],
    description: toNullableString(values.description),
  };
}

/**
 * Procedure form → ProcedureUpdateRequest (edit mode).
 *
 * `code` is deliberately ABSENT — the backend `ProcedureUpdate` schema has
 * no `code` field (immutable; sending it yields 422). The edit form keeps
 * the code input disabled and never includes it in the payload.
 */
export function procedureFormValuesToUpdate(values: ProcedureFormValues): ProcedureUpdateRequest {
  const request: ProcedureUpdateRequest = {
    name: values.name.trim(),
    default_cost: toFiniteNumber(values.default_cost),
    category: values.category as ProcedureCreateRequest['category'],
  };
  const description = toNullableString(values.description);
  if (description !== null) request.description = description;
  return request;
}
