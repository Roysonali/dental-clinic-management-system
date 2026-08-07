import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { TreatmentPlanStatusBadge } from './TreatmentPlanStatusBadge';
import { TREATMENT_PLAN_STATUS_LABELS } from '../../constants/treatmentPlan';
import type { TreatmentPlanStatus } from '../../types/treatmentPlan';

describe('TreatmentPlanStatusBadge', () => {
  it.each([
    ['draft', 'Draft'],
    ['under_review', 'Under Review'],
    ['proposed', 'Proposed'],
    ['rejected', 'Rejected'],
    ['accepted', 'Accepted'],
    ['in_progress', 'In Progress'],
    ['on_hold', 'On Hold'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
  ])('renders the %s status with its label', (status, label) => {
    renderWithProviders(<TreatmentPlanStatusBadge status={status as TreatmentPlanStatus} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('covers every backend status in the label map', () => {
    expect(Object.keys(TREATMENT_PLAN_STATUS_LABELS)).toHaveLength(9);
  });
});
