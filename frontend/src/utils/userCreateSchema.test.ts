import { describe, it, expect } from 'vitest';
import { userCreateSchema } from './userCreateSchema';

/**
 * Valid input that satisfies every backend rule.
 *
 * NOTE: the email deliberately has NO surrounding whitespace — zod's
 * `.email()` (like the backend `EmailStr`) rejects padded emails, so the
 * schema only lowercases already-valid emails (mirroring the backend
 * `normalize_email`, which also runs after `EmailStr` validation).
 */
const valid = {
  full_name: '  Juan   Dela Cruz ',
  email: 'JUAN@Example.COM',
  password: 'Secure@Pass1',
  role_id: '3',
};

describe('userCreateSchema', () => {
  describe('full_name', () => {
    it('requires full_name', () => {
      const result = userCreateSchema.safeParse({ ...valid, full_name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects names shorter than 2 characters (backend min_length=2)', () => {
      const result = userCreateSchema.safeParse({ ...valid, full_name: 'A' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Full name must be at least 2 characters',
      );
    });

    it('rejects names longer than 100 characters (backend max_length=100)', () => {
      const result = userCreateSchema.safeParse({
        ...valid,
        full_name: 'J'.repeat(101),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Full name must not exceed 100 characters',
      );
    });

    it('normalizes whitespace like the backend normalize_full_name', () => {
      const result = userCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(result.data?.full_name).toBe('Juan Dela Cruz');
    });
  });

  describe('email', () => {
    it('requires email', () => {
      const result = userCreateSchema.safeParse({ ...valid, email: '' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('Email address is required');
    });

    it('rejects invalid emails (backend EmailStr)', () => {
      const result = userCreateSchema.safeParse({ ...valid, email: 'not-an-email' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Please enter a valid email address',
      );
    });

    it('normalizes to lowercase like the backend normalize_email', () => {
      const result = userCreateSchema.safeParse(valid);
      expect(result.data?.email).toBe('juan@example.com');
    });
  });

  describe('password (backend 8–128 + upper/lower/digit/special)', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const result = userCreateSchema.safeParse({ ...valid, password: 'Ab1!2a' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must be at least 8 characters',
      );
    });

    it('rejects passwords longer than 128 characters', () => {
      const result = userCreateSchema.safeParse({
        ...valid,
        password: `${'Ab1!'.repeat(40)}x`, // 161 chars
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must not exceed 128 characters',
      );
    });

    it('requires at least one uppercase letter', () => {
      const result = userCreateSchema.safeParse({ ...valid, password: 'lowercase1!' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must contain at least one uppercase letter',
      );
    });

    it('requires at least one lowercase letter', () => {
      const result = userCreateSchema.safeParse({ ...valid, password: 'UPPERCASE1!' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must contain at least one lowercase letter',
      );
    });

    it('requires at least one digit', () => {
      const result = userCreateSchema.safeParse({ ...valid, password: 'Upperlower!' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must contain at least one digit',
      );
    });

    it('requires at least one special character', () => {
      const result = userCreateSchema.safeParse({ ...valid, password: 'Upperlower1' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Password must contain at least one special character',
      );
    });

    it('accepts a fully compliant password', () => {
      const result = userCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(result.data?.password).toBe('Secure@Pass1');
    });
  });

  describe('role_id', () => {
    it('requires a role (backend approve requires role_id)', () => {
      const result = userCreateSchema.safeParse({ ...valid, role_id: '' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('Role is required');
    });

    it('rejects non-numeric role ids', () => {
      const result = userCreateSchema.safeParse({ ...valid, role_id: 'admin' });
      expect(result.success).toBe(false);
    });

    it('rejects role ids below 1 (backend gt=0)', () => {
      const result = userCreateSchema.safeParse({ ...valid, role_id: '0' });
      expect(result.success).toBe(false);
    });

    it('accepts a positive numeric role id', () => {
      const result = userCreateSchema.safeParse(valid);
      expect(result.data?.role_id).toBe('3');
    });
  });
});
