import { describe, it, expect } from 'vitest';
import {
  isRoleUnchanged,
  responseToRoleForm,
  roleFormToPayload,
} from './userFormUtils';
import type { UserDetailResponse } from '../types/user';

const user: UserDetailResponse = {
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: null,
  created_by: 1,
  created_at: '2026-07-01T08:00:00Z',
  updated_at: null,
  updated_by: null,
};

describe('userFormUtils', () => {
  describe('responseToRoleForm', () => {
    it('maps the current role id into an editable form value', () => {
      expect(responseToRoleForm(user)).toEqual({ role_id: '3' });
    });

    it('maps a role-less user (role_id null) to an empty selection', () => {
      expect(responseToRoleForm({ role_id: null })).toEqual({ role_id: '' });
    });

    it('works with list rows (UserListItem shape) too', () => {
      expect(responseToRoleForm({ role_id: 6 })).toEqual({ role_id: '6' });
    });
  });

  describe('roleFormToPayload', () => {
    it('parses the role id string into the ChangeRoleRequest payload', () => {
      expect(roleFormToPayload({ role_id: '5' })).toEqual({ role_id: 5 });
    });
  });

  describe('isRoleUnchanged', () => {
    it('returns true when the selected role equals the current role', () => {
      expect(isRoleUnchanged({ role_id: '3' }, 3)).toBe(true);
    });

    it('returns false when the role changes', () => {
      expect(isRoleUnchanged({ role_id: '5' }, 3)).toBe(false);
    });

    it('returns false for an empty selection', () => {
      expect(isRoleUnchanged({ role_id: '' }, 3)).toBe(false);
    });

    it('returns false when the user has no current role', () => {
      expect(isRoleUnchanged({ role_id: '3' }, null)).toBe(false);
    });

    it('returns false for invalid (non-positive) input', () => {
      expect(isRoleUnchanged({ role_id: '0' }, 0)).toBe(false);
    });
  });
});
