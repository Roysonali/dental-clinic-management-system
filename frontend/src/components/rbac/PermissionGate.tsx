import { cloneElement, isValidElement, type FC, type ReactElement, type ReactNode } from 'react';
import { usePermission } from '../../hooks/rbac/usePermission';
import type { RoleName } from '../../constants/roles';

export type PermissionGateMode = 'hide' | 'disable';

interface PermissionGateProps {
  /** Roles required to see (or use) the wrapped control. */
  requiredRoles: readonly RoleName[];
  /** The permission-protected content. */
  children: ReactNode;
  /** Rendered instead of `children` when denied in `hide` mode (default: nothing). */
  fallback?: ReactNode;
  /**
   * Hidden-vs-disabled policy (documented in `docs/Sprint-11C-...`):
   * - `'hide'`    (default): denied → render `fallback` (nothing). Use for
   *   sensitive destructive actions (row deactivate/reactivate) so they are
   *   completely absent — screen readers never encounter them.
   * - `'disable'`: denied → render `children` with `disabled` +
   *   `aria-disabled` injected, keeping layout stable and the control
   *   visible but inert. Use for toolbar CTAs where a disappearing button
   *   would cause layout shift. Requires `children` to be a single element
   *   that honours a `disabled` prop (Button/IconButton do).
   */
  mode?: PermissionGateMode;
}

/**
 * PermissionGate — inline action-level authorization gate (Sprint 11C).
 *
 * Shows, hides or disables a control according to the current user's role,
 * mirroring what the backend would allow (`usePermission().can()`).
 *
 * Deliberately conservative while the role probe is in flight or unknown:
 * a gate renders nothing (hide) or the control disabled (disable) until the
 * probe proves access — no flash of admin actions for non-admins, and no
 * leaked destructive buttons.
 *
 * Safe outside an AuthProvider (renders the denied state) so isolated
 * renders and tests never crash.
 */
export const PermissionGate: FC<PermissionGateProps> = ({
  requiredRoles,
  children,
  fallback = null,
  mode = 'hide',
}) => {
  const { can } = usePermission();
  const allowed = can(requiredRoles);

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'disable' && isValidElement(children)) {
    // The control must honour a `disabled` prop (Button/IconButton do).
    const element = children as ReactElement<{
      disabled?: boolean;
      'aria-disabled'?: boolean;
    }>;
    return <>{cloneElement(element, { disabled: true, 'aria-disabled': true })}</>;
  }

  return <>{fallback}</>;
};
