# Treatment Plan Module — DensCare

## Module Overview

Structured dental treatment planning for clinical workflows. Enables creation, approval, versioning, and tracking of comprehensive treatment plans — linking diagnoses, procedures, cost estimates, and payment schedules into a single clinical episode. Integrates with Patient Management, Doctor Management, Appointment Management, and Patient Records modules.

## Status

**Design documentation complete.** Pending implementation.

## MVP Scope

- Treatment Plan CRUD with status lifecycle (draft → proposed → accepted → in_progress → completed → cancelled)
- Treatment Plan Items (procedure line items with tooth numbers, cost estimates, sequencing)
- Procedure master catalog (ADA CDT codes or custom codes)
- Versioning — plan revisions with snapshot preservation
- Cost estimation — itemized costs, subtotals, discounts, total
- Approval workflow — patient acknowledgment tracking, payment plan linkage
- Search, filter, pagination, sorting
- Full audit trail
- Integration with Auth, RBAC, Users, Patients, Doctors, Appointments, Patient Records

**Out of scope:** Insurance claim generation, billing/invoice integration, treatment outcome analytics, teledentistry consent, multi-clinic treatment plan sharing, AI-assisted treatment recommendations.

## Folder Structure

```
docs/treatment/
  README.md
  01-business-analysis.md      — Business requirements
  02-domain-analysis.md         — Domain model
  03-database-design.md         — Database design
  04-workflows-state-machines.md — Workflows & state machines
  05-api-design.md              — API design
  06-security-rbac.md           — Security/RBAC
  07-validation-rules.md        — Validation rules
  08-enums-constants.md         — Enums/constants
  09-exception-design.md        — Exception hierarchy
  10-architecture-design.md     — Architecture design
  11-orm-model-design.md        — ORM model design
  12-repository-design.md       — Repository design
  13-validator-design.md        — Validator design
  14-service-design.md          — Service design
  15-mappers-schemas.md         — Mappers/schemas
  16-router-design.md           — Router design
  17-testing-strategy.md        — Testing strategy
  18-production-review.md       — Production readiness review
```

## Key Design Decisions

1. TreatmentPlan is the aggregate root — owns TreatmentPlanItem and TreatmentPlanVersion as child entities
2. Procedure catalog is a reference/master entity (seeded with common dental procedures)
3. Status lifecycle follows a state machine with guarded transitions (no arbitrary status jumps)
4. Versioning creates immutable snapshots when plan is modified after acceptance
5. Tooth numbering follows FDI World Dental Federation notation (two-digit system)
6. Cost estimates are itemized per procedure — total is computed, not stored
7. Patient acknowledgment is tracked via TreatmentPlanApproval, not a boolean flag
8. Follows existing DensCare layered architecture: Router → Service → Validator → Repository → DB
9. Auth, RBAC, Patients, Doctors, Appointments, Patient Records consumed, not duplicated

## Implementation Status

| Component | Status |
|---|---|
| Documentation | Complete |
| Implementation | Pending |

## Last Updated

2026-07-13
