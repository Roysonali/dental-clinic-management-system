import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import {
  useActivateDoctor,
  useCreateDoctor,
  useDeactivateDoctor,
  useToggleAvailability,
  useToggleLeave,
  useUpdateDoctor,
  useReplaceWeekSchedule,
  useCreateDoctorSchedule,
  useUpdateDoctorSchedule,
  useDeleteDoctorSchedule,
} from './useDoctorMutations';
import { useDoctors } from './useDoctors';
import type { DoctorCreateRequest, DoctorResponse, DayOfWeek, ScheduleResponse } from '../../types/doctor';

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggleLeave: vi.fn(),
    toggleAvailability: vi.fn(),
    replaceWeekSchedule: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
  },
}));

const listMock = vi.mocked(doctorService.list);
const createMock = vi.mocked(doctorService.create);
const updateMock = vi.mocked(doctorService.update);
const activateMock = vi.mocked(doctorService.activate);
const deactivateMock = vi.mocked(doctorService.deactivate);
const toggleLeaveMock = vi.mocked(doctorService.toggleLeave);
const toggleAvailabilityMock = vi.mocked(doctorService.toggleAvailability);
const replaceWeekScheduleMock = vi.mocked(doctorService.replaceWeekSchedule);
const createScheduleMock = vi.mocked(doctorService.createSchedule);
const updateScheduleMock = vi.mocked(doctorService.updateSchedule);
const deleteScheduleMock = vi.mocked(doctorService.deleteSchedule);

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: null,
  gender: null,
  primary_phone: '+639171234567',
  address: null,
  qualification: null,
  registration_number: null,
  years_of_experience: null,
  consultation_fee: null,
  consultation_duration: null,
  languages_known: null,
  profile_photo_url: null,
  biography: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [],
  created_by: null,
  updated_by: null,
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
};

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Harness: mounts the doctor list query alongside one create mutation. */
function Harness() {
  const doctors = useDoctors(true);
  const create = useCreateDoctor();
  return (
    <div>
      <span data-testid="count">{doctors.data?.total ?? -1}</span>
      <button
        onClick={() =>
          create.mutate({ user_id: 3, primary_phone: '+639171234567' } satisfies DoctorCreateRequest)
        }
      >
        create
      </button>
    </div>
  );
}

describe('useDoctorMutations', () => {
  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    activateMock.mockReset();
    deactivateMock.mockReset();
    toggleLeaveMock.mockReset();
    toggleAvailabilityMock.mockReset();
    replaceWeekScheduleMock.mockReset();
    createScheduleMock.mockReset();
    updateScheduleMock.mockReset();
    deleteScheduleMock.mockReset();
  });

  it('useCreateDoctor posts the payload and invalidates the doctor list (refetch)', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    createMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const user = userEvent.setup();
    render(<Harness />, { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    const callsBeforeMutation = listMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'create' }));

    expect(createMock).toHaveBeenCalledWith({ user_id: 3, primary_phone: '+639171234567' });
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBeforeMutation),
    );
  });

  it('useUpdateDoctor calls update with id + partial payload', async () => {
    updateMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUpdateDoctor(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate({ id: 'd1', payload: { years_of_experience: 11 } });

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('d1', { years_of_experience: 11 }));
  });

  it('useActivateDoctor calls activate(id)', async () => {
    activateMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useActivateDoctor(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate('d1');

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith('d1'));
  });

  it('useDeactivateDoctor calls deactivate(id)', async () => {
    deactivateMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDeactivateDoctor(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate('d1');

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith('d1'));
  });

  it('useToggleLeave calls toggleLeave(id)', async () => {
    toggleLeaveMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useToggleLeave(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate('d1');

    await waitFor(() => expect(toggleLeaveMock).toHaveBeenCalledWith('d1'));
  });

  it('useToggleAvailability calls toggleAvailability(id)', async () => {
    toggleAvailabilityMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useToggleAvailability(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate('d1');

    await waitFor(() => expect(toggleAvailabilityMock).toHaveBeenCalledWith('d1'));
  });

  it('propagates mutation errors to the mutation result', async () => {
    activateMock.mockRejectedValue(new Error('Activation failed'));
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useActivateDoctor(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate('d1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  /* ── Schedule Mutations ─────────────────────────────────────────── */

  const scheduleResponse: ScheduleResponse = {
    id: 's1',
    doctor_id: 'd1',
    day_of_week: 0 as DayOfWeek,
    start_time: '10:00:00',
    end_time: '13:00:00',
    is_active: true,
  };

  it('useReplaceWeekSchedule calls replaceWeekSchedule with doctorId and schedules', async () => {
    replaceWeekScheduleMock.mockResolvedValue([scheduleResponse]);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useReplaceWeekSchedule(), { wrapper: makeWrapper(queryClient) });
    const schedules = [{ day_of_week: 0 as const, start_time: '10:00', end_time: '13:00' }];
    result.current.mutate({ doctorId: 'd1', schedules });

    await waitFor(() => expect(replaceWeekScheduleMock).toHaveBeenCalledWith('d1', schedules));
  });

  it('useReplaceWeekSchedule invalidates doctor queries on success', async () => {
    replaceWeekScheduleMock.mockResolvedValue([scheduleResponse]);
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useReplaceWeekSchedule(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate({ doctorId: 'd1', schedules: [] });

    await waitFor(() => expect(replaceWeekScheduleMock).toHaveBeenCalled());
  });

  it('useCreateDoctorSchedule calls createSchedule with doctorId and payload', async () => {
    createScheduleMock.mockResolvedValue(scheduleResponse);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useCreateDoctorSchedule(), { wrapper: makeWrapper(queryClient) });
    const payload = { day_of_week: 0 as const, start_time: '10:00', end_time: '13:00' };
    result.current.mutate({ doctorId: 'd1', payload });

    await waitFor(() => expect(createScheduleMock).toHaveBeenCalledWith('d1', payload));
  });

  it('useUpdateDoctorSchedule calls updateSchedule with doctorId, scheduleId, and payload', async () => {
    updateScheduleMock.mockResolvedValue(scheduleResponse);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUpdateDoctorSchedule(), { wrapper: makeWrapper(queryClient) });
    const payload = { start_time: '09:00' };
    result.current.mutate({ doctorId: 'd1', scheduleId: 's1', payload });

    await waitFor(() => expect(updateScheduleMock).toHaveBeenCalledWith('d1', 's1', payload));
  });

  it('useDeleteDoctorSchedule calls deleteSchedule with doctorId and scheduleId', async () => {
    deleteScheduleMock.mockResolvedValue(undefined);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDeleteDoctorSchedule(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate({ doctorId: 'd1', scheduleId: 's1' });

    await waitFor(() => expect(deleteScheduleMock).toHaveBeenCalledWith('d1', 's1'));
  });

  it('useReplaceWeekSchedule propagates errors', async () => {
    replaceWeekScheduleMock.mockRejectedValue(new Error('Overlap detected'));
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useReplaceWeekSchedule(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate({ doctorId: 'd1', schedules: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
