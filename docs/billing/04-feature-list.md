# Feature List — Billing Module

> **Document Type:** Feature Inventory
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Convention:** Features are organized by implementation phase. Each feature includes priority, description, and dependencies.

| Field | Value |
|---|---|
| Document | Feature List |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 01-business-analysis.md, 02-functional-requirements.md, 08-future-scope.md |

---

## 1. Feature Summary

| Phase | Features | Mandatory | Optional/ Future | Total |
|---|---|---|---|---|
| Phase 1 (MVP) | 8 feature groups | 8 | 0 | 8 |
| Phase 2 | 7 feature groups | 0 | 7 | 7 |
| Phase 3 | 9 feature groups | 0 | 9 | 9 |
| **Total** | **24 feature groups** | **8** | **16** | **24** |

---

## 2. Phase 1 — MVP (Mandatory)

These features are required for the initial go-live of the Billing module. They constitute the minimum viable product enabling core financial operations.

| ID | Feature Group | Priority | External Dependencies | Description |
|---|---|---|---|---|
| F-MVP-001 | Invoice Management | Critical | Patients, Users | Create, read, update, cancel, and void invoices with sequential numbering and status lifecycle |
| F-MVP-002 | Invoice Line Items | Critical | Procedures (optional), Treatment Plans (optional) | Add line items with quantity, unit price, discount, and computed totals |
| F-MVP-003 | Treatment Plan Integration | Critical | Treatment Plans | Generate invoices from accepted treatment plans; track price overrides |
| F-MVP-004 | Payment Management | Critical | Invoices, Users | Record payments (cash, card, cheque, bank transfer); multiple partial payments; payment reversal |
| F-MVP-005 | Receipts | Critical | Payments, Invoices | Auto-generate receipts on payment; reprint support; consolidated receipts |
| F-MVP-006 | Search & Filtering | Critical | All financial entities | Search by invoice number, patient name; filter by status, date range, payment method |
| F-MVP-007 | Audit Trail | Critical | Users | Full mutation audit (created_by, updated_by, timestamps, status history, price override tracking) |
| F-MVP-008 | Role-based Permissions | Critical | RBAC module | Permission enforcement on all financial operations; role-appropriate visibility |

### MVP Feature Interdependencies

```
Treatment Plan Integration ──► Invoice Management ──► Payment Management ──► Receipts
                                    │                       │
                                    ▼                       ▼
                            Audit Trail ◄────────── Role-based Permissions
                                    │
                                    ▼
                           Search & Filtering
```

---

## 3. Phase 2 — Enhanced Capabilities (Future)

These features extend the MVP with workflow automation, financial management, and reporting. They are not required for initial go-live but represent the next tier of business value.

| ID | Feature Group | Priority | External Dependencies | Description |
|---|---|---|---|---|
| F-P2-001 | Discount Approval Workflow | High | Users, RBAC | Configurable thresholds for discount approval; multi-level approval routing |
| F-P2-002 | Tax Management | High | System Configuration | Configurable tax rates; automatic calculation; multi-rate support; tax exemption |
| F-P2-003 | Refunds | High | Payments, Invoices | Full/partial refund processing; refund approval; refund receipts |
| F-P2-004 | Credit Notes | High | Invoices, Payments | Credit note issuance; application to invoices; expiry management |
| F-P2-005 | Patient Financial Summary | High | Patients, Invoices, Payments, Credit Notes | Per-patient financial overview: invoices, payments, credits, outstanding balance |
| F-P2-006 | Financial Dashboard | Medium | Invoices, Payments | Revenue totals, receivables aging, payment method distribution, tax summary |
| F-P2-007 | Reports | Medium | Invoices, Payments, Tax | Revenue report, receivables aging, tax summary, payment method, discount report; CSV/PDF/Excel export |

### Phase 2 Feature Interdependencies

```
Tax Management ──────────► Invoice Line Items (tax calculation)
                                │
Discount Approval ───────► Invoice Line Items (discount on line items)
                                │
Refunds ─────────────────► Payments (payment reversal)
                                │
Credit Notes ────────────► Invoices (invoice correction)
                                │
                                ▼
                Patient Financial Summary
                Financial Dashboard
                Reports
```

---

## 4. Phase 3 — Advanced Integrations (Future)

These features extend the Billing module with enterprise-level integrations and specialized capabilities. They are deferred to allow the module to stabilize on core functionality first.

| ID | Feature Group | Priority | External Dependencies | Description |
|---|---|---|---|---|
| F-P3-001 | Insurance Support | Medium | Insurance module (new), Patients, Invoices | Insurance provider management; policy tracking; claim generation and submission; receivable tracking |
| F-P3-002 | Payment Gateway Integration | Medium | Payment gateway provider | Online payment processing; payment links; automatic payment posting |
| F-P3-003 | Notifications | Medium | Notification module (new), Email/SMS infrastructure | Invoice notifications; payment reminders; overdue alerts; receipt delivery |
| F-P3-004 | Patient Portal Integration | Medium | Patient Portal module (new) | Patient self-service invoice viewing; online payment; receipt download |
| F-P3-005 | Accounting Software Integration | Medium | External accounting platforms | Chart of accounts mapping; automated journal export; reconciliation |
| F-P3-006 | Multi-branch Support | Low | Multi-branch module (new) | Branch-level numbering, tax, reporting; cross-branch consolidation |
| F-P3-007 | Multi-currency Support | Low | Exchange rate service | Foreign currency invoicing; exchange rate management; dual-amount display |
| F-P3-008 | E-Invoicing | Low | Regional e-invoicing standards | Standards-compliant e-invoice format; digital signature; government portal submission |
| F-P3-009 | Advance Payments / Patient Wallet | Low | Payments, Patients | Pre-payment collection; wallet balance management; wallet consumption on invoices |

### Phase 3 Feature Interdependencies

```
Insurance Support ──────► Invoice Line Items (claim data)
                                │
Payment Gateway ────────► Payment Management (online payments)
                                │
Notifications ──────────► All billing events
                                │
Patient Portal ─────────► Invoice Display, Payment
                                │
Accounting Export ──────► Invoices, Payments, Tax
                                │
Multi-branch ───────────► All billing features (branch-scoped)
                                │
Multi-currency ─────────► Invoices, Payments (currency support)
                                │
E-Invoicing ────────────► Invoice (regulatory compliance)
                                │
Patient Wallet ─────────► Payments (pre-payment, wallet)
```

---

## 5. Feature Dependency Matrix

| Feature | Depends On | Required By |
|---|---|---|
| Invoice Management | — (foundational) | All other features |
| Invoice Line Items | Invoice Management | Treatment Plan Integration, Tax Management, Discount Approval |
| Treatment Plan Integration | Invoice Management, Invoice Line Items | — |
| Payment Management | Invoice Management | Receipts, Refunds, Patient Summary, Dashboard |
| Receipts | Payment Management | — |
| Search & Filtering | All MVP entities | Dashboard, Reports |
| Audit Trail | — (cross-cutting) | All features |
| Role-based Permissions | — (cross-cutting) | All features |
| Discount Approval Workflow | Invoice Line Items | — |
| Tax Management | Invoice Line Items | Reports, E-Invoicing |
| Refunds | Payment Management | Credit Notes, Patient Summary |
| Credit Notes | Invoice Management, Payments | Patient Summary, Reports |
| Patient Financial Summary | Invoices, Payments, Credit Notes | Patient Portal |
| Financial Dashboard | Invoices, Payments | — |
| Reports | Invoices, Payments, Tax | Accounting Export |
| Insurance Support | Patients, Invoices | — |
| Payment Gateway | Payment Management | Patient Portal, Notifications |
| Notifications | Invoices, Payments | — |
| Patient Portal | Patient Summary, Payment Gateway | — |
| Accounting Export | Reports | — |
| Multi-branch | All features (branch-scoped) | — |
| Multi-currency | Invoices, Payments | — |
| E-Invoicing | Invoice, Tax | — |
| Patient Wallet | Payments, Patients | — |

---

## 6. Feature Priority Legend

| Priority | Definition |
|---|---|
| Critical | System cannot go live without this feature. Directly impacts core business operations. |
| High | Important operational capability. Workaround exists but is inefficient or error-prone. |
| Medium | Valuable enhancement. Improves user experience or adds analytical capability. |
| Low | Nice-to-have for specific deployment scenarios. Not universally required. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md) |
| **Related** | [02-functional-requirements.md](02-functional-requirements.md), [08-future-scope.md](08-future-scope.md) |
| **Next Reading** | [05-user-roles-and-permissions.md](05-user-roles-and-permissions.md) → [06-business-rules.md](06-business-rules.md) |
