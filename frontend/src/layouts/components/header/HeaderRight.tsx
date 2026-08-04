import type { FC } from 'react';
import { Settings, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from '../../../components/common/Dropdown/Dropdown';
import { NotificationMenu } from '../../../components/common/NotificationMenu/NotificationMenu';
import { UserMenu } from '../../../components/common/UserMenu/UserMenu';
import { Divider } from '../../../components/common/Divider/Divider';
import { useAuth } from '../../../hooks/auth/useAuth';
import { ROUTES } from '../../../routes/routes';

/**
 * HeaderRight — right section of the application header.
 *
 * Contains:
 * - Notification bell dropdown (NotificationMenu)
 * - Vertical divider
 * - User avatar with dropdown menu (UserMenu), driven by the authenticated
 *   session — name/email come from GET /auth/me and "Sign out" clears the
 *   session and returns to the login page.
 *
 * The backend does not expose the current user's role via /auth/me, so no
 * role chip is rendered (see types/auth.ts).
 */
export const HeaderRight: FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    // Guards will redirect anyway; navigate explicitly for immediacy.
    navigate(ROUTES.AUTH.LOGIN, { replace: true });
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Notifications */}
      <NotificationMenu />

      {/* Divider */}
      <Divider orientation="vertical" className="mx-1 h-6 text-neutral-200" />

      {/* User menu */}
      <UserMenu
        name={user?.full_name}
        email={user?.email}
        onLogout={handleLogout}
      >
        <Dropdown.Item icon={Settings} label="Settings" />
        <Dropdown.Item icon={HelpCircle} label="Help" />
      </UserMenu>
    </div>
  );
};
