import { useState, type FC } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Modal } from './Modal';

/** Harness that opens the modal from a trigger so focus restoration can be asserted. */
const Harness: FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <Modal open={open} onClose={() => { setOpen(false); onClose?.(); }} ariaLabel="Confirm action">
        <button type="button">Confirm</button>
      </Modal>
    </>
  );
};

describe('Modal', () => {
  it('renders content when open', () => {
    render(<Modal open onClose={vi.fn()} ariaLabel="Confirm action"><p>Body</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={vi.fn()} ariaLabel="Confirm action"><p>Body</p></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape, consistent with the Drawer', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} ariaLabel="Confirm action"><p>Body</p></Modal>);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} ariaLabel="Confirm action"><p>Body</p></Modal>,
    );

    // The backdrop is the first child of the fixed overlay wrapper.
    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger when closed via Escape', async () => {
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open modal' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('does not stack duplicate Escape listeners across open/close cycles', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <Modal open onClose={onClose} ariaLabel="Confirm action"><p>Body</p></Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close and reopen — the previous effect cleanup must remove the old listener.
    rerender(<Modal open={false} onClose={onClose} ariaLabel="Confirm action"><p>Body</p></Modal>);
    rerender(<Modal open onClose={onClose} ariaLabel="Confirm action"><p>Body</p></Modal>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
