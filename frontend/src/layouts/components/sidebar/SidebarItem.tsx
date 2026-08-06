import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../../components/common/Icon/Icon';
import { Tooltip } from '../../../components/common/Tooltip/Tooltip';
import type { NavItemConfig } from '../navigation/navigation.types';

interface SidebarItemProps {
  /** Navigation item configuration */
  item: NavItemConfig;
  /** Whether sidebar is collapsed */
  collapsed: boolean;
  /** Whether this item is the currently active route */
  isActive: boolean;
}

/**
 * SidebarItem — a single navigation link within the sidebar.
 *
 * - Active route highlighted with primary colour
 * - Disabled items are non-interactive with muted styling
 * - In collapsed mode: labels hidden, tooltip shown on hover/focus
 * - Uses NavLink from react-router-dom for declarative active detection
 * - Accessible with aria-current for active items
 */
export const SidebarItem: FC<SidebarItemProps> = ({ item, collapsed, isActive }) => {
  // Disabled items render as a span instead of a link
  if (item.disabled) {
    return (
      <div className="group relative mx-2">
        <div
          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 opacity-40"
          aria-disabled="true"
        >
          <Icon icon={item.icon} size="md" className="shrink-0 text-neutral-400" />
          {!collapsed && (
            <span className="text-body-sm font-medium text-neutral-400">
              {item.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  const linkContent = (
    <div
      className={`
        flex items-center gap-3 rounded-lg px-3 py-2 text-body-sm font-medium transition-all duration-150
        ${
          isActive
            ? 'bg-primary-50 font-semibold text-primary-700'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
        }
      `}
    >
      <Icon
        icon={item.icon}
        size="md"
        className={`shrink-0 ${isActive ? 'text-primary-600' : 'text-neutral-400'}`}
      />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
    </div>
  );

  const link = item.route ? (
    <NavLink
      to={item.route}
      className="block mx-2"
      aria-current={isActive ? 'page' : undefined}
    >
      {linkContent}
    </NavLink>
  ) : (
    <div className="mx-2">{linkContent}</div>
  );

  // In collapsed mode, wrap with a tooltip
  if (collapsed) {
    return (
      <Tooltip content={item.label} position="right" showDelay={200} hideDelay={0}>
        {link}
      </Tooltip>
    );
  }

  return link;
};
