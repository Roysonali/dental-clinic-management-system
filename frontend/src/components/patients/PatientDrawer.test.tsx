import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PatientDrawer } from './PatientDrawer';

describe('PatientDrawer', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <PatientDrawer open={false} mode="create" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the register title in create mode', () => {
    renderWithProviders(
      <PatientDrawer open mode="create" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Register Patient' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register Patient' })).toBeInTheDocument();
  });

  it('renders the edit title in edit mode', () => {
    renderWithProviders(
      <PatientDrawer open mode="edit" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Edit Patient' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows a loading state instead of the form while fetching', () => {
    renderWithProviders(
      <PatientDrawer open mode="edit" loading onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('status', { name: 'Loading patient' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  it('submits form values via onSubmit', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <PatientDrawer
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValues={{ date_of_birth: '1990-05-15', gender: 'male' }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/primary contact number/i), {
      target: { value: '+639123456789' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <PatientDrawer open mode="create" onClose={onClose} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
