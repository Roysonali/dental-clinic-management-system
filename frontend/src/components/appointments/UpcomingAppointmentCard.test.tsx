import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UpcomingAppointmentCard } from './UpcomingAppointmentCard';

const baseProps = {
  patientName: 'Juan Dela Cruz',
  start_time: '10:00:00',
  end_time: '10:30:00',
  type: 'Consultation' as const,
  status: 'Scheduled' as const,
};

describe('UpcomingAppointmentCard', () => {
  it('renders the patient name, time range, type and status', () => {
    renderWithProviders(<UpcomingAppointmentCard {...baseProps} />);

    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('renders the dentist name when provided', () => {
    renderWithProviders(<UpcomingAppointmentCard {...baseProps} dentistName="Dr. Jose Rizal" />);
    expect(screen.getByText('with Dr. Jose Rizal')).toBeInTheDocument();
  });

  it('is keyboard-activatable when onClick is provided', () => {
    const onClick = vi.fn();
    renderWithProviders(<UpcomingAppointmentCard {...baseProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is not interactive when no onClick is provided', () => {
    renderWithProviders(<UpcomingAppointmentCard {...baseProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
