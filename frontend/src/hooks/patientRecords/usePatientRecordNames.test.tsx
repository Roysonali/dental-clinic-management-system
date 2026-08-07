import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { usePatientRecordNames } from './usePatientRecordNames';
import { patientService } from '../../services/patientService';
import { appointmentService } from '../../services/appointmentService';
import { userService } from '../../services/userService';

vi.mock('../../services/patientService', () => ({
  patientService: { get: vi.fn() },
}));

vi.mock('../../services/appointmentService', () => ({
  appointmentService: { get: vi.fn() },
}));

vi.mock('../../services/userService', () => ({
  userService: { list: vi.fn(), get: vi.fn() },
}));

const patientGetMock = vi.mocked(patientService.get);
const appointmentGetMock = vi.mocked(appointmentService.get);
const userListMock = vi.mocked(userService.list);
const userGetMock = vi.mocked(userService.get);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

function httpError(status: number, data?: unknown): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, undefined, response);
}

function renderNamesHook(patientIds: string[] = [], appointmentIds: string[] = [], userIds: number[] = []) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePatientRecordNames(patientIds, appointmentIds, userIds), { wrapper });
}

describe('usePatientRecordNames — M-3 (batch + shared-cache name resolution)', () => {
  beforeEach(() => {
    patientGetMock.mockReset();
    appointmentGetMock.mockReset();
    userListMock.mockReset();
    userGetMock.mockReset();
  });

  it('resolves patient + appointment names via per-id lookups', async () => {
    patientGetMock.mockResolvedValue({
      id: 'p1', patient_code: 'PAT-1', full_name: 'Juan Dela Cruz',
    } as never);
    appointmentGetMock.mockResolvedValue({
      id: 'a1', appointment_number: 'APT-1',
    } as never);

    const { result } = renderNamesHook(['p1'], ['a1'], []);

    await waitFor(() => {
      expect(result.current.patientNames.get('p1')).toBe('Juan Dela Cruz');
      expect(result.current.appointmentNumbers.get('a1')).toBe('APT-1');
    });
  });

  it('batches user names through the admin directory — no per-id GET when found', async () => {
    userListMock.mockResolvedValue({
      items: [
        { id: 3, full_name: 'Dr. Reyes', email: 'r@x.com', status: 'active', is_active: true, role_id: 2, role_name: 'DOCTOR', last_login_at: null, created_at: null },
        { id: 7, full_name: 'Nurse Ana', email: 'a@x.com', status: 'active', is_active: true, role_id: 5, role_name: 'RECEPTIONIST', last_login_at: null, created_at: null },
      ],
      total: 2, page: 1, page_size: 100,
    });

    const { result } = renderNamesHook([], [], [3, 7]);

    await waitFor(() => expect(result.current.userNames.get(3)).toBe('Dr. Reyes'));
    expect(result.current.userNames.get(7)).toBe('Nurse Ana');
    expect(userListMock).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    // Found in the directory → zero per-id fallback requests.
    expect(userGetMock).not.toHaveBeenCalled();
  });

  it('non-admin (403 directory) collapses to all-null WITHOUT per-id fallback requests', async () => {
    userListMock.mockRejectedValue(
      httpError(403, { success: false, message: 'Insufficient permissions' }),
    );

    const { result } = renderNamesHook([], [], [3, 7]);

    await waitFor(() => expect(userListMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.userNames.get(3)).toBeNull());
    expect(result.current.userNames.get(7)).toBeNull();
    // The whole point: N forbidden lookups become a single one.
    expect(userGetMock).not.toHaveBeenCalled();
  });

  it('falls back to per-id GETs only for users missing from a successful directory read', async () => {
    userListMock.mockResolvedValue({
      items: [{ id: 3, full_name: 'Dr. Reyes', email: 'r@x.com', status: 'active', is_active: true, role_id: 2, role_name: 'DOCTOR', last_login_at: null, created_at: null }],
      total: 1, page: 1, page_size: 100,
    });
    userGetMock.mockResolvedValue({
      id: 9, full_name: 'Dr. Lim', email: 'l@x.com', status: 'active', is_active: true, role_id: 2, role_name: 'DOCTOR', last_login_at: null, created_at: null, updated_at: null, updated_by: null, created_by: null,
    } as never);

    const { result } = renderNamesHook([], [], [3, 9]);

    await waitFor(() => expect(result.current.userNames.get(9)).toBe('Dr. Lim'));
    expect(result.current.userNames.get(3)).toBe('Dr. Reyes');
    expect(userGetMock).toHaveBeenCalledTimes(1);
    expect(userGetMock).toHaveBeenCalledWith(9);
  });
});
