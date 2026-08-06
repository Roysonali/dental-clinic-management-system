import { useMemo, type FC } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarGroup } from './SidebarGroup';
import { getNavGroups } from '../navigation/navigation.config';
import { getActiveItemId } from '../navigation/navigation.helpers';
import { usePermission } from '../../../hooks/rbac/usePermission';

interface SidebarContentProps {
  /** Whether sidebar is collapsed */
  collapsed: boolean;
}

/**
 * SidebarContent — scrollable navigation area.
 *
 * Renders all navigation groups with active route highlighting, filtered
 * for the current user's role (Sprint 11C): admin-only items (Users,
 * Pending Approvals) appear only for admins. While the role probe is
 * unresolved the admin items are simply absent — the probe is a single
 * cached request, so admins see them immediately after it resolves.
 *
 * Active state is determined by matching the current pathname against
 * each item's route, supporting nested route matches.
 */
export const SidebarContent: FC<SidebarContentProps> = ({ collapsed }) => {
  const { pathname } = useLocation();
  const { role } = usePermission();
  const groups = getNavGroups(role);
  const activeItemId = useMemo(
    () => getActiveItemId(pathname, groups),
    [pathname, groups],
  );

  return (
    <div className="flex-1 overflow-y-auto py-2">
      <div>
        {groups.map((group) => (
          <SidebarGroup
            key={group.id}
            label={group.label}
            items={group.items}
            collapsed={collapsed}
            activeItemId={activeItemId}
          />
        ))}
      </div>
    </div>
  );
};
