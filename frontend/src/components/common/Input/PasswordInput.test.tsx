import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

/** The eye toggle lives inside Input's trailing slot; that slot must be
 *  pointer-events-auto or the button is unclickable in real browsers. This
 *  guards the root-cause regression that unit-click tests cannot catch
 *  (jsdom does not resolve Tailwind CSS). */
function expectTrailingActionInteractive() {
  const button = screen.getByRole('button', { name: /password/i });
  const wrapper = button.closest('[class*="pointer-events"]');
  expect(wrapper).not.toBeNull();
  expect(wrapper?.className).toContain('pointer-events-auto');
  expect(wrapper?.className).not.toContain('pointer-events-none');
}

describe('PasswordInput (shared)', () => {
  it('renders a password input with the label and a show/hide affordance', () => {
    render(<PasswordInput label="Password" />);

    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'Show password' }),
    ).toBeInTheDocument();
  });

  it('is masked by default and the trailing toggle is clickable (pointer-events)', () => {
    render(<PasswordInput label="Password" />);

    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute('type', 'password');
    expectTrailingActionInteractive();
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
    expect(
      screen.getByRole('button', { name: 'Show password' }),
    ).toBeInTheDocument();
  });

  it('keeps the input value intact across visibility toggles', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" defaultValue="s3cret!" />);
    const input = screen.getByLabelText(/^Password/);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveValue('s3cret!');
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveValue('s3cret!');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('is keyboard accessible: the toggle is focusable and Enter reveals', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText(/^Password/);

    // The visibility button must be in the tab order (no tabIndex={-1}).
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toHaveFocus();
  });

  it('does not submit the enclosing form when the toggle is used', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput label="Password" />
        <button type="submit">Submit</button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('disables the toggle together with the input', () => {
    render(<PasswordInput label="Password" disabled />);

    expect(screen.getByLabelText(/^Password/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
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
