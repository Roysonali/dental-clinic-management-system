"""InvoiceService — service-layer orchestrator for the Invoice aggregate.

Responsibilities
---------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Core lifecycle**: create, read, update-draft, delete-draft, issue, cancel.
* **Line-item orchestration**: assigns sequence numbers, persists child items.
* **Business validation**: delegates to ``InvoiceValidator`` and
  ``FinancialValidator``.
* **Document numbering**: delegates to ``DocumentSequenceService`` for
  sequential invoice numbers.
* **Audit integration**: records workflow events via ``AuditRepository``.
* **Read-only queries**: read and search without mutation.
* **Logging**: workflow-level business events.

Ownership boundaries
-------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (InvoiceValidator)                |
+---------------------------+-----------------------------------+
| Invoice + item creation   | Persistence                       |
| workflow                  | (InvoiceRepository)               |
+---------------------------+-----------------------------------+
| Line-item sequence        | Amount validation                 |
| assignment and net-amount | (FinancialValidator)              |
| derivation                |                                   |
+---------------------------+-----------------------------------+
| Document numbering        | Sequence row locking              |
| (DocumentSequenceService) | (DocumentSequenceRepository)      |
+---------------------------+-----------------------------------+
| Audit event creation      | SQL                               |
| (AuditRepository)         |                                   |
+---------------------------+-----------------------------------+
| Logging                   |                                   |
+---------------------------+-----------------------------------+
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.billing.constants import DEFAULT_PAGE_SIZE
from app.modules.billing.enums import (
    AuditAction,
    DocumentType,
    InvoiceStatus,
)
from app.modules.billing.exceptions import (
    BillingValidationError,
    DocumentSequenceNotFound,
    InvoiceCreationFailed,
    InvoiceNotFound,
    InvoiceNotEditable,
    InvoiceValidationFailed,
    InvalidInvoiceStatusTransition,
    SequenceReservationFailed,
)
from app.modules.billing.models import (
    BillingAuditLog,
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
)
from app.modules.billing.repositories import (
    AuditRepository,
    InvoiceRepository,
)
from app.modules.billing.services.base import BaseService
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.validators import (
    FinancialValidator,
    InvoiceValidator,
)


logger = logging.getLogger(__name__)


class InvoiceService(BaseService):
    """Service-layer orchestrator for the Invoice aggregate.

    Args:
        db: The active SQLAlchemy ``Session``.
        invoice_repo: ``InvoiceRepository`` for aggregate persistence.
        invoice_validator: ``InvoiceValidator`` for business rules.
        financial_validator: ``FinancialValidator`` for monetary validations.
        document_sequence_service: ``DocumentSequenceService`` for document
            number reservation.
        audit_repo: ``AuditRepository`` for audit event persistence.
    """

    def __init__(
        self,
        db: Session,
        invoice_repo: InvoiceRepository,
        invoice_validator: InvoiceValidator,
        financial_validator: FinancialValidator,
        document_sequence_service: DocumentSequenceService,
        audit_repo: AuditRepository,
    ) -> None:
        super().__init__(db)
        self._invoice_repo = invoice_repo
        self._invoice_validator = invoice_validator
        self._financial = financial_validator
        self._document_sequence_service = document_sequence_service
        self._audit_repo = audit_repo

    # ==================================================================
    # create_invoice
    # ==================================================================

    def create_invoice(
        self,
        patient_id: UUID,
        invoice_number: str,
        currency_code: str,
        items: list[dict[str, Any]],
        created_by: int,
        *,
        treatment_plan_id: UUID | None = None,
        appointment_id: UUID | None = None,
        doctor_id: UUID | None = None,
        notes: str | None = None,
        due_date: date | None = None,
        invoice_date: date | None = None,
    ) -> Invoice:
        """Create a new invoice in Draft status.

        Workflow:
        1. Validate currency code.
        2. Validate invoice number format and uniqueness.
        3. Resolve invoice date and due date defaults.
        4. Validate invoice date range.
        5. Validate all foreign-key references exist before persistence
           (Sprint 12A — application-layer FK hardening).
        6. Build the ``Invoice`` aggregate root.
        7. Validate and normalise line items, assign sequence numbers.
        8. Create the initial ``InvoiceStatusHistory`` entry.
        9. Persist the aggregate via ``invoice_repo.create()``.
        10. Commit the transaction.

        Args:
            patient_id: UUID of the invoice owner.
            invoice_number: Unique sequential number (validated for format
                and uniqueness).
            currency_code: ISO 4217 currency code.
            items: List of line-item dicts. Each dict must contain
                ``description``, ``quantity``, and ``unit_price``; optional
                keys include ``sequence_number``, ``discount_type``,
                ``discount_value``, ``plan_item_id``, ``diagnosis_id``,
                ``original_price``, and ``override_reason``.
            created_by: Integer ID of the user creating the invoice
                (auth.users.id = INTEGER).
            treatment_plan_id: Optional linked treatment plan UUID.
            appointment_id: Optional linked appointment UUID.
            doctor_id: Optional linked doctor UUID.
            notes: Optional free-text notes.
            due_date: Optional payment due date. Defaults to 30 days after
                ``invoice_date`` (or today if ``invoice_date`` is omitted).
            invoice_date: Optional invoice creation date. Defaults to today
                when omitted.

        Returns:
            The newly created ``Invoice`` aggregate with items and status
            history populated.

        Raises:
            PatientNotFound: If ``patient_id`` does not resolve.
            TreatmentPlanNotFound: If ``treatment_plan_id`` is provided but
                does not resolve.
            AppointmentNotFoundException: If ``appointment_id`` is provided
                but does not resolve.
            DoctorNotFound: If ``doctor_id`` is provided but does not resolve.
            InvoiceValidationFailed: If a business validation fails.
            InvoiceNumberAlreadyUsed: If the invoice number is taken.
            InvoiceCreationFailed: If a database error occurs.
        """
        try:
            # ── 1. Validate currency ──────────────────────────────
            validated_currency = self._financial.validate_currency_code(currency_code)

            # ── 2. Validate invoice number ────────────────────────
            self._invoice_validator.validate_invoice_number_format(invoice_number)
            self._invoice_validator.validate_invoice_number_unique(invoice_number)

            # ── 3. Resolve dates ──────────────────────────────────
            resolved_invoice_date = invoice_date if invoice_date is not None else date.today()
            if due_date is None:
                resolved_due_date = resolved_invoice_date + timedelta(days=30)
            else:
                resolved_due_date = due_date

            # ── 4. Validate dates ─────────────────────────────────
            self._invoice_validator.validate_invoice_date(
                resolved_invoice_date, resolved_due_date
            )
            self._invoice_validator.validate_due_date(
                resolved_due_date, resolved_invoice_date
            )

            # ── 5. Validate items exist ───────────────────────────
            if not items:
                raise InvoiceValidationFailed(
                    "At least one line item is required to create an invoice",
                    details={"item_count": 0},
                )

            # ── 6. Validate FK references exist (Sprint 12A) ──────
            self._invoice_validator.validate_patient_exists(patient_id)
            self._invoice_validator.validate_treatment_plan_exists(treatment_plan_id)
            self._invoice_validator.validate_appointment_exists(appointment_id)
            self._invoice_validator.validate_doctor_exists(doctor_id)

            # ── 7. Build the aggregate ────────────────────────────
            invoice = Invoice(
                patient_id=patient_id,
                treatment_plan_id=treatment_plan_id,
                appointment_id=appointment_id,
                doctor_id=doctor_id,
                invoice_number=invoice_number.strip(),
                invoice_date=resolved_invoice_date,
                due_date=resolved_due_date,
                status=InvoiceStatus.DRAFT,
                currency_code=validated_currency.upper(),
                notes=notes.strip() if notes else None,
                created_by=created_by,
            )

            # ── 8. Validate and attach line items ─────────────────
            self._validate_and_attach_items(invoice, items, created_by)

            # ── 9. Create initial status history entry ────────────
            status_entry = InvoiceStatusHistory(
                from_status=None,
                to_status=InvoiceStatus.DRAFT.value,
                changed_by=created_by,
                reason="Initial creation",
            )
            invoice.status_history.append(status_entry)

            # ── 10. Persist and commit ────────────────────────────
            self._invoice_repo.create(invoice)
            self._commit()

            logger.info(
                "Invoice created: id=%s, number=%s, patient=%s, items=%d",
                str(invoice.id),
                invoice.invoice_number,
                str(patient_id),
                len(invoice.items),
            )
            return invoice

        except (
            InvoiceNotFound,
            InvoiceValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error during invoice creation for patient %s — rolled back",
                str(patient_id),
            )
            raise InvoiceCreationFailed(
                f"Failed to create invoice for patient {patient_id}"
            )

    # ==================================================================
    # issue_invoice
    # ==================================================================

    def issue_invoice(
        self,
        invoice_id: UUID,
        issued_by: int,
    ) -> Invoice:
        """Transition a Draft invoice to Issued status.

        Workflow:
        1. Acquire a row lock on the invoice.
        2. Validate invoice exists and is issuable (Draft + line items).
        3. Reserve the next invoice document number via
           ``DocumentSequenceService``.
        4. Assign the reserved document number to the invoice.
        5. Transition status to ``Issued`` and append an
           ``InvoiceStatusHistory`` entry.
        6. Persist the aggregate changes and create a
           ``BillingAuditLog`` entry.
        7. Commit the transaction.

        Args:
            invoice_id: UUID of the invoice to issue.
            issued_by: Integer ID of the user issuing the invoice
                (auth.users.id = INTEGER).

        Returns:
            The updated ``Invoice`` aggregate with ``Issued`` status.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            InvoiceValidationFailed: If business validation fails (e.g.,
                missing line items).
            InvalidInvoiceStatusTransition: If the status transition is not
                allowed.
            DocumentSequenceNotFound: If no document sequence exists for
                invoices.
            BillingValidationError: If the document type or sequence
                configuration is invalid.
            SequenceReservationFailed: If document number reservation fails
                due to a database error.
            InvoiceCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ─────────────────────────────────
            invoice = self._invoice_repo.get_for_update(invoice_id)
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Validate status transition ─────────────────────
            self._invoice_validator.validate_status_transition(
                invoice, InvoiceStatus.ISSUED
            )

            # ── 3. Validate issuable ──────────────────────────────
            self._invoice_validator.validate_issuable(invoice)

            # ── 4. Capture pre-mutation state for audit ───────────
            previous_status = invoice.status

            # ── 5. Reserve document number ────────────────────────
            document_number = self._document_sequence_service.reserve_next_number(
                DocumentType.INVOICE, issued_by
            )

            # ── 6. Mutate aggregate ───────────────────────────────
            invoice.invoice_number = document_number
            invoice.status = InvoiceStatus.ISSUED
            invoice.updated_by = issued_by

            status_entry = InvoiceStatusHistory(
                from_status=InvoiceStatus.DRAFT.value,
                to_status=InvoiceStatus.ISSUED.value,
                changed_by=issued_by,
                reason=None,
            )
            invoice.status_history.append(status_entry)

            # ── 7. Audit ─────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="invoice",
                entity_id=invoice.id,
                action=AuditAction.ISSUED,
                old_value={"status": previous_status.value
                    if isinstance(previous_status, InvoiceStatus)
                    else str(previous_status)
                },
                new_value={
                    "status": InvoiceStatus.ISSUED.value,
                    "invoice_number": document_number,
                },
                changed_by=issued_by,
            )
            self._audit_repo.create(audit_log)

            # ── 8. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Invoice issued: id=%s, number=%s, by=%s",
                str(invoice_id),
                document_number,
                str(issued_by),
            )
            return invoice

        except (
            InvoiceNotFound,
            InvoiceValidationFailed,
            InvalidInvoiceStatusTransition,
            DocumentSequenceNotFound,
            BillingValidationError,
            SequenceReservationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error issuing invoice %s — rolled back",
                str(invoice_id),
            )
            raise InvoiceCreationFailed(
                f"Failed to issue invoice {invoice_id}"
            )

    # ==================================================================
    # cancel_invoice
    # ==================================================================

    def cancel_invoice(
        self,
        invoice_id: UUID,
        cancelled_by: int,
        cancellation_reason: str,
    ) -> Invoice:
        """Cancel an invoice and record the cancellation reason.

        Workflow:
        1. Acquire a row lock on the invoice.
        2. Validate invoice exists.
        3. Assign the ``cancellation_reason`` and ``updated_by``.
        4. Validate the invoice is cancellable.
        5. Transition status to ``Cancelled``.
        6. Append an ``InvoiceStatusHistory`` entry.
        7. Persist changes and create a ``BillingAuditLog`` entry.
        8. Commit the transaction.

        Args:
            invoice_id: UUID of the invoice to cancel.
            cancelled_by: Integer ID of the user cancelling the invoice
                (auth.users.id = INTEGER).
            cancellation_reason: The reason for cancellation. Must be
                non-empty.

        Returns:
            The updated ``Invoice`` aggregate with ``Cancelled`` status.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            InvoiceValidationFailed: If ``cancellation_reason`` is empty or
                the invoice is not cancellable.
            InvalidInvoiceStatusTransition: If the status transition is not
                allowed (e.g. invoice is already terminal).
            InvoiceCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ─────────────────────────────────
            invoice = self._invoice_repo.get_for_update(invoice_id)
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Validate status transition ─────────────────────
            self._invoice_validator.validate_status_transition(
                invoice, InvoiceStatus.CANCELLED
            )

            # ── 3. Validate cancellable ──────────────────────────
            self._invoice_validator.validate_cancellable(
                invoice, cancellation_reason=cancellation_reason
            )

            # ── 4. Assign cancellation context ────────────────────
            invoice.cancellation_reason = cancellation_reason.strip()
            invoice.updated_by = cancelled_by

            # ── 5. Transition status ──────────────────────────────
            old_status = invoice.status
            invoice.status = InvoiceStatus.CANCELLED

            status_entry = InvoiceStatusHistory(
                from_status=old_status.value
                if isinstance(old_status, InvoiceStatus)
                else str(old_status),
                to_status=InvoiceStatus.CANCELLED.value,
                changed_by=cancelled_by,
                reason=cancellation_reason.strip(),
            )
            invoice.status_history.append(status_entry)

            # ── 6. Audit ─────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="invoice",
                entity_id=invoice.id,
                action=AuditAction.CANCELLED,
                old_value={"status": old_status.value
                    if isinstance(old_status, InvoiceStatus)
                    else str(old_status)
                },
                new_value={
                    "status": InvoiceStatus.CANCELLED.value,
                    "cancellation_reason": cancellation_reason.strip(),
                },
                changed_by=cancelled_by,
            )
            self._audit_repo.create(audit_log)

            # ── 7. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Invoice cancelled: id=%s, number=%s, by=%s",
                str(invoice_id),
                invoice.invoice_number,
                str(cancelled_by),
            )
            return invoice

        except (
            InvoiceNotFound,
            InvoiceValidationFailed,
            InvalidInvoiceStatusTransition,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error cancelling invoice %s — rolled back",
                str(invoice_id),
            )
            raise InvoiceCreationFailed(
                f"Failed to cancel invoice {invoice_id}"
            )

    # ==================================================================
    # update_draft_invoice
    # ==================================================================

    def update_draft_invoice(
        self,
        invoice_id: UUID,
        updated_by: int,
        *,
        notes: str | None = None,
        due_date: date | None = None,
        items: list[dict[str, Any]] | None = None,
    ) -> Invoice:
        """Update a Draft invoice.

        Workflow:
        1. Acquire a row lock on the invoice.
        2. Validate invoice exists and is editable (Draft).
        3. Apply allowed updates (notes, due_date).
        4. If ``items`` is provided, validate and replace existing items.
        5. Commit the transaction.

        Args:
            invoice_id: UUID of the invoice to update.
            updated_by: Integer ID of the user performing the update
                (auth.users.id = INTEGER).
            notes: Optional replacement notes.
            due_date: Optional replacement due date.
            items: Optional replacement line items. If omitted, existing
                items are preserved.

        Returns:
            The updated ``Invoice`` aggregate.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            InvoiceNotEditable: If the invoice is not in Draft status.
            InvoiceValidationFailed: If a business validation fails.
        """
        try:
            # ── 1. Lock and load ─────────────────────────────────
            invoice = self._invoice_repo.get_for_update(invoice_id)
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Validate editable ──────────────────────────────
            self._invoice_validator.validate_editable(invoice)

            # ── 3. Apply allowed updates ──────────────────────────
            update_fields: dict[str, Any] = {"updated_by": updated_by}
            if notes is not None:
                update_fields["notes"] = notes.strip() or None
            if due_date is not None:
                self._invoice_validator.validate_due_date(
                    due_date, invoice.invoice_date
                )
                update_fields["due_date"] = due_date

            self._invoice_repo.update(invoice, update_fields)

            # ── 4. Replace items if provided ──────────────────────
            if items is not None:
                if not items:
                    raise InvoiceValidationFailed(
                        "At least one line item is required",
                        details={"invoice_id": str(invoice_id)},
                    )
                self._replace_invoice_items(invoice, items, updated_by)

            # ── 5. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Invoice updated: id=%s, number=%s, by=%s",
                str(invoice_id),
                invoice.invoice_number,
                str(updated_by),
            )
            return invoice

        except (
            InvoiceNotFound,
            InvoiceNotEditable,
            InvoiceValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error updating invoice %s — rolled back",
                str(invoice_id),
            )
            raise InvoiceCreationFailed(
                f"Failed to update invoice {invoice_id}"
            )

    # ==================================================================
    # delete_draft_invoice
    # ==================================================================

    def delete_draft_invoice(self, invoice_id: UUID) -> None:
        """Delete a Draft invoice.

        Workflow:
        1. Load the invoice.
        2. Validate it exists and is editable (Draft).
        3. Delete via ``invoice_repo.delete()``.
        4. Commit the transaction.

        Args:
            invoice_id: UUID of the invoice to delete.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            InvoiceNotEditable: If the invoice is not in Draft status.
        """
        try:
            invoice = self._invoice_repo.get_for_update(invoice_id)
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            self._invoice_validator.validate_editable(invoice)

            self._invoice_repo.delete(invoice)
            self._commit()

            logger.info("Invoice deleted: id=%s", str(invoice_id))

        except (
            InvoiceNotFound,
            InvoiceNotEditable,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error deleting invoice %s — rolled back",
                str(invoice_id),
            )
            raise InvoiceCreationFailed(
                f"Failed to delete invoice {invoice_id}"
            )

    # ==================================================================
    # get_invoice
    # ==================================================================

    def get_invoice(self, invoice_id: UUID) -> Invoice:
        """Fetch an invoice by its UUID.

        Read-only operation. No mutation, no commit.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The ``Invoice`` entity.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        invoice = self._invoice_validator.validate_invoice_exists(invoice_id)
        return invoice

    # ==================================================================
    # search_invoices
    # ==================================================================

    def search_invoices(
        self,
        *,
        term: str | None = None,
        patient_id: UUID | None = None,
        doctor_id: UUID | None = None,
        status: InvoiceStatus | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        """Search and filter invoices.

        Read-only operation. No mutation, no commit.

        Args:
            term: Case-insensitive search across ``invoice_number`` and
                patient names.
            patient_id: Filter by patient UUID.
            doctor_id: Filter by doctor UUID.
            status: Filter by invoice status.
            date_from: Only invoices created **on or after** this date.
            date_to: Only invoices created **on or before** this date.
            page: 1-based page number.
            page_size: Page size.
            sort_by: Sort field.
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.
        """
        return self._invoice_repo.list(
            search=term,
            patient_id=patient_id,
            doctor_id=doctor_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _validate_and_attach_items(
        self,
        invoice: Invoice,
        items: list[dict[str, Any]],
        created_by: int,
    ) -> None:
        """Validate line-item data and attach them to ``invoice``.

        Assigns sequence numbers (1-based) if omitted. Does not persist —
        persistence is deferred to ``repo.create()`` via the cascade.

        Validates FK references for ``plan_item_id`` and ``diagnosis_id``
        via the validator (Sprint 12A.1 — line-item FK hardening).

        Args:
            invoice: The aggregate root being built.
            items: Raw item data dicts.
            created_by: User UUID for the new ``InvoiceItem`` records.

        Raises:
            InvoiceValidationFailed: If an item is invalid or sequences
                collide.
            ItemNotFound: If a ``plan_item_id`` references a non-existent
                treatment plan item.
            DiagnosisNotFound: If a ``diagnosis_id`` references a non-existent
                diagnosis.
        """
        seen_sequences: set[int] = set()
        for idx, item_data in enumerate(items, start=1):
            description = item_data.get("description")
            if not description or not str(description).strip():
                raise InvoiceValidationFailed(
                    f"Line item {idx}: description is required",
                    details={"index": idx},
                )

            quantity = item_data.get("quantity", 1)
            self._financial.validate_positive_amount(quantity, field="quantity")

            unit_price = item_data.get("unit_price", Decimal("0.00"))
            self._financial.validate_non_negative_amount(
                unit_price, field="unit_price"
            )

            discount_value = item_data.get("discount_value")
            if discount_value is not None:
                self._financial.validate_non_negative_amount(
                    discount_value, field="discount_value"
                )

            subtotal = unit_price * quantity
            if discount_value is not None and discount_value > subtotal:
                raise InvoiceValidationFailed(
                    f"Line item {idx}: discount exceeds line subtotal",
                    details={
                        "index": idx,
                        "discount": str(discount_value),
                        "subtotal": str(subtotal),
                    },
                )

            net_amount = self._compute_item_net_amount(
                unit_price, quantity, discount_value
            )
            self._financial.validate_non_negative_amount(net_amount, field="net_amount")

            # ── Sprint 12A.1: Validate line-item FK references ──────
            plan_item_id = item_data.get("plan_item_id")
            diagnosis_id = item_data.get("diagnosis_id")
            self._invoice_validator.validate_line_item_plan_item(
                plan_item_id=plan_item_id,
                treatment_plan_id=invoice.treatment_plan_id,
                item_index=idx,
            )
            self._invoice_validator.validate_line_item_diagnosis(
                diagnosis_id=diagnosis_id,
                patient_id=invoice.patient_id,
                item_index=idx,
            )

            sequence = item_data.get("sequence_number")
            if sequence is None:
                sequence = idx
            else:
                sequence = int(sequence)

            if sequence < 1:
                raise InvoiceValidationFailed(
                    f"Line item {idx}: sequence_number must be >= 1",
                    details={"index": idx, "sequence": sequence},
                )

            if sequence in seen_sequences:
                raise InvoiceValidationFailed(
                    f"Line item {idx}: duplicate sequence_number {sequence}",
                    details={"index": idx, "sequence": sequence},
                )
            seen_sequences.add(sequence)

            self._invoice_validator.validate_line_item_sequence(
                invoice, sequence, exclude_item_id=None
            )

            discount_type = item_data.get("discount_type")
            if discount_type is not None and not str(discount_type).strip():
                discount_type = None

            item = InvoiceItem(
                invoice_id=invoice.id,
                sequence_number=sequence,
                description=str(description).strip(),
                quantity=int(quantity),
                unit_price=unit_price,
                discount_type=discount_type,
                discount_value=discount_value,
                net_amount=net_amount,
                plan_item_id=plan_item_id,
                diagnosis_id=diagnosis_id,
                original_price=item_data.get("original_price"),
                override_reason=item_data.get("override_reason"),
                created_by=created_by,
            )
            invoice.items.append(item)

    def _replace_invoice_items(
        self,
        invoice: Invoice,
        items: list[dict[str, Any]],
        updated_by: int,
    ) -> None:
        """Replace all line items on a draft invoice.

        Explicitly deletes existing items through the repository to avoid
        SQLite ``delete-orphan`` / ``passive_deletes`` behaviour that
        does not reliably cascade when FK enforcement is disabled in tests.

        Sequence numbers are re-assigned starting from 1 when omitted.

        Args:
            invoice: The draft invoice to modify.
            items: New line-item dicts.
            updated_by: UUID of the user performing the update.

        Raises:
            InvoiceValidationFailed: If any item is invalid.
        """
        existing_items = list(invoice.items)
        for item in existing_items:
            self._invoice_repo.remove_item(item)
        invoice.items.clear()
        self._validate_and_attach_items(invoice, items, updated_by)

    def _compute_item_net_amount(
        self,
        unit_price: Decimal,
        quantity: int,
        discount_value: Decimal | None = None,
    ) -> Decimal:
        """Derive the net amount for a line item.

        Formula: (unit_price * quantity) - discount_value.
        The result is floored at zero to respect the database check
        constraint.

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
        if net < Decimal("0.00"):
            net = Decimal("0.00")
        return net


__all__ = ["InvoiceService"]
