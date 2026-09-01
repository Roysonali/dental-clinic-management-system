import { useState, useCallback, useMemo, type FC } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import {
  DOCTOR_DAY_LABELS,
  DOCTOR_ALL_DAYS,
  CLINIC_DEFAULT_SESSIONS,
} from '../../constants/doctor';
import type {
  DoctorProfileResponse,
  ScheduleCreateRequest,
  ScheduleResponse,
  DayOfWeek,
} from '../../types/doctor';

/* ── Local Draft Types ──────────────────────────────────────────────────── */

interface DraftSession {
  _key: string;
  start_time: string;
  end_time: string;
}

interface DraftDay {
  day_of_week: DayOfWeek;
  sessions: DraftSession[];
}

type DraftSchedule = DraftDay[];

/* ── Helpers ────────────────────────────────────────────────────────────── */

let _nextKey = 0;
function tempKey(): string {
  return `tmp-${++_nextKey}`;
}

/** Convert backend ScheduleResponse[] into a local draft. */
function schedulesToDraft(schedules: ScheduleResponse[]): DraftSchedule {
  const grouped: Partial<Record<DayOfWeek, DraftSession[]>> = {};

  for (const s of schedules) {
    if (!grouped[s.day_of_week]) grouped[s.day_of_week] = [];
    grouped[s.day_of_week]!.push({
      _key: tempKey(),
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
    });
  }

  return DOCTOR_ALL_DAYS.map((day) => ({
    day_of_week: day,
    sessions: (grouped[day] ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));
}

/** Pre-populate with clinic default sessions (Mon–Sat). */
function clinicDefaultDraft(): DraftSchedule {
  return DOCTOR_ALL_DAYS.map((day) => ({
    day_of_week: day,
    sessions: CLINIC_DEFAULT_SESSIONS.map((s) => ({
      _key: tempKey(),
      start_time: s.start,
      end_time: s.end,
    })),
  }));
}

/* ── Client-side Validation ──────────────────────────────────────────────── */

interface ValidationError {
  day: DayOfWeek;
  message: string;
}

function validateDraft(draft: DraftSchedule): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const day of draft) {
    const sessions = day.sessions;

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];

      if (!s.start_time || !s.end_time) {
        errors.push({ day: day.day_of_week, message: `Session ${i + 1}: start and end times are required` });
        continue;
      }

      if (s.start_time >= s.end_time) {
        errors.push({ day: day.day_of_week, message: `Session ${i + 1}: end time must be after start time` });
      }

      for (let j = i + 1; j < sessions.length; j++) {
        const other = sessions[j];
        if (s.start_time < other.end_time && other.start_time < s.end_time) {
          errors.push({ day: day.day_of_week, message: `Sessions ${i + 1} and ${j + 1} overlap` });
        }
      }
    }
  }

  return errors;
}

/** Convert draft to API payload. */
function draftToPayload(draft: DraftSchedule): ScheduleCreateRequest[] {
  const payload: ScheduleCreateRequest[] = [];
  for (const day of draft) {
    for (const s of day.sessions) {
      if (s.start_time && s.end_time) {
        payload.push({
          day_of_week: day.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
        });
      }
    }
  }
  return payload;
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface DoctorScheduleEditorProps {
  open: boolean;
  onClose: () => void;
  doctor: DoctorProfileResponse;
  hasCustomSchedules: boolean;
  onSave: (schedules: ScheduleCreateRequest[]) => void;
  saving?: boolean;
  error?: string | null;
}

export const DoctorScheduleEditor: FC<DoctorScheduleEditorProps> = ({
  open,
  onClose,
  doctor,
  hasCustomSchedules,
  onSave,
  saving = false,
  error = null,
}) => {
  const [draft, setDraft] = useState<DraftSchedule>(() =>
    hasCustomSchedules ? schedulesToDraft(doctor.schedules) : clinicDefaultDraft(),
  );

  const validationErrors = useMemo(() => validateDraft(draft), [draft]);
  const hasErrors = validationErrors.length > 0;

  const addSession = useCallback((day: DayOfWeek) => {
    setDraft((prev) =>
      prev.map((d) => {
        if (d.day_of_week !== day) return d;
        // Calculate a non-overlapping default for the new session:
        // - If the day is empty, use the first clinic default session (10:00-13:00)
        // - Otherwise, place it after the last session ends (or use clinic default)
        let newStart = CLINIC_DEFAULT_SESSIONS[0].start;
        let newEnd = CLINIC_DEFAULT_SESSIONS[0].end;
        if (d.sessions.length > 0) {
          const lastEnd = d.sessions[d.sessions.length - 1].end_time;
          // Try to place after the last session; if it exceeds 21:00, fall back to 10:00-13:00
          if (lastEnd < '21:00') {
            newStart = lastEnd;
            newEnd = '21:00';
          }
        }
        return {
          ...d,
          sessions: [...d.sessions, { _key: tempKey(), start_time: newStart, end_time: newEnd }],
        };
      }),
    );
  }, []);

  const removeSession = useCallback((day: DayOfWeek, sessionKey: string) => {
    setDraft((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? { ...d, sessions: d.sessions.filter((s) => s._key !== sessionKey) }
          : d,
      ),
    );
  }, []);

  const updateSessionTime = useCallback(
    (day: DayOfWeek, sessionKey: string, field: 'start_time' | 'end_time', value: string) => {
      setDraft((prev) =>
        prev.map((d) =>
          d.day_of_week === day
            ? {
                ...d,
                sessions: d.sessions.map((s) =>
                  s._key === sessionKey ? { ...s, [field]: value } : s,
                ),
              }
            : d,
        ),
      );
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (hasErrors) return;
    onSave(draftToPayload(draft));
  }, [draft, hasErrors, onSave]);

  return (
    <Drawer open={open} onClose={onClose}>
      <Drawer.Header>
        <h2 className="text-lg font-semibold text-neutral-900">Edit Weekly Schedule</h2>
      </Drawer.Header>
      <Drawer.Body>
        <div className="flex flex-col gap-6">
          <div className="rounded-md bg-primary-50 p-3 text-body-sm text-primary-700">
            {hasCustomSchedules
              ? 'Editing the existing custom schedule. Changes are saved when you click "Save Schedule".'
              : 'Pre-populated with clinic default hours. Modify to create a custom schedule.'}
          </div>

          {hasErrors && (
            <div className="rounded-md bg-danger-50 p-3 text-body-sm text-danger-700">
              <p className="font-medium">Please fix the following:</p>
              <ul className="mt-1 list-inside list-disc">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    {DOCTOR_DAY_LABELS[err.day]}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-danger-50 p-3 text-body-sm text-danger-700">
              {error}
            </div>
          )}

          {draft.map((day) => (
            <div key={day.day_of_week} className="border-b border-neutral-100 pb-4 last:border-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-neutral-900">
                  {DOCTOR_DAY_LABELS[day.day_of_week]}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addSession(day.day_of_week)}
                  data-testid={`add-session-${day.day_of_week}`}
                >
                  <Icon icon={Plus} size="sm" className="mr-1" />
                  Add Session
                </Button>
              </div>

              {day.sessions.length === 0 ? (
                <p className="text-body-sm text-neutral-400 italic">Not working</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {day.sessions.map((session) => (
                    <div key={session._key} className="flex items-center gap-2">
                      <Icon icon={Clock} size="sm" className="text-neutral-400" />
                      <input
                        type="time"
                        value={session.start_time}
                        onChange={(e) =>
                          updateSessionTime(day.day_of_week, session._key, 'start_time', e.target.value)
                        }
                        className="rounded border border-neutral-300 px-2 py-1 text-body-sm tabular-nums"
                        data-testid={`start-time-${day.day_of_week}`}
                      />
                      <span className="text-neutral-400">–</span>
                      <input
                        type="time"
                        value={session.end_time}
                        onChange={(e) =>
                          updateSessionTime(day.day_of_week, session._key, 'end_time', e.target.value)
                        }
                        className="rounded border border-neutral-300 px-2 py-1 text-body-sm tabular-nums"
                        data-testid={`end-time-${day.day_of_week}`}
                      />
                      <IconButton
                        icon={<Trash2 />}
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSession(day.day_of_week, session._key)}
                        aria-label="Remove session"
                        data-testid={`remove-session-${day.day_of_week}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} data-testid="cancel-schedule">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={hasErrors || saving}
            data-testid="save-schedule"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </Drawer.Footer>
    </Drawer>
  );
};
