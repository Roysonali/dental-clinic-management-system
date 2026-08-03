import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormActions } from './FormActions';

describe('FormActions', () => {
  it('renders a submit button with the default label', () => {
    render(<FormActions />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders a cancel button when onCancel is provided', () => {
    render(<FormActions onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('omits the cancel button when onCancel is not provided', () => {
    render(<FormActions />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<FormActions onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses custom submit and cancel labels', () => {
    render(<FormActions submitText="Create Patient" cancelText="Back" onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Create Patient' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('disables and marks the submit button as busy while submitting', () => {
    render(<FormActions submitting />);
    const submit = screen.getByRole('button', { name: 'Save' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('respects submitDisabled and cancelDisabled', () => {
    render(<FormActions submitDisabled cancelDisabled onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('renders extra children before the buttons', () => {
    render(
      <FormActions>
        <button type="button">Reset</button>
      </FormActions>,
    );
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('submits the surrounding form when the submit button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <FormActions />
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
