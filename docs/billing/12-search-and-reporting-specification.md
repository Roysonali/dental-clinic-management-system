# Search & Reporting Specification — Billing Module

> **Document Type:** Search and Reporting Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Define searchable fields, available filters, sorting, pagination, export capabilities, financial reports, and dashboard metrics.

| Field | Value |
|---|---|
| Document | Search & Reporting Specification |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 02-functional-requirements.md, 07-workflows.md, 03-non-functional-requirements.md |

---

## Table of Contents

1. [Search Specifications](#1-search-specifications)
2. [Filter Specifications](#2-filter-specifications)
3. [Sorting](#3-sorting)
4. [Pagination](#4-pagination)
5. [Export Capabilities](#5-export-capabilities)
6. [Financial Reports](#6-financial-reports)
7. [Dashboard Metrics](#7-dashboard-metrics)
8. [Saved Searches (Future)](#8-saved-searches-future)

---

## 1. Search Specifications

### 1.1 Invoice Search

| Field | Search Type | Match Behavior | Phase |
|---|---|---|---|
| Invoice Number | Text | Exact match, prefix match, and partial match | MVP |
| Patient Name | Text | Partial, case-insensitive match | MVP |
| Patient ID | Exact | Exact UUID match | MVP |
| Invoice Status | Enum | Single or multi-select status filter | MVP |
| Date Range (Invoice Date) | Date | Start date and end date inclusive | MVP |
| Date Range (Due Date) | Date | Start date and end date inclusive | MVP |
| Amount Range | Numeric | Minimum and/or maximum amount | Phase 2 |
| Payment Method | Enum | Filter by payment method | MVP |
| Treating Doctor | Reference | Select from doctor list | Phase 2 |
| Treatment Plan ID | Reference | Exact or partial plan code | Phase 2 |

### 1.2 Payment Search

| Field | Search Type | Match Behavior | Phase |
|---|---|---|---|
| Payment Reference Number | Text | Exact and partial match | MVP |
| Patient Name | Text | Partial, case-insensitive match | MVP |
| Payment Method | Enum | Single or multi-select | MVP |
| Date Range | Date | Payment date range inclusive | MVP |
| Amount Range | Numeric | Minimum and/or maximum amount | Phase 2 |
| Invoice Number | Text | Exact match — find payments for a specific invoice | MVP |

### 1.3 Receipt Search

| Field | Search Type | Match Behavior | Phase |
|---|---|---|---|
| Receipt Number | Text | Exact and partial match | MVP |
| Patient Name | Text | Partial, case-insensitive match | MVP |
| Invoice Number | Text | Exact match | MVP |
| Date Range | Date | Receipt date range inclusive | MVP |
| Payment Method | Enum | Filter by payment method | MVP |

### 1.4 Credit Note Search (Phase 2)

| Field | Search Type | Match Behavior | Phase |
|---|---|---|---|
| Credit Note Number | Text | Exact and partial match | Phase 2 |
| Original Invoice Number | Text | Exact match | Phase 2 |
| Patient Name | Text | Partial, case-insensitive match | Phase 2 |
| Date Range | Date | Issue date range inclusive | Phase 2 |
| Status | Enum | draft, issued, applied, expired, void | Phase 2 |

---

## 2. Filter Specifications

### 2.1 Invoice Filters

| Filter | Values | Default | Phase |
|---|---|---|---|
| Status | Draft, Issued, Paid, Partially Paid, Overdue, Cancelled, Void | All | MVP |
| Date Range | Custom date range or preset (Today, This Week, This Month, This Quarter, This Year) | Current month | MVP |
| Payment Method | Cash, Card, Cheque, Bank Transfer, Other | All | MVP |
| Amount Range | Min / Max amounts | None | Phase 2 |
| Doctor | List of active doctors | All | Phase 2 |
| Branch | List of branches | All | Phase 3 |

### 2.2 Preset Date Ranges

| Preset | Range | Phase |
|---|---|---|
| Today | Current date | MVP |
| This Week | Monday–Sunday of current week | MVP |
| This Month | First–last day of current month | MVP |
| Last Month | First–last day of previous month | MVP |
| This Quarter | First–last day of current quarter | Phase 2 |
| This Year | January 1–December 31 of current year | Phase 2 |
| Custom | User-defined start and end date | MVP |

---

## 3. Sorting

| Entity | Sortable Fields | Default Sort | Phase |
|---|---|---|---|
| Invoices | Invoice Date (ASC/DESC), Due Date, Amount, Status, Patient Name | Invoice Date DESC | MVP |
| Payments | Payment Date (ASC/DESC), Amount, Method | Payment Date DESC | MVP |
| Receipts | Receipt Date (ASC/DESC), Amount | Receipt Date DESC | MVP |
| Credit Notes | Issue Date (ASC/DESC), Amount, Status | Issue Date DESC | Phase 2 |

---

## 4. Pagination

| Parameter | Default | Maximum | Phase |
|---|---|---|---|
| Page Size | 20 records | 100 records | MVP |
| Page Number | 1 | Unlimited | MVP |
| Total Count | Returned in response | — | MVP |

### Pagination Response

Each paginated response SHALL include:

- `results`: Array of matching records
- `total`: Total number of matching records
- `page`: Current page number
- `page_size`: Number of records per page
- `total_pages`: Total number of pages

---

## 5. Export Capabilities

| Export Type | Formats | Data Included | Phase |
|---|---|---|---|
| Invoice List | CSV, PDF | Search results — visible columns | Phase 2 |
| Invoice Detail | PDF | Full invoice with line items | Phase 2 |
| Payment List | CSV | Search results | Phase 2 |
| Revenue Report | CSV, PDF, XLSX | Revenue data by date | Phase 2 |
| Receivables Aging | CSV, PDF, XLSX | Aging buckets with amounts | Phase 2 |
| Tax Summary | CSV, XLSX | Tax per rate per period | Phase 2 |
| Payment Method Summary | CSV | Amounts per payment method | Phase 2 |
| Discount Summary | CSV | Discount totals and count | Phase 2 |
| Audit Log | CSV, PDF | Complete audit data for selected period | Phase 2 |

### Export Constraints

| Constraint | Description |
|---|---|
| Maximum export rows | 10,000 records per export (larger exports should be batched or use date range filtering) |
| Date range limit | Maximum 1 year per export request |
| File retention | Exported files are transient — no permanent storage of export files |
| Permission | Export requires elevated permission (EXPORT_DATA) |

---

## 6. Financial Reports

### 6.1 Revenue Report

| Attribute | Description |
|---|---|
| **Purpose** | Show clinic revenue collected over a specified period |
| **Granularity** | Daily, Weekly, Monthly, Custom range |
| **Metrics** | Total revenue, count of invoices paid, average invoice value |
| **Filters** | Date range, payment method, doctor |
| **Phase** | Phase 2 |

### 6.2 Receivables Aging Report

| Attribute | Description |
|---|---|
| **Purpose** | Show outstanding invoice balances classified by time overdue |
| **Aging Buckets** | 0–30 days, 31–60 days, 61–90 days, 90+ days |
| **Metrics** | Total outstanding per bucket, count of invoices per bucket, percentage of total |
| **Filters** | As-of date |
| **Phase** | Phase 2 |

### 6.3 Tax Summary Report

| Attribute | Description |
|---|---|
| **Purpose** | Show tax collected per rate for tax filing |
| **Granularity** | Monthly, Quarterly, Annually |
| **Metrics** | Taxable amount, tax collected per rate, total tax |
| **Filters** | Date range, tax rate |
| **Phase** | Phase 2 |

### 6.4 Payment Method Summary

| Attribute | Description |
|---|---|
| **Purpose** | Show distribution of payment methods used |
| **Metrics** | Amount and count per payment method, percentage of total |
| **Filters** | Date range |
| **Phase** | Phase 2 |

### 6.5 Discount Summary Report

| Attribute | Description |
|---|---|
| **Purpose** | Show discount activity for financial review |
| **Metrics** | Total discount amount, count of discounted invoices, average discount percentage, discounts by approver |
| **Filters** | Date range, doctor |
| **Phase** | Phase 2 |

---

## 7. Dashboard Metrics

### 7.1 MVP Dashboard

| Metric | Description | Calculation |
|---|---|---|
| Total Outstanding Balance | Sum of all unpaid invoice balances | Sum of (grand total − payments) for invoices in Issued/Partially Paid/Overdue status |
| Invoices by Status | Count of invoices in each status | GROUP BY status |
| Recent Payments | Last 10 payments recorded | ORDER BY created_at DESC LIMIT 10 |
| Recently Created Invoices | Last 10 invoices created | ORDER BY created_at DESC LIMIT 10 |

### 7.2 Phase 2 Dashboard

| Metric | Description | Calculation |
|---|---|---|
| Daily Revenue | Total payments collected today | SUM(payment amounts) WHERE payment_date = today |
| Weekly Revenue | Total payments collected this week | SUM(payment amounts) WHERE payment_date in current week |
| Monthly Revenue | Total payments collected this month | SUM(payment amounts) WHERE payment_date in current month |
| Receivables Aging | Outstanding balance per aging bucket | SUM(outstanding) GROUP BY age from due date |
| Payment Method Distribution | Percentage of revenue by payment method | SUM(amount) GROUP BY payment_method |
| Tax Collected Summary | Total tax collected per rate | SUM(tax_amount) GROUP BY tax_rate |
| Invoice Status Distribution | Count and percentage by status | COUNT(*) GROUP BY status |

### 7.3 Business KPIs

The following Key Performance Indicators provide actionable financial intelligence for clinic management:

| KPI | Description | Calculation | Phase |
|---|---|---|---|
| **Daily Revenue** | Total payments collected on the current day | SUM(payment amounts) WHERE payment_date = today | Phase 2 |
| **Monthly Revenue** | Total payments collected in the current month | SUM(payment amounts) WHERE payment_date in current month | Phase 2 |
| **Outstanding Balance** | Total unpaid amount across all issued invoices | SUM(grand total − payments) WHERE status ≠ Paid/Cancelled/Void | Phase 2 |
| **Collection Rate** | Percentage of issued invoices that have been paid | (COUNT Paid invoices / COUNT Issued invoices) × 100 | Phase 2 |
| **Refund Percentage** | Total refunded amount as a percentage of total payments | (SUM(refund amounts) / SUM(payment amounts)) × 100 | Phase 2 |
| **Average Invoice Value** | Average grand total across all issued invoices | AVG(grand total) WHERE status = Issued or later | Phase 2 |
| **Revenue by Doctor** | Total payments attributed to each doctor's treatments | SUM(payment amounts) GROUP BY treating doctor | Phase 2 |
| **Revenue by Procedure** | Total payments attributed to each procedure code | SUM(line item amounts) GROUP BY procedure code | Phase 2 |
| **Invoice Aging** | Percentage of outstanding balance per aging bucket | SUM(outstanding) GROUP BY days past due (0-30, 31-60, 61-90, 90+) | Phase 2 |
| **Discount Rate** | Total discounts as a percentage of total revenue | (SUM(discount amounts) / SUM(grand total)) × 100 | Phase 2 |

### 7.4 KPI Visualization Notes

| KPI | Suggested Visualization | Update Frequency |
|---|---|---|
| Daily Revenue | Number card with trend arrow | Real-time |
| Monthly Revenue | Bar chart (day-by-day) | Daily |
| Outstanding Balance | Number card | Real-time |
| Collection Rate | Percentage gauge | Daily |
| Refund Percentage | Number with trend | Monthly |
| Average Invoice Value | Number card | Daily |
| Revenue by Doctor | Horizontal bar chart | Monthly |
| Revenue by Procedure | Pie or treemap chart | Monthly |
| Invoice Aging | Stacked bar chart (aging buckets) | Daily |
| Discount Rate | Number with trend | Monthly |

---

## 8. Saved Searches (Future)

| Capability | Description | Phase |
|---|---|---|
| Save Search Criteria | User can save a search configuration (filters, sort, columns) | Phase 3 |
| Named Searches | User assigns a name to the saved search | Phase 3 |
| Shared Searches | Saved searches can be shared with other users/roles | Phase 3 |
| Default Searches | Clinic Administrator can set default searches for roles | Phase 3 |
| Scheduled Export | Saved search can be scheduled for automatic export (daily/weekly/monthly) | Phase 3 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [02-functional-requirements.md](02-functional-requirements.md) (FR-6, FR-14, FR-15) |
| **Related** | [03-non-functional-requirements.md](03-non-functional-requirements.md), [07-workflows.md](07-workflows.md) |
| **Next Reading** | [13-audit-requirements.md](13-audit-requirements.md) |
