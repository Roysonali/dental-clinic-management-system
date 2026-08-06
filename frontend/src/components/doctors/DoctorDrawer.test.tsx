import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorDrawer } from './DoctorDrawer';

describe('DoctorDrawer', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <DoctorDrawer open={false} mode="create" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the register title in create mode', () => {
    renderWithProviders(
      <DoctorDrawer open mode="create" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Register Doctor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register Doctor' })).toBeInTheDocument();
  });

  it('renders the edit title in edit mode', () => {
    renderWithProviders(
      <DoctorDrawer open mode="edit" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Edit Doctor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows a loading state instead of the form while fetching', () => {
    renderWithProviders(
      <DoctorDrawer open mode="edit" loading onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('status', { name: 'Loading doctor' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Primary Phone')).not.toBeInTheDocument();
  });

  it('submits form values via onSubmit', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <DoctorDrawer
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValues={{ user_id: '3', date_of_birth: '1985-04-12', gender: 'male' }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/primary phone/i), { target: { value: '+639123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register Doctor' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <DoctorDrawer open mode="create" onClose={onClose} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces server errors inside the form', () => {
    renderWithProviders(
      <DoctorDrawer
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        serverMessage="Registration failed"
        serverErrors={{ primary_phone: 'Phone already registered.' }}
      />,
    );

    expect(screen.getByText('Registration failed')).toBeInTheDocument();
    expect(screen.getByText('Phone already registered.')).toBeInTheDocument();
  });
});
