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

/**
 * Today's date as a local-timezone `YYYY-MM-DD` string.
 *
 * Built from the local calendar components (getFullYear/getMonth/getDate)
 * rather than `new Date().toISOString().slice(0, 10)`, which uses UTC and
 * can be off by one day in timezones east of UTC (e.g. 11 PM local on the
 * 4th is already the 5th in UTC). Used for date-picker min/max bounds.
 */
export function todayLocalISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a backend `time` value (`HH:MM:SS`) as `h:mm AM/PM`.
 * Returns "—" for empty input.
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '—';
  const parts = time.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format a `start_time`/`end_time` pair as "9:00 – 9:30 AM".
 * Handles missing halves gracefully (e.g. only start_time present).
 */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return '—';
  return `${formatTime(start)} – ${formatTime(end)}`;
}
