import { describe, it, expectTypeOf } from 'vitest';
import type {
  DayOfWeek,
  DoctorCreateRequest,
  DoctorGender,
  DoctorListResponse,
  DoctorResponse,
  DoctorSortField,
  DoctorUpdateRequest,
  DoctorUserResponse,
  SortOrder,
} from './doctor';

describe('doctor type contracts (compile-time)', () => {
  it('DoctorResponse covers every field the Appointment module reads', () => {
    expectTypeOf<DoctorResponse>().toMatchTypeOf<
      Pick<DoctorUserResponse, 'id' | 'doctor_code' | 'user_id' | 'user_full_name' | 'user_email'>
    >();
  });

  it('DoctorListResponse items are full DoctorResponse records (not the summary slice)', () => {
    expectTypeOf<DoctorListResponse['items']>().toEqualTypeOf<DoctorResponse[]>();
  });

  it('DoctorCreateRequest requires user_id and primary_phone', () => {
    expectTypeOf<DoctorCreateRequest>().toMatchTypeOf<{
      user_id: number;
      primary_phone: string;
    }>();
  });

  it('DoctorUpdateRequest removes user_id from the create contract', () => {
    // The ONLY key removed by the update request is user_id.
    expectTypeOf<
      Exclude<keyof DoctorCreateRequest, keyof DoctorUpdateRequest>
    >().toEqualTypeOf<'user_id'>();
  });

  it('DoctorGender mirrors the backend GenderEnum exactly', () => {
    expectTypeOf<DoctorGender>().toEqualTypeOf<'male' | 'female' | 'other'>();
  });

  it('DoctorSortField and SortOrder mirror the backend Literals', () => {
    expectTypeOf<DoctorSortField>().toEqualTypeOf<'full_name' | 'years_of_experience'>();
    expectTypeOf<SortOrder>().toEqualTypeOf<'asc' | 'desc'>();
  });

  it('DayOfWeek is 0–5 (Monday–Saturday, no Sunday)', () => {
    expectTypeOf<DayOfWeek>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5>();
  });
});
