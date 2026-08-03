import { useId, useMemo, useState, type FC } from 'react';
import { Clock } from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';
import { Popover } from '../Popover/Popover';

/* ── Helpers (zero-dependency) ─────────────────────────────────────── */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildTimeOptions(stepMinutes: number): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    options.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return options;
}

function formatDisplay(time: string, use24h: boolean): string {
  const [h, m] = time.split(':').map(Number);
  if (use24h) return `${pad(h)}:${pad(m)}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(hour12)}:${pad(m)} ${suffix}`;
}

/* ── Props ─────────────────────────────────────────────────────────── */

interface TimePickerProps {
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
  /** Selected time (`HH:MM` 24-hour) — controlled */
  value?: string;
  /** Default time (uncontrolled) */
  defaultValue?: string;
  /** Called when a time is selected */
  onChange?: (value: string) => void;
  /** Step between options in minutes (default 30, minimum 1) */
  stepMinutes?: number;
  /** Display format */
  format?: '12h' | '24h';
  /** Placeholder shown when empty */
  placeholder?: string;
  /** Additional wrapper classes */
  wrapperClassName?: string;
  /** Additional classes */
  className?: string;
}

/**
 * TimePicker — zero-dependency scrollable time list picker returning
 * `HH:MM` (24-hour) strings. Composes FormField and the Popover primitive
 * (outside-click, Escape, positioning, focus restoration, ARIA wiring).
 *
 * @example
 * ```tsx
 * <TimePicker
 *   label="Start time"
 *   value={startTime}
 *   onChange={setStartTime}
 *   stepMinutes={15}
 *   format="12h"
 * />
 * ```
 */
export const TimePicker: FC<TimePickerProps> = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  value: controlledValue,
  defaultValue,
  onChange,
  stepMinutes = 30,
  format = '12h',
  placeholder = 'Select a time',
  wrapperClassName = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const [open, setOpen] = useState(false);
  const listboxId = useId();

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const isControlled = controlledValue !== undefined;
  const use24h = format === '24h';

  const safeStep = Math.max(1, stepMinutes);
  const options = useMemo(() => buildTimeOptions(safeStep), [safeStep]);

  const selectTime = (time: string) => {
    if (!isControlled) setInternalValue(time);
    onChange?.(time);
    setOpen(false);
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
        onOpenChange={setOpen}
        align="start"
        className={`w-full ${className}`}
      >
        {/* Trigger */}
        <Popover.Trigger
          as="button"
          ariaHaspopup="listbox"
          ariaControls={open ? listboxId : undefined}
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
          <Icon icon={Clock} size="sm" className="shrink-0 text-neutral-400" />
          <span className={value ? 'text-neutral-800' : 'text-neutral-400'}>
            {value ? formatDisplay(value, use24h) : placeholder}
          </span>
        </Popover.Trigger>

        {/* Time list */}
        <Popover.Content role="listbox" ariaLabel="Select time" id={listboxId} className="max-h-56 w-36 overflow-y-auto py-1">
          {options.map((time) => {
            const isSelected = time === value;
            return (
              <button
                key={time}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectTime(time)}
                className={`
                  flex w-full items-center justify-center px-3 py-1.5 text-body-sm transition-colors duration-100
                  focus-visible:outline-none focus-visible:bg-neutral-100
                  ${isSelected ? 'bg-primary-50 font-semibold text-primary-700' : 'text-neutral-700 hover:bg-neutral-100'}
                `}
              >
                {formatDisplay(time, use24h)}
              </button>
            );
          })}
        </Popover.Content>
      </Popover>
    </FormField>
  );
};
