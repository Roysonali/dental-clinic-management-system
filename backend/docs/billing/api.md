# Billing Module — API Reference

> **Base URL:** All endpoints are prefixed with `/billing`
> **Auth:** JWT Bearer Token (`Authorization: Bearer <token>`)
> **Roles:** admin, receptionist, doctor, dental_assistant (varies by endpoint)

---

## 1. Invoice Endpoints

### `GET /billing/invoices`
List invoices with pagination, filtering, and sorting.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `int` (query) | Page number, default 1 |
| `page_size` | `int` (query) | Items per page, default 20 |
| `search` | `str` (query) | Full-text search across invoice fields |
| `status` | `InvoiceStatus` (query) | Filter by invoice status |
| `patient_id` | `UUID` (query) | Filter by patient |
| `doctor_id` | `UUID` (query) | Filter by doctor |
| `date_from` | `date` (query) | Invoice date lower bound |
| `date_to` | `date` (query) | Invoice date upper bound |
| `sort_by` | `str` (query) | Sort field: `created_at`, `invoice_date`, `grand_total`, `status`, `invoice_number` |
| `sort_order` | `SortOrder` (query) | `asc` or `desc` (default `desc`) |
| `include_cancelled` | `bool` (query) | Include cancelled invoices |
| `include_drafts` | `bool` (query) | Include draft invoices |

**Response:** `200` — Paginated list of `InvoiceSummaryResponse`

---

### `POST /billing/invoices`
Create a new invoice in draft status.

**Request body:** `InvoiceCreateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_id` | `UUID` | ✅ | Patient receiving treatment |
| `doctor_id` | `UUID` | ✅ | Treating doctor |
| `appointment_id` | `UUID` | ❌ | Associated appointment |
| `invoice_date` | `date` | ❌ | Defaults to today |
| `due_date` | `date` | ❌ | Defaults to 30 days from invoice date |
| `notes` | `str` | ❌ | Internal notes |
| `items` | `list[InvoiceLineItemCreateRequest]` | ✅ | At least 1 line item required |
| `currency_code` | `CurrencyCode` | ❌ | Defaults to INR |
| `grand_total` | `Decimal` | ❌ | Computed from items if omitted |

**Response:** `201` — `InvoiceResponse` (full aggregate)

---

### `GET /billing/invoices/{invoice_id}`
Retrieve a single invoice with all line items and payment allocations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `invoice_id` | `UUID` (path) | Invoice UUID |

**Response:** `200` — `InvoiceResponse`

---

### `PATCH /billing/invoices/{invoice_id}`
Update invoice metadata (draft only).

**Request body:** `InvoiceDraftUpdateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | `str` | ❌ | Updated internal notes |
| `due_date` | `date` | ❌ | Updated due date |

**Response:** `200` — `InvoiceResponse`

---

### `POST /billing/invoices/{invoice_id}/issue`
Issue a draft invoice — assigns a permanent invoice number, freezes all amounts.

**Errors:**
- `422` — Invoice has no line items
- `409` — Invoice is not in draft status

**Response:** `200` — `InvoiceResponse`

---

### `POST /billing/invoices/{invoice_id}/cancel`
Cancel an issued invoice. Requires a cancellation reason.

**Request body:** `InvoiceCancelRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cancellation_reason` | `str` | ✅ | Reason for cancellation |

**Errors:**
- `409` — Invoice is already cancelled or is in draft status

**Response:** `200` — `InvoiceResponse`

---

### `DELETE /billing/invoices/{invoice_id}`

**Errors:**
- `409` — Only draft invoices can be deleted

**Response:** `204` — No content

---

## 2. Payment Endpoints

### `GET /billing/payments`
List payments with pagination and filtering.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `int` (query) | Page number |
| `page_size` | `int` (query) | Items per page |
| `search` | `str` (query) | Search across payment fields |
| `status` | `PaymentStatus` (query) | Filter by status |
| `payment_method` | `PaymentMethod` (query) | Filter by method |
| `patient_id` | `UUID` (query) | Filter by patient |
| `invoice_id` | `UUID` (query) | Filter by invoice |
| `date_from` | `date` (query) | Payment date lower bound |
| `date_to` | `date` (query) | Payment date upper bound |
| `sort_by` | `str` (query) | Sort field: `created_at`, `payment_date`, `amount`, `status` |
| `sort_order` | `SortOrder` (query) | `asc` or `desc` |

**Response:** `200` — Paginated list of `PaymentSummaryResponse`

---

### `POST /billing/payments`
Create a new payment in Pending status.

**Request body:** `PaymentCreateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_id` | `UUID` | ✅ | Patient making the payment |
| `total_amount` | `Decimal` | ✅ | Payment amount |
| `payment_method` | `PaymentMethod` | ✅ | Method of payment |
| `payment_date` | `date` | ❌ | Defaults to today |
| `reference_number` | `str` | ❌ | External reference (cheque/transaction ID) |
| `notes` | `str` | ❌ | Internal notes |

**Response:** `201` — `PaymentResponse`

---

### `GET /billing/payments/{payment_id}`
Retrieve a single payment with allocations.

**Response:** `200` — `PaymentResponse`

---

### `PATCH /billing/payments/{payment_id}`
Update payment metadata (pending payments only).

**Request body:** `PaymentMetadataUpdateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reference_number` | `str` | ❌ | Updated reference |
| `notes` | `str` | ❌ | Updated notes |

**Response:** `200` — `PaymentResponse`

---

### `DELETE /billing/payments/{payment_id}`
Delete a pending payment.

**Response:** `204` — No content

---

### `POST /billing/payments/{payment_id}/complete`
Mark a pending payment as completed.

**Response:** `200` — `PaymentResponse`

---

### `POST /billing/payments/{payment_id}/fail`
Mark a pending payment as failed.

**Response:** `200` — `PaymentResponse`

---

### `POST /billing/payments/{payment_id}/void`
Void a payment.

**Response:** `200` — `PaymentResponse`

---

### `POST /billing/payments/{payment_id}/allocate`
Allocate payment amount to an invoice.

**Request body:** `PaymentAllocateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_id` | `UUID` | ✅ | Invoice to allocate against |
| `amount` | `Decimal` | ✅ | Amount to allocate |
| `notes` | `str` | ❌ | Allocation notes |

**Response:** `201` — `AllocationResponse`

---

### `POST /billing/payments/{payment_id}/deallocate`
Remove a payment allocation from an invoice.

**Request body:** `PaymentDeallocateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_id` | `UUID` | ✅ | Invoice to deallocate from |

**Response:** `204` — No content

---

### `GET /billing/payments/{payment_id}/allocations`
List allocations for a payment.

**Response:** `200` — `list[AllocationResponse]`

---

## 3. Receipt Endpoints

### `GET /billing/receipts/{receipt_id}`
Retrieve a single receipt.

**Response:** `200` — `ReceiptResponse`

---

### `POST /billing/receipts`
Generate a receipt for a completed payment.

**Request body:** `ReceiptGenerateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payment_id` | `UUID` | ✅ | Completed payment to generate receipt for |

**Errors:**
- `404` — Payment not found
- `422` — Payment not in a status that allows receipt generation

**Response:** `201` — `ReceiptResponse`

---

### `POST /billing/receipts/{receipt_id}/regenerate`
Regenerate an existing receipt.

**Response:** `200` — `ReceiptResponse`

---

## 4. Refund Endpoints

### `POST /billing/refunds`
Request a refund against a payment.

**Request body:** `RefundCreateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payment_id` | `UUID` | ✅ | Original payment |
| `amount` | `Decimal` | ✅ | Refund amount |
| `reason` | `str` | ✅ | Reason for refund |

**Response:** `201` — `RefundResponse`

---

### `POST /billing/refunds/{refund_id}/approve`
Approve a pending refund request.

**Response:** `200` — `RefundResponse`

---

### `POST /billing/refunds/{refund_id}/reject`
Reject a pending refund request.

**Request body:** `RefundRejectRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `str` | ✅ | Rejection reason |

**Response:** `200` — `RefundResponse`

---

### `POST /billing/refunds/{refund_id}/complete`
Execute an approved refund.

**Response:** `200` — `RefundResponse`

---

## 5. Credit Note Endpoints

### `POST /billing/credit-notes`
Create a new credit note against an invoice.

**Request body:** `CreditNoteCreateRequest`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_id` | `UUID` | ✅ | Source invoice |
| `amount` | `Decimal` | ✅ | Credit note amount |
| `reason` | `str` | ✅ | Reason for credit |

**Response:** `201` — `CreditNoteResponse`

---

### `POST /billing/credit-notes/{cn_id}/issue`
Issue a draft credit note.

**Response:** `200` — `CreditNoteResponse`

---

### `POST /billing/credit-notes/{cn_id}/void`
Void a credit note.

**Response:** `200` — `CreditNoteResponse`

---

### `POST /billing/credit-notes/{cn_id}/apply`
Apply a credit note against an invoice.

**Response:** `200` — `CreditNoteResponse`

---

## 6. Dashboard Endpoints

### `GET /billing/dashboard`
Full billing dashboard — totals, recent invoices, recent payments, optional patient summary.

| Parameter | Type | Description |
|-----------|------|-------------|
| `patient_id` | `UUID` (query) | Optional — scope dashboard to a patient |

**Response:** `200` — `BillingDashboardResponse`

### `GET /billing/summary`
System-wide financial totals (lightweight).

**Response:** `200` — `BillingTotalsResponse`

---

## Error Responses

All errors follow the standard DensCare envelope:

```json
{
  "success": false,
  "message": "Invoice not found: <uuid>",
  "details": {"invoice_id": "<uuid>"}
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `401` | Not authenticated |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `409` | Invalid state transition / conflict |
| `422` | Validation or financial integrity failure |
| `500` | Internal server error (safe generic message, no stack trace) |

## Pagination Format

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```
