import { describe, it, expect } from 'vitest';
import { formatISODate, formatTime, formatTimeRange, todayLocalISO } from './date';

describe('formatTime', () => {
  it('formats 24h backend times as 12-hour clock', () => {
    expect(formatTime('09:00:00')).toBe('9:00 AM');
    expect(formatTime('10:30:00')).toBe('10:30 AM');
    expect(formatTime('14:05:00')).toBe('2:05 PM');
    expect(formatTime('21:00:00')).toBe('9:00 PM');
  });

  it('handles midnight and noon correctly', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM');
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });

  it('returns an em-dash for empty input', () => {
    expect(formatTime('')).toBe('—');
    expect(formatTime(null)).toBe('—');
    expect(formatTime(undefined)).toBe('—');
  });

  it('returns the raw value for malformed input', () => {
    expect(formatTime('not-a-time')).toBe('not-a-time');
  });
});

describe('formatTimeRange', () => {
  it('formats a start/end pair', () => {
    expect(formatTimeRange('09:00:00', '09:30:00')).toBe('9:00 AM – 9:30 AM');
  });

  it('handles missing halves gracefully', () => {
    expect(formatTimeRange('09:00:00', null)).toBe('9:00 AM – —');
    expect(formatTimeRange(null, '10:00:00')).toBe('— – 10:00 AM');
    expect(formatTimeRange(null, null)).toBe('—');
    expect(formatTimeRange('', '')).toBe('—');
  });
});

describe('todayLocalISO', () => {
  it('returns the local calendar date as YYYY-MM-DD', () => {
    const date = new Date(2026, 7, 4, 23, 30); // Aug 4 2026, 11:30 PM local
    expect(todayLocalISO(date)).toBe('2026-08-04');
  });

  it('zero-pads month and day', () => {
    expect(todayLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('never shifts into the next UTC day for timezones east of UTC', () => {
    // 11 PM local on the 4th is the 5th in UTC — the helper must stay on the
    // local calendar date (this was the bug with toISOString().slice(0,10)).
    const date = new Date(2026, 7, 4, 23, 0);
    expect(todayLocalISO(date)).toBe('2026-08-04');
  });
});

describe('formatISODate', () => {
  it('formats an ISO date into a readable date', () => {
    expect(formatISODate('2026-07-08')).toMatch(/Jul/i);
  });

  it('returns an em-dash for empty input', () => {
    expect(formatISODate(null)).toBe('—');
    expect(formatISODate('')).toBe('—');
  });
});
