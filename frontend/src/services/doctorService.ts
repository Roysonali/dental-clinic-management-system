import { api } from './api';
import type {
  DoctorCreateRequest,
  DoctorListParams,
  DoctorListResponse,
  DoctorProfileResponse,
  DoctorResponse,
  DoctorUpdateRequest,
  DoctorUserResponse,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleResponse,
  SpecializationListParams,
  SpecializationListResponse,
} from '../types/doctor';

/* ── Wire normalization ─────────────────────────────────────────────────── */

/**
 * Wire shape of a doctor record as delivered by the API.
 *
 * The backend types `consultation_fee` as `Decimal` (`schemas.py`), and
 * Pydantic v2 serializes `Decimal` values to JSON **strings** (e.g.
 * `"800.00"`) so precision is preserved on the wire. The frontend domain
 * contract (`DoctorResponse.consultation_fee`) is `number | null`, so the
 * service layer — the boundary between the wire format and the UI — converts
 * it here. This keeps every consumer (table, cards, sort comparators, forms)
 * operating on a real number without scattering conversions through
 * components.
 */
interface DoctorResponseDto extends Omit<DoctorResponse, 'consultation_fee'> {
  consultation_fee?: string | number | null;
}

/** Normalize a raw fee value into the domain type; non-numeric → null. */
function toFeeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Normalize a raw doctor record into the typed `DoctorResponse`. */
function normalizeDoctor(dto: DoctorResponseDto): DoctorResponse {
  const { consultation_fee, ...rest } = dto;
  return { ...rest, consultation_fee: toFeeNumber(consultation_fee) };
}

/** Normalize every record in a paginated list response. */
function normalizeDoctorList(dto: DoctorListResponse): DoctorListResponse {
  return { ...dto, items: dto.items.map(normalizeDoctor) };
}

/**
 * Doctor API service.
 *
 * Endpoints mirror backend `app/modules/doctors/routes.py` exactly:
 * - GET    /doctors                            → paginated list (admin/receptionist only)
 * - POST   /doctors                            → create (201, admin only)
 * - GET    /doctors/{id}                       → single doctor
 * - GET    /doctors/user/{user_id}             → doctor by linked user (appointment consumer)
 * - PATCH  /doctors/{id}                       → partial update (admin)
 * - DELETE /doctors/{id}                       → hard delete (204, admin only)
 * - PATCH  /doctors/{id}/activate              → activate (admin)
 * - PATCH  /doctors/{id}/deactivate            → deactivate (admin)
 * - PATCH  /doctors/{id}/leave                 → toggle on_leave (admin, NO body)
 * - PATCH  /doctors/{id}/availability          → toggle availability (admin, NO body)
 * - GET    /doctors/{id}/profile               → profile incl. schedules + specializations
 * - GET    /specializations                    → paginated specialization list
 *
 * Schedule CRUD endpoints are intentionally NOT exposed yet (Phase 2).
 */
export const doctorService = {
  /** GET /doctors?page=&page_size=&search=&is_active=&is_available=&specialization_id=&sort_by=&sort_order= */
  async list(params: DoctorListParams = {}): Promise<DoctorListResponse> {
    const { data } = await api.get<DoctorListResponse>('/doctors', { params });
    return normalizeDoctorList(data);
  },

  /** GET /doctors/{id} */
  async get(id: string): Promise<DoctorResponse> {
    const { data } = await api.get<DoctorResponse>(`/doctors/${id}`);
    return normalizeDoctor(data);
  },

  /** GET /doctors/user/{user_id} */
  async getByUserId(userId: number): Promise<DoctorUserResponse> {
    const { data } = await api.get<DoctorUserResponse>(`/doctors/user/${userId}`);
    return data;
  },

  /** GET /doctors/{id}/profile — details-page source (profile + schedules + specializations). */
  async getProfile(id: string): Promise<DoctorProfileResponse> {
    const { data } = await api.get<DoctorProfileResponse>(`/doctors/${id}/profile`);
    return { ...normalizeDoctor(data), schedules: data.schedules };
  },

  /** POST /doctors (201) — admin only. */
  async create(payload: DoctorCreateRequest): Promise<DoctorResponse> {
    const { data } = await api.post<DoctorResponse>('/doctors', payload);
    return normalizeDoctor(data);
  },

  /** PATCH /doctors/{id} — partial update, admin only. */
  async update(id: string, payload: DoctorUpdateRequest): Promise<DoctorResponse> {
    const { data } = await api.patch<DoctorResponse>(`/doctors/${id}`, payload);
    return normalizeDoctor(data);
  },

  /** PATCH /doctors/{id}/activate — admin only. */
  async activate(id: string): Promise<DoctorResponse> {
    const { data } = await api.patch<DoctorResponse>(`/doctors/${id}/activate`);
    return normalizeDoctor(data);
  },

  /** PATCH /doctors/{id}/deactivate — admin only. */
  async deactivate(id: string): Promise<DoctorResponse> {
    const { data } = await api.patch<DoctorResponse>(`/doctors/${id}/deactivate`);
    return normalizeDoctor(data);
  },

  /** PATCH /doctors/{id}/leave — toggles on_leave; NO request body. */
  async toggleLeave(id: string): Promise<DoctorResponse> {
    const { data } = await api.patch<DoctorResponse>(`/doctors/${id}/leave`);
    return normalizeDoctor(data);
  },

  /** PATCH /doctors/{id}/availability — toggles availability; NO request body. */
  async toggleAvailability(id: string): Promise<DoctorResponse> {
    const { data } = await api.patch<DoctorResponse>(`/doctors/${id}/availability`);
    return normalizeDoctor(data);
  },

  /**
   * DELETE /doctors/{id} — hard delete (204), admin only.
   *
   * NOTE: implemented for Phase 1A contract completeness but NOT surfaced
   * in any UI until Phase 2 (blueprint decision D-2). The backend performs
   * a permanent delete with no dependency guard.
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/doctors/${id}`);
  },

  /* ── Schedule CRUD ───────────────────────────────────────────────────── */

  /** GET /doctors/{id}/schedules — list all schedule entries for a doctor. */
  async listSchedules(doctorId: string): Promise<ScheduleResponse[]> {
    const { data } = await api.get<ScheduleResponse[]>(`/doctors/${doctorId}/schedules`);
    return data;
  },

  /** POST /doctors/{id}/schedules — create a single schedule entry. */
  async createSchedule(doctorId: string, payload: ScheduleCreateRequest): Promise<ScheduleResponse> {
    const { data } = await api.post<ScheduleResponse>(`/doctors/${doctorId}/schedules`, payload);
    return data;
  },

  /** PATCH /doctors/{id}/schedules/{sid} — partial update a schedule entry. */
  async updateSchedule(
    doctorId: string,
    scheduleId: string,
    payload: ScheduleUpdateRequest,
  ): Promise<ScheduleResponse> {
    const { data } = await api.patch<ScheduleResponse>(
      `/doctors/${doctorId}/schedules/${scheduleId}`,
      payload,
    );
    return data;
  },

  /** DELETE /doctors/{id}/schedules/{sid} — delete a schedule entry. */
  async deleteSchedule(doctorId: string, scheduleId: string): Promise<void> {
    await api.delete(`/doctors/${doctorId}/schedules/${scheduleId}`);
  },

  /** PUT /doctors/{id}/schedules — atomically replace entire weekly schedule. */
  async replaceWeekSchedule(
    doctorId: string,
    schedules: ScheduleCreateRequest[],
  ): Promise<ScheduleResponse[]> {
    const { data } = await api.put<ScheduleResponse[]>(`/doctors/${doctorId}/schedules`, schedules);
    return data;
  },

  /** GET /specializations — filter dropdown / master data. */
  async listSpecializations(params: SpecializationListParams = {}): Promise<SpecializationListResponse> {
    const { data } = await api.get<SpecializationListResponse>('/specializations', { params });
    return data;
  },
};
