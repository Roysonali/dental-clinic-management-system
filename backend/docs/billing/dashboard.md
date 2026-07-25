# Billing Dashboard & Reporting

## Overview

The billing dashboard provides a summary view of the clinic's financial health. It aggregates data across invoices, payments, and patients.

## Endpoints

### `GET /billing/dashboard`

Returns a comprehensive dashboard view.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `patient_id` | `UUID` | ❌ | Scope to a single patient |

**Response:** `BillingDashboardResponse`

```json
{
  "totals": {
    "total_invoiced": "150000.00",
    "total_collected": "95000.00",
    "total_outstanding": "55000.00",
    "total_cancelled": "5000.00",
    "total_overdue": "12000.00",
    "invoice_count": 150,
    "paid_count": 85,
    "pending_count": 40,
    "overdue_count": 15,
    "cancelled_count": 10
  },
  "recent_invoices": [...],
  "recent_payments": [...],
  "patient_summary": null,
  "generated_at": "2026-07-24T10:30:00Z"
}
```

### `GET /billing/summary`

Lightweight version returning only financial totals.

**Response:** `BillingTotalsResponse`

```json
{
  "total_invoiced": "150000.00",
  "total_collected": "95000.00",
  "total_outstanding": "55000.00",
  "total_cancelled": "5000.00",
  "total_overdue": "12000.00",
  "invoice_count": 150,
  "paid_count": 85,
  "pending_count": 40,
  "overdue_count": 15,
  "cancelled_count": 10
}
```

## Architecture

Dashboard endpoints use `BillingOrchestrationService` which coordinates across:

| Service | Role |
|---------|------|
| `InvoiceService` | Invoice aggregation & counts |
| `PaymentService` | Payment aggregation |
| `ReceiptService` | Receipt status |
| `RefundService` | Refund metrics |
| `CreditNoteService` | Credit note summaries |
| `FinancialCalculationService` | Totals & financial math |

All DTO conversion is handled by `BillingDashboardMapper` — the router never constructs response objects directly.

## Implementation (Router)

```python
@router.get(
    "/dashboard",
    operation_id="get_billing_dashboard",
    summary="Billing Dashboard",
    description="Returns comprehensive dashboard with totals, recent activity, and optional patient summary.",
    response_model=BillingDashboardResponse,
    status_code=status.HTTP_200_OK,
    responses=_COMMON_ERROR_RESPONSES,
)
async def get_billing_dashboard(
    patient_id: UUID | None = Query(None, description="Scope to a specific patient"),
    service: BillingOrchestrationService = Depends(get_billing_orchestration_service),
    _: User = Depends(role_required(RolePermission.BILLING_READ)),
) -> BillingDashboardResponse:
    result = service.get_billing_dashboard(patient_id=patient_id)
    return BillingDashboardMapper.to_dashboard_response(result)
```
