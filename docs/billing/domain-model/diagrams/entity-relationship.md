# Entity Relationship Diagram — Billing Domain

> **Document Type:** Architecture Diagram (Mermaid)
> **Last Updated:** 2026-07-20

## Conceptual ER Diagram

```mermaid
erDiagram
    INVOICE ||--|{ LINE_ITEM : "owns (composition)"
    INVOICE ||--|{ INVOICE_STATUS_HISTORY : "records (composition)"
    INVOICE }|--|| PATIENT : "references"
    INVOICE }|--|{ PAYMENT_ALLOCATION : "allocated to"
    INVOICE |o--|| TREATMENT_PLAN : "optionally sourced from"
    INVOICE |o--|| DOCTOR : "optionally references"
    INVOICE |o--|| APPOINTMENT : "optionally references"

    PAYMENT ||--|{ PAYMENT_ALLOCATION : "owns (composition)"
    PAYMENT }|--|| PATIENT : "references"

    PAYMENT_ALLOCATION }|--|| PAYMENT : "belongs to"
    PAYMENT_ALLOCATION }|--|| INVOICE : "allocates to"
    PAYMENT_ALLOCATION |o--|| PAYMENT_ALLOCATION : "refund reverses (self-ref)"

    RECEIPT }|--|| PAYMENT : "references"
    RECEIPT }|--|{ INVOICE : "references"

    CREDIT_NOTE }|--|| INVOICE : "corrects"
    CREDIT_NOTE }|--|| PATIENT : "references"

    PATIENT_CREDIT }|--|| PATIENT : "belongs to"
    PATIENT_CREDIT |o--|| PAYMENT_ALLOCATION : "originates from (overpayment)"
    PATIENT_CREDIT |o--|| CREDIT_NOTE : "originates from"

    DOCUMENT_SEQUENCE ||--|{ SEQUENCE_CONSUMPTION : "logs (composition)"

    INVOICE {
        uuid invoice_id PK
        uuid patient_id FK
        uuid treatment_plan_id FK "optional"
        uuid appointment_id FK "optional"
        uuid doctor_id FK "optional"
        uuid created_by FK
        uuid updated_by FK
        string invoice_number
        date invoice_date
        date due_date
        enum status
        string currency
        text notes
        string cancellation_reason "nullable"
        string void_reason "nullable"
        datetime created_at
        datetime updated_at
    }

    LINE_ITEM {
        uuid line_item_id PK
        uuid invoice_id FK
        uuid plan_item_id FK "optional"
        uuid diagnosis_id FK "optional"
        string description
        int quantity
        decimal unit_price
        decimal discount_amount
        enum discount_type
        decimal net_amount
        decimal tax_amount "Phase 2"
        decimal original_price "if overridden"
        string override_reason "if overridden"
    }

    PAYMENT {
        uuid payment_id PK
        uuid patient_id FK
        uuid created_by FK
        string payment_number
        enum payment_method
        decimal total_amount
        date payment_date
        string reference_number "nullable"
        boolean is_reversed
        string reversal_reason "nullable"
        text notes
        datetime created_at
    }

    PAYMENT_ALLOCATION {
        uuid allocation_id PK
        uuid payment_id FK
        uuid invoice_id FK
        decimal allocated_amount
        boolean is_refund
        string refund_reason "nullable"
        uuid original_allocation_id FK "self-ref, nullable"
        uuid created_by FK
        datetime created_at
    }

    RECEIPT {
        uuid receipt_id PK
        uuid payment_id FK
        string receipt_number
        date receipt_date
        decimal amount
        datetime created_at
    }

    CREDIT_NOTE {
        uuid credit_note_id PK
        uuid invoice_id FK
        uuid patient_id FK
        string credit_note_number
        date issue_date
        decimal amount
        decimal remaining_balance
        string reason
        enum status
        date expiry_date
        string void_reason "nullable"
        datetime created_at
    }

    PATIENT_CREDIT {
        uuid patient_credit_id PK
        uuid patient_id FK
        uuid source_allocation_id FK "nullable"
        uuid source_credit_note_id FK "nullable"
        decimal original_amount
        decimal remaining_amount
        date expiry_date "nullable"
        datetime created_at
    }

    DOCUMENT_SEQUENCE {
        string document_type PK
        string prefix
        bigint current_value
        int min_digits
        bigint start_value
        datetime updated_at
        uuid updated_by
    }

    SEQUENCE_CONSUMPTION {
        uuid id PK
        string document_type
        bigint number_assigned
        datetime reserved_at
        uuid reserved_by
        uuid document_id "nullable"
        string status
    }
```

## Legend

| Notation | Meaning |
|---|---|
| `||--||` | One-to-one |
| `||--|{` | One-to-many (non-optional) |
| `||--o{` | One-to-many (optional) |
| `}|--||` | Many-to-one (non-optional) |
| `}o--||` | Many-to-one (optional from child side) |
| `FK` | Foreign key reference to another entity |
| `PK` | Primary key |

## Cross-Reference

| Direction | Document |
|---|---|
| **Part of** | [18-er-diagram.md](../18-er-diagram.md) |
| **Related** | [12-entity-relationships.md](../12-entity-relationships.md) |
