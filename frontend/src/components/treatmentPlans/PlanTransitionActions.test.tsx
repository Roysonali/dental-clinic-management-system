import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PlanTransitionActions } from './PlanTransitionActions';
import type { ApprovalResponse, TreatmentPlanActionId } from '../../types/treatmentPlan';

const signedApproval: ApprovalResponse = {
  id: 'a1',
  approved_by: 3,
  approved_at: '2026-08-02T09:00:00Z',
  patient_status: 'pending',
  patient_acknowledged_at: null,
  approval_notes: null,
};

describe('PlanTransitionActions', () => {
  it('renders the endpoint-backed actions for a draft plan', () => {
    renderWithProviders(
      <PlanTransitionActions status="draft" onAction={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Submit for Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Plan' })).toBeInTheDocument();
  });

  it('renders the approval surface only when proposed (unsigned → Doctor Approve)', () => {
    renderWithProviders(
      <PlanTransitionActions status="proposed" onAction={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Doctor Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Plan' })).toBeInTheDocument();
  });

  it('does not render the approval surface outside proposed', () => {
    renderWithProviders(
      <PlanTransitionActions status="accepted" onAction={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Doctor Approve' })).not.toBeInTheDocument();
  });

  // F-02: the four approval actions are gated by the approval sub-state.
  it('swaps Doctor Approve → Revoke once the doctor has signed (F-02)', () => {
    renderWithProviders(
      <PlanTransitionActions status="proposed" approval={signedApproval} onAction={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Doctor Approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke Doctor Approval' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patient Accepts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patient Declines' })).toBeInTheDocument();
    // accept/decline/cancel are NOT sub-state gated (backend only needs PROPOSED).
    expect(screen.getByRole('button', { name: 'Accept Plan' })).toBeInTheDocument();
  });

  it('hides the patient buttons before the doctor signs (F-02)', () => {
    renderWithProviders(
      <PlanTransitionActions status="proposed" approval={null} onAction={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Doctor Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Patient Accepts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Patient Declines' })).not.toBeInTheDocument();
  });

  it('hides the patient buttons once the patient has decided (F-02)', () => {
    renderWithProviders(
      <PlanTransitionActions
        status="proposed"
        approval={{ ...signedApproval, patient_status: 'accepted' }}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Revoke Doctor Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Patient Accepts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Patient Declines' })).not.toBeInTheDocument();
  });

  it('emits the action id when a button is clicked', () => {
    const onAction = vi.fn();
    renderWithProviders(<PlanTransitionActions status="in_progress" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Put on Hold' }));
    expect(onAction).toHaveBeenCalledWith('hold' as TreatmentPlanActionId);
  });

  it('renders a no-actions message for terminal statuses', () => {
    renderWithProviders(
      <PlanTransitionActions status="completed" onAction={vi.fn()} />,
    );
    expect(screen.getByText('No further actions are available for this plan.')).toBeInTheDocument();
  });
});
