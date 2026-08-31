import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarLegend } from './CalendarLegend';

describe('CalendarLegend', () => {
  it('renders all appointment statuses', () => {
    render(<CalendarLegend />);

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('In Treatment')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('No Show')).toBeInTheDocument();
  });

  it('has accessible group label', () => {
    render(<CalendarLegend />);
    expect(screen.getByRole('group', { name: /appointment status legend/i })).toBeInTheDocument();
  });

  it('renders color swatches for each status', () => {
    const { container } = render(<CalendarLegend />);
    const swatches = container.querySelectorAll('span[aria-hidden="true"]');
    expect(swatches.length).toBe(7);
  });
});
