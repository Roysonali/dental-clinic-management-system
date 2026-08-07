import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientRecordStatusBadge } from './PatientRecordStatusBadge';

describe('PatientRecordStatusBadge', () => {
  it('renders the human-readable label for a status', () => {
    render(<PatientRecordStatusBadge status="UNDER_REVIEW" />);
    expect(screen.getByText('Under Review')).toBeInTheDocument();
  });

  it('renders FINALIZED for a finalized record regardless of the raw status', () => {
    render(<PatientRecordStatusBadge status="COMPLETED" isFinalized />);
    expect(screen.getByText('Finalized')).toBeInTheDocument();
  });

  it('labels every supported status', () => {
    const { rerender } = render(<PatientRecordStatusBadge status="DRAFT" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();

    rerender(<PatientRecordStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    rerender(<PatientRecordStatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();

    rerender(<PatientRecordStatusBadge status="FINALIZED" />);
    expect(screen.getByText('Finalized')).toBeInTheDocument();

    rerender(<PatientRecordStatusBadge status="LOCKED" />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
