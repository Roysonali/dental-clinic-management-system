import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import {
  UserCreateContainer,
  USER_CREATE_LOOKUP_ATTEMPTS,
  type UserCreationResult,
} from './UserCreateContainer';
import { authService } from '../../../services/authService';
import type { PendingUserResponse, RegisterResponse } from '../../../types/auth';

vi.mock('../../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

const registerMock = vi.mocked(authService.register);
const fetchPendingMock = vi.mocked(authService.fetchPendingUsers);
const approveMock = vi.mocked(authService.approveUser);

const pendingUser: PendingUserResponse = {
  id: 9,
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  status: 'pending',
};

/** Fill and submit the Add-User drawer form. */
async function submitForm() {
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
}

/** Controlled harness so tests can drive drawer close → reopen. */
function ReopenHarness({
  onCreated,
}: {
  onCreated?: (result: UserCreationResult) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen drawer
      </button>
      <UserCreateContainer
        open={open}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
      />
    </div>
  );
}

const registeredMessage = 'Registration submitted. Waiting for admin approval.';

describe('UserCreateContainer', () => {
  beforeEach(() => {
    registerMock.mockReset();
    fetchPendingMock.mockReset();
    approveMock.mockReset();
  });

  it('runs register → pending lookup → approve and reports success', async () => {
    registerMock.mockResolvedValue({ message: registeredMessage });
    fetchPendingMock.mockResolvedValue([pendingUser]);
    approveMock.mockResolvedValue({ message: 'User approved successfully.' });

    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <UserCreateContainer open onClose={onClose} onCreated={onCreated} />,
    );

    await submitForm();

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Secure@Pass1',
      }),
    );

    // The register response carries no user id — the container resolves the
    // created account from the pending queue by email before approving. The
    // account is found on the FIRST lookup attempt, so no retries happen.
    await waitFor(
      () => {
        expect(approveMock).toHaveBeenCalledWith(9, 3);
        expect(fetchPendingMock).toHaveBeenCalledTimes(1);
        expect(onCreated).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'approved', title: 'User added' }),
        );
      },
      { timeout: 3000 },
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('retries the pending lookup and approves when the account appears later', async () => {
    registerMock.mockResolvedValue({ message: registeredMessage });
    // Attempt 1: the freshly registered account has not reached the queue yet.
    // Attempt 2: found → approval proceeds and retrying stops.
    fetchPendingMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pendingUser]);
    approveMock.mockResolvedValue({ message: 'User approved successfully.' });

    const onCreated = vi.fn();
    renderWithProviders(<UserCreateContainer open onClose={vi.fn()} onCreated={onCreated} />);

    await submitForm();

    await waitFor(
      () => {
        expect(fetchPendingMock).toHaveBeenCalledTimes(2);
        expect(approveMock).toHaveBeenCalledWith(9, 3);
        expect(onCreated).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'approved' }),
        );
      },
      { timeout: 3000 },
    );
  });

  it('falls back to pending after the lookup retries are exhausted', async () => {
    registerMock.mockResolvedValue({ message: registeredMessage });
    // The account never appears in the queue — every attempt misses.
    fetchPendingMock.mockResolvedValue([]);

    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <UserCreateContainer open onClose={onClose} onCreated={onCreated} />,
    );

    await submitForm();

    await waitFor(
      () => {
        expect(fetchPendingMock).toHaveBeenCalledTimes(USER_CREATE_LOOKUP_ATTEMPTS);
        expect(onCreated).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'pending' }),
        );
        expect(approveMock).not.toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('falls back to pending when the pending-queue lookup request fails', async () => {
    registerMock.mockResolvedValue({ message: registeredMessage });
    // Network failure while reading the pending queue — registration itself
    // succeeded, so the account is left in the queue for manual approval.
    fetchPendingMock.mockRejectedValue(new Error('network down'));

    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <UserCreateContainer open onClose={onClose} onCreated={onCreated} />,
    );

    await submitForm();

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'pending' }),
      ),
    );
    expect(approveMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('reports approval_failed when approval rejects with 404', async () => {
    registerMock.mockResolvedValue({ message: registeredMessage });
    fetchPendingMock.mockResolvedValue([pendingUser]);
    // Account vanished between lookup and approval (e.g. concurrently
    // approved/deactivated) — report the fallback, do not leave the admin
    // trapped in a form that would 409 on retry.
    approveMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: 'User not found' } },
    });

    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <UserCreateContainer open onClose={onClose} onCreated={onCreated} />,
    );

    await submitForm();

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'approval_failed' }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the drawer open with the backend message on register failure (duplicate email)', async () => {
    registerMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Email already registered' } },
    });

    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <UserCreateContainer open onClose={onClose} onCreated={onCreated} />,
    );

    await submitForm();

    await waitFor(() =>
      expect(screen.getByText('Email already registered')).toBeInTheDocument(),
    );
    // Drawer stays open so the admin can correct the email; no approval attempted.
    expect(screen.getByRole('dialog', { name: 'Add User' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('maps backend 422 validation errors onto the banner and inline fields', async () => {
    registerMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
          details: [
            {
              loc: ['body', 'email'],
              msg: 'Invalid email address',
              type: 'value_error',
            },
            {
              loc: ['body', 'full_name'],
              msg: 'String should have at least 2 characters',
              type: 'string_too_short',
            },
          ],
        },
      },
    });

    const onClose = vi.fn();
    renderWithProviders(<UserCreateContainer open onClose={onClose} />);

    await submitForm();

    // Server-level banner message.
    await waitFor(() => expect(screen.getByText('Validation failed')).toBeInTheDocument());
    // Field-level errors surface inline next to their inputs (serverErrors).
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(
      screen.getByText('String should have at least 2 characters'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // Drawer stays open for corrections.
    expect(screen.getByRole('dialog', { name: 'Add User' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a loading state and prevents dismissal while submitting', async () => {
    let resolveRegister: ((value: RegisterResponse) => void) | undefined;
    registerMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        }),
    );
    // Lets the workflow settle cleanly after we resolve the register call.
    fetchPendingMock.mockResolvedValue([]);

    const onClose = vi.fn();
    renderWithProviders(<UserCreateContainer open onClose={onClose} />);

    await submitForm();
    await waitFor(() => expect(registerMock).toHaveBeenCalled());

    const dialog = screen.getByRole('dialog', { name: 'Add User' });

    // Submit button: spinner + disabled while the workflow is in flight.
    const submitButton = within(dialog).getByRole('button', { name: 'Add User' });
    await waitFor(() => {
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
      expect(submitButton).toBeDisabled();
    });

    // Cancel + header close are disabled too.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    expect(closeButton).toBeDisabled();
    expect(closeButton).toHaveAttribute('aria-disabled', 'true');

    // Escape must not dismiss the drawer while the workflow is in flight.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    // Settle the workflow so the test ends in a clean state.
    await act(async () => {
      resolveRegister?.({ message: registeredMessage });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('clears the previous server error when the drawer closes and reopens', async () => {
    registerMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Email already registered' } },
    });

    const onCreated = vi.fn();
    renderWithProviders(<ReopenHarness onCreated={onCreated} />);

    // 1. Duplicate-email error appears in the open drawer.
    await submitForm();
    await waitFor(() =>
      expect(screen.getByText('Email already registered')).toBeInTheDocument(),
    );

    // 2. Close via the header close button → drawer unmounts.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Add User' }),
      ).not.toBeInTheDocument(),
    );

    // 3. Reopen → the previous server error has been cleared.
    fireEvent.click(screen.getByRole('button', { name: 'Reopen drawer' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Add User' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('Email already registered')).not.toBeInTheDocument();
  });
});
