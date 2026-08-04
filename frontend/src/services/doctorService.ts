import { api } from './api';
import type {
  DoctorListParams,
  DoctorListResponse,
  DoctorUserResponse,
} from '../types/doctor';

/**
 * Doctor API service.
 *
 * Endpoints mirror backend `app/modules/doctors/routes.py`:
 * - GET /doctors            -> paginated list (admin/receptionist only)
 * - GET /doctors/user/{id}  -> doctor profile (with `user_full_name`)
 *
 * The appointment module consumes both: the list populates the dentist
 * dropdown in the create/edit form, and `getByUserId` resolves the display
 * name for a single appointment row.
 */
export const doctorService = {
  /** GET /doctors?page=&page_size=&search=&is_active= */
  async list(params: DoctorListParams = {}): Promise<DoctorListResponse> {
    const { data } = await api.get<DoctorListResponse>('/doctors', { params });
    return data;
  },

  /** GET /doctors/user/{user_id} */
  async getByUserId(userId: number): Promise<DoctorUserResponse> {
    const { data } = await api.get<DoctorUserResponse>(`/doctors/user/${userId}`);
    return data;
  },
};
