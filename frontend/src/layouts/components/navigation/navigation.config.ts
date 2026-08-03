import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileText,
  Stethoscope,
  Receipt,
  Package,
  FlaskConical,
  Shield,
  BarChart3,
  Settings,
} from 'lucide-react';
import { ROUTES } from '../../../routes/routes';
import type { NavGroupConfig } from './navigation.types';

/**
 * Navigation groups and items.
 *
 * Single source of truth for the sidebar navigation structure.
 * Items with `disabled: true` appear visually disabled and are non-interactive.
 * The `roles` array is a placeholder for future RBAC filtering (not yet enforced).
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'dashboard',
    label: '',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        route: ROUTES.DASHBOARD,
        group: 'dashboard',
      },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical',
    items: [
      {
        id: 'patients',
        label: 'Patients',
        icon: Users,
        route: ROUTES.PATIENTS,
        group: 'clinical',
      },
      {
        id: 'appointments',
        label: 'Appointments',
        icon: CalendarClock,
        route: ROUTES.APPOINTMENTS,
        group: 'clinical',
      },
      {
        id: 'treatment-plans',
        label: 'Treatment Plans',
        icon: FileText,
        route: ROUTES.TREATMENT_PLANS,
        group: 'clinical',
      },
      {
        id: 'doctors',
        label: 'Doctors',
        icon: Stethoscope,
        route: ROUTES.DOCTORS,
        group: 'clinical',
      },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    items: [
      {
        id: 'billing',
        label: 'Billing',
        icon: Receipt,
        route: ROUTES.BILLING,
        group: 'financial',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        group: 'operations',
        disabled: true,
      },
      {
        id: 'laboratory',
        label: 'Laboratory',
        icon: FlaskConical,
        group: 'operations',
        disabled: true,
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        id: 'users',
        label: 'Users',
        icon: Shield,
        group: 'administration',
        disabled: true,
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: BarChart3,
        group: 'administration',
        disabled: true,
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        group: 'administration',
        disabled: true,
      },
    ],
  },
];

/**
 * Get all navigation groups.
 * Future: Accept roles to filter by permissions.
 */
export function getNavGroups(): NavGroupConfig[] {
  return NAV_GROUPS;
}
