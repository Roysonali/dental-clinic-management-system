import type { FC } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { UserListItem } from '../../types/user';

export type UserStatusIntent = 'deactivate' | 'activate';

interface UserStatusDialogProps {
  /** Open state */
  open: boolean;
  /** The user being acted on */
  user: UserListItem | null;
  /** Which status change to confirm */
  intent: UserStatusIntent | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Error banner message (e.g. backend 400/403) */
  error?: string | null;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * UserStatusDialog — confirmation for activate / deactivate
 * (`PATCH /users/{id}/activate` and `PATCH /users/{id}/deactivate`).
 *
 * Reuses the Doctor/Patient confirmation-dialog pattern and surfaces
 * backend errors (400 already-active/inactive, 403, self-action
 * restrictions, LAST_ADMIN_CANNOT_BE_MODIFIED) via the `error` prop.
 * The dialog stays open on errors and closes only on success (the
 * container closes it in the mutation's `onSuccess`).
 */
export const UserStatusDialog: FC<UserStatusDialogProps> = ({
  open,
  user,
  intent,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const isDeactivate = intent === 'deactivate';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={isDeactivate ? 'Deactivate user' : 'Activate user'}
    >
      <Modal.Header>
        <div className="flex items-start gap-3">
          <span
            className={`
              mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
              ${isDeactivate ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}
            `}
          >
            <Icon icon={isDeactivate ? UserX : UserCheck} size="md" />
          </span>
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">
              {isDeactivate ? 'Deactivate User' : 'Activate User'}
            </h2>
            <p className="mt-0.5 text-body-sm text-neutral-500">{user?.email}</p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-3">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}
        <p className="text-body text-neutral-700">
          {isDeactivate ? (
            <>
              <span className="font-semibold text-neutral-900">
                {user?.full_name ?? 'This user'}
              </span>{' '}
              will be <span className="font-semibold text-danger">deactivated</span>. Their status
              changes to <span className="font-medium text-neutral-900">inactive</span> and they can
              no longer log in until an admin reactivates the account.
            </>
          ) : (
            <>
              <span className="font-semibold text-neutral-900">
                {user?.full_name ?? 'This user'}
              </span>{' '}
              will be <span className="font-semibold text-success">activated</span>. Their status
              changes to <span className="font-medium text-neutral-900">active</span> and they can
              log in again.
            </>
          )}
        </p>
        <p className="mt-3 text-body-sm text-neutral-500">
          This action requires the ADMIN role. You cannot activate or deactivate your own account,
          and the last remaining admin cannot be modified.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={isDeactivate ? 'danger' : 'success'}
          loading={submitting}
          onClick={onConfirm}
        >
          {isDeactivate ? 'Deactivate' : 'Activate'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
