import { useMemo, type FC } from 'react';
import { Check } from 'lucide-react';
import type { TreatmentPlanStatus } from '../../types/treatmentPlan';

/**
 * Linear workflow steps for the progress bar. Rejected and cancelled are
 * terminal forks that render OUTSIDE the happy path (a badge, not a step).
 * Derived purely from `planActionsForStatus`-adjacent logic — no new state.
 */
const HAPPY_PATH: readonly TreatmentPlanStatus[] = [
  'draft',
  'under_review',
  'proposed',
  'accepted',
  'in_progress',
  'completed',
] as const;

/** Step index of a status on the happy path (or -1 when off-path). */
function happyPathIndex(status: TreatmentPlanStatus): number {
  const index = HAPPY_PATH.indexOf(status);
  return index;
}

interface WorkflowProgressBarProps {
  status: TreatmentPlanStatus;
  className?: string;
}

/**
 * WorkflowProgressBar — visual plan-lifecycle indicator (S-02 header).
 *
 * Renders the happy-path steps with connected segments; the current step is
 * highlighted, completed steps show a check. `rejected` / `cancelled` render
 * a warning label instead of a step (they are not on the happy path).
 * `role="progressbar"` + `aria-valuenow` for screen readers.
 */
export const WorkflowProgressBar: FC<WorkflowProgressBarProps> = ({ status, className = '' }) => {
  const currentIndex = happyPathIndex(status);

  const segment = useMemo(() => {
    if (status === 'rejected') return { label: 'Rejected', variant: 'bg-danger' } as const;
    if (status === 'cancelled') return { label: 'Cancelled', variant: 'bg-neutral-400' } as const;
    return null;
  }, [status]);

  if (segment) {
    return (
      <div className={`flex items-center gap-3 ${className}`} role="status">
        <span className={`h-2.5 w-2.5 rounded-full ${segment.variant}`} aria-hidden="true" />
        <p className="text-body-sm font-medium text-neutral-600">
          {segment.label} — no longer on the active workflow
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={HAPPY_PATH.length - 1}
      aria-valuenow={Math.max(0, currentIndex)}
      aria-valuetext={`Step ${currentIndex + 1} of ${HAPPY_PATH.length}: ${status}`}
    >
      <ol className="flex items-center">
        {HAPPY_PATH.map((step, index) => {
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                {/* Step circle */}
                <span
                  aria-hidden="true"
                  className={`
                    flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold
                    transition-colors duration-150
                    ${
                      isCompleted
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : isCurrent
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-neutral-300 bg-white text-neutral-400'
                    }
                  `}
                >
                  {isCompleted ? <Check size={14} /> : index + 1}
                </span>
                <span
                  className={`
                    hidden text-label font-medium sm:inline
                    ${isCurrent ? 'text-primary-700' : isCompleted ? 'text-neutral-800' : 'text-neutral-400'}
                  `}
                >
                  {step.replace(/_/g, ' ')}
                </span>
              </div>
              {/* Connector */}
              {index < HAPPY_PATH.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`mx-2 h-0.5 flex-1 rounded-full ${isCompleted ? 'bg-primary-500' : 'bg-neutral-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
