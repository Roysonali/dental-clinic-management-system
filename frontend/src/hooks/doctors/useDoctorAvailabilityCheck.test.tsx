import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDoctorAvailabilityCheck } from './useDoctorAvailabilityCheck';

/** Minimal shape matching the hook's expected doctorListItems element. */
function makeDoctorItem(overrides: Partial<{
  user_id: number;
  is_active: boolean;
  available_for_appointment: boolean;
  on_leave: boolean;
}> = {}) {
  return {
    user_id: 3,
    is_active: true,
    available_for_appointment: true,
    on_leave: false,
    ...overrides,
  };
}

describe('useDoctorAvailabilityCheck', () => {
  it('returns no warning when no dentist is selected', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck(null, '2026-09-04', [makeDoctorItem()]),
    );

    expect(result.current.availabilityWarning).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('returns no warning when doctor is available and not on leave', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck('3', '2026-09-04', [makeDoctorItem()]),
    );

    expect(result.current.availabilityWarning).toBeNull();
  });

  it('returns no warning when dentist_id is not in list (defensive — let backend handle)', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck('999', '2026-09-04', [makeDoctorItem()]),
    );

    expect(result.current.availabilityWarning).toBeNull();
  });

  it('shows warning when doctor is on leave', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck(
        '3',
        '2026-09-04',
        [makeDoctorItem({ on_leave: true })],
      ),
    );

    expect(result.current.availabilityWarning).toBe(
      'Doctor is currently on leave.',
    );
  });

  it('shows warning when doctor is inactive', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck(
        '3',
        '2026-09-04',
        [makeDoctorItem({ is_active: false })],
      ),
    );

    expect(result.current.availabilityWarning).toBe(
      'Doctor profile is inactive.',
    );
  });

  it('shows warning when doctor is not available for appointments', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck(
        '3',
        '2026-09-04',
        [makeDoctorItem({ available_for_appointment: false })],
      ),
    );

    expect(result.current.availabilityWarning).toBe(
      'Doctor is not available for appointments.',
    );
  });

  it('on_leave takes priority over available_for_appointment', () => {
    const { result } = renderHook(() =>
      useDoctorAvailabilityCheck(
        '3',
        '2026-09-04',
        [
          makeDoctorItem({
            on_leave: true,
            available_for_appointment: false,
          }),
        ],
      ),
    );

    // on_leave is checked first in the hook
    expect(result.current.availabilityWarning).toBe(
      'Doctor is currently on leave.',
    );
  });

  it('returns no warning for any day when doctor is available', () => {
    // Verify schedule-day is no longer checked — every weekday should be fine.
    const dates = [
      '2026-09-01', // Monday
      '2026-09-02', // Tuesday
      '2026-09-03', // Wednesday
      '2026-09-04', // Thursday → actually check what day
      '2026-09-05', // Friday → check
      '2026-09-06', // Saturday
    ];

    for (const date of dates) {
      const { result } = renderHook(() =>
        useDoctorAvailabilityCheck('3', date, [makeDoctorItem()]),
      );
      expect(result.current.availabilityWarning).toBeNull();
    }
  });
});
