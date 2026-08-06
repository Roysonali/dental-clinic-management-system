import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserCreateForm } from './UserCreateForm';
import type { UserCreateFormValues } from '../../types/user';

describe('UserCreateForm', () => {
  it('renders exactly the four backend-supported fields', () => {
    renderWithProviders(<UserCreateForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Required labels render a "*" marker — match with regex like the
    // doctor/patient form test conventions.
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();

    // No invented fields (username, phone, address, avatar, dob, status…).
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows required-field validation errors on empty submit', async () => {
    renderWithProviders(<UserCreateForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    await waitFor(() => {
      expect(screen.getAllByText('Full name must be at least 2 characters').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Email address is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Password must be at least 8 characters').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Role is required').length).toBeGreaterThan(0);
    });
  });

  it('rejects invalid emails (backend EmailStr)', async () => {
    renderWithProviders(<UserCreateForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Please enter a valid email address').length,
      ).toBeGreaterThan(0);
    });
  });

  it('rejects weak passwords (backend complexity rules)', async () => {
    renderWithProviders(<UserCreateForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Create a strong password'), {
      target: { value: 'lowercase1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Password must contain at least one uppercase letter').length,
      ).toBeGreaterThan(0);
    });
  });

  it('calls onSubmit with normalized values for a valid submission', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<UserCreateForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: '  Juan   Dela Cruz ' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'JUAN@Example.COM' },
    });
    fireEvent.change(screen.getByPlaceholderText('Create a strong password'), {
      target: { value: 'Secure@Pass1' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const values = onSubmit.mock.calls[0][0] as UserCreateFormValues;
    // Backend normalization applied by the schema (trim + collapse, lowercase).
    expect(values.full_name).toBe('Juan Dela Cruz');
    expect(values.email).toBe('juan@example.com');
    expect(values.password).toBe('Secure@Pass1');
    expect(values.role_id).toBe('3');
  });

  it('fires onCancel', () => {
    const onCancel = vi.fn();
    renderWithProviders(<UserCreateForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces server-level error banner and field errors', () => {
    renderWithProviders(
      <UserCreateForm
        onSubmit={vi.fn()}
        serverMessage="Email already registered"
        serverErrors={{ email: 'Email already registered' }}
      />,
    );

    // The message renders both as the banner and as the inline field error.
    expect(screen.getAllByText('Email already registered').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
  });
});
