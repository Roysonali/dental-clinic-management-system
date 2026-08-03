import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelect } from './MultiSelect';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('MultiSelect', () => {
  it('renders the placeholder when nothing is selected', () => {
    render(<MultiSelect options={options} />);
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveTextContent('Select options');
  });

  it('renders selected pills in uncontrolled mode', () => {
    render(<MultiSelect options={options} defaultValue={['a', 'b']} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('opens the listbox on click and selects an option (uncontrolled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiSelect options={options} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Option A' }));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('supports controlled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiSelect options={options} value={['a']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('checkbox', { name: 'Option B' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('removes an option via its pill remove button without opening the popover', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiSelect options={options} defaultValue={['a', 'b']} onChange={onChange} />);

    await user.click(screen.getByLabelText('Remove Option A'));
    expect(onChange).toHaveBeenCalledWith(['b']);
    // The popover must not have toggled open as a side effect.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={options} />);

    const combobox = screen.getByRole('combobox');
    combobox.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveFocus();
  });

  it('exposes correct ARIA attributes on the trigger', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={options} />);
    const combobox = screen.getByRole('combobox');

    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={options} disabled />);
    const combobox = screen.getByRole('combobox');

    expect(combobox).toHaveAttribute('aria-disabled', 'true');
    await user.click(combobox);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no options', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={[]} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('respects disabled options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const withDisabled = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B', disabled: true },
    ];
    render(<MultiSelect options={withDisabled} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    const disabledCheckbox = screen.getByRole('checkbox', { name: 'Option B' });
    expect(disabledCheckbox).toBeDisabled();
  });
});
