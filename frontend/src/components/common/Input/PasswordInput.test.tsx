import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput (shared)', () => {
  it('renders a password input with the label and a show/hide affordance', () => {
    render(<PasswordInput label="Password" />);

    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'Show password' }),
    ).toBeInTheDocument();
  });

  it('toggles between password and text when the eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText(/^Password/);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows the error and hides the helper text when an error is present', () => {
    render(
      <PasswordInput label="Password" error="Password is required" helperText="8+ characters" />,
    );

    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.queryByText('8+ characters')).not.toBeInTheDocument();
  });

  it('shows the helper text when there is no error', () => {
    render(<PasswordInput label="Password" helperText="8+ characters" />);

    expect(screen.getByText('8+ characters')).toBeInTheDocument();
  });

  it('forwards input attributes such as autoComplete and placeholder', () => {
    render(
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        placeholder="Create a strong password"
      />,
    );

    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute('autoComplete', 'new-password');
    expect(input).toHaveAttribute('placeholder', 'Create a strong password');
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput label="Password" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('password');
  });
});
