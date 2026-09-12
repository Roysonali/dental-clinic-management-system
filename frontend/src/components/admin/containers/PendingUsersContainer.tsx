import { useState, type FC } from 'react';
import { ShieldAlert, UserCheck, UserX, Stethoscope, FileText } from 'lucide-react';
import {
  useApproveUser,
  useDeactivatePendingUser,
  usePendingUsers,
} from '../../../hooks/auth/usePendingUsers';
import {
  useDoctorApplications,
  useApproveDoctorApplication,
  useRejectDoctorApplication,
  useRoles,
} from '../../../hooks/auth/useDoctorApplications';
import { parseApiError } from '../../../services/apiError';
import {
  ROLES,
  ROLE_LABELS,
  ROLE_IDS,
  DOCTOR_ROLES,
  type RoleName,
} from '../../../constants/roles';
import { Spinner } from '../../common/Spinner/Spinner';
import { Alert } from '../../common/Alert/Alert';
import { Button } from '../../common/Button/Button';
import { Select } from '../../common/Input/Select';
import { Modal } from '../../common/Modal/Modal';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import type { PendingUserResponse, DoctorApplicationResponse } from '../../../types/auth';

/**
 * Fallback role options (seeded id map) — used only while the server role
 * list is unavailable. Kept in sync with `backend/app/database/seed_roles.py`.
 */
const FALLBACK_ROLE_OPTIONS = Object.values(ROLES).map((role) => ({
  value: String(ROLE_IDS[role]),
  label: ROLE_LABELS[role],
}));

const FALLBACK_DOCTOR_ROLE_OPTIONS = DOCTOR_ROLES.map((role) => ({
  value: String(ROLE_IDS[role]),
  label: ROLE_LABELS[role],
}));

/**
 * Build role options from the server-provided role list (F-03).
 *
 * Prefers stable role *name* codes over database ids: the dropdown value is
 * the role name when the backend role list is available, resolved to the
 * matching server id at approve time. Falls back to the seeded id map when
 * the role list query fails.
 */
function buildRoleOptions(
  roles: { id: number; name: string }[] | undefined,
  allowedNames: readonly RoleName[] | null,
) {
  if (!roles || roles.length === 0) {
    return allowedNames ? FALLBACK_DOCTOR_ROLE_OPTIONS : FALLBACK_ROLE_OPTIONS;
  }
  return roles
    .filter((r) => allowedNames === null || allowedNames.includes(r.name as RoleName))
    .map((r) => ({
      value: r.name,
      label: ROLE_LABELS[r.name as RoleName] ?? r.name,
      id: r.id,
    }));
}

/**
 * PendingUsersContainer — admin approval queue.
 *
 * Orchestrates:
 * - GET /auth/users/pending (list of registration requests)
 * - PATCH /auth/users/{id}/approve with a chosen role
 * - PATCH /auth/users/{id}/deactivate (confirmed via modal)
 *
 * The backend enforces admin-only access; a 403 renders an "insufficient
 * permissions" state (the backend does not expose the current user's role,
 * so the screen cannot be gated client-side).
 */
export const PendingUsersContainer: FC = () => {
  const { data: pendingUsers, isLoading, isError, error, refetch } = usePendingUsers();
  const { data: doctorApplications, refetch: refetchApps } = useDoctorApplications();
  const { data: serverRoles } = useRoles();
  const approveMutation = useApproveUser();
  const deactivateMutation = useDeactivatePendingUser();
  const approveDoctorMutation = useApproveDoctorApplication();
  const rejectDoctorMutation = useRejectDoctorApplication();

  /* F-03: role options come from the server role list; the value is the
   * stable role NAME code, resolved to the server id on submit. */
  const roleOptions = buildRoleOptions(serverRoles, null);
  const doctorRoleOptions = buildRoleOptions(serverRoles, DOCTOR_ROLES);
  const roleIdByName = new Map(
    (serverRoles ?? []).map((r) => [r.name, r.id] as const),
  );

  const [roleSelections, setRoleSelections] = useState<Record<number, string>>({});
  const [doctorRoleSelections, setDoctorRoleSelections] = useState<Record<number, string>>({});
  const [deactivatingUser, setDeactivatingUser] = useState<PendingUserResponse | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<DoctorApplicationResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const errorInfo = isError ? parseApiError(error) : null;
  const mutationError = approveMutation.isError
    ? parseApiError(approveMutation.error).message
    : deactivateMutation.isError
      ? parseApiError(deactivateMutation.error).message
      : approveDoctorMutation.isError
        ? parseApiError(approveDoctorMutation.error).message
        : rejectDoctorMutation.isError
          ? parseApiError(rejectDoctorMutation.error).message
          : null;

  const handleApprove = (userId: number) => {
    const selected = roleSelections[userId];
    // Server role list available → value is a role NAME; resolve to id.
    const roleId = roleIdByName.get(selected) ?? Number(selected);
    if (!Number.isInteger(roleId) || roleId <= 0) return;
    approveMutation.mutate({ userId, roleId });
  };

  const handleConfirmDeactivate = () => {
    if (!deactivatingUser) return;
    deactivateMutation.mutate(deactivatingUser.id, {
      onSettled: () => setDeactivatingUser(null),
    });
  };

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return <Spinner centered size="lg" label="Loading pending approvals" />;
  }

  /* ── Forbidden (non-admin) ───────────────────────────────────────── */
  if (errorInfo?.kind === 'forbidden') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Insufficient permissions"
        description="This screen is restricted to Administrators and Chief Doctors. Your account does not have the required role."
      />
    );
  }

  /* ── Other errors ────────────────────────────────────────────────── */
  if (errorInfo) {
    return (
      <Alert
        variant="danger"
        title="Unable to load pending approvals"
        description={errorInfo.message}
        actions={<Button variant="outline" onClick={() => void refetch()}>Retry</Button>}
      />
    );
  }

  /* ── Empty queue ─────────────────────────────────────────────────── */
  if (!pendingUsers || pendingUsers.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="No pending approvals"
        description="There are no registration requests waiting for review."
      />
    );
  }

  const handleApproveDoctor = (applicationId: number) => {
    const selected = doctorRoleSelections[applicationId];
    // Server role list available → value is a role NAME; resolve to id.
    const roleId = roleIdByName.get(selected) ?? Number(selected);
    if (!Number.isInteger(roleId) || roleId <= 0) return;
    approveDoctorMutation.mutate(
      { applicationId, roleId },
      {
        onSettled: () => {
          setSelectedApplication(null);
          void refetchApps();
          void refetch();
        },
      },
    );
  };

  const handleRejectDoctor = (applicationId: number) => {
    rejectDoctorMutation.mutate(
      { applicationId, reason: rejectReason || undefined },
      {
        onSettled: () => {
          setSelectedApplication(null);
          setRejectReason('');
          void refetchApps();
          void refetch();
        },
      },
    );
  };

  const hasDoctorApps = doctorApplications && doctorApplications.length > 0;
  const hasStaffApps = pendingUsers && pendingUsers.length > 0;

  return (
    <div className="space-y-6">
      {mutationError && (
        <Alert variant="danger" title="Action failed" description={mutationError} />
      )}

      {/* ── Doctor Applications Section ────────────────────────── */}
      {hasDoctorApps && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Stethoscope size={18} className="text-primary-600" />
            <h3 className="text-h4 font-semibold text-neutral-900">
              Doctor Applications
            </h3>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption font-medium text-primary-700">
              {doctorApplications.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[640px] text-left" aria-label="Doctor applications">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Qualification</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctorApplications.map((app) => (
                  <tr key={app.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-body font-medium text-neutral-900">
                      {app.user_full_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-body text-neutral-600">
                      {app.user_email || ''}
                    </td>
                    <td className="px-4 py-3 text-body text-neutral-600">
                      {app.qualification || '—'}
                    </td>
                    <td className="px-4 py-3 text-body text-neutral-500">
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedApplication(app)}
                        >
                          <FileText size={14} className="mr-1" />
                          Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Staff Applications Section ─────────────────────────── */}
      {hasStaffApps && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <UserCheck size={18} className="text-neutral-600" />
            <h3 className="text-h4 font-semibold text-neutral-900">
              Staff Applications
            </h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
              {pendingUsers.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[640px] text-left" aria-label="Pending staff approvals">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role to assign</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => {
                  const pendingApprove = approveMutation.isPending
                    && approveMutation.variables?.userId === user.id;
                  const pendingDeactivate = deactivateMutation.isPending
                    && deactivateMutation.variables === user.id;
                  const busy = pendingApprove || pendingDeactivate;
                  const selectedRole = roleSelections[user.id] ?? '';

                  return (
                    <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 text-body font-medium text-neutral-900">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 text-body text-neutral-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          aria-label={`Role to assign to ${user.full_name}`}
                          options={roleOptions}
                          placeholder="Select a role"
                          value={selectedRole}
                          disabled={busy}
                          onChange={(e) =>
                            setRoleSelections((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          wrapperClassName="max-w-[200px]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            loading={pendingApprove}
                            disabled={!selectedRole || busy}
                            onClick={() => handleApprove(user.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={pendingDeactivate}
                            disabled={busy}
                            onClick={() => setDeactivatingUser(user)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Doctor Application Review Modal ────────────────────────────── */}
      <Modal
        open={!!selectedApplication}
        onClose={() => setSelectedApplication(null)}
        size="lg"
        ariaLabel="Review doctor application"
      >
        <Modal.Header>
          <h2 className="text-h4 font-semibold text-neutral-900">
            Doctor Application Review
          </h2>
        </Modal.Header>
        <Modal.Body>
          {selectedApplication && (
            <div className="space-y-4">
              {/* Applicant Info (P2: show submitted photo so admin can review it) */}
              <div className="rounded-lg bg-neutral-50 p-4">
                <h3 className="text-body font-semibold text-neutral-900 mb-2">Applicant</h3>
                <div className="flex items-start gap-4">
                  {selectedApplication.profile_photo_url ? (
                    <img
                      src={selectedApplication.profile_photo_url}
                      alt={`${selectedApplication.user_full_name ?? 'Applicant'} profile photo`}
                      className="h-16 w-16 shrink-0 rounded-full border border-neutral-200 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-h4 font-semibold text-neutral-400"
                      aria-label="No profile photo submitted"
                    >
                      {(selectedApplication.user_full_name ?? '?')
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <div>
                      <p className="text-caption text-neutral-500">Name</p>
                      <p className="text-body text-neutral-900">{selectedApplication.user_full_name}</p>
                    </div>
                    <div>
                      <p className="text-caption text-neutral-500">Email</p>
                      <p className="text-body text-neutral-900">{selectedApplication.user_email}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div className="rounded-lg bg-neutral-50 p-4">
                <h3 className="text-body font-semibold text-neutral-900 mb-2">Professional Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedApplication.qualification && (
                    <div>
                      <p className="text-caption text-neutral-500">Qualification</p>
                      <p className="text-body text-neutral-900">{selectedApplication.qualification}</p>
                    </div>
                  )}
                  {selectedApplication.registration_number && (
                    <div>
                      <p className="text-caption text-neutral-500">Registration Number</p>
                      <p className="text-body text-neutral-900">{selectedApplication.registration_number}</p>
                    </div>
                  )}
                  {selectedApplication.years_of_experience != null && (
                    <div>
                      <p className="text-caption text-neutral-500">Experience</p>
                      <p className="text-body text-neutral-900">{selectedApplication.years_of_experience} years</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Details */}
              <div className="rounded-lg bg-neutral-50 p-4">
                <h3 className="text-body font-semibold text-neutral-900 mb-2">Personal Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedApplication.primary_phone && (
                    <div>
                      <p className="text-caption text-neutral-500">Phone</p>
                      <p className="text-body text-neutral-900">{selectedApplication.primary_phone}</p>
                    </div>
                  )}
                  {selectedApplication.gender && (
                    <div>
                      <p className="text-caption text-neutral-500">Gender</p>
                      <p className="text-body text-neutral-900 capitalize">{selectedApplication.gender}</p>
                    </div>
                  )}
                  {selectedApplication.date_of_birth && (
                    <div>
                      <p className="text-caption text-neutral-500">Date of Birth</p>
                      <p className="text-body text-neutral-900">{selectedApplication.date_of_birth}</p>
                    </div>
                  )}
                  {selectedApplication.address && (
                    <div className="col-span-2">
                      <p className="text-caption text-neutral-500">Address</p>
                      <p className="text-body text-neutral-900">{selectedApplication.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Specializations (master-data names from the backend) */}
              {selectedApplication.specialization_names && selectedApplication.specialization_names.length > 0 && (
                <div className="rounded-lg bg-neutral-50 p-4">
                  <h3 className="text-body font-semibold text-neutral-900 mb-2">Specializations</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedApplication.specialization_names.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-primary-50 px-3 py-1 text-caption font-medium text-primary-700"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Selection for Approval — P2: explicit a11y label */}
              <div>
                <label
                  htmlFor="doctor-role-select"
                  className="text-body font-medium text-neutral-900 block mb-1"
                >
                  Assign Doctor Role
                </label>
                <Select
                  id="doctor-role-select"
                  aria-label="Assign Doctor Role"
                  options={doctorRoleOptions}
                  placeholder="Select a doctor role"
                  value={doctorRoleSelections[selectedApplication.id] ?? ''}
                  onChange={(e) =>
                    setDoctorRoleSelections((prev) => ({
                      ...prev,
                      [selectedApplication.id]: e.target.value,
                    }))
                  }
                  wrapperClassName="max-w-[300px]"
                />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setSelectedApplication(null)}
            disabled={approveDoctorMutation.isPending || rejectDoctorMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={rejectDoctorMutation.isPending}
            disabled={approveDoctorMutation.isPending || rejectDoctorMutation.isPending}
            onClick={() => selectedApplication && handleRejectDoctor(selectedApplication.id)}
          >
            Reject
          </Button>
          <Button
            variant="success"
            loading={approveDoctorMutation.isPending}
            disabled={
              !selectedApplication ||
              !doctorRoleSelections[selectedApplication.id] ||
              approveDoctorMutation.isPending ||
              rejectDoctorMutation.isPending
            }
            onClick={() => selectedApplication && handleApproveDoctor(selectedApplication.id)}
          >
            Approve
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Deactivation confirmation ─────────────────────────────────── */}
      <Modal
        open={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        size="sm"
        ariaLabel="Confirm deactivation"
      >
        <Modal.Header>
          <h2 className="text-h4 font-semibold text-neutral-900">
            Deactivate registration request?
          </h2>
        </Modal.Header>
        <Modal.Body>
          <p className="text-body text-neutral-600">
            {deactivatingUser?.full_name} ({deactivatingUser?.email}) will not
            be able to log in. This can be reversed later by an administrator.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeactivatingUser(null)}
            disabled={deactivateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deactivateMutation.isPending}
            leftIcon={<UserX size={16} />}
            onClick={handleConfirmDeactivate}
          >
            Deactivate user
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
