# Billing Module — Core Workflows

## 1. Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create Invoice
    DRAFT --> ISSUED: Issue Invoice
    DRAFT --> CANCELLED: Cancel Draft
    DRAFT --> VOID: Void Draft
    ISSUED --> PARTIALLY_PAID: Partial Payment
    ISSUED --> PAID: Full Payment
    ISSUED --> CANCELLED: Cancel
    ISSUED --> OVERDUE: Past Due Date
    ISSUED --> VOID: Void
    PARTIALLY_PAID --> PAID: Remaining Payment
    PARTIALLY_PAID --> OVERDUE: Past Due Date
    PARTIALLY_PAID --> CANCELLED: Cancel
    PARTIALLY_PAID --> VOID: Void
    PAID --> VOID: Void
    OVERDUE --> PARTIALLY_PAID: Partial Payment
    OVERDUE --> PAID: Full Payment
    OVERDUE --> CANCELLED: Cancel
    OVERDUE --> VOID: Void
    CANCELLED --> [*]: Terminal
    VOID --> [*]: Terminal
```

### Key Rules

- **DRAFT** is the only editable status — line items and amounts can change
- **ISSUED** freezes all amounts and assigns a permanent sequential invoice number
- Once **ISSUED**, an invoice becomes immutable (see ADR-002)
- An **ISSUED** invoice can be **CANCELLED** with a required reason
- **CANCELLED** and **VOID** are terminal states with no outgoing transitions

### Implementation Flow

```
1. POST /billing/invoices
   → Creates invoice in DRAFT status
   → Validates line items
   → Computes grand_total
   → Returns InvoiceResponse

2. POST /billing/invoices/{id}/issue
   → Validates status is DRAFT
   → Validates at least 1 line item exists
   → Reserves document sequence number (gap-tracked)
   → Creates sequence consumption log
   → Updates status to ISSUED
   → Returns InvoiceResponse with permanent invoice_number

3. POST /billing/invoices/{id}/cancel
   → Requires cancellation_reason
   → Validates status is ISSUED/OVERDUE
   → Updates status to CANCELLED
   → Records audit trail

4. PATCH /billing/invoices/{id}
   → Only updates notes and due_date
   → Validates status is DRAFT
   → Returns updated InvoiceResponse
```

## 2. Payment Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Record Payment
    PENDING --> COMPLETED: Complete
    PENDING --> FAILED: Mark Failed
    PENDING --> VOID: Void
    COMPLETED --> REFUNDED: Full Refund
    COMPLETED --> REVERSED: Payment Reversed
    FAILED --> PENDING: Retry
    COMPLETED --> [*]: Terminal (after refund/reverse)
    FAILED --> [*]: Terminal (after retry window)
    REFUNDED --> [*]: Terminal
    REVERSED --> [*]: Terminal
    VOID --> [*]: Terminal
```

### Key Rules

- **PENDING** is the only editable status
- **COMPLETED** payments can be allocated to invoices
- A payment can be allocated across multiple invoices
- Allocations cannot exceed the payment's total amount
- Allocations cannot exceed the invoice's grand total

### Implementation Flow

```
1. POST /billing/payments
   → Validates patient exists
   → Creates payment in PENDING status
   → Returns PaymentResponse

2. POST /billing/payments/{id}/complete
   → Validates status is PENDING
   → Updates to COMPLETED
   → Returns PaymentResponse

3. POST /billing/payments/{id}/allocate
   → Validates payment is COMPLETED
   → Validates invoice is ISSUED/PARTIALLY_PAID/OVERDUE
   → Validates amounts
   → Creates payment allocation
   → Updates invoice status if fully paid
   → Returns AllocationResponse
```

## 3. Refund Workflow

```mermaid
stateDiagram-v2
    [*] --> PENDING: Request Refund
    PENDING --> APPROVED: Approve
    PENDING --> REJECTED: Reject (requires reason)
    APPROVED --> COMPLETED: Execute
    REJECTED --> [*]: Terminal
    COMPLETED --> [*]: Terminal
```

### Key Rules

- **PENDING** refunds can be approved or rejected
- **APPROVED** refunds can be executed once
- Refund amount cannot exceed the original payment amount
- A completed refund reverses the corresponding payment allocation

### Implementation Flow

```
1. POST /billing/refunds
   → Validates payment exists and is completed
   → Validates refund amount ≤ payment amount
   → Creates refund in PENDING status
   → Returns RefundResponse

2. POST /billing/refunds/{id}/approve
   → Validates status is PENDING
   → Administrative action (RBAC-guarded)
   → Updates to APPROVED
   → Returns RefundResponse

3. POST /billing/refunds/{id}/complete
   → Validates status is APPROVED
   → Executes refund (reverses allocation)
   → Updates to COMPLETED
   → Returns RefundResponse
```

## 4. Receipt Generation

```mermaid
sequenceDiagram
    participant Client
    participant Router
    participant ReceiptService
    participant ReceiptRepo
    participant DocSequence

    Client->>Router: POST /billing/receipts {payment_id}
    Router->>ReceiptService: generate_receipt(payment_id)
    ReceiptService->>ReceiptRepo: lock payment by id
    alt Payment not found
        ReceiptRepo-->>ReceiptService: None
        ReceiptService-->>Router: raise PaymentNotFound
        Router-->>Client: 404
    else
        ReceiptService->>DocSequence: reserve_next_number("receipt")
        ReceiptService->>ReceiptRepo: create receipt record
        ReceiptService->>DocSequence: mark consumption COMPLETED
        ReceiptService-->>Router: ReceiptResponse
        Router-->>Client: 201
    end
```

## 5. Credit Note Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create
    DRAFT --> ISSUED: Issue
    DRAFT --> VOID: Void
    ISSUED --> APPLIED: Apply to Invoice
    ISSUED --> VOID: Void
    ISSUED --> EXPIRED: Past Expiry
    APPLIED --> [*]: Terminal
    VOID --> [*]: Terminal
    EXPIRED --> [*]: Terminal
```

### Key Rules

- Credit notes are created against an invoice
- **DRAFT** credit notes can be issued or voided
- **ISSUED** credit notes can be applied, voided, or expire
- Applying a credit note reduces the outstanding balance of the target invoice
- Once applied, voided, or expired, a credit note cannot be modified
