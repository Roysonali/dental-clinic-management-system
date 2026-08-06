import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';
import { Drawer } from '../Drawer/Drawer';
import { Modal } from '../Modal/Modal';

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
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('August');
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2026');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('July');

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('September');
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

describe('DatePicker overlay behaviour', () => {
  it('renders the calendar in a portal at document.body with the z-datepicker layer', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);

    await user.click(screen.getByRole('button', { name: 'Select a date' }));
    const dialog = screen.getByRole('dialog', { name: 'Select date' });

    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass('z-datepicker');
  });

  it('is not clipped by an overflow-hidden ancestor', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <DatePicker />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Select a date' }));
    const dialog = screen.getByRole('dialog', { name: 'Select date' });

    expect(dialog.parentElement).toBe(document.body);
    expect(container.querySelector('[style*="overflow"]')?.contains(dialog)).toBe(false);
  });

  it('renders inside the Drawer overlay layer, escaping the scrollable Drawer Body', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open onClose={vi.fn()} ariaLabel="Edit patient">
        <Drawer.Body>
          <DatePicker />
        </Drawer.Body>
      </Drawer>,
    );

    await user.click(screen.getByRole('button', { name: 'Select a date' }));
    const dialog = screen.getByRole('dialog', { name: 'Select date' });

    expect(dialog.closest('.fixed.inset-0.z-drawer')).not.toBeNull();
    expect(dialog.closest('.overflow-y-auto')).toBeNull();
  });

  it('renders inside the Modal overlay layer', async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={vi.fn()} ariaLabel="New appointment">
        <Modal.Body>
          <DatePicker />
        </Modal.Body>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Select a date' }));
    const dialog = screen.getByRole('dialog', { name: 'Select date' });

    expect(dialog.closest('.fixed.inset-0.z-modal')).not.toBeNull();
  });
});

describe('DatePicker navigation', () => {
  it('opens the month grid and selects a month by mouse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue="2026-08-15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Select month' }));
    expect(screen.getByRole('grid', { name: 'Select a month in 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sep' }));
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('September');
    // Month selection does not commit a date.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigates the month grid with arrow keys and commits with Enter', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Select month' }));
    expect(screen.getByRole('button', { name: 'Aug' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Sep' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('September');
  });

  it('jumps to any year, then a month, then commits a day (fast navigation)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue="2026-08-15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Select year' }));
    await user.click(screen.getByRole('button', { name: '2027' }));
    expect(screen.getByRole('grid', { name: 'Select a month in 2027' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dec' }));
    expect(screen.getByRole('button', { name: 'Select year' })).toHaveTextContent('2027');
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('December');

    await user.click(screen.getByRole('button', { name: '31' }));
    expect(onChange).toHaveBeenCalledWith('2027-12-31');
  });

  it('navigates the year grid with arrow keys and decade buttons', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Select year' }));
    expect(screen.getByText('2016–2027')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '2025' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Next decade' }));
    expect(screen.getByText('2028–2039')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2038' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '2039' })).toHaveFocus();
  });
});

describe('DatePicker keyboard navigation', () => {
  it('moves focus through the day grid with arrow keys', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    expect(screen.getByRole('button', { name: '15' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '16' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '15' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: '8' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: '15' })).toHaveFocus();
  });

  it('jumps to the first/last day with Home/End', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: '31' })).toHaveFocus();
  });

  it('moves between months with PageUp/PageDown', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2026-08-15" />);

    await user.click(screen.getByRole('button', { name: 'Aug 15, 2026' }));
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('September');
    expect(screen.getByRole('button', { name: '15' })).toHaveFocus();

    await user.keyboard('{PageUp}');
    expect(screen.getByRole('button', { name: 'Select month' })).toHaveTextContent('August');
    expect(screen.getByRole('button', { name: '15' })).toHaveFocus();
  });
});
