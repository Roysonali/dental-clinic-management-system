import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './userService';
import { api } from './api';
import type {
  UserActionResponse,
  UserDetailResponse,
  UserListParams,
  UserListResponse,
} from '../types/user';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const patchMock = vi.mocked(api.patch);

const response: UserListResponse = {
  items: [
    {
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active',
      is_active: true,
      role_id: 3,
      role_name: 'GENERAL_DOCTOR',
      last_login_at: null,
      created_at: '2026-07-01T08:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
};

const detail: UserDetailResponse = {
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
  updated_at: '2026-07-01T09:00:00Z',
  updated_by: 1,
};

const action: UserActionResponse = { user_id: 3, message: 'User activated successfully' };

describe('userService', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
  });

  describe('list', () => {
    it('GETs /users with the given params and returns the list', async () => {
      getMock.mockResolvedValue({ data: response });
      const params: UserListParams = { search: 'rizal', role_id: 3, status: 'active', page: 1, page_size: 10 };

      await expect(userService.list(params)).resolves.toEqual(response);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/users', { params });
    });

    it('passes an empty params object when no params are provided', async () => {
      getMock.mockResolvedValue({ data: response });

      await expect(userService.list()).resolves.toEqual(response);

      expect(getMock).toHaveBeenCalledWith('/users', { params: {} });
    });
  });

  describe('get', () => {
    it('GETs /users/{user_id} and returns the detail record', async () => {
      getMock.mockResolvedValue({ data: detail });

      await expect(userService.get(3)).resolves.toEqual(detail);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/users/3');
    });
  });

  describe('changeRole', () => {
    it('PATCHes /users/{user_id}/role with { role_id } and returns the action response', async () => {
      patchMock.mockResolvedValue({ data: { user_id: 3, message: 'Role updated successfully' } });

      await expect(userService.changeRole(3, 5)).resolves.toEqual({
        user_id: 3,
        message: 'Role updated successfully',
      });

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/users/3/role', { role_id: 5 });
    });
  });

  describe('activate / deactivate', () => {
    it('PATCHes /users/{user_id}/activate with NO request body', async () => {
      patchMock.mockResolvedValue({ data: action });

      await expect(userService.activate(3)).resolves.toEqual(action);

      expect(patchMock).toHaveBeenCalledWith('/users/3/activate');
    });

    it('PATCHes /users/{user_id}/deactivate with NO request body', async () => {
      patchMock.mockResolvedValue({ data: action });

      await expect(userService.deactivate(3)).resolves.toEqual(action);

      expect(patchMock).toHaveBeenCalledWith('/users/3/deactivate');
    });
  });

  describe('listUsers (deprecated alias)', () => {
    it('delegates to list with identical params', async () => {
      getMock.mockResolvedValue({ data: response });
      const params: UserListParams = { page: 1, page_size: 10 };

      await expect(userService.listUsers(params)).resolves.toEqual(response);

      expect(getMock).toHaveBeenCalledWith('/users', { params });
    });
  });
});
