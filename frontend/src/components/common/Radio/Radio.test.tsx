import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio } from './Radio';

describe('Radio (shared)', () => {
  it('renders a semantic radio with an accessible label', () => {
    render(<Radio name="gender" label="Male" />);
    expect(screen.getByRole('radio', { name: 'Male' })).toBeInTheDocument();
  });

  it('toggles between radio options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div>
        <Radio name="gender" label="Male" value="male" onChange={onChange} />
        <Radio name="gender" label="Female" value="female" />
      </div>,
    );

    await user.click(screen.getByRole('radio', { name: 'Female' }));
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Male' })).not.toBeChecked();
  });

  it('keeps the checked dot control on the circle (regression: blue border with invisible dot)', () => {
    render(<Radio name="gender" label="Male" checked onChange={() => {}} />);

    const radio = screen.getByRole('radio', { name: 'Male' });
    const circle = radio.nextElementSibling;
    const dot = circle?.querySelector('span');

    // The dot scales in via the circle's `peer-checked:[&>span]:scale-100`
    // child selector — putting `peer-checked:scale-100` directly on the dot
    // (a child, unreachable by the sibling peer combinator) previously left
    // the checked radio showing only a blue border with no dot.
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('class')).toContain('scale-0');
    expect(circle?.getAttribute('class')).toContain('peer-checked:[&>span]:scale-100');
  });
});
