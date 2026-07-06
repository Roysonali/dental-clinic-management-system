"""
Patient Record Mapper
=====================

Production-grade mapper for converting ``PatientRecord`` ORM instances
to Pydantic response schemas.

All response schemas already declare ``from_attributes=True`` in their
``model_config``, which means Pydantic can perform the conversion
automatically.  This mapper exists to:

1. Provide a **single entry point** for all ORM → schema conversions
   so that callers don't need to import ``model_validate`` everywhere.
2. Add **convenience methods** for list / summary / nested conversions.
3. **Decouple** the service/router layer from Pydantic internals — if
   the serialisation logic ever becomes more complex (e.g. computed
   fields, role-based field filtering), the mapper is the right place
   to centralise those transformations.

Usage
-----
    from app.modules.patient_records.mappers import PatientRecordMapper

    response = PatientRecordMapper.to_response(orm_record)
    summary = PatientRecordMapper.to_summary(orm_record)
    items = PatientRecordMapper.to_response_list(orm_records)
"""

from __future__ import annotations

from typing import Sequence

from app.modules.patient_records.schemas.patient_record_schema import (
    PatientRecordListItem,
    PatientRecordNestedResponse,
    PatientRecordResponse,
    PatientRecordSummaryResponse,
)


class PatientRecordMapper:
    """Stateless utility methods for converting ``PatientRecord`` ORM
    instances to Pydantic response schemas.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Single-record conversions
    # ==================================================================

    @staticmethod
    def to_response(record) -> PatientRecordResponse:
        """Convert a ``PatientRecord`` ORM instance to the full response schema.

        Includes all nested relationships (diagnoses, prescriptions,
        follow-ups, attachments, audit logs) with their respective
        nested response schemas.

        Args:
            record: A ``PatientRecord`` ORM instance (or equivalent
                dict-like object).

        Returns:
            A ``PatientRecordResponse`` with all fields populated.
        """
        return PatientRecordResponse.model_validate(record)

    @staticmethod
    def to_summary(record) -> PatientRecordSummaryResponse:
        """Convert a ``PatientRecord`` ORM instance to the summary schema.

        The summary schema includes only the most commonly displayed
        fields: ``id``, ``status``, ``chief_complaint``,
        ``is_finalized``, ``created_at``, and ``updated_at``.

        Args:
            record: A ``PatientRecord`` ORM instance.

        Returns:
            A ``PatientRecordSummaryResponse``.
        """
        return PatientRecordSummaryResponse.model_validate(record)

    @staticmethod
    def to_nested(record) -> PatientRecordNestedResponse:
        """Convert a ``PatientRecord`` ORM instance to the nested schema.

        The nested schema is a lightweight representation with only
        ``id``, ``status``, ``is_finalized``, and ``chief_complaint``.
        It is used when embedding a patient record inside another
        response (e.g. appointment details).

        Args:
            record: A ``PatientRecord`` ORM instance.

        Returns:
            A ``PatientRecordNestedResponse``.
        """
        return PatientRecordNestedResponse.model_validate(record)

    @staticmethod
    def to_list_item(record) -> PatientRecordListItem:
        """Convert a ``PatientRecord`` ORM instance to a list item schema.

        The list item schema is used for paginated list responses and
        includes ``id``, ``patient_id``, ``appointment_id``, ``status``,
        ``is_finalized``, ``chief_complaint``, and ``created_at``.

        Args:
            record: A ``PatientRecord`` ORM instance.

        Returns:
            A ``PatientRecordListItem``.
        """
        return PatientRecordListItem.model_validate(record)

    # ==================================================================
    # Collection conversions
    # ==================================================================

    @staticmethod
    def to_response_list(
        records: Sequence,
    ) -> list[PatientRecordResponse]:
        """Convert a sequence of ``PatientRecord`` ORM instances to a list
        of full response schemas.

        Args:
            records: Iterable of ``PatientRecord`` ORM instances.

        Returns:
            A list of ``PatientRecordResponse`` objects.
        """
        return [PatientRecordMapper.to_response(r) for r in records]

    @staticmethod
    def to_summary_list(
        records: Sequence,
    ) -> list[PatientRecordSummaryResponse]:
        """Convert a sequence of ``PatientRecord`` ORM instances to a list
        of summary response schemas.

        Args:
            records: Iterable of ``PatientRecord`` ORM instances.

        Returns:
            A list of ``PatientRecordSummaryResponse`` objects.
        """
        return [PatientRecordMapper.to_summary(r) for r in records]

    @staticmethod
    def to_list_items(
        records: Sequence,
    ) -> list[PatientRecordListItem]:
        """Convert a sequence of ``PatientRecord`` ORM instances to a list
        of list-item schemas (used in paginated responses).

        Args:
            records: Iterable of ``PatientRecord`` ORM instances.

        Returns:
            A list of ``PatientRecordListItem`` objects.
        """
        return [PatientRecordMapper.to_list_item(r) for r in records]
