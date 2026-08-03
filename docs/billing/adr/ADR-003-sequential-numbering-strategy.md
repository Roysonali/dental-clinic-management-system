# ADR-003: Sequential Numbering Strategy

| Field | Value |
|---|---|
| **ADR ID** | ADR-003 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Module** | Billing |
| **Deciders** | Engineering Team |

---

## Context

Invoices, receipts, and credit notes are legal financial documents. Many jurisdictions require that these documents carry a unique, sequentially increasing number that is free of gaps. The numbering system must handle concurrent invoice creation (multiple users creating invoices simultaneously), failed transactions (database rollbacks), and configurable prefixes (clinic branding preferences).

## Problem

How should sequential document numbers be generated to ensure gapless, non-reusable numbering under concurrent load while supporting configurable prefixes and starting values?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Dedicated sequence table + application-level reservation** | A `document_sequences` table stores the current value for each document type (invoice, receipt, credit note). The application reserves a number by incrementing the counter in a transaction BEFORE creating the document. Failed document creation leaves the number consumed but tracked. | True gapless sequence; auditable consumption; configurable per type | Reserved numbers are lost if the document creation fails (gaps in the sequence, but tracked at the application level) |
| **B: PostgreSQL SEQUENCE object** | Native PostgreSQL sequence object with `nextval()` and `currval()`. | Database-native; high concurrency; no application logic needed; transactional safety | Gaps from rollbacks are permanent; cannot be tracked or explained to auditors; sequences can be reset accidentally |
| **C: UUID-based document numbers** | Generate UUIDs as document identifiers. Separate sequential display number generated on issuance. | No concurrency issues; no sequence management; unique across systems | Display number is separate from record ID; two-number system confuses staff and patients; auditors expect a single sequential number |
| **D: MAX(id) + 1** | Compute next number as MAX(current_number) + 1 from existing records. | Simple; no separate sequence object needed | Race condition under concurrent creation; gaps from deletions; performance degrades with table size |
| **E: Dedicated sequence table with two-phase reservation** | Reserve a block of numbers (e.g., 100 at a time) in memory, issue from the reserved block, release unused numbers on application restart. | High performance; reduced DB calls; near-gapless in practice | Complexity; unused numbers on restart; over-engineered for clinic scale |

## Decision

**Option A: Dedicated sequence table with application-level reservation and gap tracking.**

## Rationale

- **Gapless guarantee:** By incrementing the sequence counter in a transaction BEFORE document creation, the number is consumed even if the subsequent INSERT fails. This ensures no gaps in the visible sequence.
- **Auditability:** Each number consumed is recorded with the requesting user and timestamp. If a gap does occur (document creation fails after number reservation), the gap is tracked and explainable to auditors.
- **Configurability:** The sequence table stores prefix, current value, minimum digit length, and starting value per document type. This can be updated via admin UI without code changes.
- **Separate sequences per document type:** Invoices, receipts, and credit notes each have their own sequence. This maps to real-world accounting where each document type has independent numbering.
- **Proven pattern:** This is a well-established pattern in financial systems. Most ERP systems and accounting platforms use a similar approach.

## Consequences

### Positive
- Gapless sequence — no numbers skipped in normal operation
- Auditable — every number reservation is recorded
- Configurable — prefix, starting number, digit length per document type
- Separate sequences per document type
- Survives concurrent creation — sequence row is locked during reservation

### Negative
- One database round-trip for number reservation (acceptable — sub-millisecond operation)
- Gap tracking logic adds minor complexity (a `sequence_consumption` table)
- Sequence reset requires manual database intervention (by design — prevents accidental resets)

## Sequence Table Schema

```
document_sequences
──────────────────
  document_type   VARCHAR(20)   PK  -- 'invoice', 'receipt', 'credit_note'
  prefix          VARCHAR(10)      -- e.g., 'INV-', 'RCT-', 'CN-'
  current_value   BIGINT           -- current maximum number assigned
  min_digits      INT              -- e.g., 5 → INV-00001
  start_value     BIGINT           -- initial value (default 1)
  updated_at      TIMESTAMP        -- last increment timestamp
  updated_by      UUID             -- user who last triggered increment

sequence_consumption
────────────────────
  id              UUID         PK
  document_type   VARCHAR(20)     -- which sequence was consumed
  number_assigned BIGINT          -- the number that was reserved
  reserved_at     TIMESTAMP       -- when the number was reserved
  reserved_by     UUID            -- the user who triggered the reservation
  document_id     UUID            -- the created document (NULL if creation failed)
  status          VARCHAR(20)     -- 'completed', 'failed', 'rolled_back'
```

## Numbering Examples

| Document Type | Prefix | Format Example |
|---|---|---|
| Invoice | `INV-` | `INV-00001`, `INV-00002` |
| Receipt | `RCT-` | `RCT-00001`, `RCT-00002` |
| Credit Note | `CN-` | `CN-00001`, `CN-00002` |

## Alternatives Rejected

**Option B (PostgreSQL SEQUENCE)** was rejected because sequence rollbacks create invisible gaps that cannot be explained to auditors. While a SEQUENCE can generate unique numbers, it cannot guarantee a gapless sequence under transaction rollbacks.

**Option C (UUID-based display numbers)** was rejected because auditors and tax authorities expect human-readable sequential numbers. A UUID is not suitable as a display identifier for financial documents.

**Option D (MAX(id) + 1)** was rejected because it creates race conditions under concurrent load — two users creating invoices simultaneously could both read the same MAX value and produce duplicate numbers.

**Option E (Two-phase reservation)** was rejected as over-engineered for the expected clinic scale. Clinics process dozens, not thousands, of invoices concurrently. Option A's single-row lock is sufficient.

## Future Considerations

If a clinic merger requires merging two numbering sequences (e.g., two clinics with overlapping invoice numbers), the sequence table supports starting-value configuration. A migration script can adjust the starting value of one clinic's sequence to avoid collisions, or a branch-specific prefix can be introduced.

## Related ADRs

- ADR-001 (Invoice as Aggregate Root) — the aggregate root uses the sequence for document numbering
- ADR-002 (Immutable Invoice After Issuance) — immutable invoices ensure sequence consumption is final
- ADR-004 (Payment Allocation Model) — receipt numbering uses the same sequence pattern
