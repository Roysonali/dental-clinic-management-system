import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { Form } from './Form';

describe('Form', () => {
  it('renders children inside a noValidate form element', () => {
    const { container } = render(
      <Form>
        <input placeholder="Email" />
      </Form>,
    );
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('novalidate');
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('prevents default submission and calls onSubmit', async () => {
    const user = userEvent.setup();
    let capturedEvent: FormEvent<HTMLFormElement> | undefined;
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      capturedEvent = event;
    });

    const { container } = render(
      <Form onSubmit={onSubmit}>
        <input placeholder="Email" />
        <button type="submit">Save</button>
      </Form>,
    );
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('novalidate');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(capturedEvent?.defaultPrevented).toBe(true);
  });

  it('applies the responsive grid layout when grid is enabled', () => {
    const { container } = render(
      <Form grid columns={2}>
        <div>Field A</div>
        <div>Field B</div>
      </Form>,
    );
    const form = container.querySelector('form');
    expect(form).toHaveClass('grid');
    expect(form).toHaveClass('grid-cols-1');
    expect(form).toHaveClass('md:grid-cols-2');
  });

  it('does not add grid classes by default', () => {
    const { container } = render(<Form><div>Field</div></Form>);
    expect(container.querySelector('form')).not.toHaveClass('grid');
  });

  it('applies the spacing class inside the grid', () => {
    const { container } = render(
      <Form grid spacing="lg">
        <div>Field A</div>
        <div>Field B</div>
      </Form>,
    );
    expect(container.querySelector('form')).toHaveClass('gap-6');
  });
});
