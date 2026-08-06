import type { LucideIcon } from 'lucide-react';
import type { RoleName } from '../../../constants/roles';

/**
 * Navigation group identifiers.
 * Single source of truth for all navigation groups.
 */
export type NavGroupId =
  | 'dashboard'
  | 'clinical'
  | 'financial'
  | 'operations'
  | 'administration';

/**
 * Navigation item configuration.
 * Each item maps to a sidebar link.
 */
export interface NavItemConfig {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Route path (undefined for disabled/placeholder items) */
  route?: string;
  /** Group this item belongs to */
  group: NavGroupId;
  /** Optional badge count/text */
  badge?: string | number;
  /** Visually disabled (non-interactive) */
  disabled?: boolean;
  /**
   * Roles that may see this item (Sprint 11C). When set, the item is
   * rendered only for users whose resolved role satisfies the list (via
   * `getNavGroups(role)`); when omitted the item is visible to everyone.
   * Admin-only items use `ADMIN_ROLES` (ADMIN + CHIEF_DOCTOR) — the only
   * roles the client can resolve. Items restricted to non-admin roles
   * cannot be represented (backend limitation — see the sprint doc).
   */
  roles?: readonly RoleName[];
}

/**
 * Navigation group configuration.
 */
export interface NavGroupConfig {
  /** Unique group identifier */
  id: NavGroupId;
  /** Group display label (shown as section heading) */
  label: string;
  /** Items in this group */
  items: NavItemConfig[];
}

/**
 * Navigation state.
 *
 * Reserved for Sprint 4 controlled-sidebar and Drawer integration.
 * Represents the runtime state of the navigation system.
 */
export interface NavigationState {
  /** Currently active item id (from route match) */
  activeItemId: string | null;
  /** Whether sidebar is collapsed */
  collapsed: boolean;
}
