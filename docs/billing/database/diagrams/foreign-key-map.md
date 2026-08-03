# Foreign Key Map — Billing Module

> **Document Type:** Architecture Diagram (Mermaid)
> **Last Updated:** 2026-07-20

## Foreign Key Relationship Map

```mermaid
graph TB
    subgraph "Enforced Foreign Keys (Within Billing)"
        ILI[invoice_line_items] -->|invoice_id| INV[invoices]
        ISH[invoice_status_history] -->|invoice_id| INV
        PAL[payment_allocations] -->|payment_id| PAY[payments]
        PAL -->|invoice_id| INV
        PAL -.->|original_allocation_id| PAL
        REC[receipts] -->|payment_id| PAY
        RINV[receipt_invoices] -->|receipt_id| REC
        RINV -->|invoice_id| INV
        ILI -.->|tax_rate_id| TAX[tax_rates]
    end

    subgraph "Application-Level References (No DB FK)"
        INV -->|patient_id| PAT[Patient Module]
        INV -->|treatment_plan_id| TP[Treatment Plan Module]
        INV -->|appointment_id| APPT[Appointment Module]
        INV -->|doctor_id| DOC[Doctor Module]
        ILI -->|plan_item_id| TP
        ILI -->|diagnosis_id| PR[Patient Records]
        PAY -->|patient_id| PAT
        CN[credit_notes] -->|invoice_id| INV
        CN -->|patient_id| PAT
        PC[patient_credits] -->|patient_id| PAT
        PC -.->|source_allocation_id| PAL
        PC -.->|source_credit_note_id| CN
    end

    subgraph "User Attribution (Everywhere)"
        INV -->|created_by/updated_by| USR[User Module]
        PAY -->|created_by/updated_by| USR
        ILI -->|created_by/updated_by| USR
    end

    classDef enforced fill:#4caf50,color:#fff
    classDef app fill:#ff9800,color:#fff
    classDef user fill:#2196f3,color:#fff

    class INV,ILI,ISH,PAY,PAL,REC,RINV,TAX enforced
    class PAT,TP,APPT,DOC,PR,CN,PC app
    class USR user
```

## FK Enforcement Summary

| Type | Count | Tables |
|---|---|---|
| Enforced (within Billing schema) | 9 | All composition relationships within Billing |
| Application-level (to external modules) | 14 | patient_id, treatment_plan_id, doctor_id, appointment_id, plan_item_id, diagnosis_id |
| User references | 4 per table | created_by, updated_by |

## FK Enforcement Rules

| Rule | Description |
|---|---|
| **Composition FKs** | Always enforced with RESTRICT. Parent cannot be deleted while children exist. |
| **Reference FKs** | Always enforced with RESTRICT. Referenced record cannot be deleted while references exist. |
| **Self-referencing FKs** | `original_allocation_id` uses SET NULL — refund allocation can exist without the original (if original was deleted — though this should not happen). |
| **External UUID references** | No FK constraint. Application validates existence before creating records. |

## Cross-Reference

| Direction | Document |
|---|---|
| **Part of** | [04-primary-and-foreign-keys.md](../04-primary-and-foreign-keys.md) |
| **Related** | [03-table-specifications.md](../03-table-specifications.md) |
