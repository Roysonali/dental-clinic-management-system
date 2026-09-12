"""Doctor Application Service — Business logic for the doctor self-registration workflow.

Handles:
- Creating doctor applications (linked to pending user accounts)
- Listing pending applications for admin review
- Atomic approval (assign role + create Doctor + mark approved)
- Rejection (mark rejected, no Doctor created)

Transaction Rules:
- The service layer owns commit() and rollback().
- Repositories only flush() and refresh().
- All state-changing operations wrap in try/except for automatic rollback.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DOCTOR_ROLES, USER_STATUS_ACTIVE
from app.modules.auth.models import Role, User
from app.modules.auth.repository import get_role_by_id
from app.modules.doctors.constants import (
    DOCTOR_CODE_PREFIX,
    DOCTOR_CODE_SEQUENCE_WIDTH,
)
from app.modules.doctors.exceptions import (
    DoctorApplicationAlreadyProcessed,
    DoctorApplicationApprovalFailed,
    DoctorApplicationCreationFailed,
    DoctorApplicationNotFound,
    DoctorCreationFailed,
    DoctorValidationFailed,
    DuplicateRegistrationNumber,
    InvalidDoctorRole,
    SpecializationInvalid,
)
from app.modules.doctors.models import (
    Doctor,
    DoctorApplication,
    DoctorSpecialization,
    Specialization,
)
from app.modules.doctors.repositories import (
    DoctorApplicationRepository,
    DoctorRepository,
    SpecializationRepository,
)
from app.modules.doctors.schemas import (
    DoctorApplicationCreate,
    DoctorApplicationRegistration,
    DoctorApplicationApprove,
    DoctorApplicationReject,
)


logger = logging.getLogger(__name__)


class DoctorApplicationService:
    """Service-layer orchestrator for the Doctor Application aggregate.

    Responsibilities:
    * Business rule validation (uniqueness, role eligibility).
    * Transaction ownership (commit on success, rollback on failure).
    * Atomic approval: assign role + create Doctor + mark approved.
    * Structured logging for auditability.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.app_repo = DoctorApplicationRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.spec_repo = SpecializationRepository(db)

    # ------------------------------------------------------------------
    # Transaction Helper
    # ------------------------------------------------------------------

    def _run_in_transaction(
        self,
        operation: str,
        fn: callable,
        *,
        on_unexpected: type[Exception] = DoctorApplicationCreationFailed,
        log_context: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Execute a callable within a transaction boundary."""
        ctx: dict[str, Any] = {"operation": operation}
        if log_context:
            ctx.update(log_context)
        try:
            result = fn()
            self.db.commit()
            logger.info("Doctor application operation succeeded", extra=ctx)
            return result
        except (
            DoctorApplicationNotFound,
            DoctorApplicationAlreadyProcessed,
            DoctorApplicationCreationFailed,
            DoctorApplicationApprovalFailed,
            DoctorValidationFailed,
            DuplicateRegistrationNumber,
            InvalidDoctorRole,
            SpecializationInvalid,
        ):
            self.db.rollback()
            raise
        except IntegrityError as exc:
            self.db.rollback()
            # F-02: a UNIQUE-constraint violation on registration_number is an
            # *expected business conflict* (e.g. two admins approving competing
            # applications for the same license number concurrently, or an
            # applicant racing an approved doctor). It must surface as 409,
            # never as a generic 500. Only unrecognised integrity violations
            # fall through to the unexpected-error mapping.
            if self._is_registration_number_violation(exc):
                logger.warning(
                    "Registration number uniqueness violated during %s "
                    "(race condition or concurrent approval): %s",
                    operation,
                    exc,
                )
                raise DuplicateRegistrationNumber(
                    "Registration number is already assigned to another doctor"
                ) from exc
            logger.error("Integrity violation during %s: %s", operation, exc)
            raise on_unexpected(
                f"Operation '{operation}' failed: integrity violation"
            ) from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception(
                "Unexpected error during %s", operation, extra=ctx
            )
            raise on_unexpected(
                f"Operation '{operation}' failed unexpectedly: {exc}"
            ) from exc

    @staticmethod
    def _is_registration_number_violation(exc: IntegrityError) -> bool:
        """Detect whether an IntegrityError is a registration_number UNIQUE violation.

        Works across drivers (psycopg2 reports constraint/index names and the
        column in the diagnostic message; SQLite repeats the column name).
        Only a safe boolean is inspected — raw SQL is never leaked to clients.
        """
        text = str(getattr(exc, "orig", None) or exc).lower()
        return "registration_number" in text

    # ------------------------------------------------------------------
    # Create Application
    # ------------------------------------------------------------------

    def create_application(
        self,
        user_id: int,
        payload: DoctorApplicationCreate,
    ) -> DoctorApplication:
        """Create a new doctor application linked to a pending user.

        Validates:
        - No existing pending application for this user.
        - Registration number uniqueness (across applications AND doctors).
        - Specialization IDs exist and are active.

        Args:
            user_id: The pending user's ID.
            payload: The validated application data.

        Returns:
            The newly created DoctorApplication.

        Raises:
            DoctorApplicationCreationFailed: If creation fails.
            DuplicateRegistrationNumber: If registration number is taken.
            SpecializationInvalid: If specialization IDs are invalid.
        """

        def _create() -> DoctorApplication:
            # Prevent duplicate pending applications
            if self.app_repo.exists_pending_by_user_id(user_id):
                raise DoctorApplicationCreationFailed(
                    "You already have a pending doctor application"
                )

            # Validate registration number uniqueness (applications + doctors)
            if payload.registration_number:
                if self.app_repo.registration_number_exists(
                    payload.registration_number
                ):
                    raise DuplicateRegistrationNumber(
                        "Registration number is already in use"
                    )
                if self.doctor_repo.registration_number_exists(
                    payload.registration_number
                ):
                    raise DuplicateRegistrationNumber(
                        "Registration number is already assigned to another doctor"
                    )

            # Validate specialization IDs
            requested_spec_ids = payload.requested_specialization_ids or []
            primary_spec_id = payload.primary_specialization_id

            if primary_spec_id is not None and primary_spec_id not in requested_spec_ids:
                raise DoctorValidationFailed(
                    "Primary specialization must be in the requested specialization list"
                )

            if requested_spec_ids:
                existing_specs = self.spec_repo.get_by_ids(requested_spec_ids)
                existing_ids = {s.id for s in existing_specs}
                missing = set(requested_spec_ids) - existing_ids
                if missing:
                    raise SpecializationInvalid(
                        f"Invalid specialization IDs: {sorted(missing)}"
                    )

            application = DoctorApplication(
                user_id=user_id,
                qualification=payload.qualification,
                registration_number=payload.registration_number,
                years_of_experience=payload.years_of_experience,
                date_of_birth=payload.date_of_birth,
                gender=payload.gender,
                primary_phone=payload.primary_phone,
                address=payload.address,
                profile_photo_url=payload.profile_photo_url,
                requested_specialization_ids=requested_spec_ids,
                primary_specialization_id=primary_spec_id,
                status=DoctorApplication.STATUS_PENDING,
            )

            self.app_repo.add(application)
            self.db.flush()
            self.db.refresh(application)

            logger.info(
                "Doctor application created: id=%s, user_id=%s",
                application.id,
                user_id,
            )
            return application

        return self._run_in_transaction(
            "create_application",
            _create,
            log_context={"user_id": user_id},
        )

    # ------------------------------------------------------------------
    # Create from Registration (combined account + application)
    # ------------------------------------------------------------------

    def create_application_from_registration(
        self,
        user_id: int,
        payload: DoctorApplicationRegistration,
    ) -> DoctorApplication:
        """Create a doctor application from the combined registration payload.

        This is used by POST /auth/register-doctor which creates both
        the User account and the DoctorApplication in one flow.

        Args:
            user_id: The newly created pending user's ID.
            payload: The combined registration payload.

        Returns:
            The newly created DoctorApplication.
        """
        # Convert the registration payload to an application-create payload
        app_payload = DoctorApplicationCreate(
            qualification=payload.qualification,
            registration_number=payload.registration_number,
            years_of_experience=payload.years_of_experience,
            date_of_birth=payload.date_of_birth,
            gender=payload.gender,
            primary_phone=payload.primary_phone,
            address=payload.address,
            profile_photo_url=payload.profile_photo_url,
            requested_specialization_ids=payload.requested_specialization_ids,
            primary_specialization_id=payload.primary_specialization_id,
        )
        return self.create_application(user_id, app_payload)

    # ------------------------------------------------------------------
    # List Pending Applications
    # ------------------------------------------------------------------

    def list_pending_applications(self) -> list[DoctorApplication]:
        """Return all pending doctor applications for admin review."""
        return self.app_repo.list_pending()

    # ------------------------------------------------------------------
    # Get Application by ID
    # ------------------------------------------------------------------

    def get_application(self, application_id: int) -> DoctorApplication:
        """Retrieve a doctor application by ID.

        Raises:
            DoctorApplicationNotFound: If no application with the given ID exists.
        """
        application = self.app_repo.get_by_id(application_id)
        if application is None:
            raise DoctorApplicationNotFound()
        return application

    # ------------------------------------------------------------------
    # Approve Application (ATOMIC)
    # ------------------------------------------------------------------

    def approve_application(
        self,
        application_id: int,
        payload: DoctorApplicationApprove,
        *,
        approved_by: int,
    ) -> DoctorApplication:
        """Atomically approve a doctor application.

        This is the CRITICAL transaction that:
        1. Validates the application is still PENDING (idempotency guard).
        2. Validates the selected role is an allowed doctor role.
        3. Validates registration number uniqueness against existing doctors.
        4. Assigns the approved RBAC role to the User.
        5. Creates a Doctor profile copying application fields.
        6. Transfers specialization assignments to the new Doctor.
        7. Marks the application APPROVED.
        8. Records audit metadata (reviewed_by, reviewed_at).

        If ANY step fails, the entire transaction is rolled back.

        Args:
            application_id: The application to approve.
            payload: Contains the role_id for the doctor role to assign.
            approved_by: The admin user ID performing the approval.

        Returns:
            The approved DoctorApplication.

        Raises:
            DoctorApplicationNotFound: If the application doesn't exist.
            DoctorApplicationAlreadyProcessed: If already approved/rejected.
            InvalidDoctorRole: If the role_id is not an allowed doctor role.
            DuplicateRegistrationNumber: If reg number conflicts with existing doctor.
            DoctorApplicationApprovalFailed: On any unexpected error.
        """

        def _approve() -> DoctorApplication:
            # 1. Load and validate application is PENDING
            application = self.app_repo.get_by_id(application_id)
            if application is None:
                raise DoctorApplicationNotFound()
            if application.status != DoctorApplication.STATUS_PENDING:
                raise DoctorApplicationAlreadyProcessed(
                    f"Application is already {application.status}"
                )

            # 2. Validate the user still exists and is pending
            user = self.db.get(User, application.user_id)
            if user is None:
                raise DoctorApplicationApprovalFailed(
                    "Linked user account no longer exists"
                )

            # 3. Validate the selected role is an allowed doctor role
            role = get_role_by_id(self.db, payload.role_id)
            if role is None:
                raise InvalidDoctorRole("Role not found")
            if role.name not in DOCTOR_ROLES:
                raise InvalidDoctorRole(
                    f"Role '{role.name}' is not an allowed doctor role. "
                    f"Allowed: {', '.join(DOCTOR_ROLES)}"
                )

            # 4. Validate registration number uniqueness against existing doctors.
            # Race-condition defence-in-depth: the DB UNIQUE constraint on
            # doctors.registration_number is the final authority; a violation
            # at flush/commit time is translated to DuplicateRegistrationNumber
            # by _run_in_transaction (F-02), so this pre-check only covers the
            # common, non-concurrent path.
            if application.registration_number:
                if self.doctor_repo.registration_number_exists(
                    application.registration_number
                ):
                    raise DuplicateRegistrationNumber(
                        "Registration number is already assigned to another doctor"
                    )

            # 5. Assign the approved RBAC role to the User
            user.role_id = role.id
            user.status = USER_STATUS_ACTIVE
            user.is_active = True
            user.updated_by = approved_by
            self.db.flush()

            # 6. Generate unique doctor code
            doctor_code = self._generate_doctor_code()

            # 7. Create Doctor profile
            doctor = Doctor(
                user_id=application.user_id,
                doctor_code=doctor_code,
                primary_phone=application.primary_phone
                or "+0000000000",  # Fallback for NOT NULL
                date_of_birth=application.date_of_birth,
                gender=application.gender,
                address=application.address,
                qualification=application.qualification,
                registration_number=application.registration_number,
                years_of_experience=application.years_of_experience,
                profile_photo_url=application.profile_photo_url,
                is_active=True,
                available_for_appointment=True,
                on_leave=False,
                created_by=approved_by,
            )
            self.db.add(doctor)
            self.db.flush()
            self.db.refresh(doctor)

            # 8. Transfer specialization assignments
            requested_spec_ids = application.requested_specialization_ids or []
            primary_spec_id = application.primary_specialization_id

            for spec_id in requested_spec_ids:
                is_primary = spec_id == primary_spec_id
                entry = DoctorSpecialization(
                    doctor_id=doctor.id,
                    specialization_id=spec_id,
                    is_primary=is_primary,
                )
                self.db.add(entry)

            if requested_spec_ids:
                self.db.flush()

            # 9. Mark application APPROVED
            from datetime import datetime, timezone

            application.status = DoctorApplication.STATUS_APPROVED
            application.reviewed_at = datetime.now(timezone.utc)
            application.reviewed_by = approved_by
            application.approved_role_id = role.id
            application.doctor_id = doctor.id

            logger.info(
                "Doctor application approved: app_id=%s, user_id=%s, "
                "doctor_id=%s, role=%s, approved_by=%s",
                application.id,
                application.user_id,
                doctor.id,
                role.name,
                approved_by,
            )

            return application

        return self._run_in_transaction(
            "approve_application",
            _approve,
            on_unexpected=DoctorApplicationApprovalFailed,
            log_context={
                "application_id": application_id,
                "approved_by": approved_by,
            },
        )

    # ------------------------------------------------------------------
    # Reject Application
    # ------------------------------------------------------------------

    def reject_application(
        self,
        application_id: int,
        payload: DoctorApplicationReject,
        *,
        rejected_by: int,
    ) -> DoctorApplication:
        """Reject a doctor application.

        Does NOT create a Doctor profile or assign any role.

        Args:
            application_id: The application to reject.
            payload: Optional rejection reason.
            rejected_by: The admin user ID performing the rejection.

        Returns:
            The rejected DoctorApplication.
        """

        def _reject() -> DoctorApplication:
            application = self.app_repo.get_by_id(application_id)
            if application is None:
                raise DoctorApplicationNotFound()
            if application.status != DoctorApplication.STATUS_PENDING:
                raise DoctorApplicationAlreadyProcessed(
                    f"Application is already {application.status}"
                )

            from datetime import datetime, timezone

            application.status = DoctorApplication.STATUS_REJECTED
            application.reviewed_at = datetime.now(timezone.utc)
            application.reviewed_by = rejected_by
            application.rejection_reason = payload.rejection_reason

            logger.info(
                "Doctor application rejected: app_id=%s, user_id=%s, "
                "rejected_by=%s, reason=%s",
                application.id,
                application.user_id,
                rejected_by,
                payload.rejection_reason,
            )

            return application

        return self._run_in_transaction(
            "reject_application",
            _reject,
            log_context={
                "application_id": application_id,
                "rejected_by": rejected_by,
            },
        )

    # ------------------------------------------------------------------
    # Doctor Code Generation
    # ------------------------------------------------------------------

    def _generate_doctor_code(self) -> str:
        """Generate a unique doctor code in DOC-XXXXXX format."""
        latest = self.doctor_repo.get_latest_doctor_code()
        if latest:
            try:
                seq = int(latest.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        seqstr = str(seq).zfill(DOCTOR_CODE_SEQUENCE_WIDTH)
        return f"{DOCTOR_CODE_PREFIX}-{seqstr}"
