import type { FC } from 'react';
import { Settings, HelpCircle } from 'lucide-react';
import { Dropdown } from '../../../components/common/Dropdown/Dropdown';
import { NotificationMenu } from '../../../components/common/NotificationMenu/NotificationMenu';
import { UserMenu } from '../../../components/common/UserMenu/UserMenu';
import { Divider } from '../../../components/common/Divider/Divider';

/**
 * HeaderRight — right section of the application header.
 *
 * Contains:
 * - Notification bell dropdown (NotificationMenu)
 * - Vertical divider
 * - User avatar with dropdown menu (UserMenu)
 *
 * Props are reserved for future extensibility (e.g., user data injection).
 *
 * @example
 * ```tsx
 * <HeaderRight />
 * ```
 */
export interface HeaderRightProps {}

export const HeaderRight: FC<HeaderRightProps> = () => {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Notifications */}
      <NotificationMenu />

      {/* Divider */}
      <Divider orientation="vertical" className="mx-1 h-6 text-neutral-200" />

      {/* User menu */}
      <UserMenu
        name="Dr. Maria Santos"
        role="General Dentist"
        email="maria@denscare.clinic"
        onLogout={() => {
          // Reserved for Sprint 7 authentication integration
        }}
      >
        <Dropdown.Item icon={Settings} label="Settings" />
        <Dropdown.Item icon={HelpCircle} label="Help" />
      </UserMenu>
    </div>
  );
};
