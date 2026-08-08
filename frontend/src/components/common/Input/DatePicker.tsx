import { useEffect, useId, useMemo, useRef, useState, type FC } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';
import { Popover } from '../Popover/Popover';

/* ── Date helpers (zero-dependency) ────────────────────────────────── */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type CalendarView = 'date' | 'month' | 'year';

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
  return new Date(year, month - 1, day);
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

/** Clamp a day into [1, daysInMonth] so navigating to short months is safe. */
function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
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

/* ── Small building blocks ─────────────────────────────────────────── */

interface HeaderButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const HeaderButton: FC<HeaderButtonProps> = ({ icon, label, onClick, disabled = false }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="rounded-lg p-1.5 text-neutral-500 transition-colors duration-100 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
  >
    <Icon icon={icon} size="sm" />
  </button>
);

interface PanelButtonProps {
  children: React.ReactNode;
  'data-month'?: number;
  'data-year'?: number;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}

const PanelButton: FC<PanelButtonProps> = ({
  children,
  'data-month': dataMonth,
  'data-year': dataYear,
  disabled = false,
  selected = false,
  onClick,
}) => (
  <button
    type="button"
    data-month={dataMonth}
    data-year={dataYear}
    disabled={disabled}
    aria-pressed={selected}
    onClick={onClick}
    className={`
      rounded-lg px-2 py-1.5 text-body-sm transition-colors duration-100
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
      disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent
      ${
        selected
          ? 'bg-primary-500 font-semibold text-white hover:bg-primary-600'
          : 'text-neutral-700 hover:bg-neutral-100'
      }
    `}
  >
    {children}
  </button>
);

/**
 * DatePicker — zero-dependency calendar popover picker that returns ISO
 * `YYYY-MM-DD` strings. Composes FormField and the Popover primitive
 * (outside-click, Escape, portal positioning, focus restoration, ARIA
 * wiring). Supports direct month/year selection and full keyboard
 * navigation, so DOB fields no longer require dozens of clicks.
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
  const [viewMode, setViewMode] = useState<CalendarView>('date');
  const dialogId = useId();
  // The trigger button is a labelable element, so the shared FormField label
  // (htmlFor) can be wired to it — the field name stays discoverable to
  // assistive tech instead of relying on the visible placeholder alone.
  const triggerId = useId();

  const isControlled = controlledValue !== undefined;
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const valueDate = useMemo(() => (value ? parseISODate(value) : null), [value]);
  const today = useMemo(() => new Date(), []);

  // The base month is derived from the selected value; user navigation is a
  // pure offset from it, so the whole view is derived and safe under
  // concurrent rendering (no render-time setState).
  const baseYear = (valueDate ?? today).getFullYear();
  const baseMonth = (valueDate ?? today).getMonth();
  const [monthOffset, setMonthOffset] = useState(0);

  // Cursor used for roving-tabindex focus + arrow-key navigation.
  const [focusedDate, setFocusedDate] = useState<Date>(() => valueDate ?? new Date());

  const viewDate = useMemo(
    () => new Date(baseYear, baseMonth + monthOffset, 1),
    [baseYear, baseMonth, monthOffset],
  );

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

  const decadeStart = year - (year % 12);
  const decadeEnd = decadeStart + 11;
  const years = useMemo(
    () => Array.from({ length: 12 }, (_, i) => decadeStart + i),
    [decadeStart],
  );

  /* ── Selection + navigation ───────────────────────────────────────── */

  const selectDate = (date: Date) => {
    const iso = toISODate(date);
    if (!isControlled) setInternalValue(iso);
    onChange?.(iso);
    setFocusedDate(date);
    setMonthOffset(0);
    setOpen(false);
  };

  const changeMonth = (delta: number) => {
    const next = new Date(baseYear, baseMonth + monthOffset + delta, 1);
    setFocusedDate(
      new Date(next.getFullYear(), next.getMonth(), clampDay(next.getFullYear(), next.getMonth(), focusedDate.getDate())),
    );
    setMonthOffset((offset) => offset + delta);
  };

  const selectMonth = (month: number) => {
    setMonthOffset(year * 12 + month - (baseYear * 12 + baseMonth));
    setViewMode('date');
    setFocusedDate(new Date(year, month, 1));
  };

  const selectYear = (targetYear: number) => {
    setMonthOffset(targetYear * 12 - (baseYear * 12 + baseMonth));
    setViewMode('month');
    setFocusedDate(new Date(targetYear, 0, 1));
  };

  const isDayDisabled = (date: Date): boolean => {
    const iso = toISODate(date);
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  const isMonthDisabled = (month: number): boolean => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    if (minDate && toISODate(last) < minDate) return true;
    if (maxDate && toISODate(first) > maxDate) return true;
    return false;
  };

  const isYearDisabled = (targetYear: number): boolean => {
    if (minDate && targetYear < Number(minDate.slice(0, 4))) return true;
    if (maxDate && targetYear > Number(maxDate.slice(0, 4))) return true;
    return false;
  };

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Re-open at the selected value's month with a fresh cursor.
      const initial = valueDate ?? new Date();
      setMonthOffset(0);
      setViewMode('date');
      setFocusedDate(initial);
    }
  };

  /* ── Focus management ─────────────────────────────────────────────── */

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Roving focus: whenever the cursor/view changes, focus the matching cell
  // so arrow navigation always has a visible, focused target.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const targetSelector: Record<CalendarView, string> = {
      date: `[data-date="${toISODate(focusedDate)}"]`,
      month: `[data-month="${focusedDate.getMonth()}"]`,
      year: `[data-year="${focusedDate.getFullYear()}"]`,
    };
    const target =
      panel.querySelector<HTMLElement>(targetSelector[viewMode]) ??
      panel.querySelector<HTMLElement>('[data-date], [data-month], [data-year]');
    target?.focus();
  }, [open, viewMode, focusedDate]);

  const moveFocusedDate = (targetYear: number, targetMonth: number, targetDay: number) => {
    const next = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth, targetDay));
    setFocusedDate(next);
    if (next.getFullYear() !== year || next.getMonth() !== monthIndex) {
      setMonthOffset(next.getFullYear() * 12 + next.getMonth() - (baseYear * 12 + baseMonth));
    }
  };

  const handleDayGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const stepMap: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (stepMap[e.key]) {
      e.preventDefault();
      moveFocusedDate(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + stepMap[e.key]);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      moveFocusedDate(year, monthIndex, 1);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      moveFocusedDate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate());
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      const target = new Date(year, monthIndex - 1, 1);
      moveFocusedDate(target.getFullYear(), target.getMonth(), focusedDate.getDate());
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      const target = new Date(year, monthIndex + 1, 1);
      moveFocusedDate(target.getFullYear(), target.getMonth(), focusedDate.getDate());
    }
  };

  const handleMonthGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = focusedDate.getMonth();
    let next = -1;
    if (e.key === 'ArrowRight') next = (current + 1) % 12;
    else if (e.key === 'ArrowLeft') next = (current + 11) % 12;
    else if (e.key === 'ArrowUp') next = (current + 9) % 12;
    else if (e.key === 'ArrowDown') next = (current + 3) % 12;
    if (next === -1) return;
    e.preventDefault();
    setFocusedDate(new Date(year, next, 1));
  };

  const handleYearGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.min(11, Math.max(0, focusedDate.getFullYear() - decadeStart));
    let nextIndex = -1;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % 12;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex + 11) % 12;
    else if (e.key === 'ArrowUp') nextIndex = (currentIndex + 9) % 12;
    else if (e.key === 'ArrowDown') nextIndex = (currentIndex + 3) % 12;
    if (nextIndex === -1) return;
    e.preventDefault();
    setFocusedDate(new Date(decadeStart + nextIndex, monthIndex, 1));
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  const focusableDay = (date: Date): boolean =>
    date.getFullYear() === year && date.getMonth() === monthIndex && isSameDay(date, focusedDate);

  return (
    <FormField
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      inputId={triggerId}
      className={wrapperClassName}
    >
      <Popover
        open={open}
        onOpenChange={handleOpen}
        align="start"
        offset={8}
        zIndex="z-datepicker"
        className={`w-full ${className}`}
      >
        {/* Trigger */}
        <Popover.Trigger
          as="button"
          id={triggerId}
          // The host-language label (FormField htmlFor) associates this button
          // with its field name (label association); the explicit aria-label
          // supplies the computed accessible name and also carries the current
          // value so assistive tech announces e.g. "Due Date: Aug 22, 2026".
          ariaLabel={
            label
              ? `${label}: ${value ? formatDisplay(value) : placeholder}`
              : undefined
          }
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
        <Popover.Content
          role="dialog"
          ariaLabel="Select date"
          id={dialogId}
          className="w-72 max-w-[calc(100vw-1rem)] p-3"
        >
          <div ref={panelRef}>
            {/* Header — differs per view */}
            {viewMode === 'date' && (
              <div className="mb-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-0.5">
                  <HeaderButton icon={ChevronsLeft} label="Previous year" onClick={() => changeMonth(-12)} />
                  <HeaderButton icon={ChevronLeft} label="Previous month" onClick={() => changeMonth(-1)} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Select month"
                    onClick={() => setViewMode('month')}
                    className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-label font-semibold text-neutral-800 transition-colors duration-100 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {MONTH_NAMES[monthIndex]}
                    <Icon icon={ChevronDown} size="xs" className="text-neutral-400" />
                  </button>
                  <button
                    type="button"
                    aria-label="Select year"
                    onClick={() => setViewMode('year')}
                    className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-label font-semibold text-neutral-800 transition-colors duration-100 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {year}
                    <Icon icon={ChevronDown} size="xs" className="text-neutral-400" />
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <HeaderButton icon={ChevronRight} label="Next month" onClick={() => changeMonth(1)} />
                  <HeaderButton icon={ChevronsRight} label="Next year" onClick={() => changeMonth(12)} />
                </div>
              </div>
            )}

            {viewMode === 'month' && (
              <div className="mb-2 flex items-center justify-between gap-1">
                <HeaderButton icon={ChevronsLeft} label="Previous year" onClick={() => changeMonth(-12)} />
                <button
                  type="button"
                  aria-label="Select year"
                  onClick={() => setViewMode('year')}
                  className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-label font-semibold text-neutral-800 transition-colors duration-100 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {year}
                  <Icon icon={ChevronDown} size="xs" className="text-neutral-400" />
                </button>
                <HeaderButton icon={ChevronsRight} label="Next year" onClick={() => changeMonth(12)} />
              </div>
            )}

            {viewMode === 'year' && (
              <div className="mb-2 flex items-center justify-between gap-1">
                <HeaderButton icon={ChevronsLeft} label="Previous decade" onClick={() => changeMonth(-144)} />
                <p className="text-label font-semibold text-neutral-800">
                  {decadeStart}–{decadeEnd}
                </p>
                <HeaderButton icon={ChevronsRight} label="Next decade" onClick={() => changeMonth(144)} />
              </div>
            )}

            {/* Body — differs per view */}
            {viewMode === 'date' && (
              <>
                {/* Weekday header */}
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="py-1 text-caption font-medium text-neutral-400">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Day grid */}
                <div
                  role="grid"
                  aria-label={`${MONTH_NAMES[monthIndex]} ${year}`}
                  onKeyDown={handleDayGridKeyDown}
                  className="grid grid-cols-7 gap-0.5"
                >
                  {cells.map((date, idx) =>
                    date === null ? (
                      <span key={`empty-${idx}`} />
                    ) : (
                      <button
                        key={toISODate(date)}
                        data-date={toISODate(date)}
                        type="button"
                        tabIndex={focusableDay(date) ? 0 : -1}
                        disabled={isDayDisabled(date)}
                        aria-pressed={valueDate ? isSameDay(date, valueDate) : false}
                        aria-current={isSameDay(date, today) ? 'date' : undefined}
                        onClick={() => selectDate(date)}
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
              </>
            )}

            {viewMode === 'month' && (
              <div
                role="grid"
                aria-label={`Select a month in ${year}`}
                onKeyDown={handleMonthGridKeyDown}
                className="grid grid-cols-3 gap-1"
              >
                {MONTH_NAMES.map((name, month) => (
                  <PanelButton
                    key={name}
                    data-month={month}
                    selected={valueDate !== null && year === valueDate.getFullYear() && month === valueDate.getMonth()}
                    disabled={isMonthDisabled(month)}
                    onClick={() => selectMonth(month)}
                  >
                    {MONTH_ABBREV[month]}
                  </PanelButton>
                ))}
              </div>
            )}

            {viewMode === 'year' && (
              <div
                role="grid"
                aria-label={`Select a year`}
                onKeyDown={handleYearGridKeyDown}
                className="grid grid-cols-3 gap-1"
              >
                {years.map((targetYear) => (
                  <PanelButton
                    key={targetYear}
                    data-year={targetYear}
                    selected={valueDate !== null && targetYear === valueDate.getFullYear()}
                    disabled={isYearDisabled(targetYear)}
                    onClick={() => selectYear(targetYear)}
                  >
                    {targetYear}
                  </PanelButton>
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover>
    </FormField>
  );
};
