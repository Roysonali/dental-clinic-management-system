import {
  Users,
  CalendarCheck,
  Stethoscope,
  FileText,
  Receipt,
  Settings,
  LayoutDashboard,
  UserPlus,
  CalendarPlus,
  DollarSign,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '../../../routes/routes';

/**
 * A command palette result item.
 */
export interface PaletteResult {
  /** Unique id */
  id: string;
  /** Display label */
  label: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Icon */
  icon: LucideIcon;
  /** Optional route for navigation */
  route?: string;
  /** Optional category label */
  category?: string;
  /** Optional keyboard shortcut badge */
  shortcut?: string;
  /** Whether this item is disabled */
  disabled?: boolean;
}

/**
 * All available command palette results (mock data).
 * When search is active, these are filtered by label + subtitle + category.
 */
export const ALL_RESULTS: PaletteResult[] = [
  // Navigation
  { id: 'go-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, route: ROUTES.DASHBOARD, category: 'Navigation', shortcut: 'G D' },
  { id: 'go-patients', label: 'Go to Patients', icon: Users, route: ROUTES.PATIENTS, category: 'Navigation', shortcut: 'G P' },
  { id: 'go-appointments', label: 'Go to Appointments', icon: CalendarCheck, route: ROUTES.APPOINTMENTS, category: 'Navigation', shortcut: 'G A' },
  { id: 'go-doctors', label: 'Go to Doctors', icon: Stethoscope, route: ROUTES.DOCTORS, category: 'Navigation', shortcut: 'G D' },
  { id: 'go-treatment-plans', label: 'Go to Treatment Plans', icon: FileText, route: ROUTES.TREATMENT_PLANS, category: 'Navigation', shortcut: 'G T' },
  { id: 'go-billing', label: 'Go to Billing', icon: Receipt, route: ROUTES.BILLING, category: 'Navigation', shortcut: 'G B' },

  // Quick Actions
  { id: 'new-patient', label: 'Register New Patient', icon: UserPlus, category: 'Quick Actions', shortcut: 'N P' },
  { id: 'schedule-appointment', label: 'Schedule Appointment', icon: CalendarPlus, category: 'Quick Actions', shortcut: 'S A' },
  { id: 'create-invoice', label: 'Create Invoice', icon: DollarSign, category: 'Quick Actions', shortcut: 'C I' },

  // Patients
  { id: 'patient-juan', label: 'Juan Dela Cruz', subtitle: 'Patient • DOB: 1990-05-15', icon: Users, category: 'Patients' },
  { id: 'patient-maria', label: 'Maria Santos', subtitle: 'Patient • DOB: 1985-11-22', icon: Users, category: 'Patients' },
  { id: 'patient-pedro', label: 'Pedro Reyes', subtitle: 'Patient • DOB: 1978-03-08', icon: Users, category: 'Patients' },

  // Doctors
  { id: 'doctor-cruz', label: 'Dr. Cruz', subtitle: 'General Dentist', icon: Stethoscope, category: 'Doctors' },
  { id: 'doctor-santos', label: 'Dr. Santos', subtitle: 'Orthodontist', icon: Stethoscope, category: 'Doctors' },

  // Appointments
  { id: 'appt-1', label: 'Juan Dela Cruz — Consultation', subtitle: 'Today at 10:00 AM', icon: CalendarCheck, category: 'Appointments' },
  { id: 'appt-2', label: 'Maria Santos — Follow-Up', subtitle: 'Today at 11:30 AM', icon: CalendarCheck, category: 'Appointments' },

  // Billing
  { id: 'inv-001', label: 'INV-00123 — Juan Dela Cruz', subtitle: '$150.00 • Pending', icon: Receipt, category: 'Billing' },
  { id: 'inv-002', label: 'INV-00124 — Maria Santos', subtitle: '$250.00 • Paid', icon: Receipt, category: 'Billing' },

  // Settings (disabled)
  { id: 'settings-general', label: 'General Settings', icon: Settings, category: 'Settings', disabled: true },
  { id: 'settings-users', label: 'User Management', icon: Settings, category: 'Settings', disabled: true },
];

/**
 * Recent searches (mock data, displayed when search query is empty).
 */
export const RECENT_SEARCHES: string[] = [
  'Juan Dela Cruz',
  'INV-00123',
  'Appointments',
];

/**
 * Filter results by a search query (case-insensitive, matches label, subtitle, category).
 */
export function filterResults(query: string): PaletteResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return ALL_RESULTS.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      (r.subtitle && r.subtitle.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q)),
  );
}

/**
 * Group results by category.
 */
export function groupResults(results: PaletteResult[]): Map<string, PaletteResult[]> {
  const groups = new Map<string, PaletteResult[]>();
  for (const r of results) {
    const cat = r.category ?? 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(r);
  }
  return groups;
}
