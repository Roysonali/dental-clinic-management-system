import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch (shared)', () => {
  it('renders a switch role control with an accessible label', () => {
    render(<Switch label="Notifications" />);
    const control = screen.getByRole('switch', { name: 'Notifications' });
    expect(control).toBeInTheDocument();
    expect(control).not.toBeChecked();
  });

  it('toggles on and off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Notifications" onChange={onChange} />);

    const control = screen.getByRole('switch', { name: 'Notifications' });
    await user.click(control);
    expect(control).toBeChecked();
    await user.click(control);
    expect(control).not.toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the thumb-slide control on the track (regression: blue track with stuck thumb)', () => {
    render(<Switch label="Notifications" checked onChange={() => {}} />);

    const control = screen.getByRole('switch', { name: 'Notifications' });
    const track = control.nextElementSibling;
    const thumb = track?.querySelector('span');

    // The thumb slides via the track's `peer-checked:[&>span]:translate-x-*`
    // child selector — putting `peer-checked:translate-x-*` directly on the
    // thumb (a child, unreachable by the sibling peer combinator) previously
    // turned the track blue while the thumb never moved.
    expect(thumb).not.toBeNull();
    expect(track?.getAttribute('class')).toContain('peer-checked:[&>span]:translate-x-5');
  });
});
