import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import type { LoginFormValues } from '../../../types/auth';

const onSubmitMock = vi.fn<(values: LoginFormValues) => void | Promise<void>>();

function renderLoginForm() {
  return render(
    <MemoryRouter>
      <LoginForm onSubmit={onSubmitMock} />
    </MemoryRouter>,
  );
}

/** Render the form and type valid credentials (button stays disabled until valid). */
async function renderAndFill() {
  renderLoginForm();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Email address/), 'juan@example.com');
  await user.type(screen.getByLabelText(/Password/), 'Secret@1');
  return user;
}

describe('LoginForm — Keep me signed in checkbox', () => {
  beforeEach(() => {
    onSubmitMock.mockReset();
  });

  it('renders the checkbox with an accessible label', () => {
    renderLoginForm();

    // getByRole throws if the checkbox (or its accessible label) is missing.
    screen.getByRole('checkbox', {
      name: /keep me signed in on this workstation/i,
    });
  });

  it('defaults to unchecked (transient session is the secure default)', () => {
    renderLoginForm();

    expect(
      screen.getByRole('checkbox', { name: /keep me signed in/i }),
    ).not.toBeChecked();
  });

  it('lets the user toggle the checkbox', async () => {
    const user = await renderAndFill();

    const checkbox = screen.getByRole('checkbox', {
      name: /keep me signed in/i,
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('submits remember_me=false when the checkbox is left unchecked', async () => {
    const user = await renderAndFill();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSubmitMock).toHaveBeenCalledWith({
      email: 'juan@example.com',
      password: 'Secret@1',
      remember_me: false,
    });
  });

  it('submits remember_me=true when the checkbox is checked', async () => {
    const user = await renderAndFill();

    await user.click(
      screen.getByRole('checkbox', { name: /keep me signed in/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSubmitMock).toHaveBeenCalledWith({
      email: 'juan@example.com',
      password: 'Secret@1',
      remember_me: true,
    });
  });

  it('keeps the submit button disabled until the form is valid', async () => {
    renderLoginForm();

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email address/), 'juan@example.com');
    await user.type(screen.getByLabelText(/Password/), 'Secret@1');

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
