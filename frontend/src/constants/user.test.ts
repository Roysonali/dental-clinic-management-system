import { describe, it, expect } from 'vitest';
import {
  ROLE_ID_MIN,
  USER_LIST_PAGE_SIZE,
  USER_LIST_STALE_TIME_MS,
  USER_MAX_PAGE_SIZE,
  USER_ROLE_OPTIONS,
  USER_SEARCH_DEBOUNCE_MS,
  USER_SEARCH_PAGE_SIZE,
  USER_SEARCH_STALE_TIME_MS,
  USER_STATUS_FILTERS,
  USER_STATUS_LABELS,
} from './user';
import { ROLE_IDS, ROLE_LABELS } from './roles';

describe('user constants', () => {
  describe('pagination (backend GET /users defaults)', () => {
    it('uses backend default page_size 10 with max 100', () => {
      expect(USER_LIST_PAGE_SIZE).toBe(10);
      expect(USER_MAX_PAGE_SIZE).toBe(100);
    });

    it('defines a list stale time for the module list page', () => {
      expect(USER_LIST_STALE_TIME_MS).toBe(30_000);
    });
  });

  describe('search (shared UserSearchSelect foundation)', () => {
    it('debounces at 350ms with backend default page size 10', () => {
      expect(USER_SEARCH_DEBOUNCE_MS).toBe(350);
      expect(USER_SEARCH_PAGE_SIZE).toBe(10);
    });

    it('keeps search results fresh for 60s', () => {
      expect(USER_SEARCH_STALE_TIME_MS).toBe(60_000);
    });
  });

  describe('validation limits (backend schemas.py)', () => {
    it('mirrors ChangeRoleRequest role_id Field(gt=0)', () => {
      expect(ROLE_ID_MIN).toBe(1);
    });
  });

  describe('role options (no GET /roles endpoint — derived from seeded constants)', () => {
    it('covers every seeded role with its id and display label', () => {
      expect(USER_ROLE_OPTIONS.map((o) => Number(o.value))).toEqual(
        Object.values(ROLE_IDS).sort((a, b) => a - b),
      );
      expect(USER_ROLE_OPTIONS.map((o) => o.label)).toEqual(
        (Object.entries(ROLE_IDS) as [keyof typeof ROLE_IDS, number][])
          .sort((a, b) => a[1] - b[1])
          .map(([role]) => ROLE_LABELS[role]),
      );
    });

    it('exports role ids as strings for the Select value contract', () => {
      expect(USER_ROLE_OPTIONS.every((o) => typeof o.value === 'string')).toBe(true);
      expect(USER_ROLE_OPTIONS[0]).toEqual({ value: String(ROLE_IDS.ADMIN), label: ROLE_LABELS.ADMIN });
    });
  });

  describe('status filters / labels (backend lifecycle statuses)', () => {
    it('covers the UI all sentinel plus every backend status', () => {
      expect(USER_STATUS_FILTERS.map((f) => f.value)).toEqual([
        'all',
        'pending',
        'active',
        'inactive',
      ]);
      expect(USER_STATUS_FILTERS.map((f) => f.label)).toEqual([
        'All',
        'Pending',
        'Active',
        'Inactive',
      ]);
    });

    it('labels every backend lifecycle status', () => {
      expect(USER_STATUS_LABELS).toEqual({
        pending: 'Pending',
        active: 'Active',
        inactive: 'Inactive',
      });
    });
  });
});
