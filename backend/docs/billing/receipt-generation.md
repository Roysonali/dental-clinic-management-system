# Receipt Generation

## Overview

Receipts are generated for completed payments. Each receipt carries a unique sequential number and serves as a formal acknowledgment of payment.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/billing/receipts/{receipt_id}` | Retrieve a receipt |
| `POST` | `/billing/receipts` | Generate receipt for a payment (payment_id in body) |
| `POST` | `/billing/receipts/{receipt_id}/regenerate` | Regenerate an existing receipt |

## Business Rules

1. Receipts can only be generated against **COMPLETED** payments
2. A payment can have at most one active receipt
3. Receipt regeneration creates a new version of the receipt with an incremented sequence
4. Old receipt versions are preserved for audit purposes
5. Each receipt receives a unique sequential number via `DocumentSequenceService`

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Router
    participant Service as ReceiptService
    participant PaymentRepo
    participant ReceiptRepo
    participant Sequence as DocumentSequenceService

    Client->>Router: POST /billing/receipts {payment_id}
    Router->>Service: generate_receipt(payment_id, user)
    Service->>PaymentRepo: get_for_update(payment_id)
    alt Payment not found
        PaymentRepo-->>Service: None
        Service-->>Router: PaymentNotFound
        Router-->>Client: 404
    else Payment not completed
        PaymentRepo-->>Service: Payment(status!=COMPLETED)
        Service-->>Router: ReceiptValidationFailed
        Router-->>Client: 422
    else Receipt exists
        Service->>ReceiptRepo: find_by_payment(payment_id)
        ReceiptRepo-->>Service: existing receipt
        Service-->>Router: ReceiptAlreadyExists
        Router-->>Client: 409
    else Success
        Service->>Sequence: reserve_next_number("receipt")
        Service->>ReceiptRepo: create receipt record
        Service->>Sequence: mark_consumed(COMPLETED)
        Service-->>Router: ReceiptResponse
        Router-->>Client: 201
    end
```
