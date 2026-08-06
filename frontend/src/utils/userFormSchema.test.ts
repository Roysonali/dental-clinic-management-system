import { describe, it, expect } from 'vitest';
import { roleAssignmentSchema } from './userFormSchema';

describe('roleAssignmentSchema (mirrors backend ChangeRoleRequest role_id > 0)', () => {
  it('accepts a positive integer role id', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: '5' });
    expect(result.success).toBe(true);
  });

  it('accepts the smallest valid role id (backend gt=0)', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: '1' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty selection', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Role is required');
    }
  });

  it('rejects zero (backend Field(gt=0))', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects negative role ids', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: '-1' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const result = roleAssignmentSchema.safeParse({ role_id: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing field', () => {
    const result = roleAssignmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
