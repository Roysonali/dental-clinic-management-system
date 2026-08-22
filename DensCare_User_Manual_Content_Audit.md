# DensCare — User Manual Content Audit

**Internal document — not for client delivery.**

Prepared by: DensCare Project Team
Date: 12 August 2026
Audited deliverable: `DensCare_User_Manual_Client_Training_Guide.docx` (Version 1.1)

This audit records what was verified in the actual DensCare implementation before
and while writing the user manual. The guiding rule was: **do not document
anything that is not implemented, and do not claim permissions that were not
verified in the code.**

---

## 1. Actual roles discovered

Verified from `backend/app/core/constants.py`, `backend/app/database/seed_roles.py`
and `frontend/src/constants/roles.ts`. Seven roles are seeded and enforced:

| Role identifier | Display name |
| --- | --- |
| `ADMIN` | Administrator |
| `CHIEF_DOCTOR` | Chief Doctor |
| `GENERAL_DOCTOR` | General Doctor |
| `SPECIALIST_DOCTOR` | Specialist Doctor |
| `CONSULTING_DOCTOR` | Consulting Doctor |
| `RECEPTIONIST` | Receptionist |
| `DENTAL_ASSISTANT` | Dental Assistant |

Groupings used by the code:

- `DOCTOR_ROLES` = CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR.
- `require_admin` = { ADMIN, CHIEF_DOCTOR } (admin-level operations: users,
  doctors write, procedures write, record delete, audit read, invoice/payment
  delete).
- Doctors' full-directory read = { ADMIN, RECEPTIONIST } only; a doctor may read
  only their own doctor profile/schedule (`doctors/dependencies.py`).

## 2. Actual modules discovered

All verified as implemented in the backend routers and frontend pages:

1. Authentication & account access (login, self-registration → pending approval,
   forgot/reset password, "remember me").
2. Dashboard (quick actions; live "My Treatment Plans" + "Upcoming
   Appointments"; **placeholder** Overview stats and Recent Activity).
3. Patients (register, list/search/filter, profile, edit, activate/deactivate).
4. Appointments (book, list, today, edit/reschedule, cancel; status lifecycle).
5. Doctors (profiles linked to user accounts, specializations, weekly schedules,
   availability, leave, activate/deactivate).
6. Patient Records (clinical + medical-history fields, status workflow,
   diagnoses, prescriptions, follow-ups, attachments, audit trail).
7. Prescriptions (medicines with name/dosage/frequency/duration/instructions;
   print/download via browser print dialog).
8. Treatment Plans (procedure items with tooth-level FDI detail, status
   lifecycle, patient acceptance, versioning).
9. Procedure Catalogue (master list of procedures with category/price/status).
10. Billing Dashboard (totals, recent invoices/payments, patient financial
    summary).
11. Invoices (draft → issue → paid/partial/overdue; cancel; void; delete-draft
    by admin).
12. Payments (pending → complete → allocate to invoices; fail/void; delete by
    admin; methods: cash/card/UPI/bank transfer/cheque/insurance/wallet).
13. Receipts (generate for completed payment; regenerate; view).
14. Refunds (create → approve → complete; reject; created from payment detail).
15. Credit Notes (create → issue → apply; void; created from invoice detail).
16. Users & Pending Approvals (admin-only; role change, activate/deactivate,
    approve registrations).

## 3. Role/module permissions verified

Permission rules below were read directly from the router dependency lists:

| Area | Allowed roles (as coded) | Source file |
| --- | --- | --- |
| Patients — create/update | ADMIN, RECEPTIONIST | `patients/routes.py` |
| Patients — list/get/profile | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `patients/routes.py` |
| Patients — activate/deactivate | ADMIN | `patients/routes.py` |
| Appointments — all ops | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `appointments/router.py` |
| Records — read/write | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `patient_records/dependencies/permissions.py` |
| Records — status change/finalize | ADMIN, DOCTOR_ROLES | same |
| Records — delete (soft) | ADMIN | same |
| Records — audit read | ADMIN, CHIEF_DOCTOR | same |
| Doctors — create/update/delete/status/schedules/specialization-assign | ADMIN, CHIEF_DOCTOR (`require_admin`) | `doctors/routes.py` |
| Doctors — list | ADMIN, RECEPTIONIST | `doctors/routes.py` |
| Doctors — read one | full read = ADMIN, RECEPTIONIST; otherwise self only | `doctors/dependencies.py` |
| Specializations — read | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `doctors/routes.py` |
| Specializations — manage | ADMIN, CHIEF_DOCTOR | `doctors/routes.py` |
| Treatment plans — all ops | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `treatment/treatment_plan_router.py` |
| Procedures — read | ADMIN, RECEPTIONIST, DOCTOR_ROLES | `treatment/procedure_router.py` |
| Procedures — write/manage | ADMIN, CHIEF_DOCTOR | `treatment/procedure_router.py` |
| Users / pending approvals | ADMIN, CHIEF_DOCTOR | `users/routes.py`, `auth/routes.py` |
| Billing dashboard | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/dashboard.py` |
| Invoices — read + create/edit draft | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/invoice.py` |
| Invoices — issue/cancel | ADMIN, RECEPTIONIST, DOCTOR_ROLES | same |
| Invoices — delete draft | ADMIN | same |
| Payments — read + create/edit | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/payment.py` |
| Payments — complete/fail/void/allocate | ADMIN, RECEPTIONIST, DOCTOR_ROLES | same |
| Payments — delete | ADMIN | same |
| Receipts — read + generate | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/receipt.py` |
| Receipts — regenerate | ADMIN, RECEPTIONIST, DOCTOR_ROLES | same |
| Refunds — create | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/refund.py` |
| Refunds — approve/reject/complete | ADMIN, RECEPTIONIST, DOCTOR_ROLES | same |
| Credit notes — create | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES | `billing/routers/credit_note.py` |
| Credit notes — issue/apply/void | ADMIN, RECEPTIONIST, DOCTOR_ROLES | same |

Notable verified nuances reflected in the manual:

- **DENTAL_ASSISTANT has billing read + draft-creation access only** — no access
  to patients, appointments, records or treatment plans, and no billing workflow
  transitions (issue/cancel/complete/allocate/regenerate/approve/apply).
- **CHIEF_DOCTOR is admin-level for management operations** (users, doctors,
  procedures, record deletion, audit trail, draft document deletion) **but is not
  a full-directory reader for doctors and cannot register/edit patients**
  (patient create/update is ADMIN + RECEPTIONIST).
- Self-guards: a user cannot change their own role or deactivate their own
  account; the approval flow assigns a role at approval time.

## 4. Workflows documented

- Login, self-registration, approval, password reset.
- **Add User from the Users screen** (admin): registers the account via
  `POST /auth/register` and auto-approves it with the chosen role via
  `PATCH /auth/users/{id}/approve` (`UserCreateContainer.tsx`); falls back to
  the pending queue if automatic approval cannot complete.
- Patient registration/search/filter/edit/activate/deactivate.
- Appointment book/reschedule/cancel/status handling.
- Clinical record creation, status workflow, diagnoses, follow-ups.
- Prescription creation, medicine entry, print/download.
- Treatment plan creation, items, status lifecycle, acceptance, versioning.
- Invoice create → draft → issue → pay → receipt; cancel; delete (admin).
- Payment record → complete → allocate; fail/void/delete.
- Refund create → approve → complete / reject.
- Credit note create → issue → apply / void.
- Attachment upload/preview/download/delete.
- Printing and PDF download via the browser print dialog.
- Six common daily scenarios (new visit, follow-up, prescription, payment,
  refund, invoice copy).

## 5. Intentionally undocumented / future modules

Documented in the manual's "Future / Not Currently Available" chapter only:

- Inventory (disabled nav item), Laboratory (disabled nav item).
- Reports (disabled nav item), Settings (disabled nav item).
- Patient portal.
- Calendar view (appointment list is the schedule view).
- Advanced billing reports (revenue/cashflow/aging/monthly/yearly).
- Standalone refund/credit-note **list** screens (no list endpoints; documents
  are created/opened from payment/invoice detail screens).
- Editing issued invoice amounts (immutable after issue).

## 6. Ambiguities / areas where the implementation was not fully verifiable

1. **Appointment status transitions** — the appointment status lifecycle
   (Scheduled → Confirmed → Checked In → In Treatment → Completed / Cancelled /
   No Show) is implemented, but the exact transition rules between every pair of
   statuses were not traced line-by-line. The manual therefore describes what
   each status means and notes that a Completed appointment cannot be cancelled
   (verified in the UI), without inventing a full transition table.
2. **Dashboard Overview metrics and Recent Activity** — these are clearly
   placeholder/sample content in the frontend (`DashboardPage.tsx` comment) with
   no backing API. The manual explicitly states they show sample figures.
3. **Receipt "Cancelled" status** — exists in the billing enums, but no UI path
   to cancel a receipt was found; the manual documents generate/view/regenerate
   only.
4. **Payment "Reversed" status** — present in the enums; no explicit UI action
   found to set it. The manual lists it in the status table with its meaning but
   no procedure was written for it.
5. **User "activate" endpoint exists but front-end flow** — user activation is
   implemented on the backend; the manual documents activate/deactivate as admin
   actions available from the user profile (as implemented in the UI).
6. **Exact print layouts** — the printable **prescription** layout was captured
   and included (Figure 13; Figure 12 is the Prescriptions tab). The printable
   **invoice** print-preview was not captured (only the invoice detail screen,
   Figure 18); the manual documents the print-preview dialog and browser
   print-dialog behaviour, which is verified from the shared
   `PrintDocumentDialog` component.
7. **Doctor navigation to their own profile** — the backend allows a doctor to
   read their own profile, but the doctor directory *list* endpoint is
   ADMIN+RECEPTIONIST only, so the manual describes the permission rather than
   prescribing a possibly-broken navigation path.
8. **Column-visibility controls** — verified present on the Patients,
   Appointments, Doctors, Users and Procedure Catalogue list toolbars; the
   manual documents them there and notes other lists do not offer the control.

## 7. Features that could not be verified / consciously excluded

- **Screenshots** — Version 1.1 embeds **22 real screenshots** captured from the
  running application (backend uvicorn on :8000 + frontend Vite dev server on
  :5173, live PostgreSQL with demo data) via a Chrome DevTools Protocol capture
  script (`docs/manual-screenshots/capture.mjs`). Each capture waits for its
  expected route/heading before shooting, so no placeholder or empty pages were
  captured. Coverage: sign-in, dashboard, users, pending approvals, doctors,
  patients list + profile, appointments, patient records list + detail,
  prescriptions tab + printable prescription, treatment plans list + detail,
  procedure catalogue, billing dashboard, invoices list + detail, payments list
  + detail, receipt, and a phone-width capture. Screenshots were taken with a
  dedicated demo administrator account
  (`demo.admin@denscare.com`, local dev database only) so no live credentials
  were exposed.
- **Screens that could not be captured** — the invoice print-preview, the
  refund/credit-note creation drawers, the New Patient / New Appointment form
  drawers, and the Attachments tab were not captured (interactive flows with no
  stable public route); these are documented textually.
- **Live dashboard statistics** — excluded from "what it shows" and flagged as
  sample content.
- **PDF generation internals** — documented exactly as the browser print-dialog
  "Save as PDF" flow, which is how the current version works.

## 8. Final quality verdict

The manual:

- describes only verified modules, roles, permissions and workflows;
- clearly separates current features from planned/future features;
- uses role-specific guides and a verified permission matrix;
- includes numbered procedures, tables, callouts, a cover page, TOC field,
  page-numbered footer and DensCare branding;
- embeds 22 real, captioned screenshots of the running application;
- was re-opened and structurally validated (28 top-level sections, 30 tables,
  22 figure captions numbered in order, 24 embedded images, PAGE field in
  footer, `updateFields` enabled so the TOC populates on open).

**Verdict: suitable for client delivery and staff training.**
