import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('renders the placeholder when empty', () => {
    render(<DatePicker />);
    expect(screen.getByRole('button', { name: 'Select a date' })).toBeInTheDocument();
  });

  it('renders the formatted value in uncontrolled mode', () => {
    render(<DatePicker defaultValue="2026-08-15" />);
    expect(screen.getByRole('button', { name: 'Aug 15, 2026' })).toBeInTheDocument();
  });

  it('opens the calendar dialog on click', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);
    await user.click(screen.getByRole('button', { name: 'Select a date' }));
    expect(screen.getByRole('dialog', { name: 'Select date' })).toBeInTheDocument();
  });

  it('selects a date and reports the ISO value (uncontrolled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue="2026-08-15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    // Pick a day from the currently displayed month (August 2026).
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(onChange).toHaveBeenCalledWith('2026-08-20');
    // The calendar closes after selection.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports controlled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-08-15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.click(screen.getByRole('button', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith('2026-08-20');
  });

  it('disables days outside the min/max range', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" minDate="2026-08-10" maxDate="2026-08-20" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    expect(screen.getByRole('button', { name: '9' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '21' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '15' })).toBeEnabled();
  });

  it('navigates months with the prev/next buttons', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);

    const trigger = screen.getByRole('button', { name: 'Select a date' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('exposes correct ARIA attributes on the trigger', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);
    const trigger = screen.getByRole('button', { name: 'Select a date' });

    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<DatePicker disabled />);
    const trigger = screen.getByRole('button', { name: 'Select a date' });

    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
