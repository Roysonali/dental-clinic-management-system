import type { FC, ReactNode } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { Dropdown } from '../Dropdown/Dropdown';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';

interface UserMenuProps {
  /** User's full name */
  name?: string;
  /** User's role/title */
  role?: string;
  /** Avatar element (if omitted, shows initials via Avatar component) */
  avatar?: ReactNode;
  /** User's email (shown in the dropdown header) */
  email?: string;
  /** Menu items displayed between user info and logout */
  children?: ReactNode;
  /** Logout handler placeholder */
  onLogout?: () => void;
  /** Additional classes */
  className?: string;
}

/**
 * UserMenu — profile dropdown for the application header.
 * No authentication logic — purely a reusable UI component.
 *
 * @example
 * ```tsx
 * <UserMenu
 *   name="Dr. Maria Santos"
 *   role="General Dentist"
 *   email="maria@denscare.clinic"
 *   onLogout={() => console.log('Logout')}
 * >
 *   <Dropdown.Item icon={Settings} label="Settings" />
 *   <Dropdown.Item icon={HelpCircle} label="Help" />
 * </UserMenu>
 * ```
 */
export const UserMenu: FC<UserMenuProps> = ({
  name,
  role,
  email,
  avatar,
  children,
  onLogout,
  className = '',
}) => {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : undefined;

  return (
    <Dropdown className={className}>
      {/* asChild: the inner button IS the trigger — no nested <button>.
          Its accessible name comes from its content (user name + role),
          so screen readers announce the actual user rather than a generic
          "User menu" label. */}
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-neutral-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {avatar ?? (
            <Avatar size="md" initials={initials} />
          )}
          <div className="hidden text-left sm:block min-w-0">
            {name && (
              <p className="text-body-sm font-medium text-neutral-900 truncate max-w-[140px]">
                {name}
              </p>
            )}
            {role && (
              <p className="text-caption text-neutral-500 truncate max-w-[140px]">
                {role}
              </p>
            )}
          </div>
          {/* Dropdown chevron — hidden on mobile where only the avatar shows */}
          <Icon
            icon={ChevronDown}
            size="sm"
            className="hidden shrink-0 text-neutral-400 sm:block"
          />
        </button>
      </Dropdown.Trigger>

      <Dropdown.Content align="end">
        {/* User info header */}
        <div className="border-b border-neutral-200 px-3 py-2.5">
          <div className="flex items-center gap-3">
            {avatar ?? <Avatar size="md" initials={initials} />}
            <div className="min-w-0">
              {name && (
                <p className="text-body-sm font-medium text-neutral-900 truncate">{name}</p>
              )}
              {email && (
                <p className="text-caption text-neutral-500 truncate">{email}</p>
              )}
              {!email && role && (
                <p className="text-caption text-neutral-500 truncate">{role}</p>
              )}
            </div>
          </div>
        </div>

        {children}

        {onLogout && (
          <>
            <hr className="my-1 border-t border-neutral-200" role="separator" />
            <Dropdown.Item icon={LogOut} label="Sign out" onClick={onLogout} />
          </>
        )}
      </Dropdown.Content>
    </Dropdown>
  );
};
