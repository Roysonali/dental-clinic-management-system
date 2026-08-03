import { useMemo } from 'react';
import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Icon } from '../Icon/Icon';

/* ── Props ─────────────────────────────────────────────────────────── */

interface ValidationSummaryProps {
  /**
   * Error object — either react-hook-form's `FieldErrors` shape
   * (`{ field: { message } }`) or a flat map of field → message string.
   */
  errors?: Record<string, unknown>;
  /** Title shown above the list */
  title?: string;
  /** Additional classes */
  className?: string;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function extractMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (
    value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string' &&
    (value as { message: string }).message.trim()
  ) {
    return (value as { message: string }).message;
  }
  return null;
}

/**
 * ValidationSummary — collects all field errors into a single
 * accessible alert box. Compatible with react-hook-form `errors`
 * (from `formState.errors`) and plain error maps.
 *
 * @example
 * ```tsx
 * <ValidationSummary errors={errors} title="Please fix the following:" />
 * ```
 */
export const ValidationSummary: FC<ValidationSummaryProps> = ({
  errors,
  title = 'Please review the following fields:',
  className = '',
}) => {
  const messages = useMemo(() => {
    if (!errors) return [];
    return Object.values(errors)
      .map(extractMessage)
      .filter((m): m is string => m !== null);
  }, [errors]);

  if (messages.length === 0) return null;

  return (
    <div
      role="alert"
      className={`rounded-lg border border-danger/25 bg-danger/10 p-4 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon icon={AlertTriangle} size="md" className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-danger">{title}</p>
          <ul className="mt-1.5 space-y-1">
            {messages.map((message, idx) => (
              <li key={idx} className="text-body-sm text-danger">
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
