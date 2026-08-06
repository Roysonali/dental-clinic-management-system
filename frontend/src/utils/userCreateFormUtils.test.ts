import { describe, it, expect } from 'vitest';
import {
  roleIdFromUserCreateForm,
  userCreateFormToRegisterPayload,
  userRoleLabelFromId,
} from './userCreateFormUtils';
import type { UserCreateFormValues } from '../types/user';

const values: UserCreateFormValues = {
  full_name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  password: 'Secure@Pass1',
  role_id: '3',
};

describe('userCreateFormToRegisterPayload', () => {
  it('maps only the fields accepted by POST /auth/register', () => {
    const payload = userCreateFormToRegisterPayload(values);
    expect(payload).toEqual({
      full_name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      password: 'Secure@Pass1',
    });
  });

  it('excludes role_id from the register payload (backend UserRegister is extra="forbid")', () => {
    const payload = userCreateFormToRegisterPayload(values);
    expect('role_id' in payload).toBe(false);
  });
});

describe('roleIdFromUserCreateForm', () => {
  it('parses the numeric-string select value', () => {
    expect(roleIdFromUserCreateForm(values)).toBe(3);
    expect(roleIdFromUserCreateForm({ ...values, role_id: '7' })).toBe(7);
  });
});

describe('userRoleLabelFromId', () => {
  it('resolves seeded role ids to their display labels', () => {
    expect(userRoleLabelFromId(1)).toBe('Administrator');
    expect(userRoleLabelFromId(6)).toBe('Receptionist');
  });

  it('falls back gracefully for unknown ids', () => {
    expect(userRoleLabelFromId(999)).toBe('Role #999');
  });
});
