import type { LucideIcon } from 'lucide-react';

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
  /** Placeholder for future RBAC filtering */
  roles?: string[];
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
