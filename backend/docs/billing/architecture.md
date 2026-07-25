# Billing Module — Architecture

> **Module:** `app.modules.billing`
> **Sprint:** 7 (Router Layer) | **Status:** Complete & Approved

## Overview

The Billing module implements an invoice-centric aggregate billing system for the DensCare Dental Clinic Management Platform. It follows Clean Architecture, Domain-Driven Design (DDD), and SOLID principles.

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TRANSPORT LAYER                         │
│  routers/                                                   │
│  • invoice.py  • payment.py  • receipt.py                   │
│  • refund.py   • credit_note.py  • dashboard.py             │
│  (thin — delegates to services & mappers only)              │
├─────────────────────────────────────────────────────────────┤
│                   APPLICATION LAYER                         │
│  services/    — Business orchestration                      │
│  validators/  — Domain & financial validation               │
│  mappers/     — ORM → DTO conversion                        │
│  dependencies.py — FastAPI DI wiring                        │
├─────────────────────────────────────────────────────────────┤
│                    DOMAIN LAYER                             │
│  models.py     — SQLAlchemy ORM models                      │
│  enums.py      — Domain enums (InvoiceStatus, CurrencyCode…) │
│  constants.py  — State machines, financial constants        │
│  exceptions.py — Typed exception hierarchy                  │
├─────────────────────────────────────────────────────────────┤
│                  PERSISTENCE LAYER                           │
│  repositories/ — Data access (repository pattern)           │
│  utils/        — Money, numbering, validation utilities     │
└─────────────────────────────────────────────────────────────┘
```

## Aggregate Root

The **Invoice** is the aggregate root. All financial operations (payments, receipts, refunds, credit notes) reference an invoice.

## Key Principles

| Principle | Application |
|-----------|------------|
| **Clean Architecture** | Dependencies point inward: Routers → Services → Repositories → Models |
| **DDD** | Invoice is the aggregate root; domain logic lives in services, not models |
| **SOLID** | Single-responsibility services, interface-segregated repositories |
| **Thin Routers** | Zero business logic — only DI, auth, validation, delegation |
| **Mapper-Only DTOs** | ORM→DTO conversion belongs exclusively in mappers |
| **Stateless Mappers** | All mappers use `@staticmethod` only — no state, no side effects |
| **Typed Exceptions** | Every domain error has a stable `code` for client consumption |

## Router Registration

```
main.py
  └─ billing_router (prefix="/billing", tag="Billing")
       ├─ invoice_router (prefix="/invoices")
       │    ├─ GET    /                           → list_invoices
       │    ├─ POST   /                           → create_invoice
       │    ├─ GET   /{invoice_id}                → get_invoice
       │    ├─ PATCH /{invoice_id}                → update_invoice
       │    ├─ POST  /{invoice_id}/issue          → issue_invoice
       │    ├─ POST  /{invoice_id}/cancel         → cancel_invoice
       │    └─ DELETE /{invoice_id}               → delete_invoice
       ├─ payment_router (prefix="/payments")
       │    ├─ GET    /                           → list_payments
       │    ├─ POST   /                           → create_payment
       │    ├─ GET   /{payment_id}                → get_payment
       │    ├─ PATCH /{payment_id}                → update_payment
       │    ├─ DELETE /{payment_id}                → delete_payment
       │    ├─ POST  /{payment_id}/complete       → complete_payment
       │    ├─ POST  /{payment_id}/fail           → fail_payment
       │    ├─ POST  /{payment_id}/void           → void_payment
        │    ├─ POST  /{payment_id}/allocate       → allocate_payment
        │    ├─ POST  /{payment_id}/deallocate     → deallocate_payment
        │    └─ GET   /{payment_id}/allocations    → list_allocations
        ├─ receipt_router (prefix="/receipts")
        │    ├─ GET   /{receipt_id}                → get_receipt
        │    ├─ POST  /                            → generate_receipt
        │    └─ POST  /{receipt_id}/regenerate     → regenerate_receipt
       ├─ refund_router (prefix="/refunds")
       │    ├─ POST   /                           → create_refund
       │    ├─ POST  /{refund_id}/approve         → approve_refund
       │    ├─ POST  /{refund_id}/reject          → reject_refund
       │    └─ POST  /{refund_id}/complete        → complete_refund
       ├─ credit_note_router (prefix="/credit-notes")
       │    ├─ POST   /                           → create_credit_note
       │    ├─ POST  /{cn_id}/issue               → issue_credit_note
       │    ├─ POST  /{cn_id}/void                → void_credit_note
       │    └─ POST  /{cn_id}/apply               → apply_credit_note
       └─ dashboard_router (prefix="")
            ├─ GET /billing/dashboard              → get_billing_dashboard
            └─ GET /billing/summary                → get_billing_summary
```

## Dependencies

All dependencies are wired in `dependencies.py` using FastAPI `Depends()`:

| Dependency | Produces | Used By |
|-----------|----------|---------|
| `get_db` | `Session` | All services |
| `get_current_user` | `User` (JWT) | All endpoints |
| `role_required(...)` | RBAC guard | All endpoints |
| `get_invoice_service` | `InvoiceService` | Invoice router |
| `get_payment_service` | `PaymentService` | Payment router |
| `get_receipt_service` | `ReceiptService` | Receipt router |
| `get_refund_service` | `RefundService` | Refund router |
| `get_credit_note_service` | `CreditNoteService` | Credit note router |
| `get_billing_orchestration_service` | `BillingOrchestrationService` | Dashboard router |

## State Machines

| Entity | States | Transitions |
|--------|--------|-------------|
| **Invoice** | `draft → issued → partially_paid → paid → overdue → cancelled → void` | `InvoiceStatus.editable_statuses() = {DRAFT}` |
| **Payment** | `pending → completed/failed/void → refunded/reversed` | `PaymentStatus.editable_statuses() = {PENDING}` |
| **Refund** | `pending → approved → completed` (or `pending → rejected`) | `RefundStatus.editable_statuses() = {PENDING}` |
| **Receipt** | `generated → cancelled` | Immutable after generation |
| **Credit Note** | `draft → issued → applied/expired/void` | `CreditNoteStatus.editable_statuses() = {DRAFT}` |

## Known Architecture Boundary

Auth module users use integer primary keys (`User.id`). Billing audit/user-reference columns use UUID foreign keys. This means write endpoints cannot be tested end-to-end through the HTTP stack without fixture overrides — an acknowledged pre-existing boundary.

_See `known-limitations.md` for details._
