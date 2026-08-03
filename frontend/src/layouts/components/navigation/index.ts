/**
 * Navigation — barrel exports.
 *
 * Public API for the navigation configuration module.
 * Sidebar consumes these to render the navigation tree.
 * Sprint 4 (RBAC) will filter groups via getNavGroups().
 */
export type {
  NavGroupId,
  NavItemConfig,
  NavGroupConfig,
  NavigationState,
} from './navigation.types';

export { NAV_GROUPS, getNavGroups } from './navigation.config';

export {
  getActiveItemId,
  findNavItem,
  getEnabledItemCount,
} from './navigation.helpers';
