"""Billing Module — InvoiceMapper.

Stateless ORM-to-DTO conversion for the Invoice aggregate root.
Converts ``Invoice`` / ``InvoiceItem`` ORM instances to their
Pydantic response schemas, and create/update request DTOs back to
ORM models.

All response DTOs are constructed explicitly — no ``model_validate()``
calls — because the DTOs contain many computed / composed fields that
do not exist as direct ORM attributes (``financials``, ``patient``,
``item_count``, etc.).

This mapper does NOT import PaymentMapper, ReceiptMapper, or RefundMapper
directly. Invoice-level responses embed lightweight summaries of related
entities via schemas defined in ``app.modules.billing.schemas`` which are
self-contained.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from app.modules.billing.constants import DEFAULT_CURRENCY
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import (
    Invoice,
    InvoiceItem,
)
from app.modules.billing.schemas.invoice import (
    AppointmentSummary,
    DoctorSummary,
    InvoiceCreateRequest,
    InvoiceFinancialSummary,
    InvoiceListItem,
    InvoiceListResponse,
    InvoiceRead,
    InvoiceStatusTransitionResponse,
    InvoiceSummary,
    InvoiceUpdateRequest,
    TreatmentPlanSummary,
)
from app.modules.billing.schemas.invoice_item import (
    InvoiceItemCreate,
    InvoiceItemSummary,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)


class InvoiceMapper:
    """Stateless converter between ``Invoice`` ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Request → ORM
    # ==================================================================

    @staticmethod
    def to_model(
        request: InvoiceCreateRequest,
        invoice_number: str,
        created_by: int,
    ) -> Invoice:
        """Convert an ``InvoiceCreateRequest`` DTO to an ``Invoice`` ORM model.

        This method constructs the aggregate root only. Line items are
        attached separately via :meth:`to_item_models`.

        Args:
            request: The validated create request DTO.
            invoice_number: The assigned sequential invoice number.
            created_by: User ID of the invoice creator (auth.users.id = int).

        Returns:
            An ``Invoice`` instance ready for persistence (without items).
        """
        return Invoice(
            patient_id=request.patient_id,
            treatment_plan_id=request.treatment_plan_id,
            appointment_id=request.appointment_id,
            doctor_id=request.doctor_id,
            invoice_number=invoice_number.strip(),
            invoice_date=request.invoice_date,
            due_date=request.due_date,
            status=InvoiceStatus.DRAFT,
            currency_code=request.currency_code.strip().upper(),
            notes=request.notes.strip() if request.notes else None,
            cancellation_reason=None,
            void_reason=None,
            created_by=created_by,
        )

    @staticmethod
    def to_item_models(
        request_items: list[InvoiceItemCreate],
        invoice_id: UUID,
        created_by: int,
    ) -> list[InvoiceItem]:
        """Convert a list of ``InvoiceItemCreate`` DTOs to ``InvoiceItem`` models.

        Args:
            request_items: The validated line items from the create request.
            invoice_id: UUID of the parent invoice (already persisted).
            created_by: User ID of the invoice creator (auth.users.id = int).

        Returns:
            A list of ``InvoiceItem`` instances with assigned sequence numbers.
        """
        items: list[InvoiceItem] = []
        for idx, item_data in enumerate(request_items, start=1):
            net_amount = InvoiceMapper._compute_net_amount(
                unit_price=item_data.unit_price,
                quantity=item_data.quantity,
                discount_value=item_data.discount_value,
            )

            items.append(
                InvoiceItem(
                    invoice_id=invoice_id,
                    sequence_number=item_data.sequence_number or idx,
                    description=item_data.description.strip(),
                    quantity=item_data.quantity,
                    unit_price=item_data.unit_price,
                    discount_type=(
                        item_data.discount_type.strip().upper()
                        if item_data.discount_type
                        else None
                    ),
                    discount_value=item_data.discount_value,
                    net_amount=net_amount,
                    plan_item_id=item_data.plan_item_id,
                    diagnosis_id=item_data.diagnosis_id,
                    original_price=item_data.original_price,
                    override_reason=(
                        item_data.override_reason.strip()
                        if item_data.override_reason
                        else None
                    ),
                    created_by=created_by,
                )
            )
        return items

    @staticmethod
    def update_model(invoice: Invoice, request: InvoiceUpdateRequest) -> Invoice:
        """Apply an ``InvoiceUpdateRequest`` to an existing ``Invoice`` model.

        Only non-``None`` fields are applied. The invoice is mutated
        in-place.

        Args:
            invoice: The ``Invoice`` ORM instance to update.
            request: The validated update request DTO.

        Returns:
            The same ``Invoice`` instance (mutated in-place) for chaining.
        """
        if request.patient_id is not None:
            invoice.patient_id = request.patient_id
        if request.treatment_plan_id is not None:
            invoice.treatment_plan_id = request.treatment_plan_id
        if request.appointment_id is not None:
            invoice.appointment_id = request.appointment_id
        if request.doctor_id is not None:
            invoice.doctor_id = request.doctor_id
        if request.invoice_date is not None:
            invoice.invoice_date = request.invoice_date
        if request.due_date is not None:
            invoice.due_date = request.due_date
        if request.currency_code is not None:
            invoice.currency_code = request.currency_code.strip().upper()
        if request.notes is not None:
            invoice.notes = request.notes.strip() or None
        if request.cancellation_reason is not None:
            invoice.cancellation_reason = (
                request.cancellation_reason.strip() or None
            )
        if request.void_reason is not None:
            invoice.void_reason = request.void_reason.strip() or None

        return invoice

    # ==================================================================
    # ORM → Response DTOs
    # ==================================================================

    @staticmethod
    def to_read(invoice: Invoice) -> InvoiceRead:
        """Convert a full ``Invoice`` aggregate to an ``InvoiceRead`` DTO.

        Composes nested patient, doctor, treatment-plan, appointment,
        creator, updater, items, and financial summaries.

        Args:
            invoice: An ``Invoice`` ORM instance with its relationships
                loaded (patient, doctor, treatment_plan, appointment,
                creator, updater, items).

        Returns:
            An ``InvoiceRead`` with all nested DTOs populated.
        """
        return InvoiceRead(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            document_type="invoice",
            status=invoice.status,
            patient=InvoiceMapper._to_patient_summary(invoice.patient)
            if invoice.patient is not None
            else PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            doctor=InvoiceMapper._to_doctor_summary(invoice.doctor)
            if invoice.doctor is not None
            else None,
            treatment_plan=InvoiceMapper._to_treatment_plan_summary(
                invoice.treatment_plan
            )
            if invoice.treatment_plan is not None
            else None,
            appointment=InvoiceMapper._to_appointment_summary(
                invoice.appointment
            )
            if invoice.appointment is not None
            else None,
            creator=InvoiceMapper._to_creator_summary(invoice.creator)
            if invoice.creator is not None
            else None,
            updater=InvoiceMapper._to_creator_summary(invoice.updater)
            if invoice.updater is not None
            else None,
            invoice_date=invoice.invoice_date,
            due_date=invoice.due_date,
            currency_code=invoice.currency_code,
            notes=invoice.notes,
            cancellation_reason=invoice.cancellation_reason,
            void_reason=invoice.void_reason,
            items=[
                InvoiceMapper._to_item_summary(item)
                for item in (invoice.items or [])
            ],
            financials=InvoiceMapper._compute_financial_summary(invoice),
            version=invoice.version,
            doc_version=invoice.doc_version,
            created_at=invoice.created_at,
            created_by=invoice.created_by,
            updated_at=invoice.updated_at,
            updated_by=invoice.updated_by,
        )

    @staticmethod
    def to_summary(invoice: Invoice) -> InvoiceSummary:
        """Convert an ``Invoice`` ORM instance to an ``InvoiceSummary`` DTO.

        Args:
            invoice: An ``Invoice`` ORM instance.

        Returns:
            An ``InvoiceSummary``.
        """
        items = invoice.items or []

        return InvoiceSummary(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            status=invoice.status,
            patient=InvoiceMapper._to_patient_summary(invoice.patient)
            if invoice.patient is not None
            else PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            doctor=InvoiceMapper._to_doctor_summary(invoice.doctor)
            if invoice.doctor is not None
            else None,
            invoice_date=invoice.invoice_date,
            due_date=invoice.due_date,
            financials=InvoiceMapper._compute_financial_summary(invoice),
            item_count=len(items),
            created_at=invoice.created_at,
        )

    @staticmethod
    def to_list_item(invoice: Invoice) -> InvoiceListItem:
        """Convert an ``Invoice`` ORM instance to an ``InvoiceListItem`` DTO.

        Args:
            invoice: An ``Invoice`` ORM instance.

        Returns:
            An ``InvoiceListItem``.
        """
        items = invoice.items or []

        return InvoiceListItem(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            status=invoice.status,
            patient=InvoiceMapper._to_patient_summary(invoice.patient)
            if invoice.patient is not None
            else PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            doctor=InvoiceMapper._to_doctor_summary(invoice.doctor)
            if invoice.doctor is not None
            else None,
            invoice_date=invoice.invoice_date,
            due_date=invoice.due_date,
            financials=InvoiceMapper._compute_financial_summary(invoice),
            item_count=len(items),
            created_at=invoice.created_at,
        )

    @staticmethod
    def to_list_response(
        invoices: Sequence[Invoice],
        total: int,
        page: int,
        page_size: int,
    ) -> InvoiceListResponse:
        """Convert a sequence of invoices to a paginated list response.

        Args:
            invoices: Items for the current page.
            total: Total matching items across all pages.
            page: Current 1-based page number.
            page_size: Items per page.

        Returns:
            An ``InvoiceListResponse``.
        """
        return InvoiceListResponse(
            items=[InvoiceMapper.to_list_item(inv) for inv in invoices],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def to_status_transition_response(
        invoice: Invoice,
        from_status: InvoiceStatus,
        to_status: InvoiceStatus,
        changed_at: datetime,
        changed_by: int,
    ) -> InvoiceStatusTransitionResponse:
        """Build a status transition response from an invoice and transition data.

        Args:
            invoice: The invoice that was transitioned.
            from_status: The previous status.
            to_status: The new status.
            changed_at: Timestamp when the transition occurred.
            changed_by: User ID who performed the transition (auth.users.id = int).

        Returns:
            An ``InvoiceStatusTransitionResponse``.
        """
        return InvoiceStatusTransitionResponse(
            invoice_id=invoice.id,
            from_status=from_status,
            to_status=to_status,
            changed_at=changed_at,
            changed_by=changed_by,
        )

    # ==================================================================
    # Private helpers — summary construction
    # ==================================================================

    @staticmethod
    def _to_patient_summary(patient: Any) -> PatientSummary:
        """Build a ``PatientSummary`` from a Patient ORM instance.

        ``full_name`` is composed from ``first_name`` / ``last_name``
        because the Patient ORM stores them separately.
        """
        return PatientSummary(
            id=patient.id,
            patient_code=patient.patient_code,
            full_name=(
                f"{patient.first_name or ''} {patient.last_name or ''}"
            ).strip(),
            is_active=patient.is_active,
        )

    @staticmethod
    def _to_creator_summary(user: Any) -> CreatorSummary:
        """Build a ``CreatorSummary`` from a User ORM instance."""
        return CreatorSummary(
            id=user.id,
            full_name=user.full_name,
        )

    @staticmethod
    def _to_doctor_summary(doctor: Any) -> DoctorSummary:
        """Build a ``DoctorSummary`` from a Doctor ORM instance.

        ``user_full_name`` is resolved from the linked User record.
        """
        return DoctorSummary(
            id=doctor.id,
            doctor_code=doctor.doctor_code,
            user_full_name=(
                doctor.user.full_name if doctor.user is not None else None
            ),
            is_active=doctor.is_active,
        )

    @staticmethod
    def _to_treatment_plan_summary(tp: Any) -> TreatmentPlanSummary:
        """Build a ``TreatmentPlanSummary`` from a TreatmentPlan ORM instance."""
        return TreatmentPlanSummary(
            id=tp.id,
            plan_code=tp.plan_code,
            status=tp.status,
        )

    @staticmethod
    def _to_appointment_summary(appt: Any) -> AppointmentSummary:
        """Build an ``AppointmentSummary`` from an Appointment ORM instance."""
        return AppointmentSummary(
            id=appt.id,
            appointment_number=appt.appointment_number,
            appointment_date=appt.appointment_date,
        )

    @staticmethod
    def _to_item_summary(item: InvoiceItem) -> InvoiceItemSummary:
        """Build an ``InvoiceItemSummary`` from an ``InvoiceItem`` ORM instance.

        ``currency_code`` is read from the parent invoice since the line-item
        model does not store it directly (BR-140: single currency per invoice).
        """
        return InvoiceItemSummary(
            id=item.id,
            sequence_number=item.sequence_number,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_type=item.discount_type,
            discount_value=item.discount_value,
            net_amount=item.net_amount,
            tax_amount=item.tax_amount,
            currency_code=(
                item.invoice.currency_code
                if item.invoice is not None
                else DEFAULT_CURRENCY.value
            ),
        )

    # ==================================================================
    # Private helpers — financial computation
    # ==================================================================

    @staticmethod
    def _compute_financial_summary(invoice: Invoice) -> InvoiceFinancialSummary:
        """Derive the financial summary from invoice items and allocations.

        This is a pure computation — no business rules, no database access.
        It only transfers existing values. The service layer owns the
        financial calculation: when ``InvoiceService`` is wired with a
        ``FinancialCalculationService`` it attaches read-time ``paid`` /
        ``refunded`` / ``outstanding`` values as transient attributes on the
        ORM aggregate (``_billing_paid_amount`` etc.), which this mapper reads.
        When those are absent (e.g. mapper used directly in unit tests) the
        neutral ``0.00`` defaults are emitted — the mapper never queries the
        database itself.

        Args:
            invoice: An ``Invoice`` ORM instance with items loaded.

        Returns:
            An ``InvoiceFinancialSummary``.
        """
        if hasattr(invoice, "items") and invoice.items:
            subtotal = sum(
                (item.unit_price or Decimal("0.00")) * (item.quantity or 0)
                for item in invoice.items
            )
            discount_total = sum(
                (item.discount_value or Decimal("0.00"))
                for item in invoice.items
            )
            tax_total = sum(
                (item.tax_amount or Decimal("0.00"))
                for item in invoice.items
                if item.tax_amount is not None
            )
            grand_total = subtotal - discount_total + tax_total
        else:
            subtotal = Decimal("0.00")
            discount_total = Decimal("0.00")
            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")

        paid_amount = getattr(
            invoice, "_billing_paid_amount", Decimal("0.00")
        )
        outstanding_amount = getattr(
            invoice, "_billing_outstanding_amount", Decimal("0.00")
        )

        return InvoiceFinancialSummary(
            currency_code=invoice.currency_code,
            subtotal=subtotal,
            discount_total=discount_total,
            tax_total=tax_total,
            grand_total=grand_total,
            paid_amount=paid_amount,
            outstanding_amount=outstanding_amount,
        )

    @staticmethod
    def _compute_net_amount(
        unit_price: Decimal,
        quantity: int,
        discount_value: Decimal | None = None,
    ) -> Decimal:
        """Compute the net amount for an invoice line item.

        Formula: (unit_price * quantity) - discount_value.
        Result is floored at zero.

        Args:
            unit_price: Price per unit.
            quantity: Number of units.
            discount_value: Optional discount amount.

        Returns:
            The non-negative net amount.
        """
        subtotal = unit_price * quantity
        discount = discount_value if discount_value is not None else Decimal("0.00")
        net = subtotal - discount
        return net if net >= Decimal("0.00") else Decimal("0.00")


__all__ = ["InvoiceMapper"]
