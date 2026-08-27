import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { PatientForm } from './PatientForm';
import type { PatientFormValues } from '../../types/patient';

describe('PatientForm', () => {
  it('renders all required fields', () => {
    renderWithProviders(<PatientForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/middle name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/primary contact number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/emergency contact number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    // Exact match: /address/i would also match the "Email Address" label.
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Patient' })).toBeInTheDocument();
  });

  it('shows required-field validation errors on empty submit', async () => {
    renderWithProviders(<PatientForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Patient' }));

    await waitFor(() => {
      // Messages appear both inline on the field and in the ValidationSummary.
      expect(screen.getAllByText('First name is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Last name is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gender is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Primary contact number is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Date of birth is required').length).toBeGreaterThan(0);
    });
  });

  it('rejects non-alphabetic characters in names (backend charset rule)', async () => {
    renderWithProviders(<PatientForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Patient' }));

    await waitFor(() => {
      expect(screen.getAllByText(/should contain only alphabetic characters/i).length).toBeGreaterThan(0);
    });
  });

  it('rejects invalid phone numbers (backend pattern rule)', async () => {
    renderWithProviders(<PatientForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } });
    fireEvent.change(screen.getByLabelText(/primary contact number/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Patient' }));

    await waitFor(() => {
      expect(screen.getAllByText(/must be 10–15 digits/i).length).toBeGreaterThan(0);
    });
  });

  it('calls onSubmit with mapped values for a valid submission', async () => {
    const onSubmit = vi.fn();
    // Pre-fill DOB + gender (the DatePicker popover is exercised by its own
    // component tests); the remaining fields are typed below.
    renderWithProviders(
      <PatientForm
        onSubmit={onSubmit}
        initialValues={{ date_of_birth: '1990-05-15', gender: 'male' }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/primary contact number/i), {
      target: { value: '+639123456789' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'juan@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Patient' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const values = onSubmit.mock.calls[0][0] as PatientFormValues;
    expect(values.first_name).toBe('Juan');
    expect(values.last_name).toBe('Dela Cruz');
    expect(values.primary_contact_number).toBe('+639123456789');
    expect(values.gender).toBe('male');
  });

  it('renders server-side errors', () => {
    renderWithProviders(
      <PatientForm
        onSubmit={vi.fn()}
        serverErrors={{ first_name: 'Patient already exists.' }}
        serverMessage="Possible duplicate patient detected"
      />,
    );

    expect(screen.getByText('Patient already exists.')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicate patient detected')).toBeInTheDocument();
  });

  it('pre-fills initial values in edit mode', () => {
    renderWithProviders(
      <PatientForm onSubmit={vi.fn()} initialValues={{ first_name: 'Maria', last_name: 'Santos' }} />,
    );
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Santos');
  });

  // ── AUD-02: Form reset regression tests ───────────────

  it('does not reset user edits when parent rerenders (AUD-02)', async () => {
    // Use a wrapper component to simulate parent rerenders via state
    let forceUpdate: () => void;
    function ParentWrapper() {
      const [, setTick] = React.useState(0);
      forceUpdate = () => setTick((t) => t + 1);
      return (
        <PatientForm
          onSubmit={vi.fn()}
          initialValues={{ first_name: 'Maria', last_name: 'Santos' }}
        />
      );
    }
    renderWithProviders(<ParentWrapper />);

    // Verify initial values populated
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria');

    // User edits the field
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Maria edited' },
    });
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria edited');

    // Parent rerenders (unrelated state change)
    act(() => {
      forceUpdate();
    });

    // User's edit must remain intact
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria edited');
  });

  it('preserves entered values after validation error (AUD-02)', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <PatientForm onSubmit={onSubmit} />,
    );

    // Fill in valid data except phone (leave empty to trigger validation)
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } });
    // Leave phone empty — will fail validation

    fireEvent.click(screen.getByRole('button', { name: 'Save Patient' }));

    // Wait for validation errors to appear
    await waitFor(() => {
      expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0);
    });

    // Verify the user's entered values are still present
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Juan');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Cruz');
  });
});
