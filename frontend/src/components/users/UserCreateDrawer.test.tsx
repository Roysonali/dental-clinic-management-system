import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserCreateDrawer } from './UserCreateDrawer';
import type { UserCreateFormValues } from '../../types/user';

describe('UserCreateDrawer', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<UserCreateDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the Add User dialog with the form when open', () => {
    renderWithProviders(<UserCreateDrawer open onClose={vi.fn()} onSubmit={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/full name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      within(dialog).getByPlaceholderText('Create a strong password'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    renderWithProviders(<UserCreateDrawer open onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits validated form values to the parent', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<UserCreateDrawer open onClose={vi.fn()} onSubmit={onSubmit} />);

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Create a strong password'), {
      target: { value: 'Secure@Pass1' },
    });
    fireEvent.change(within(dialog).getByLabelText(/role/i), { target: { value: '3' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add User' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as UserCreateFormValues;
    expect(values.email).toBe('jane@example.com');
    expect(values.role_id).toBe('3');
  });

  it('shows the server error banner inside the dialog', () => {
    renderWithProviders(
      <UserCreateDrawer
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        serverMessage="Email already registered"
      />,
    );
    expect(screen.getByText('Email already registered')).toBeInTheDocument();
  });

  it('focuses the Full Name input automatically when it opens', async () => {
    renderWithProviders(<UserCreateDrawer open onClose={vi.fn()} onSubmit={vi.fn()} />);

    // The shared Drawer focuses `initialFocusRef` on open (after the panel
    // mount), so the first field — not the panel — receives focus.
    await waitFor(() =>
      expect(screen.getByLabelText(/full name/i)).toHaveFocus(),
    );
  });

  it('disables close and cancel while submission is in progress', () => {
    renderWithProviders(
      <UserCreateDrawer open submitting onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toBeDisabled();
    expect(closeButton).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
