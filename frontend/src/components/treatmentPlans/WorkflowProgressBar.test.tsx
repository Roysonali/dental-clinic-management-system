import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { WorkflowProgressBar } from './WorkflowProgressBar';

describe('WorkflowProgressBar', () => {
  it('renders a progressbar with the correct step position', () => {
    const { container } = renderWithProviders(<WorkflowProgressBar status="accepted" />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBe('3');
  });

  it('renders the status in the aria label', () => {
    renderWithProviders(<WorkflowProgressBar status="draft" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain('draft');
  });

  it('renders a terminal badge for cancelled plans', () => {
    renderWithProviders(<WorkflowProgressBar status="cancelled" />);
    expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
  });
});
