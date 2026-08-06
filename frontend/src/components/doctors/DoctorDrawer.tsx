import type { FC } from 'react';
import { X } from 'lucide-react';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { Spinner } from '../common/Spinner/Spinner';
import { DoctorForm } from './DoctorForm';
import type { DoctorFormValues } from '../../types/doctor';

interface DoctorDrawerProps {
  /** Open state */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Called with validated form values */
  onSubmit: (values: DoctorFormValues) => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<DoctorFormValues>;
  /** Server-side field errors */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Show a loading state instead of the form (e.g. fetching the doctor) */
  loading?: boolean;
  /** Title shown in the drawer header */
  title?: string;
  /** Submit button label */
  submitText?: string;
  /** Disable the form (e.g. while initial data loads) */
  disabled?: boolean;
}

/**
 * DoctorDrawer — right-side drawer that hosts the shared DoctorForm.
 * One drawer serves BOTH create and edit (container decides the mode).
 * Reuses the Drawer primitive (focus trap, Escape, focus restoration).
 */
export const DoctorDrawer: FC<DoctorDrawerProps> = ({
  open,
  onClose,
  mode,
  onSubmit,
  submitting = false,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  loading = false,
  title = mode === 'edit' ? 'Edit Doctor' : 'Register Doctor',
  submitText = mode === 'edit' ? 'Save Changes' : 'Register Doctor',
  disabled = false,
}) => {
  return (
    <Drawer open={open} onClose={onClose} position="right" size="xl" ariaLabel={title}>
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">{title}</h2>
            <p className="text-caption text-neutral-500">
              {mode === 'edit' ? 'Update the doctor’s record below.' : 'Add a new doctor to the clinic roster.'}
            </p>
          </div>
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
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16" role="status" aria-label="Loading doctor">
            <Spinner size="lg" variant="primary" />
            <p className="text-caption text-neutral-400">Loading doctor details…</p>
          </div>
        ) : (
          <DoctorForm
            mode={mode}
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
