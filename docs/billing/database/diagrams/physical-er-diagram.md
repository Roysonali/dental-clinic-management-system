# Physical ER Diagram — Billing Module

> **Document Type:** Architecture Diagram (Mermaid)
> **Last Updated:** 2026-07-20

## Physical Table Relationship Diagram

```mermaid
erDiagram
    invoices {
        uuid invoice_id PK
        uuid patient_id FK "External"
        uuid treatment_plan_id FK "Optional"
        uuid appointment_id FK "Optional"
        uuid doctor_id FK "Optional"
        varchar invoice_number UK
        date invoice_date
        date due_date
        varchar status "draft|issued|partially_paid|paid|overdue|cancelled|void"
        varchar currency
        text notes "Nullable"
        text cancellation_reason "Nullable"
        text void_reason "Nullable"
        int version "Optimistic lock"
        uuid created_by "External FK"
        timestamptz created_at
        uuid updated_by "External FK"
        timestamptz updated_at
    }

    invoice_line_items {
        uuid line_item_id PK
        uuid invoice_id FK
        uuid plan_item_id FK "Optional"
        uuid diagnosis_id FK "Optional"
        varchar description
        int quantity ">= 1"
        numeric unit_price ">= 0"
        varchar discount_type "PERCENTAGE|FIXED_AMOUNT|NULL"
        numeric discount_value "Nullable"
        numeric net_amount
        uuid tax_rate_id FK "Phase 2"
        numeric tax_amount "Phase 2"
        numeric original_price "Nullable"
        varchar override_reason "Nullable"
        int version
        uuid created_by
        timestamptz created_at
        uuid updated_by
        timestamptz updated_at
    }

    invoice_status_history {
        uuid status_history_id PK
        uuid invoice_id FK
        varchar from_status "Nullable for first"
        varchar to_status
        uuid changed_by
        timestamptz changed_at
        text reason "Nullable"
    }

    payments {
        uuid payment_id PK
        uuid patient_id FK "External"
        varchar payment_number UK
        varchar payment_method "Extensible"
        numeric total_amount "> 0"
        date payment_date
        varchar reference_number "Gateway/Cheque #"
        varchar status "pending|completed|failed|refunded|reversed|void"
        boolean is_reversed
        text reversal_reason "Nullable"
        text notes "Nullable"
        int version
        uuid created_by
        timestamptz created_at
        uuid updated_by
        timestamptz updated_at
    }

    payment_allocations {
        uuid allocation_id PK
        uuid payment_id FK
        uuid invoice_id FK "Ref"
        numeric allocated_amount
        boolean is_refund
        text refund_reason "Nullable"
        uuid original_allocation_id FK "Self-ref"
        uuid created_by
        timestamptz created_at
    }

    receipts {
        uuid receipt_id PK
        uuid payment_id FK "Ref"
        varchar receipt_number UK
        date receipt_date
        numeric amount
        varchar status "generated|cancelled"
        uuid created_by
        timestamptz created_at
    }

    receipt_invoices {
        uuid receipt_id FK
        uuid invoice_id FK "Ref"
    }

    credit_notes {
        uuid credit_note_id PK
        uuid invoice_id FK "Ref"
        uuid patient_id FK "External"
        varchar credit_note_number UK
        date issue_date
        numeric amount
        numeric remaining_balance
        text reason
        varchar status "draft|issued|applied|expired|void"
        date expiry_date "Nullable"
        text void_reason "Nullable"
        int version
        uuid created_by
        timestamptz created_at
        uuid updated_by
        timestamptz updated_at
    }

    patient_credits {
        uuid patient_credit_id PK
        uuid patient_id FK "External"
        uuid source_allocation_id FK "Nullable"
        uuid source_credit_note_id FK "Nullable"
        numeric original_amount
        numeric remaining_amount ">= 0"
        date expiry_date "Nullable"
        uuid created_by
        timestamptz created_at
        uuid updated_by
        timestamptz updated_at
    }

    document_sequences {
        varchar document_type PK "invoice|receipt|payment|refund|credit_note"
        varchar prefix "INV-|RCT-|PAY-|RFD-|CN-"
        bigint current_value
        int min_digits
        bigint start_value
        timestamptz updated_at
        uuid updated_by
    }

    sequence_consumption_log {
        uuid id PK
        varchar document_type
        bigint number_assigned
        timestamptz reserved_at
        uuid reserved_by
        uuid document_id "Nullable if failed"
        varchar status "completed|failed|rolled_back"
    }

    tax_rates {
        uuid tax_rate_id PK
        varchar name
        numeric rate
        varchar jurisdiction
        boolean is_active
        uuid created_by
        timestamptz created_at
        uuid updated_by
        timestamptz updated_at
    }

    invoices ||--|{ invoice_line_items : "has"
    invoices ||--|{ invoice_status_history : "tracks"
    payments ||--|{ payment_allocations : "has"
    receipts ||--|{ receipt_invoices : "includes"
    payment_allocations }|--|| invoices : "allocates to"
    receipt_invoices }|--|| invoices : "refers to"
    credit_notes }|--|| invoices : "corrects"
    tax_rates |o--|{ invoice_line_items : "applied to (Phase 2)"
```

## Table Count

| Category | Count | Tables |
|---|---|---|
| Core domain tables | 8 | invoices, invoice_line_items, payments, payment_allocations, receipts, credit_notes, patient_credits |
| Join tables | 1 | receipt_invoices |
| Audit tables | 2 | invoice_status_history, sequence_consumption_log |
| Utility tables | 2 | document_sequences, tax_rates |

## Color Legend (for visual implementation)

| Entity Type | Suggested Color |
|---|---|
| Aggregate Root | Blue header |
| Child Entity | Light blue header |
| Join Table | Green header |
| Audit/History | Grey header |
| Utility/Reference | Yellow header |

## Cross-Reference

| Direction | Document |
|---|---|
| **Part of** | [03-table-specifications.md](../03-table-specifications.md) |
| **Related** | [diagrams/logical-er-diagram.md](logical-er-diagram.md) |
