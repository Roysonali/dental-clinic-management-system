# Doctor Management Module — DensCare

## Module Overview

Structured professional profiles for dental practitioners. Extends User Management with doctor-specific data: specialization, schedule, consultation fees, qualifications.

## Status

**MVP documentation complete.** Pending implementation.

## MVP Scope

- Doctor Profile CRUD (1:1 with User)
- Specialization management (master list + assignments)
- Weekly schedule management (normalized DoctorSchedule table)
- Search, filter, pagination, sorting
- Status toggles (activate/deactivate, availability, leave)
- Full audit trail
- Integration with Auth, RBAC, Users, Appointments, Patient Records

**Out of scope:** Credentials, leave workflow, commissions, analytics, multi-clinic, notifications. See Phase 18.

## Folder Structure

```
docs/doctor-management/
  README.md
  phase-01-business-analysis.md       — Business requirements
  phase-02-domain-analysis.md         — Domain model
  phase-03-architecture-design.md     — Architecture
  phase-04-database-design.md         — Database design
  phase-05-business-rules.md          — Business rules
  phase-06-api-design.md              — API design
  phase-07-security-rbac.md           — Security/RBAC
  phase-08-enums-constants.md         — Enums/constants
  phase-09-sqlalchemy-models.md       — Models
  phase-10-pydantic-schemas.md        — Schemas
  phase-11-repository-layer.md        — Repository
  phase-12-service-layer.md           — Service
  phase-13-orchestrator-layer.md      — Orchestrator
  phase-14-router-layer.md            — Router
  phase-15-testing.md                 — Testing
  phase-16-manual-qa.md               — QA
  phase-17-production-readiness.md    — Production readiness
  phase-18-future-roadmap.md          — Future roadmap
  architecture-decision-records/
    ADR-001.md  — DoctorProfile as separate entity
    ADR-002.md  — Weekly schedule templates
    ADR-003.md  — Soft-delete
```

## ADR Index

| ADR | Title | Status |
|---|---|---|
| ADR-001 | DoctorProfile as Separate Entity | Accepted |
| ADR-002 | Weekly Schedule Templates | Accepted |
| ADR-003 | Soft-Delete | Accepted |

## Key Design Decisions

1. DoctorProfile references users.id via FK — extends User, does not duplicate
2. Only DOCTOR-family roles (CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR) can have a profile
3. Schedule stored in normalized doctor_schedules table (not JSON)
4. Simple on_leave boolean instead of full leave workflow
5. Follows existing DensCare layered architecture: Router -> Service -> Repository -> DB
6. Auth, RBAC, User Management consumed, not duplicated

## Implementation Status

| Component | Status |
|---|---|
| Documentation | Complete (refactored for MVP) |
| Implementation | Pending |

## Last Updated

2026-07-07
