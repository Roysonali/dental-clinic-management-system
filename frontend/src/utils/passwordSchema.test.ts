import { describe, it, expect } from 'vitest';
import { passwordSchema } from './passwordSchema';

/**
 * The shared password policy — the single canonical frontend mirror of the
 * backend `validate_password_complexity` (8–128 chars, upper + lower +
 * digit + special). Reused by RegisterForm and the Add-User form.
 */
describe('passwordSchema (shared backend password policy)', () => {
  it('accepts a fully compliant password', () => {
    expect(passwordSchema.safeParse('Secure@Pass1').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab1!2a');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must be at least 8 characters',
    );
  });

  it('rejects passwords longer than 128 characters', () => {
    const result = passwordSchema.safeParse(`${'Ab1!'.repeat(40)}x`); // 161 chars
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must not exceed 128 characters',
    );
  });

  it('requires at least one uppercase letter', () => {
    const result = passwordSchema.safeParse('lowercase1!');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must contain at least one uppercase letter',
    );
  });

  it('requires at least one lowercase letter', () => {
    const result = passwordSchema.safeParse('UPPERCASE1!');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must contain at least one lowercase letter',
    );
  });

  it('requires at least one digit', () => {
    const result = passwordSchema.safeParse('Upperlower!');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must contain at least one digit',
    );
  });

  it('requires at least one special character', () => {
    const result = passwordSchema.safeParse('Upperlower1');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Password must contain at least one special character',
    );
  });
});
