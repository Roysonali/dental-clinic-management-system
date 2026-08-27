from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patients.models import Patient
from app.modules.patients.repository import (
    PatientRepository,
)
from app.modules.patients.mapper import (
    PatientMapper,
)
from app.modules.patients.schemas import (
    PatientCreate,
    PatientQuickCreate,
    PatientQuickCreateResponse,
    PatientListItem,
    PatientSummaryAppointment,
    PatientSummaryBilling,
    PatientSummaryCounts,
    PatientSummaryInvoice,
    PatientSummaryRecord,
    PatientSummaryResponse,
    PatientSummaryTreatmentPlan,
    PatientUpdate,
)
from app.core.constants import ProfileStatus
from app.modules.patients.exceptions import (
    DuplicatePatientDetected,
    InvalidPatientOperation,
    PatientCreationFailed,
    PatientNotFound,
    PatientUpdateFailed,
)


logger = logging.getLogger(__name__)


class PatientService:

    def __init__(
        self,
        db: Session,
    ):

        self.db = db

        self.repository = (
            PatientRepository(
                db
            )
        )

    

    @staticmethod
    def _normalize_text(
        value,
    ):

        if value is None:
            return None

        return (
            str(value)
            .strip().title()
        )

    @staticmethod
    def _compute_profile_status(
        patient: Patient,
    ) -> ProfileStatus:
        """Determine profile completeness based on required clinical fields.

        A patient is INCOMPLETE when date_of_birth or gender is None.
        This is the single source of truth — called on create and update.
        """

        if (
            patient.date_of_birth is None
            or patient.gender is None
        ):
            return ProfileStatus.INCOMPLETE

        return ProfileStatus.COMPLETE

    def _generate_patient_code(
        self,
    ):

        sequence = (

            self.repository
            .get_next_patient_sequence()
        )
        if sequence is None:
            raise PatientCreationFailed(
            details="Failed to generate patient sequence"
        )

        return (
            f"PAT-{sequence:06d}"
        )

    def _check_duplicates(
        self,
        payload: PatientCreate,
    ):
        """
        Checks for duplicate patients.

        Returns:
            list[str] -> Warning messages

        Raises:
            DuplicatePatientDetected -> Exact duplicate found
        """

        warnings = []

        first_name = self._normalize_text(payload.first_name)
        last_name = self._normalize_text(payload.last_name)

        email = (
            self._normalize_text(payload.email).lower()
            if payload.email
            else None
        )

        # --------------------------------------------------
        # Exact duplicate (BLOCK)
        # --------------------------------------------------

        exact_duplicate = self.repository.find_exact_duplicate(
            first_name=first_name,
            last_name=last_name,
            date_of_birth=payload.date_of_birth,
            phone=payload.primary_contact_number,
            email=email,
        )

        if exact_duplicate:

            logger.warning(
                "Exact duplicate blocked: code=%s, name=%s %s",
                exact_duplicate.patient_code,
                exact_duplicate.first_name,
                exact_duplicate.last_name,
            )

            raise DuplicatePatientDetected(
                details={
                    "patient_code": exact_duplicate.patient_code,
                    "name": f"{exact_duplicate.first_name} {exact_duplicate.last_name}",
                    "message": "Patient already exists."
                }
            )

        # --------------------------------------------------
        # Phone warning
        # --------------------------------------------------

        if self.repository.find_by_phone(
            payload.primary_contact_number
        ):
            warnings.append(
                "Primary contact number already exists."
            )

            logger.info(
                "Duplicate phone warning: number=%s",
                payload.primary_contact_number,
            )

        # --------------------------------------------------
        # Email warning
        # --------------------------------------------------

        if email:

            if self.repository.find_by_email(email):

                warnings.append(
                    "Email address already exists."
                )

                logger.info(
                    "Duplicate email warning: email=%s",
                    email,
                )

        # --------------------------------------------------
        # Name + DOB warning
        # --------------------------------------------------

        if self.repository.find_by_name_dob(
            first_name,
            last_name,
            payload.date_of_birth,
        ):

            warnings.append(
                "Patient with same name and date of birth already exists."
            )

            logger.info(
                "Duplicate name+DOB warning: name=%s %s, dob=%s",
                first_name,
                last_name,
                payload.date_of_birth,
            )

        return warnings

   
    def create_patient(
        self,
        payload: PatientCreate,
        created_by,
    ):

        try:

            warnings = self._check_duplicates(
                payload
            )

            patient = Patient(

                patient_code=(
                    self
                    ._generate_patient_code()
                ),

                first_name=(
                    self
                    ._normalize_text(
                        payload.first_name
                    )
                ),

                middle_name=(
                    self
                    ._normalize_text(
                        payload.middle_name
                    )
                ),

                last_name=(
                    self
                    ._normalize_text(
                        payload.last_name
                    )
                ),

                date_of_birth=(
                    payload.date_of_birth
                ),

                gender=(
                    payload.gender
                ),

                primary_contact_number=(
                    payload.primary_contact_number
                ),

                emergency_contact_number=(
                    payload.emergency_contact_number
                ),

                email=(
                    self._normalize_text(
                        payload.email
                    ).lower()
                    if payload.email
                    else None
                ),

               address=self._normalize_text(payload.address),
               remarks=self._normalize_text(payload.remarks),

                profile_status=ProfileStatus.COMPLETE,

                created_by=(
                    created_by
                ),
            )

            patient = (
                self
                .repository
                .create(
                    patient
                )
            )

            self.db.commit()

            logger.info(
                "Patient created: code=%s, id=%s",
                patient.patient_code,
                patient.id,
            )

            return PatientMapper.to_response(patient)

        except DuplicatePatientDetected:
            self.db.rollback()
            logger.info(
                "Patient creation blocked by duplicate detection.",
            )
            raise

        except Exception as e:

            self.db.rollback()

            logger.exception(
                "Patient creation failed: %s",
                str(e),
            )

            raise PatientCreationFailed(
                details=str(e)
            )

    # ------------------------------------------------------------------
    # Quick Create (Phone-Call Workflow)
    # ------------------------------------------------------------------

    def quick_create_patient(
        self,
        payload: PatientQuickCreate,
        created_by: int,
    ) -> PatientQuickCreateResponse:
        """Create a minimal patient record for the phone-call workflow.

        Validates available fields with full rigor.
        Detects potential duplicates (non-blocking) via phone and name+phone.
        Sets profile_status to INCOMPLETE.
        """

        try:

            first_name = self._normalize_text(payload.first_name)
            last_name = self._normalize_text(payload.last_name)
            phone = (
                payload.primary_contact_number
                .replace(" ", "")
                .replace("-", "")
                .strip()
            )

            # --------------------------------------------------
            # T3: Backend potential-match detection (non-blocking)
            # --------------------------------------------------
            potential_matches: list[PatientListItem] = []
            warnings: list[str] = []
            seen_ids: set = set()

            phone_matches = self.repository.find_by_phone(phone)
            if phone_matches:
                warnings.append(
                    "A patient with this phone number already exists."
                )
                for p in phone_matches:
                    if p.id not in seen_ids:
                        seen_ids.add(p.id)
                        potential_matches.append(
                            PatientMapper.to_list_item(p)
                        )

            name_phone_matches = self.repository.find_by_name_and_phone(
                first_name, last_name, phone
            )
            if name_phone_matches:
                warnings.append(
                    "A patient with this name and phone already exists."
                )
                for p in name_phone_matches:
                    if p.id not in seen_ids:
                        seen_ids.add(p.id)
                        potential_matches.append(
                            PatientMapper.to_list_item(p)
                        )

            # --------------------------------------------------
            # Create patient
            # --------------------------------------------------
            patient = Patient(
                patient_code=self._generate_patient_code(),
                first_name=first_name,
                middle_name=self._normalize_text(payload.middle_name),
                last_name=last_name,
                primary_contact_number=phone,
                gender=payload.gender,
                date_of_birth=None,
                profile_status=ProfileStatus.INCOMPLETE,
                is_active=True,
                created_by=created_by,
            )

            patient = self.repository.create(patient)
            self.db.commit()

            logger.info(
                "Quick-create patient: code=%s, id=%s",
                patient.patient_code,
                patient.id,
            )

            return PatientQuickCreateResponse(
                patient=PatientMapper.to_response(patient),
                potential_matches=potential_matches,
                warnings=warnings,
            )

        except Exception as e:
            self.db.rollback()
            logger.exception(
                "Quick-create patient failed: %s",
                str(e),
            )
            raise PatientCreationFailed(details=str(e))

    def get_patient(
        self,
        patient_id: UUID,
    ):

        patient = (

            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            logger.warning(
                "Patient not found: id=%s",
                patient_id,
            )

            raise (
                PatientNotFound()
            )

        return (
            PatientMapper
            .to_response(
                patient
            )
        )

  

    def list_patients(
        self,
        page=1,
        page_size=20,
        search=None,
        is_active=None,
    ):

        (
            patients,
            total,
        ) = (

            self.repository
            .list(

                page=page,

                page_size=page_size,

                search=search,

                is_active=is_active,
            )
        )

        return (
            PatientMapper
            .to_list_response(

                patients,

                total,

                page,

                page_size,
            )
        )

  

    def update_patient(
        self,
        patient_id: UUID,
        payload: PatientUpdate,
        updated_by: int | None = None,
    ):

        try:

            patient = (
                self.repository
                .get_by_id(
                    patient_id
                )
            )

            if not patient:

                raise (
                    PatientNotFound()
                )

            updates = payload.model_dump(exclude_none=True)

            # Normalize text fields
            for field in [
                "first_name",
                "middle_name",
                "last_name",
                "address",
                "remarks",
            ]:
                if field in updates:
                    updates[field] = self._normalize_text(
                        updates[field]
                    )

            # Normalize email
            if "email" in updates and updates["email"]:
                updates["email"] = (
                    updates["email"]
                    .strip()
                    .lower()
                )

            # --------------------------------------------------
            # Duplicate validation
            # --------------------------------------------------
            warnings = self._check_update_duplicates(
                patient,
                updates,
            )

            # --------------------------------------------------
            # Update patient
            # --------------------------------------------------
            patient = (
                self.repository
                .update(
                    patient,
                    updates,
                    updated_by=updated_by,
                )
            )

            # --------------------------------------------------
            # Recompute profile status
            # --------------------------------------------------
            patient.profile_status = (
                self._compute_profile_status(patient)
            )

            self.db.commit()

            logger.info(
                "Patient updated: id=%s, fields=%s",
                patient.id,
                list(updates.keys()),
            )

            return PatientMapper.to_response(patient)
    
        except PatientNotFound:
            self.db.rollback()
            logger.warning(
                "Patient update failed - not found: id=%s",
                patient_id,
            )
            raise

        except DuplicatePatientDetected:
            self.db.rollback()
            logger.info(
                "Patient update blocked by duplicate detection: id=%s",
                patient_id,
            )
            raise

        except Exception as e:

            self.db.rollback()

            logger.exception(
                "Patient update failed: id=%s, error=%s",
                patient_id,
                str(e),
            )

            raise PatientUpdateFailed(
            details=str(e)
        )


    def change_patient_status(
        self,
        patient_id: UUID,
        active: bool,
        updated_by: int | None = None,
    ):

        patient = (
            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            raise (
                PatientNotFound()
            )

        if patient.is_active == active:

            logger.warning(
                "Status change skipped - already %s: id=%s",
                "active" if active else "inactive",
                patient_id,
            )

            raise (
                InvalidPatientOperation(
                    details=(
                        "status already set"
                    )
                )
            )

        patient = (
            self.repository
            .set_active_status(
                patient,
                active,
                updated_by=updated_by,
            )
        )

        self.db.commit()

        logger.info(
            "Patient status changed to %s: id=%s, code=%s",
            "active" if active else "inactive",
            patient.id,
            patient.patient_code,
        )

        return (
            PatientMapper
            .to_response(
                patient
            )
        )


    def get_patient_profile(
        self,
        patient_id: UUID,
    ):

        patient = (
            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            logger.warning(
                "Patient profile requested but not found: id=%s",
                patient_id,
            )

            raise (
                PatientNotFound()
            )

        return (
            PatientMapper
            .to_profile_response(
                patient
            )
        )

    # ------------------------------------------------------------------
    # Patient Hub Summary
    # ------------------------------------------------------------------

    def get_patient_summary(
        self,
        patient_id: UUID,
    ) -> PatientSummaryResponse:
        """Aggregated overview for the Patient Hub.

        Returns counts, recent items, and billing summary in a single
        response to minimise initial-load requests.  All queries use
        COUNT / LIMIT — no unnecessary ORM object loading.
        """

        # Verify patient exists
        patient = self.repository.get_by_id(patient_id)
        if not patient:
            raise PatientNotFound()

        # Lazy imports to avoid circular dependencies (billing ↔ patients)
        from app.modules.appointments.model import Appointment
        from app.modules.patient_records.models.patient_record import PatientRecord
        from app.modules.treatment.models import TreatmentPlan
        from app.modules.billing.models.invoice import Invoice
        from app.modules.billing.models.payment import Payment

        # ── Counts ──────────────────────────────────────────────
        total_appointments = self.db.scalar(
            select(func.count()).where(
                Appointment.patient_id == patient_id
            )
        ) or 0

        total_records = self.db.scalar(
            select(func.count()).where(
                PatientRecord.patient_id == patient_id,
                PatientRecord.is_deleted == False,  # noqa: E712
            )
        ) or 0

        total_treatment_plans = self.db.scalar(
            select(func.count()).where(
                TreatmentPlan.patient_id == patient_id
            )
        ) or 0

        total_invoices = self.db.scalar(
            select(func.count()).where(
                Invoice.patient_id == patient_id
            )
        ) or 0

        total_payments = self.db.scalar(
            select(func.count()).where(
                Payment.patient_id == patient_id
            )
        ) or 0

        counts = PatientSummaryCounts(
            total_appointments=total_appointments,
            total_records=total_records,
            total_treatment_plans=total_treatment_plans,
            total_invoices=total_invoices,
            total_payments=total_payments,
        )

        # ── Recent Appointments (3) ─────────────────────────────
        recent_appt_rows = self.db.scalars(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
            .limit(3)
        ).all()

        recent_appointments = [
            PatientSummaryAppointment(
                id=str(a.id),
                appointment_number=a.appointment_number,
                appointment_date=a.appointment_date,
                start_time=str(a.start_time),
                end_time=str(a.end_time),
                status=a.status.value if hasattr(a.status, 'value') else str(a.status),
                appointment_type=a.appointment_type.value if hasattr(a.appointment_type, 'value') else str(a.appointment_type),
            )
            for a in recent_appt_rows
        ]

        # ── Recent Records (3) ──────────────────────────────────
        recent_record_rows = self.db.scalars(
            select(PatientRecord)
            .where(
                PatientRecord.patient_id == patient_id,
                PatientRecord.is_deleted == False,  # noqa: E712
            )
            .order_by(PatientRecord.created_at.desc())
            .limit(3)
        ).all()

        recent_records = [
            PatientSummaryRecord(
                id=str(r.id),
                status=r.status.value if hasattr(r.status, 'value') else str(r.status),
                chief_complaint=r.chief_complaint,
                created_at=r.created_at,
            )
            for r in recent_record_rows
        ]

        # ── Active Treatment Plans (3) ──────────────────────────
        active_tp_rows = self.db.scalars(
            select(TreatmentPlan)
            .where(
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.is_active == True,  # noqa: E712
            )
            .order_by(TreatmentPlan.created_at.desc())
            .limit(3)
        ).all()

        active_treatment_plans = [
            PatientSummaryTreatmentPlan(
                id=str(t.id),
                plan_code=t.plan_code,
                status=t.status.value if hasattr(t.status, 'value') else str(t.status),
                created_at=t.created_at,
            )
            for t in active_tp_rows
        ]

        # ── Recent Invoices (3) ─────────────────────────────────
        recent_invoice_rows = self.db.scalars(
            select(Invoice)
            .where(Invoice.patient_id == patient_id)
            .order_by(Invoice.created_at.desc())
            .limit(3)
        ).all()

        recent_invoices = [
            PatientSummaryInvoice(
                id=str(inv.id),
                invoice_number=inv.invoice_number,
                status=inv.status.value if hasattr(inv.status, 'value') else str(inv.status),
                total_amount=inv.grand_total if hasattr(inv, 'grand_total') else Decimal("0.00"),
                outstanding_amount=inv.outstanding_amount if hasattr(inv, 'outstanding_amount') else Decimal("0.00"),
                invoice_date=inv.invoice_date,
            )
            for inv in recent_invoice_rows
        ]

        # ── Billing Summary ─────────────────────────────────────
        # Delegate to existing billing service — no duplicated logic
        billing_summary = None
        try:
            from app.modules.billing.services.financial_calculation_service import (
                FinancialCalculationService,
            )

            fin_service = FinancialCalculationService(self.db)
            patient_fin = fin_service.get_patient_summary(patient_id)
            billing_summary = PatientSummaryBilling(
                total_invoiced=patient_fin.total_invoiced,
                total_paid=patient_fin.total_paid,
                total_outstanding=patient_fin.total_outstanding,
                total_credited=patient_fin.total_credited,
            )
        except Exception:
            logger.debug(
                "Billing summary unavailable for patient %s",
                patient_id,
            )

        return PatientSummaryResponse(
            counts=counts,
            recent_appointments=recent_appointments,
            recent_records=recent_records,
            active_treatment_plans=active_treatment_plans,
            recent_invoices=recent_invoices,
            billing=billing_summary,
        )
    
    def _check_update_duplicates(
        self,
        patient: Patient,
        updates: dict,
    ):
        """
        Checks duplicates while updating.
        Ignores the current patient.
        """

        warnings = []

        first_name = updates.get(
            "first_name",
            patient.first_name,
        )

        last_name = updates.get(
            "last_name",
            patient.last_name,
        )

        dob = updates.get(
            "date_of_birth",
            patient.date_of_birth,
        )

        phone = updates.get(
            "primary_contact_number",
            patient.primary_contact_number,
        )

        email = updates.get(
            "email",
            patient.email,
        )

        exact = (
            self.repository.find_exact_duplicate_for_update(
                patient.id,
                first_name,
                last_name,
                dob,
                phone,
                email,
            )
        )

        if exact:

            logger.warning(
                "Exact duplicate blocked during update: id=%s, matched_code=%s",
                patient.id,
                exact.patient_code,
            )

            raise DuplicatePatientDetected(
                details={
                    "patient_code": exact.patient_code,
                    "name": f"{exact.first_name} {exact.last_name}",
                    "message": "Patient already exists."
                }
            )

        if self.repository.find_by_phone_for_update(
            patient.id,
            phone,
        ):
            warnings.append(
                "Primary contact number already exists."
            )

            logger.info(
                "Update phone warning: patient_id=%s, phone=%s",
                patient.id,
                phone,
            )

        if email:

            if self.repository.find_by_email_for_update(
                patient.id,
                email,
            ):
                warnings.append(
                    "Email address already exists."
                )

                logger.info(
                    "Update email warning: patient_id=%s, email=%s",
                    patient.id,
                    email,
                )

        if self.repository.find_by_name_dob_for_update(
            patient.id,
            first_name,
            last_name,
            dob,
        ):
            warnings.append(
                "Patient with same name and date of birth already exists."
            )

            logger.info(
                "Update name+DOB warning: patient_id=%s",
                patient.id,
            )

        return warnings