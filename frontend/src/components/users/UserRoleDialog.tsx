import { useState, type FC } from 'react';
import { UserCog } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Select } from '../common/Input/Select';
import { USER_ROLE_OPTIONS } from '../../constants/user';
import { roleAssignmentSchema } from '../../utils/userFormSchema';
import type { UserListItem } from '../../types/user';

interface UserRoleDialogProps {
  /** Open state */
  open: boolean;
  /** The user whose role is being changed */
  user: UserListItem | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Backend error banner message (e.g. 400 ROLE_NOT_FOUND / SELF_ROLE_CHANGE_NOT_ALLOWED) */
  error?: string | null;
  /** Called with the parsed positive role id when the user confirms */
  onConfirm: (roleId: number) => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * UserRoleDialog — role assignment for `PATCH /users/{id}/role`.
 *
 * - Shows the user's current role (`role_name` from the backend).
 * - The selector prefills the current `role_id`; validation mirrors the
 *   backend `ChangeRoleRequest.role_id: Field(gt=0)` via the Phase 1A
 *   `roleAssignmentSchema` (no frontend-only rules).
 * - The dialog stays open on validation errors and on backend errors
 *   (`error` prop); the container closes it only on mutation success.
 */
export const UserRoleDialog: FC<UserRoleDialogProps> = ({
  open,
  user,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  // The container remounts this dialog per user (`key={user.id}`), so the
  // initializer below always runs against the freshly-selected user — no
  // effect-based resync is needed (and the project lint forbids it).
  const [selectedRole, setSelectedRole] = useState<string>(() =>
    user?.role_id != null ? String(user.role_id) : '',
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    const result = roleAssignmentSchema.safeParse({ role_id: selectedRole });
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Role is required');
      return;
    }
    setValidationError(null);
    onConfirm(Number(selectedRole));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel="Change role"
    >
      <Modal.Header>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
            <Icon icon={UserCog} size="md" />
          </span>
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">Change Role</h2>
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
        <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
          <p className="text-caption text-neutral-500">Current role</p>
          <p className="text-body font-medium text-neutral-900">
            {user?.role_name ?? 'No role assigned'}
          </p>
        </div>
        <Select
          label="New Role"
          placeholder="Select a role"
          value={selectedRole}
          error={validationError ?? undefined}
          disabled={submitting}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setValidationError(null);
          }}
          options={USER_ROLE_OPTIONS.map((role) => ({
            value: role.value,
            label: role.label,
          }))}
        />
        <p className="mt-3 text-body-sm text-neutral-500">
          This action requires the ADMIN role and is recorded with the admin&apos;s id. You cannot
          change your own role, and the last remaining admin cannot be demoted.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} onClick={handleConfirm}>
          Save Role
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
