import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationMenu } from './NotificationMenu';

describe('NotificationMenu', () => {
  it('renders a single bell trigger button with no nested buttons', () => {
    render(<NotificationMenu />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].querySelector('button')).toBeNull();
    // The bell is the trigger itself: it carries the menu semantics.
    expect(buttons[0]).toHaveAttribute('aria-haspopup', 'menu');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(buttons[0]).toHaveAccessibleName(/Notifications/);
  });

  it('opens the notification dropdown on click', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);

    const trigger = screen.getByRole('button', { name: /Notifications/ });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Appointment Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /View all notifications/ })).toBeInTheDocument();
  });
});
