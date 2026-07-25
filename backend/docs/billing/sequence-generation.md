# Document Sequence Generation (ADR-003)

## Overview

Every issued financial document (invoice, receipt, credit note) receives a unique, sequential, human-readable number. The numbering system follows ADR-003 with gap tracking for auditability.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 DocumentSequenceService                      │
│                                                             │
│  reserve_next_number(document_type) → str                   │
│  mark_consumed(number_id, status)                           │
│  rollback_reservation(number_id)                            │
├─────────────────────────────────────────────────────────────┤
│                  SequenceConsumptionLog                      │
│  • id (UUID, PK)                                            │
│  • document_type (str)                                      │
│  • sequence_number (int)                                    │
│  • document_id (UUID, nullable — filled on completion)      │
│  • status (completed | failed | rolled_back)                │
│  • reserved_at (datetime)                                   │
│  • completed_at (datetime, nullable)                        │
└─────────────────────────────────────────────────────────────┘
```

## Transaction Integrity

The sequence reservation uses a **pre-reservation + completion** model within a **single database session**:

1. **Reserve** — Insert a `SequenceConsumptionLog` row with status `PENDING` inside the current transaction
2. **Use** — Create/update the business document with the reserved number
3. **Complete** — Update the consumption log to `COMPLETED`

If step 2 or 3 fails, the transaction rolls back entirely — the `PENDING` consumption log is never committed. This ensures:

- **No gaps from failed operations** — If invoice issuance fails after reserving a number, the rollback ensures the number is available for retry
- **Intentional gaps are auditable** — If a number is reserved and the transaction commits but the document is later cancelled, the consumption log stays as `COMPLETED`, preserving the gap audit trail
- **Idempotency** — The same document never consumes two numbers

## Supported Document Types

| Document Type | Prefix | Example |
|---------------|--------|---------|
| `invoice` | INV- | INV-00001 |
| `receipt` | RCT- | RCT-00001 |
| `credit_note` | CN- | CN-00001 |
| `payment` | PAY- | PAY-00001 |
| `refund` | RFD- | RFD-00001 |

## Error Handling

- `DocumentSequenceNotFound` — Raised when no sequence is configured for a document type
- `SequenceReservationFailed` — Raised when the atomic increment fails (database-level)
