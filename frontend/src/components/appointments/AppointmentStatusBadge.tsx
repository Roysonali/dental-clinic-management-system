import type { FC } from 'react';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import type { BadgeSize } from '../common/Badge/badge.types';
import { APPOINTMENT_STATUS_VARIANTS } from '../../constants/appointment';
import type { AppointmentStatus } from '../../types/appointment';

export interface AppointmentStatusBadgeProps {
  /** Backend status value (e.g. "Checked In", "No Show") */
  status: AppointmentStatus;
  size?: BadgeSize;
  className?: string;
}

/**
 * AppointmentStatusBadge — StatusBadge configured for the appointment
 * lifecycle statuses (Scheduled/Confirmed/.../No Show).
 */
export const AppointmentStatusBadge: FC<AppointmentStatusBadgeProps> = ({
  status,
  size = 'sm',
  className = '',
}) => {
  return (
    <StatusBadge
      status={status}
      size={size}
      statusMap={APPOINTMENT_STATUS_VARIANTS}
      className={className}
    />
  );
};
