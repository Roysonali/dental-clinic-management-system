import type { FC } from 'react';
import { Bell } from 'lucide-react';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../Button/IconButton';
import { Tooltip } from '../Tooltip/Tooltip';
import { MOCK_NOTIFICATIONS } from './notificationData';

/**
 * NotificationMenu — notification bell dropdown for the application header.
 *
 * Displays a bell icon with an unread count badge. Opens a dropdown
 * containing a scrollable list of mock notifications. Each unread
 * notification shows a blue indicator dot.
 *
 * No backend or real-time notifications — purely a reusable UI component.
 *
 * @example
 * ```tsx
 * <NotificationMenu />
 * ```
 */
interface NotificationMenuProps {
  /** Additional classes */
  className?: string;
}

export const NotificationMenu: FC<NotificationMenuProps> = ({ className = '' }) => {
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <Dropdown className={className}>
      <Tooltip content="Notifications" position="bottom">
        {/* asChild: the IconButton is the trigger itself — no nested <button>. */}
        <Dropdown.Trigger asChild>
          <IconButton
            icon={
              <span className="relative">
                <Icon icon={Bell} size="md" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
            }
            variant="ghost"
            size="sm"
            aria-label={`Notifications (${unreadCount} unread)`}
          />
        </Dropdown.Trigger>
      </Tooltip>

      <Dropdown.Content align="end" className="w-[360px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-body-sm font-semibold text-neutral-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption font-medium text-primary-700">
              {unreadCount} new
            </span>
          )}
        </div>

        {/* Scrollable list */}
        <div className="max-h-[320px] overflow-y-auto">
          {MOCK_NOTIFICATIONS.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-neutral-50"
              role="menuitem"
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                <Icon
                  icon={notification.icon}
                  size="md"
                  className="text-neutral-400"
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-neutral-900">
                    {notification.title}
                  </span>
                  {notification.unread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
                  )}
                </div>
                <p className="mt-0.5 text-caption text-neutral-500 line-clamp-2">
                  {notification.description}
                </p>
                <p className="mt-0.5 text-small text-neutral-400">
                  {notification.timestamp}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-4 py-2.5">
          <button
            type="button"
            className="w-full rounded-lg px-3 py-1.5 text-center text-body-sm font-medium text-primary-600 transition-colors duration-100 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            role="menuitem"
          >
            View all notifications
          </button>
        </div>
      </Dropdown.Content>
    </Dropdown>
  );
};
