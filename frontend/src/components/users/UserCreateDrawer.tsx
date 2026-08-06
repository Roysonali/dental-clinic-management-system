import { useRef, type FC } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { UserCreateForm } from './UserCreateForm';
import type { UserCreateFormValues } from '../../types/user';

interface UserCreateDrawerProps {
  /** Open state */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Called with validated form values */
  onSubmit: (values: UserCreateFormValues) => void;
  /** Show loading state on the submit button (register + approve in flight) */
  submitting?: boolean;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Server-side field errors (snake_case keys) */
  serverErrors?: Record<string, string>;
}

/**
 * UserCreateDrawer — right-side drawer hosting the Add-User form.
 *
 * Thin composition layer over the shared Drawer primitive (focus trap,
 * Escape, focus restoration) + the stateless UserCreateForm. All business
 * logic (register → pending lookup → approve) lives in
 * UserCreateContainer.
 *
 * The form is unmounted whenever the drawer closes (Drawer returns null),
 * so values reset naturally on every open — no effect-based resync.
 */
export const UserCreateDrawer: FC<UserCreateDrawerProps> = ({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverMessage = null,
  serverErrors = {},
}) => {
  // Focus target on open — the Full Name input (focused via the shared
  // Drawer `initialFocusRef` so it wins the focus on mount).
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Add User"
      initialFocusRef={firstFieldRef}
    >
      <Drawer.Header>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon icon={UserPlus} size="md" />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Add User</h2>
              <p className="text-caption text-neutral-500">
                Register a new account and assign a role. The user is approved
                immediately and can sign in.
              </p>
            </div>
          </div>
          <IconButton
            icon={<Icon icon={X} size="sm" />}
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            aria-disabled={submitting || undefined}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body>
        <UserCreateForm
          onSubmit={onSubmit}
          submitting={submitting}
          onCancel={onClose}
          serverMessage={serverMessage}
          serverErrors={serverErrors}
          firstFieldRef={firstFieldRef}
        />
      </Drawer.Body>
    </Drawer>
  );
};
