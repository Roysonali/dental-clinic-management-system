import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

describe('Checkbox (shared)', () => {
  it('renders a semantic checkbox with an accessible label', () => {
    render(<Checkbox label="Accept terms" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('is unchecked by default and toggles to checked on click', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Notifications" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Notifications' });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('respects an initial checked value (controlled)', () => {
    render(<Checkbox label="Default on" checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Default on' })).toBeChecked();
  });

  it('renders the checkmark visual when checked and hides it when unchecked', () => {
    render(<Checkbox label="Terms" checked onChange={() => {}} />);

    // The custom box is the direct sibling of the hidden input.
    const checkbox = screen.getByRole('checkbox', { name: 'Terms' });
    const box = checkbox.nextElementSibling;
    expect(box).not.toBeNull();
    expect(box?.getAttribute('class')).toContain('peer-checked:bg-primary-500');
    expect(box?.getAttribute('class')).toContain('peer-checked:[&>svg]:opacity-100');

    const svg = box?.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('opacity-0');
  });

  it('keeps the checkmark on the checked box (regression: solid-blue box with invisible check)', () => {
    render(<Checkbox label="Terms" checked onChange={() => {}} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Terms' });
    const box = checkbox.nextElementSibling;
    const svg = box?.querySelector('svg');

    // The checkmark svg starts hidden (opacity-0) and is revealed via the
    // box's `peer-checked:[&>svg]:opacity-100` child selector — the root
    // cause of the "solid blue, no checkmark" defect was that the opacity
    // toggle sat on the svg itself (a child, unreachable by the sibling
    // peer combinator). Guard that the toggle now lives on the box.
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('opacity-0');
    expect(box?.getAttribute('class')).toContain('peer-checked:[&>svg]:opacity-100');
  });

  it('marks the checkbox mixed (indeterminate) when requested', () => {
    render(<Checkbox label="Select all" indeterminate checked={false} onChange={() => {}} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Select all' });
    expect(checkbox).toBePartiallyChecked();
    // Indeterminate renders the dash visual on the box (peer-indeterminate).
    const box = checkbox.nextElementSibling;
    expect(box?.className).toContain('peer-indeterminate:bg-primary-500');
  });

  it('disables interaction and exposes the disabled state', () => {
    render(<Checkbox label="Read only" disabled checked />);

    const checkbox = screen.getByRole('checkbox', { name: 'Read only' });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
    // The label is visually muted for disabled controls.
    expect(screen.getByText('Read only').closest('label')?.className).toContain('opacity-50');
  });

  it('applies the error border when error is set', () => {
    render(<Checkbox label="Terms" error />);

    const checkbox = screen.getByRole('checkbox', { name: 'Terms' });
    const box = checkbox.nextElementSibling;
    expect(box?.getAttribute('class')).toContain('border-danger');
    expect(screen.getByRole('checkbox', { name: 'Terms' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('is keyboard accessible: Space toggles the checkbox', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Agree" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Agree' });
    await user.tab();
    expect(checkbox).toHaveFocus();

    await user.keyboard(' ');
    expect(checkbox).toBeChecked();

    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
  });

  it('submits the form value correctly in a native form (RHF-compatible wiring)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onSubmit(Object.fromEntries(data.entries()));
        }}
      >
        <Checkbox name="remember_me" label="Keep me signed in" />
        <button type="submit">Submit</button>
      </form>,
    );

    // Unchecked → value absent from the submission.
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenLastCalledWith({});

    // Checked → value present.
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ remember_me: 'on' });
  });

  it('forwards the ref to the underlying native input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox label="Terms" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('updates a React state holder through onChange (uncontrolled flow)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Option" onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Option' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('respects the controlled checked prop over internal state', async () => {
    const user = userEvent.setup();
    function ControlledHost() {
      const [checked, setChecked] = useState(false);
      return <Checkbox label="Controlled" checked={checked} onChange={() => setChecked(true)} />;
    }
    render(<ControlledHost />);

    const checkbox = screen.getByRole('checkbox', { name: 'Controlled' });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
