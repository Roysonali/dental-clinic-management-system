/**
 * User module constants.
 *
 * Maintains alignment with backend `app/modules/users/` (schemas.py,
 * routes.py) and `app/core/constants.py`. Do not add values that don't
 * exist upstream.
 */
import type { UserStatusFilter } from '../types/user';
import { ROLE_IDS, ROLE_LABELS, type RoleName } from './roles';

/* ── List / pagination ──────────────────────────────────────────────── */

/** Default page size for GET /users (matches backend default 10, max 100). */
export const USER_LIST_PAGE_SIZE = 10;

/** Max page size accepted by the backend (`le=100`). */
export const USER_MAX_PAGE_SIZE = 100;

/** React Query stale time for the paginated user list (module list page). */
export const USER_LIST_STALE_TIME_MS = 30_000;

/* ── Search (UserSearchSelect + list toolbar) ───────────────────────── */

/** Default page size for user searches (backend default 10). */
export const USER_SEARCH_PAGE_SIZE = 10;

/** Search debounce for user search inputs. */
export const USER_SEARCH_DEBOUNCE_MS = 350;

/** React Query stale time for user searches (blueprint: 60s). */
export const USER_SEARCH_STALE_TIME_MS = 60_000;

/* ── Validation limits (backend schemas.py / routes.py) ────────────── */

/** Minimum role id accepted by PATCH /users/{id}/role (backend `Field(gt=0)`). */
export const ROLE_ID_MIN = 1;

/* ── Role options (no GET /roles endpoint — derived from seeded constants) ── */

/**
 * Role filter/assign options ordered by seeded role id.
 *
 * The backend exposes NO `GET /roles` endpoint, yet `GET /users` filters
 * by numeric `role_id` and `PATCH /users/{id}/role` requires one. Options
 * are therefore derived from the canonical `constants/roles.ts`
 * (`ROLE_IDS` mirrors `backend/app/database/seed_roles.py` insert order,
 * `ROLE_LABELS` mirrors the seed display names). No invented values.
 */
export const USER_ROLE_OPTIONS: readonly { value: string; label: string }[] = (
  Object.entries(ROLE_IDS) as [RoleName, number][]
)
  .sort((a, b) => a[1] - b[1])
  .map(([role, id]) => ({ value: String(id), label: ROLE_LABELS[role] }));

/* ── Status filters / labels ────────────────────────────────────────── */

/** Status filter option descriptors for the list toolbar. */
export const USER_STATUS_FILTERS: readonly {
  value: UserStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

/** Human-readable status labels (display only). */
export const USER_STATUS_LABELS: Record<'pending' | 'active' | 'inactive', string> = {
  pending: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
};
