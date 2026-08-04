import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);

const loginResponse = {
  access_token: 'jwt-token',
  token_type: 'bearer',
};

const registerResponse = {
  message: 'Registration submitted. Waiting for admin approval.',
};

const currentUser = {
  id: 1,
  full_name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  status: 'active' as const,
};

const pendingUser = {
  id: 2,
  full_name: 'Maria Santos',
  email: 'maria@example.com',
  status: 'pending' as const,
};

const approvalResponse = { message: 'User approved successfully.' };

describe('authService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  describe('login', () => {
    it('POSTs form-encoded username/password to /auth/login', async () => {
      postMock.mockResolvedValue({ data: loginResponse });

      await expect(authService.login('juan@example.com', 'Secret@1')).resolves.toEqual(
        loginResponse,
      );

      expect(postMock).toHaveBeenCalledTimes(1);
      const [url, body] = postMock.mock.calls[0] as [string, URLSearchParams];
      expect(url).toBe('/auth/login');
      expect(body).toBeInstanceOf(URLSearchParams);
      expect(body.get('username')).toBe('juan@example.com');
      expect(body.get('password')).toBe('Secret@1');
    });
  });

  describe('register', () => {
    it('POSTs the JSON payload to /auth/register', async () => {
      postMock.mockResolvedValue({ data: registerResponse });
      const payload = {
        full_name: 'Juan Dela Cruz',
        email: 'juan@example.com',
        password: 'Secret@1',
      };

      await expect(authService.register(payload)).resolves.toEqual(registerResponse);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/auth/register', payload);
    });
  });

  describe('getMe', () => {
    it('GETs /auth/me and returns the profile', async () => {
      getMock.mockResolvedValue({ data: currentUser });

      await expect(authService.getMe()).resolves.toEqual(currentUser);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('fetchPendingUsers', () => {
    it('GETs /auth/users/pending and returns the list', async () => {
      getMock.mockResolvedValue({ data: [pendingUser] });

      await expect(authService.fetchPendingUsers()).resolves.toEqual([pendingUser]);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/auth/users/pending');
    });
  });

  describe('approveUser', () => {
    it('PATCHes /auth/users/{id}/approve with { role_id }', async () => {
      patchMock.mockResolvedValue({ data: approvalResponse });

      await expect(authService.approveUser(2, 6)).resolves.toEqual(approvalResponse);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/auth/users/2/approve', { role_id: 6 });
    });
  });

  describe('deactivateUser', () => {
    it('PATCHes /auth/users/{id}/deactivate', async () => {
      patchMock.mockResolvedValue({ data: approvalResponse });

      await expect(authService.deactivateUser(2)).resolves.toEqual(approvalResponse);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/auth/users/2/deactivate');
    });
  });

  describe('error handling', () => {
    it('propagates axios request errors to the caller', async () => {
      postMock.mockRejectedValue(new Error('Network Error'));

      await expect(authService.login('a@b.com', 'x')).rejects.toThrow('Network Error');
    });

    it('propagates backend HTTP errors (e.g. 401 invalid credentials)', async () => {
      postMock.mockRejectedValue(new Error('Request failed with status code 401'));

      await expect(authService.login('a@b.com', 'wrong')).rejects.toThrow('status code 401');
    });
  });
});
