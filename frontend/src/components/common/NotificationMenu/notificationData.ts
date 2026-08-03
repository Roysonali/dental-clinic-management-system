import { CalendarCheck, CreditCard, UserPlus, Stethoscope, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NotificationItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    icon: CalendarCheck,
    title: 'Appointment Confirmed',
    description: 'Juan Dela Cruz confirmed his appointment for July 30 at 10:00 AM.',
    timestamp: '5 min ago',
    unread: true,
  },
  {
    id: 'n2',
    icon: CreditCard,
    title: 'Invoice Paid',
    description: 'Payment of $250.00 for Invoice #INV-2026-0042 has been completed.',
    timestamp: '1 hour ago',
    unread: true,
  },
  {
    id: 'n3',
    icon: UserPlus,
    title: 'New Patient Registered',
    description: 'Maria Santos has been registered as a new patient.',
    timestamp: '3 hours ago',
    unread: true,
  },
  {
    id: 'n4',
    icon: Stethoscope,
    title: 'Treatment Completed',
    description: 'Root canal treatment for patient Roberto Reyes has been marked completed.',
    timestamp: 'Yesterday',
    unread: false,
  },
  {
    id: 'n5',
    icon: Wrench,
    title: 'System Maintenance',
    description: 'Scheduled maintenance will occur on August 2, 2:00 AM – 4:00 AM.',
    timestamp: '2 days ago',
    unread: false,
  },
];
