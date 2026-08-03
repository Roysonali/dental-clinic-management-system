import type { FC } from 'react';
import { X } from 'lucide-react';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { PatientForm } from './PatientForm';
import { Spinner } from '../common/Spinner/Spinner';
import type { PatientFormValues } from '../../types/patient';

interface PatientDrawerProps {
  /** Open state */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Called with validated form values */
  onSubmit: (values: PatientFormValues) => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<PatientFormValues>;
  /** Server-side field errors */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Show a loading state instead of the form (e.g. fetching the patient) */
  loading?: boolean;
  /** Title shown in the drawer header */
  title?: string;
  /** Submit button label */
  submitText?: string;
  /** Disable the form (e.g. while initial data loads) */
  disabled?: boolean;
}

/**
 * PatientDrawer — right-side drawer that hosts the shared PatientForm.
 *
 * One drawer serves BOTH create and edit — the container decides the mode.
 * Reuses the Drawer primitive (focus trap, Escape, focus restoration) and
 * the presentational PatientForm (react-hook-form + zod).
 */
export const PatientDrawer: FC<PatientDrawerProps> = ({
  open,
  onClose,
  mode,
  onSubmit,
  submitting = false,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  loading = false,
  title = mode === 'edit' ? 'Edit Patient' : 'Register Patient',
  submitText = mode === 'edit' ? 'Save Changes' : 'Register Patient',
  disabled = false,
}) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel={title}
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h4 font-semibold text-neutral-900">{title}</h2>
          <IconButton
            icon={<Icon icon={X} size="sm" />}
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body>
        {loading ? (
          <div className="flex h-full items-center justify-center py-16" role="status" aria-label="Loading patient">
            <Spinner size="lg" variant="primary" />
          </div>
        ) : (
          <PatientForm
            onSubmit={onSubmit}
            submitting={submitting}
            submitText={submitText}
            onCancel={onClose}
            initialValues={initialValues}
            serverErrors={serverErrors}
            serverMessage={serverMessage}
            disabled={disabled}
          />
        )}
      </Drawer.Body>
    </Drawer>
  );
};
