import { useId, useMemo, useState, type FC } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';
import { Popover } from '../Popover/Popover';

/* ── Date helpers (zero-dependency) ────────────────────────────────── */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  return date;
}

function formatDisplay(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ── Props ─────────────────────────────────────────────────────────── */

interface DatePickerProps {
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required marker */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Selected date (ISO `YYYY-MM-DD`) — controlled */
  value?: string;
  /** Default selected date (uncontrolled) */
  defaultValue?: string;
  /** Called when a date is selected */
  onChange?: (value: string) => void;
  /** Earliest selectable date (ISO `YYYY-MM-DD`) */
  minDate?: string;
  /** Latest selectable date (ISO `YYYY-MM-DD`) */
  maxDate?: string;
  /** Placeholder shown when empty */
  placeholder?: string;
  /** Additional wrapper classes */
  wrapperClassName?: string;
  /** Additional classes */
  className?: string;
}

/**
 * DatePicker — zero-dependency calendar popover picker that returns ISO
 * `YYYY-MM-DD` strings. Composes FormField and the Popover primitive
 * (outside-click, Escape, positioning, focus restoration, ARIA wiring).
 *
 * @example
 * ```tsx
 * <DatePicker
 *   label="Date of birth"
 *   value={dob}
 *   onChange={setDob}
 *   maxDate={todayISO}
 * />
 * ```
 */
export const DatePicker: FC<DatePickerProps> = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  value: controlledValue,
  defaultValue,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select a date',
  wrapperClassName = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const [open, setOpen] = useState(false);
  const dialogId = useId();

  const isControlled = controlledValue !== undefined;
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Stable references so the derived view below only recomputes when inputs change.
  const valueDate = useMemo(() => (value ? parseISODate(value) : null), [value]);
  const today = useMemo(() => new Date(), []);
  const baseMonth = valueDate ?? today;

  // User month navigation is stored as an offset from the base month, which is
  // derived from the selected value. This keeps the view fully derived — the
  // calendar follows value changes automatically with no render-time setState
  // and no effect, remaining safe under concurrent rendering.
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(
    () => new Date(baseMonth.getFullYear(), baseMonth.getMonth() + monthOffset, 1),
    [baseMonth, monthOffset],
  );

  const selectDate = (date: Date) => {
    const iso = toISODate(date);
    if (!isControlled) setInternalValue(iso);
    onChange?.(iso);
    setMonthOffset(0);
    setOpen(false);
  };

  const monthIndex = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const result: (Date | null)[] = Array(startWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(new Date(year, monthIndex, day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, monthIndex]);

  const changeMonth = (delta: number) => {
    setMonthOffset((offset) => offset + delta);
  };

  const isDisabled = (date: Date): boolean => {
    const iso = toISODate(date);
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  return (
    <FormField
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      className={wrapperClassName}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Re-open the calendar at the selected value's month so a stale
          // navigation offset never leaks across open/close cycles.
          if (next) setMonthOffset(0);
        }}
        align="start"
        focusOnOpen
        className={`w-full ${className}`}
      >
        {/* Trigger */}
        <Popover.Trigger
          as="button"
          ariaHaspopup="dialog"
          ariaControls={open ? dialogId : undefined}
          ariaInvalid={!!error}
          disabled={disabled}
          className={`
            flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-body
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
            ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400 focus:border-primary-500'}
          `}
        >
          <Icon icon={Calendar} size="sm" className="shrink-0 text-neutral-400" />
          <span className={value ? 'text-neutral-800' : 'text-neutral-400'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </Popover.Trigger>

        {/* Calendar popover */}
        <Popover.Content role="dialog" ariaLabel="Select date" id={dialogId} className="w-72 p-3">
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-neutral-500 transition-colors duration-100 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon icon={ChevronLeft} size="sm" />
            </button>
            <p className="text-label font-semibold text-neutral-800">
              {MONTH_NAMES[monthIndex]} {year}
            </p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-neutral-500 transition-colors duration-100 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon icon={ChevronRight} size="sm" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-caption font-medium text-neutral-400">
                {day}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((date, idx) =>
              date === null ? (
                <span key={`empty-${idx}`} />
              ) : (
                <button
                  key={toISODate(date)}
                  type="button"
                  disabled={isDisabled(date)}
                  onClick={() => selectDate(date)}
                  aria-pressed={valueDate ? isSameDay(date, valueDate) : false}
                  className={`
                    aspect-square rounded-lg text-body-sm transition-colors duration-100
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                    disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent
                    ${
                      valueDate && isSameDay(date, valueDate)
                        ? 'bg-primary-500 font-semibold text-white hover:bg-primary-600'
                        : isSameDay(date, today)
                          ? 'font-semibold text-primary-700 hover:bg-primary-50'
                          : 'text-neutral-700 hover:bg-neutral-100'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              ),
            )}
          </div>
        </Popover.Content>
      </Popover>
    </FormField>
  );
};
