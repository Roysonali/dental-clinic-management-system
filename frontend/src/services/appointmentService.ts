import { api } from './api';
import type {
  AppointmentCreatePayload,
  AppointmentListParams,
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentUpdatePayload,
  CalendarAppointmentListResponse,
  CalendarAppointmentParams,
} from '../types/appointment';

/**
 * Appointment API service.
 *
 * Endpoints mirror backend `app/modules/appointments/router.py`:
 * - GET    /appointments          -> paginated list (skip, limit)
 * - POST   /appointments          -> create (201)
 * - GET    /appointments/today    -> today's appointments (array)
 * - GET    /appointments/{id}     -> single appointment (UUID path param)
 * - PUT    /appointments/{id}     -> update (reschedule / edit)
 * - PATCH  /appointments/{id}/cancel -> cancel
 *
 * The backend returns plain objects (no `{success, data}` envelope), so each
 * method destructures `data` and returns it as-is. Errors bubble as Axios
 * errors for `parseApiError`.
 */
export const appointmentService = {
  /** GET /appointments?skip=&limit= */
  async list(params: AppointmentListParams = {}): Promise<AppointmentListResponse> {
    const { data } = await api.get<AppointmentListResponse>('/appointments', { params });
    return data;
  },

  /** GET /patients/{patientId}/appointments?skip=&limit= */
  async listByPatient(
    patientId: string,
    params: AppointmentListParams = {},
  ): Promise<AppointmentListResponse> {
    const { data } = await api.get<AppointmentListResponse>(
      `/patients/${patientId}/appointments`,
      { params },
    );
    return data;
  },

  /** POST /appointments (201) */
  async create(payload: AppointmentCreatePayload): Promise<AppointmentResponse> {
    const { data } = await api.post<AppointmentResponse>('/appointments', payload);
    return data;
  },

  /** GET /appointments/today */
  async today(): Promise<AppointmentResponse[]> {
    const { data } = await api.get<AppointmentResponse[]>('/appointments/today');
    return data;
  },

  /** GET /appointments/{id} */
  async get(id: string): Promise<AppointmentResponse> {
    const { data } = await api.get<AppointmentResponse>(`/appointments/${id}`);
    return data;
  },

  /** PUT /appointments/{id} — partial edit (reschedule etc.) */
  async update(
    id: string,
    payload: AppointmentUpdatePayload,
  ): Promise<AppointmentResponse> {
    const { data } = await api.put<AppointmentResponse>(`/appointments/${id}`, payload);
    return data;
  },

  /** PATCH /appointments/{id}/cancel */
  async cancel(id: string): Promise<AppointmentResponse> {
    const { data } = await api.patch<AppointmentResponse>(`/appointments/${id}/cancel`);
    return data;
  },

  /** GET /appointments/calendar?start=&end=&dentist_id=&status= */
  async calendar(params: CalendarAppointmentParams): Promise<CalendarAppointmentListResponse> {
    const { data } = await api.get<CalendarAppointmentListResponse>('/appointments/calendar', { params });
    return data;
  },
};
