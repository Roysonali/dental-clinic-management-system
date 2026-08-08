import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvoiceDetailActions } from './InvoiceDetailActions';

// PermissionGate → usePermission must resolve without a role probe.
// A non-admin result hides the ADMIN-only delete action by default.
const permissionMock = {
  state: { status: 'non-admin' as const, role: null },
  isAdmin: false,
  isResolved: true,
  role: null,
  can: vi.fn(() => false),
};

vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

function renderActions(status: Parameters<typeof InvoiceDetailActions>[0]['status']) {
  const handlers = {
    onIssue: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<InvoiceDetailActions status={status} {...handlers} />);
  return handlers;
}

describe('InvoiceDetailActions', () => {
  it('renders Issue / Edit / Cancel for a draft', () => {
    renderActions('draft');
    expect(screen.getByRole('button', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it.each(['issued', 'partially_paid', 'overdue'] as const)(
    'renders only Cancel for %s (no Issue on issued invoices)',
    (status) => {
      renderActions(status);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    },
  );

  it.each(['paid', 'cancelled', 'void'] as const)(
    'renders no actions for %s',
    (status) => {
      renderActions(status);
      expect(screen.getByText('No actions are available for this invoice status.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    },
  );

  it('does not expose the admin-only Delete action for a non-admin user (PermissionGate)', () => {
    renderActions('draft');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('disables the lifecycle buttons while a request is in flight', () => {
    render(
      <InvoiceDetailActions
        status="draft"
        submitting
        onIssue={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Issue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
