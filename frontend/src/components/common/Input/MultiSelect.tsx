import { useState, useId, type FC } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../Checkbox/Checkbox';
import { Popover } from '../Popover/Popover';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
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
  /** Available options */
  options: readonly MultiSelectOption[];
  /** Selected values (controlled) */
  value?: readonly string[];
  /** Default selected values (uncontrolled) */
  defaultValue?: readonly string[];
  /** Called when selection changes */
  onChange?: (values: string[]) => void;
  /** Placeholder shown when nothing is selected */
  placeholder?: string;
  /** Max number of selected pills rendered inline (rest become "+N more") */
  maxPills?: number;
  /** Additional wrapper classes */
  wrapperClassName?: string;
  /** Additional classes */
  className?: string;
}

/**
 * MultiSelect — checkbox multi-select dropdown. Composes FormField,
 * Checkbox, and the Popover primitive (outside-click, Escape, positioning,
 * focus restoration and ARIA wiring all come from Popover).
 *
 * @example
 * ```tsx
 * <MultiSelect
 *   label="Specializations"
 *   options={specs.map(s => ({ value: s.id, label: s.name }))}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="Select specializations"
 * />
 * ```
 */
export const MultiSelect: FC<MultiSelectProps> = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  options,
  value: controlledValue,
  defaultValue = [],
  onChange,
  placeholder = 'Select options',
  maxPills = 3,
  wrapperClassName = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState<string[]>(() => [...defaultValue]);
  const [open, setOpen] = useState(false);
  const listboxId = useId();

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? [...controlledValue] : internalValue;

  const update = (next: string[]) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  const toggleOption = (value: string) => {
    if (currentValue.includes(value)) {
      update(currentValue.filter((v) => v !== value));
    } else {
      update([...currentValue, value]);
    }
  };

  const removeOption = (value: string) => {
    update(currentValue.filter((v) => v !== value));
  };

  const selectedLabels = currentValue
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is MultiSelectOption => o !== undefined);

  const pills = selectedLabels.slice(0, maxPills);
  const overflowCount = selectedLabels.length - pills.length;

  return (
    <FormField
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      className={wrapperClassName}
    >
      <Popover open={open} onOpenChange={setOpen} align="start" className={`w-full ${className}`}>
        {/* Trigger */}
        <Popover.Trigger
          as="div"
          role="combobox"
          ariaHaspopup="listbox"
          ariaControls={open ? listboxId : undefined}
          ariaInvalid={!!error}
          disabled={disabled}
          className={`
            flex w-full cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-body text-neutral-800
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
            ${disabled ? 'cursor-not-allowed opacity-60' : ''}
            ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400 focus:border-primary-500'}
          `}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
            {selectedLabels.length === 0 ? (
              <span className="text-neutral-400">{placeholder}</span>
            ) : (
              <>
                {pills.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 py-0.5 pl-2 pr-1 text-caption font-medium text-primary-700"
                  >
                    <span className="truncate">{opt.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOption(opt.value);
                      }}
                      aria-label={`Remove ${opt.label}`}
                      className="rounded-full p-0.5 hover:bg-primary-100 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <Icon icon={X} size="xs" />
                    </button>
                  </span>
                ))}
                {overflowCount > 0 && (
                  <span className="text-caption text-neutral-500">+{overflowCount} more</span>
                )}
              </>
            )}
          </span>
          <Icon
            icon={ChevronDown}
            size="sm"
            className={`shrink-0 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </Popover.Trigger>

        {/* Menu */}
        <Popover.Content className="max-h-60 w-full overflow-y-auto py-1">
          <div id={listboxId} role="listbox" aria-multiselectable="true">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-body-sm text-neutral-400">No options available</p>
            ) : (
              options.map((opt) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={currentValue.includes(opt.value)}
                  className={`
                    px-3 py-1.5 transition-colors duration-100
                    hover:bg-neutral-100
                    ${opt.disabled ? 'cursor-not-allowed opacity-50' : ''}
                  `}
                >
                  <Checkbox
                    label={opt.label}
                    checked={currentValue.includes(opt.value)}
                    disabled={opt.disabled}
                    onChange={() => toggleOption(opt.value)}
                    size="sm"
                  />
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover>
    </FormField>
  );
};
