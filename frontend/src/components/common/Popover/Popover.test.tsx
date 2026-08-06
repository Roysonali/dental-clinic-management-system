import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from './Popover';
import { Drawer } from '../Drawer/Drawer';
import { Modal } from '../Modal/Modal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Popover overlay behaviour', () => {
  it('renders content in a portal at document.body by default', () => {
    const { container } = render(
      <Popover open>
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>Menu</Popover.Content>
      </Popover>,
    );
    const content = screen.getByText('Menu');
    expect(content.parentElement).toBe(document.body);
    // The render container must not contain the floating content.
    expect(container.contains(content)).toBe(false);
  });

  it('is not clipped by an overflow ancestor (rendered outside it)', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Popover open>
          <Popover.Trigger as="button">Open</Popover.Trigger>
          <Popover.Content>Menu</Popover.Content>
        </Popover>
      </div>,
    );
    const content = screen.getByText('Menu');
    // Portaled directly under <body>, so no node can clip it.
    expect(content.parentElement).toBe(document.body);
    expect(container.querySelector('[style*="overflow"]')?.contains(content)).toBe(false);
  });

  it('renders inside the Drawer overlay layer, escaping the scrollable Drawer Body', () => {
    render(
      <Drawer open onClose={vi.fn()} ariaLabel="Edit patient">
        <Drawer.Body>
          <Popover open>
            <Popover.Trigger as="button">Open</Popover.Trigger>
            <Popover.Content>Menu</Popover.Content>
          </Popover>
        </Drawer.Body>
      </Drawer>,
    );
    const content = screen.getByText('Menu');
    // Escaped the Drawer.Body scroll container…
    expect(content.closest('.overflow-y-auto')).toBeNull();
    // …and portals into the drawer's own stacking-context root.
    expect(content.closest('.fixed.inset-0.z-drawer')).not.toBeNull();
  });

  it('renders inside the Modal overlay layer', () => {
    render(
      <Modal open onClose={vi.fn()} ariaLabel="Confirm action">
        <Modal.Body>
          <Popover open>
            <Popover.Trigger as="button">Open</Popover.Trigger>
            <Popover.Content>Menu</Popover.Content>
          </Popover>
        </Modal.Body>
      </Modal>,
    );
    const content = screen.getByText('Menu');
    expect(content.closest('.fixed.inset-0.z-modal')).not.toBeNull();
  });

  it('applies the default z-dropdown layer token', () => {
    render(
      <Popover open>
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>Menu</Popover.Content>
      </Popover>,
    );
    expect(screen.getByText('Menu')).toHaveClass('z-dropdown');
  });

  it('applies a custom z-index layer token', () => {
    render(
      <Popover open zIndex="z-datepicker">
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>Menu</Popover.Content>
      </Popover>,
    );
    expect(screen.getByText('Menu')).toHaveClass('z-datepicker');
  });

  it('keeps w-full content matched to the trigger width inside the portal', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 100,
      bottom: 50,
      right: 400,
      width: 300,
      height: 40,
      x: 100,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);
    render(
      <Popover open align="start">
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content className="w-full">Menu</Popover.Content>
      </Popover>,
    );
    const content = screen.getByText('Menu');
    expect(content.style.width).toBe('300px');
    expect(content.style.visibility).toBe('visible');
  });

  it('flips above when there is not enough space below the trigger', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      left: 100,
      bottom: 740,
      right: 400,
      width: 300,
      height: 40,
      x: 100,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect);
    render(
      <Popover open align="start">
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>Menu</Popover.Content>
      </Popover>,
    );
    const content = screen.getByText('Menu');
    // Preferred bottom position (740 + 8 = 748) would overflow 768 - 8, so the
    // popover flips to the top: 700 - 40 - 8 = 652.
    expect(content.style.top).toBe('652px');
  });
});

describe('Popover interaction', () => {
  it('closes on outside click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <Popover>
          <Popover.Trigger as="button">Open</Popover.Trigger>
          <Popover.Content>Menu</Popover.Content>
        </Popover>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>Menu</Popover.Content>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(screen.getByText('Menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not close when interacting inside the portaled content', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger as="button">Open</Popover.Trigger>
        <Popover.Content>
          <button type="button">Inner</button>
        </Popover.Content>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Inner' }));
    expect(screen.getByRole('button', { name: 'Inner' })).toBeInTheDocument();
  });
});
