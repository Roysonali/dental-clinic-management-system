import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from './TimePicker';

describe('TimePicker', () => {
  it('renders the placeholder when empty', () => {
    render(<TimePicker />);
    expect(screen.getByRole('button', { name: 'Select a time' })).toBeInTheDocument();
  });

  it('renders the value in 12h format by default', () => {
    render(<TimePicker defaultValue="14:00" />);
    expect(screen.getByRole('button', { name: '02:00 PM' })).toBeInTheDocument();
  });

  it('renders the value in 24h format when requested', () => {
    render(<TimePicker defaultValue="14:00" format="24h" />);
    expect(screen.getByRole('button', { name: '14:00' })).toBeInTheDocument();
  });

  it('opens the listbox and selects a time (uncontrolled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker format="24h" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Select a time' }));
    expect(screen.getByRole('listbox', { name: 'Select time' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '14:00' }));
    expect(onChange).toHaveBeenCalledWith('14:00');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports controlled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker value="09:00" format="24h" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '09:00' }));
    await user.click(screen.getByRole('option', { name: '09:30' }));
    expect(onChange).toHaveBeenCalledWith('09:30');
  });

  it('generates options based on stepMinutes', async () => {
    const user = userEvent.setup();
    render(<TimePicker stepMinutes={60} format="24h" />);

    await user.click(screen.getByRole('button', { name: 'Select a time' }));
    expect(screen.getAllByRole('option')).toHaveLength(24);
    expect(screen.getByRole('option', { name: '00:00' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '23:00' })).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<TimePicker />);

    const trigger = screen.getByRole('button', { name: 'Select a time' });
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('exposes correct ARIA attributes on the trigger', async () => {
    const user = userEvent.setup();
    render(<TimePicker />);
    const trigger = screen.getByRole('button', { name: 'Select a time' });

    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<TimePicker disabled />);
    const trigger = screen.getByRole('button', { name: 'Select a time' });

    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
