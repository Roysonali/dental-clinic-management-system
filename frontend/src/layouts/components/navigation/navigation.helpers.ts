import type { NavItemConfig, NavGroupConfig } from './navigation.types';

/**
 * Finds the active navigation item id based on the current pathname.
 * Supports nested route matching so sub-routes like /patients/123
 * correctly highlight the /patients nav item.
 */
export function getActiveItemId(
  pathname: string,
  groups: NavGroupConfig[],
): string | null {
  const sorted = groups
    .flatMap((g) => g.items)
    // Sort longest routes first so /treatment-plans matches before /
    .sort((a, b) => ((b.route ?? '').length) - ((a.route ?? '').length));

  for (const item of sorted) {
    if (!item.route || item.disabled) continue;
    if (pathname === item.route || pathname.startsWith(item.route + '/')) {
      return item.id;
    }
  }

  return null;
}

/**
 * Find a navigation item by its id.
 *
 * Reserved for Sprint 4 RBAC filtering and dynamic navigation support.
 * Currently unused but kept as public API for future integration.
 */
export function findNavItem(
  id: string,
  groups: NavGroupConfig[],
): NavItemConfig | undefined {
  return groups.flatMap((g) => g.items).find((item) => item.id === id);
}

/**
 * Count enabled (non-disabled) items in a group.
 *
 * Reserved for Sprint 4 badge display and navigation visibility logic.
 * Currently unused but kept as public API for future integration.
 */
export function getEnabledItemCount(group: NavGroupConfig): number {
  return group.items.filter((item) => !item.disabled).length;
}
