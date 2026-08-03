# Logical ER Diagram — Billing Module

> **Document Type:** Architecture Diagram (Mermaid)
> **Last Updated:** 2026-07-20

## Logical Entity-Relationship Diagram

```mermaid
erDiagram
    INVOICE ||--|{ INVOICE_LINE_ITEM : "contains"
    INVOICE ||--|{ INVOICE_STATUS_HISTORY : "tracks"
    INVOICE }o--|| PATIENT : "belongs to"
    INVOICE }o--|| TREATMENT_PLAN : "sourced from"
    INVOICE }o--|| DOCTOR : "treated by"
    INVOICE }o--|| APPOINTMENT : "references"

    PAYMENT ||--|{ PAYMENT_ALLOCATION : "allocates via"
    PAYMENT }o--|| PATIENT : "received from"

    PAYMENT_ALLOCATION }|--|| INVOICE : "applied to"
    PAYMENT_ALLOCATION }o--|| PAYMENT_ALLOCATION : "reversed by"

    RECEIPT ||--|{ RECEIPT_INVOICE : "covers"
    RECEIPT }o--|| PAYMENT : "references"

    RECEIPT_INVOICE }|--|| INVOICE : "refers to"

    CREDIT_NOTE }o--|| INVOICE : "corrects"
    CREDIT_NOTE }o--|| PATIENT : "issued to"

    PATIENT_CREDIT }o--|| PATIENT : "belongs to"
    PATIENT_CREDIT }o--|| PAYMENT_ALLOCATION : "originates from"
    PATIENT_CREDIT }o--|| CREDIT_NOTE : "originates from"

    DOCUMENT_SEQUENCE ||--|{ SEQUENCE_CONSUMPTION_LOG : "audited by"

    TAX_RATE }o--|| INVOICE_LINE_ITEM : "applies to" : "Phase 2"

    INVOICE_LINE_ITEM }o--|| TAX_RATE : "taxed by"
```

## Entity Summary

| Entity | Type | Phase | Rows (Year 1 Est.) |
|---|---|---|---|
| INVOICE | Core | MVP | 24,000 |
| INVOICE_LINE_ITEM | Core | MVP | 120,000 |
| INVOICE_STATUS_HISTORY | Audit | MVP | 48,000 |
| PAYMENT | Core | MVP | 24,000 |
| PAYMENT_ALLOCATION | Core | MVP | 30,000 |
| RECEIPT | Core | MVP | 24,000 |
| RECEIPT_INVOICE | Join | MVP | 25,000 |
| CREDIT_NOTE | Core | Phase 2 | 2,400 |
| PATIENT_CREDIT | Core | MVP | 2,400 |
| DOCUMENT_SEQUENCE | Utility | MVP | 5 |
| SEQUENCE_CONSUMPTION_LOG | Audit | MVP | 72,000 |
| TAX_RATE | Reference | Phase 2 | 20 |

## Cross-Reference

| Direction | Document |
|---|---|
| **Part of** | [03-table-specifications.md](../03-table-specifications.md) |
| **Related** | [diagrams/physical-er-diagram.md](physical-er-diagram.md) |
