/**
 * Date formatting utilities shared across feature modules.
 */

/**
 * Format an ISO date or datetime (YYYY-MM-DD or full ISO datetime) as a
 * human-readable date, e.g. "May 15, 1990". Returns "—" for empty input.
 */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
