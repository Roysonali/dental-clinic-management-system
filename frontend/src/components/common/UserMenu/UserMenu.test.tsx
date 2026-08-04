import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './UserMenu';
import { Dropdown } from '../Dropdown/Dropdown';

const onLogout = vi.fn();

function renderUserMenu() {
  return render(
    <UserMenu
      name="Dr. Maria Santos"
      role="General Dentist"
      email="maria@denscare.clinic"
      onLogout={onLogout}
    >
      <Dropdown.Item label="Settings" />
    </UserMenu>,
  );
}

/** The outer Dropdown.Trigger button — carries aria-haspopup/aria-expanded. */
function getTrigger() {
  return screen.getByRole('button', { name: /Dr\. Maria Santos/ });
}

describe('UserMenu', () => {
  beforeEach(() => {
    onLogout.mockReset();
  });

  it('renders the user name, role and avatar initials', () => {
    renderUserMenu();

    expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('General Dentist')).toBeInTheDocument();
    // Initials derived from the name ("Dr. Maria Santos" → "DM").
    expect(screen.getByText('DM')).toBeInTheDocument();
  });

  it('exposes the trigger with the correct accessibility attributes', () => {
    renderUserMenu();

    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the menu on click and renders menu items with menuitem roles', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    const trigger = getTrigger();
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Sign out' }),
    ).toBeInTheDocument();
  });

  it('shows the email in the dropdown header once the menu is open', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    expect(screen.queryByText('maria@denscare.clinic')).not.toBeInTheDocument();

    await user.click(getTrigger());

    expect(screen.getByText('maria@denscare.clinic')).toBeInTheDocument();
  });

  it('closes the menu when Escape is pressed and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    const trigger = getTrigger();
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    await user.click(getTrigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation between menu items', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    await user.click(getTrigger());
    const menu = screen.getByRole('menu');

    // ArrowDown moves forward, wraps to the last item and back via ArrowUp.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(
      screen.getByRole('menuitem', { name: 'Settings' }),
    ).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(
      screen.getByRole('menuitem', { name: 'Sign out' }),
    ).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(
      screen.getByRole('menuitem', { name: 'Settings' }),
    ).toHaveFocus();
  });

  it('calls onLogout and closes the menu when Sign out is clicked', async () => {
    const user = userEvent.setup();
    renderUserMenu();

    await user.click(getTrigger());
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not render a Sign out item when onLogout is omitted', async () => {
    const user = userEvent.setup();
    render(
      <UserMenu name="Dr. Maria Santos" email="maria@denscare.clinic">
        <Dropdown.Item label="Settings" />
      </UserMenu>,
    );

    await user.click(getTrigger());

    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).not.toBeInTheDocument();
  });
});
