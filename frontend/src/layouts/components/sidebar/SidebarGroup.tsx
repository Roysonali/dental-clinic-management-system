import type { FC } from 'react';
import { SidebarItem } from './SidebarItem';
import { NavigationGroup } from '../../../components/common/NavigationGroup/NavigationGroup';
import type { NavItemConfig } from '../navigation/navigation.types';

interface SidebarGroupProps {
  /** Group display label (empty string for dashboard group) */
  label: string;
  /** Items in this group */
  items: NavItemConfig[];
  /** Whether sidebar is collapsed */
  collapsed: boolean;
  /** Currently active item id */
  activeItemId: string | null;
}

/**
 * SidebarGroup — groups navigation items under a section heading.
 *
 * Composes the existing Design System NavigationGroup component.
 * - Groups with a label are collapsible
 * - Dashboard group has no label and is always expanded
 * - In collapsed mode, group labels are hidden (only items shown with tooltips)
 */
export const SidebarGroup: FC<SidebarGroupProps> = ({
  label,
  items,
  collapsed,
  activeItemId,
}) => {
  const hasLabel = label.length > 0;

  // Don't render empty groups
  if (items.length === 0) return null;

  // Don't render groups where all items are disabled in collapsed mode
  if (collapsed && items.every((item) => item.disabled)) return null;

  const groupContent = (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <SidebarItem
          key={item.id}
          item={item}
          collapsed={collapsed}
          isActive={activeItemId === item.id}
        />
      ))}
    </div>
  );

  // Dashboard group: no label, always expanded, no collapsible
  if (!hasLabel || collapsed) {
    return <div className="py-1">{groupContent}</div>;
  }

  // Groups with a label: use NavigationGroup for collapsible behaviour
  return (
    <div className="py-1">
      <NavigationGroup title={label} collapsible defaultExpanded>
        {groupContent}
      </NavigationGroup>
    </div>
  );
};
