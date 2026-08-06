import { describe, it, expectTypeOf } from 'vitest';
import type {
  ChangeRoleRequest,
  RoleFormValues,
  UserActionResponse,
  UserDetailResponse,
  UserListItem,
  UserListParams,
  UserListResponse,
  UserRole,
  UserStatusFilter,
} from './user';
import type { UserStatus } from './auth';
import type { RoleName } from '../constants/roles';

describe('user type contracts (compile-time)', () => {
  it('UserListItem mirrors the backend UserListItem schema exactly', () => {
    expectTypeOf<UserListItem>().toEqualTypeOf<{
      id: number;
      full_name: string;
      email: string;
      status: UserStatus;
      is_active: boolean;
      role_id: number | null;
      role_name: string | null;
      last_login_at: string | null;
      created_at: string | null;
    }>();
  });

  it('UserDetailResponse extends the list row with audit fields (UserDetailResponse)', () => {
    expectTypeOf<UserDetailResponse>().toEqualTypeOf<{
      id: number;
      full_name: string;
      email: string;
      status: UserStatus;
      is_active: boolean;
      role_id: number | null;
      role_name: string | null;
      last_login_at: string | null;
      created_by: number | null;
      created_at: string | null;
      updated_at: string | null;
      updated_by: number | null;
    }>();
  });

  it('UserListResponse items are UserListItem records', () => {
    expectTypeOf<UserListResponse['items']>().toEqualTypeOf<UserListItem[]>();
    expectTypeOf<UserListResponse>().toMatchTypeOf<{
      total: number;
      page: number;
      page_size: number;
    }>();
  });

  it('UserListParams supports exactly the backend query params (no sort — fixed id DESC ordering)', () => {
    expectTypeOf<keyof UserListParams>().toEqualTypeOf<
      'search' | 'role_id' | 'status' | 'page' | 'page_size'
    >();
    expectTypeOf<UserListParams['status']>().toEqualTypeOf<UserStatus | undefined>();
    expectTypeOf<UserListParams['page']>().toEqualTypeOf<number | undefined>();
  });

  it('ChangeRoleRequest mirrors backend ChangeRoleRequest (role_id only)', () => {
    expectTypeOf<ChangeRoleRequest>().toEqualTypeOf<{ role_id: number }>();
  });

  it('UserActionResponse mirrors backend UserActionResponse', () => {
    expectTypeOf<UserActionResponse>().toEqualTypeOf<{ user_id: number; message: string }>();
  });

  it('UserRole is the backend role-name union (app/core/constants.py)', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<RoleName>();
  });

  it('UserStatusFilter is the backend status union plus the UI-only all sentinel', () => {
    expectTypeOf<UserStatusFilter>().toEqualTypeOf<'all' | UserStatus>();
  });

  it('RoleFormValues holds the role id as a string (RHF form convention)', () => {
    expectTypeOf<RoleFormValues>().toEqualTypeOf<{ role_id: string }>();
  });
});
