import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';

describe('AppointmentStatusBadge', () => {
  it.each([
    ['Scheduled', 'Scheduled'],
    ['Confirmed', 'Confirmed'],
    ['Checked In', 'Checked In'],
    ['In Treatment', 'In Treatment'],
    ['Completed', 'Completed'],
    ['Cancelled', 'Cancelled'],
    ['No Show', 'No Show'],
  ])('renders the %s status verbatim', (status) => {
    renderWithProviders(<AppointmentStatusBadge status={status as never} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('maps multi-word statuses to the configured variant colours', () => {
    // The variant classes live on the outer Badge span; the inner span holds
    // the text. info → bg-blue-100, danger → bg-red-100.
    renderWithProviders(<AppointmentStatusBadge status="Checked In" />);
    expect(screen.getByText('Checked In').parentElement?.className).toContain('bg-blue-100');

    renderWithProviders(<AppointmentStatusBadge status="No Show" />);
    expect(screen.getByText('No Show').parentElement?.className).toContain('bg-red-100');
  });

  it('supports a custom size', () => {
    renderWithProviders(<AppointmentStatusBadge status="Completed" size="md" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
