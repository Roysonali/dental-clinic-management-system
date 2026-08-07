import { describe, it, expect, vi, beforeEach } from 'vitest';
import { procedureService } from './procedureService';
import { api } from './api';
import type { ProcedureCreateRequest, ProcedureUpdateRequest } from '../types/procedure';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const procedure = {
  id: 1,
  code: 'PROPHY',
  name: 'Prophylaxis',
  category: 'preventive',
  default_cost: 1200,
  is_active: true,
  description: 'Cleaning',
} as const;

const listResponse = { items: [procedure], total: 1, page: 1, page_size: 20, total_pages: 1 };

describe('procedureService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  describe('list', () => {
    it('GETs /procedures with category/is_active params', async () => {
      getMock.mockResolvedValue({ data: listResponse });

      await expect(procedureService.list({ page: 1, page_size: 20, category: 'preventive', is_active: true }))
        .resolves.toEqual(listResponse);
      expect(getMock).toHaveBeenCalledWith('/procedures', {
        params: { page: 1, page_size: 20, category: 'preventive', is_active: true },
      });
    });
  });

  describe('search', () => {
    it('GETs /procedures/search with term + limit', async () => {
      getMock.mockResolvedValue({ data: [procedure] });

      await expect(procedureService.search('PRO', 10)).resolves.toEqual([procedure]);
      expect(getMock).toHaveBeenCalledWith('/procedures/search', { params: { term: 'PRO', limit: 10 } });
    });
  });

  describe('listActive', () => {
    it('GETs /procedures/active', async () => {
      getMock.mockResolvedValue({ data: [procedure] });

      await expect(procedureService.listActive()).resolves.toEqual([procedure]);
      expect(getMock).toHaveBeenCalledWith('/procedures/active');
    });
  });

  describe('create / update', () => {
    it('POSTs /procedures with the create payload', async () => {
      postMock.mockResolvedValue({ data: procedure });
      const payload: ProcedureCreateRequest = { code: 'prophy', name: 'Prophylaxis', default_cost: 1200, category: 'preventive' };

      await expect(procedureService.create(payload)).resolves.toEqual(procedure);
      expect(postMock).toHaveBeenCalledWith('/procedures', payload);
    });

    it('PATCHes /procedures/{id} with the update payload (no code)', async () => {
      patchMock.mockResolvedValue({ data: procedure });
      const payload: ProcedureUpdateRequest = { name: 'Prophylaxis', default_cost: 1300 };

      await expect(procedureService.update(1, payload)).resolves.toEqual(procedure);
      expect(patchMock).toHaveBeenCalledWith('/procedures/1', payload);
    });
  });

  describe('activate / deactivate / delete', () => {
    it('PATCHes /procedures/{id}/activate', async () => {
      patchMock.mockResolvedValue({ data: procedure });

      await procedureService.activate(1);
      expect(patchMock).toHaveBeenCalledWith('/procedures/1/activate');
    });

    it('PATCHes /procedures/{id}/deactivate', async () => {
      patchMock.mockResolvedValue({ data: { ...procedure, is_active: false } });

      await procedureService.deactivate(1);
      expect(patchMock).toHaveBeenCalledWith('/procedures/1/deactivate');
    });

    it('DELETEs /procedures/{id} (204 → resolves)', async () => {
      deleteMock.mockResolvedValue({});

      await expect(procedureService.delete(1)).resolves.toBeUndefined();
      expect(deleteMock).toHaveBeenCalledWith('/procedures/1');
    });
  });

  describe('error handling', () => {
    it('propagates axios errors (e.g. 409 delete-active-procedure)', async () => {
      deleteMock.mockRejectedValue(new Error('Request failed with status code 409'));

      await expect(procedureService.delete(1)).rejects.toThrow('status code 409');
    });
  });

  describe('wire contract — F-03', () => {
    it('serializes procedure default_cost as a JSON number (Decimal-as-number)', async () => {
      // Exact shape the backend serializes for ProcedureResponse —
      // `default_cost` is a Decimal serialized as a JSON number.
      getMock.mockResolvedValue({
        data: {
          items: [
            {
              id: 1,
              code: 'PROPHY',
              name: 'Prophylaxis',
              category: 'preventive',
              default_cost: 1200.0,
              is_active: true,
              description: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        },
      });

      const page = await procedureService.list({ page: 1, page_size: 20 });
      expect(typeof page.items[0].default_cost).toBe('number');
    });
  });
});
