import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationSummary } from './ValidationSummary';

describe('ValidationSummary', () => {
  it('renders messages from react-hook-form style errors', () => {
    render(
      <ValidationSummary
        errors={{
          name: { type: 'required', message: 'Name is required' },
          age: { type: 'min', message: 'Age must be positive' },
        }}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Name is required');
    expect(alert).toHaveTextContent('Age must be positive');
  });

  it('renders messages from flat string error maps', () => {
    render(<ValidationSummary errors={{ email: 'Email is invalid' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email is invalid');
  });

  it('ignores nested errors without a message', () => {
    render(<ValidationSummary errors={{ name: { type: 'required' } }} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no errors', () => {
    const { container } = render(<ValidationSummary errors={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when errors is undefined', () => {
    const { container } = render(<ValidationSummary />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a custom title', () => {
    render(<ValidationSummary errors={{ name: 'Name is required' }} title="Fix the following" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the following');
  });
});
