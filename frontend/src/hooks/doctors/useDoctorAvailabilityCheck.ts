import { useMemo } from 'react';

/**
 * Result of a doctor availability check for a specific date.
 */
export interface DoctorAvailabilityResult {
  /** Whether the check is still loading. */
  isLoading: boolean;
  /** Whether the check failed (e.g. network error). */
  isError: boolean;
  /**
   * Availability warning message. Null when:
   * - dentist not yet selected
   * - doctor is available (active, not on leave)
   *
   * Non-null warnings:
   * - "Doctor is currently on leave."
   * - "Doctor is not available for appointments."
   */
  availabilityWarning: string | null;
}

/**
 * Checks whether a doctor is available for appointments.
 *
 * Uses the doctor list data (already fetched by useDoctors) to check
 * on-leave and availability status — no additional API call is needed.
 *
 * Schedule validation is handled authoritatively by the backend on
 * appointment submission (validate_doctor_schedule in validators.py).
 * This hook only provides proactive UX guidance for clearly-ineligible
 * states that the dentist dropdown may not fully cover.
 *
 * @param doctorUserId — The dentist's user_id (from the form select), or null
 * @param doctorListItems — The items from useDoctors() query data
 */
export function useDoctorAvailabilityCheck(
  doctorUserId: string | null,
  _appointmentDate: string,
  doctorListItems: Array<{
    user_id: number;
    is_active: boolean;
    available_for_appointment: boolean;
    on_leave: boolean;
  }> = [],
): DoctorAvailabilityResult {

  const matchedDoctor = useMemo(() => {
    if (!doctorUserId) return null;
    const uid = Number(doctorUserId);
    return doctorListItems.find((d) => d.user_id === uid) ?? null;
  }, [doctorUserId, doctorListItems]);

  const availabilityWarning = useMemo(() => {
    // No selection yet → no warning.
    if (!doctorUserId) return null;

    // No matching doctor found in the list → don't warn (let backend handle it).
    if (!matchedDoctor) return null;

    // Doctor is inactive.
    if (!matchedDoctor.is_active) {
      return 'Doctor profile is inactive.';
    }

    // Doctor is on leave.
    if (matchedDoctor.on_leave) {
      return 'Doctor is currently on leave.';
    }

    // Doctor is not accepting appointments.
    if (!matchedDoctor.available_for_appointment) {
      return 'Doctor is not available for appointments.';
    }

    return null;
  }, [doctorUserId, matchedDoctor]);

  return {
    isLoading: false,
    isError: false,
    availabilityWarning,
  };
}
