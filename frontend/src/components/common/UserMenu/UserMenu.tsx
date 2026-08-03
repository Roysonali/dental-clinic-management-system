import type { FC, ReactNode } from 'react';
import { User, LogOut } from 'lucide-react';
import { Dropdown } from '../Dropdown/Dropdown';

interface UserMenuProps {
  /** User's full name */
  name?: string;
  /** User's role/title */
  role?: string;
  /** Avatar element (if omitted, shows initials or default icon) */
  avatar?: ReactNode;
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
    : '?';

  return (
    <Dropdown className={className}>
      <Dropdown.Trigger>
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-neutral-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="User menu"
        >
          {avatar ?? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-label font-semibold">
              {initials}
            </div>
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
        </button>
      </Dropdown.Trigger>

      <Dropdown.Content align="end">
        {/* User info header */}
        <div className="border-b border-neutral-200 px-3 py-2.5">
          {name && (
            <p className="text-body-sm font-medium text-neutral-900">{name}</p>
          )}
          {role && (
            <p className="text-caption text-neutral-500">{role}</p>
          )}
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
