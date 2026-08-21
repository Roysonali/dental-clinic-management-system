import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/* ── Base field props shared across Input, Textarea, Select ────────── */

export interface BaseFieldProps {
  /** Label text shown above the field */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper/description text */
  helperText?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** Whether the field has a success state */
  success?: boolean;
  /** Additional wrapper classes */
  wrapperClassName?: string;
}

/* ── Input Props ───────────────────────────────────────────────────── */

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    BaseFieldProps {
  /** Leading icon/prefix element */
  leadingIcon?: ReactNode;
  /** Trailing icon/suffix element */
  trailingIcon?: ReactNode;
  /**
   * Treat the trailing icon as an interactive action control (e.g. a
   * visibility toggle). The trailing slot is `pointer-events-none` by
   * default so decorative icons never block input clicks; set this to
   * allow the control to receive pointer events.
   */
  trailingAction?: boolean;
  /** Text prefix (before the value, inside the input) */
  prefix?: string;
  /** Text suffix (after the value, inside the input) */
  suffix?: string;
}

/* ── Textarea Props ────────────────────────────────────────────────── */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseFieldProps {
  /** Enable auto-resize (height grows with content) */
  autoResize?: boolean;
  /** Show character counter (requires maxLength) */
  showCharCount?: boolean;
  /** Max character count (required for counter) */
  maxLength?: number;
}

/* ── Select Props ──────────────────────────────────────────────────── */

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    BaseFieldProps {
  /** Placeholder option (shown when no value selected) */
  placeholder?: string;
  /** Array of options */
  options: readonly { value: string; label: string; disabled?: boolean }[];
  /** Show a clear button when a value is selected */
  clearable?: boolean;
  /** Called when the clear button is clicked */
  onClear?: () => void;
}
