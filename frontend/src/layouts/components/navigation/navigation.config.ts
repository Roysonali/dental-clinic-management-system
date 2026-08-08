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
  UserCheck,
  BookOpen,
  BarChart3,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { ROUTES } from '../../../routes/routes';
import { ADMIN_ROLES } from '../../../constants/roles';
import { roleMeetsRequirement } from '../../../constants/rbac';
import type { RoleName } from '../../../constants/roles';
import type { NavGroupConfig } from './navigation.types';

/**
 * Navigation groups and items.
 *
 * Single source of truth for the sidebar navigation structure.
 *
 * RBAC (Sprint 11C):
 * - Items with a `roles` list are permission-aware: `getNavGroups(role)`
 *   keeps them only when the current user's resolved role satisfies the
 *   requirement. Admin-only items (Users, Pending Approvals) carry
 *   `roles: ADMIN_ROLES` — non-admins never see them.
 * - Items with `disabled: true` appear visually disabled and are
 *   non-interactive (placeholders for not-yet-built modules).
 * - Items restricted to non-admin roles cannot be modelled here because
 *   the client cannot resolve non-admin roles (backend limitation — see
 *   `docs/Sprint-11C-RBAC-UI-Integration.md`); those modules stay visible
 *   to everyone and the backend enforces with 403.
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
        id: 'patient-records',
        label: 'Patient Records',
        icon: ClipboardList,
        route: ROUTES.PATIENT_RECORDS,
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
        label: 'Billing Dashboard',
        icon: Receipt,
        route: ROUTES.BILLING,
        group: 'financial',
      },
      {
        // Invoice list route ships with Phase 2 (Sprint 14A.2); the backend
        // read/write endpoint set is fully supported, so the item is live.
        id: 'invoices',
        label: 'Invoices',
        icon: FileText,
        route: ROUTES.BILLING_INVOICES,
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
        route: ROUTES.USERS,
        group: 'administration',
        // Every /users endpoint is require_admin on the backend; the item
        // is enabled and visible for admins only (Sprint 11C).
        roles: ADMIN_ROLES,
      },
      {
        id: 'pending-approvals',
        label: 'Pending Approvals',
        icon: UserCheck,
        route: ROUTES.ADMIN.PENDING_USERS,
        group: 'administration',
        // /auth/users/pending + approve/deactivate are require_admin too.
        roles: ADMIN_ROLES,
      },
      {
        id: 'procedures',
        label: 'Procedure Catalog',
        icon: BookOpen,
        route: ROUTES.PROCEDURES,
        group: 'administration',
        // Reads are 🅰 (no role gate); admin writes are gated inline via
        // PermissionGate (⭐). Kept visible like the other 🅰 modules — the
        // backend excludes DENTAL_ASSISTANT with 403 (R16, [MAP §9]).
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
 * Get the navigation groups filtered for a resolved role.
 *
 * Items carrying a `roles` requirement are kept only when
 * `roleMeetsRequirement` passes. Groups left with no items are dropped so
 * an empty section heading is never rendered.
 *
 * @param role — the current user's resolved role (null while unresolved or
 *   for non-admins; admin-only items are hidden in that case).
 */
export function getNavGroups(role: RoleName | null = null): NavGroupConfig[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || roleMeetsRequirement(role, item.roles),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
