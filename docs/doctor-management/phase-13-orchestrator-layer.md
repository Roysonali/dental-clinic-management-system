# Phase 13: Orchestrator Layer — Doctor Management Module

> **Status:** PASS | **Target Quality Score:** 9.8/10
> **MVP Scope:** No orchestrator required for MVP. All operations are single-service.

---

## 1. Decision: No Orchestrator in MVP

Per Phase 3 §2.4 (Architecture Design), the Orchestrator layer is **deferred to post-MVP** for the Doctor Management module.

### Rationale

The existing DensCare `ClinicalWorkflowOrchestrator` exists because it coordinates across **multiple aggregates** (diagnoses, prescriptions, attachments, follow-ups) within a single clinical episode. For the Doctor Management MVP:

- **Doctor onboarding** — Validates user + role + creates profile. All operations are within the `DoctorService` boundary.
- **Profile updates** — Single-service: `DoctorService.update_doctor()`
- **Status changes** — Single-service: `DoctorService.change_status()`
- **Schedule management** — Single-service: `DoctorService.create_schedule()`

**MVP:** No orchestrator. All logic lives in the Service layer.
**Post-MVP:** Orchestrator added for cross-aggregate workflows (e.g., leave approval spanning Doctor Management and Notifications).

---

## 2. MVP Operations Are Single-Service

| Operation | Layer | Why No Orchestrator |
|---|---|---|
| Create doctor profile | `DoctorService.create_doctor()` | Single aggregate (DoctorProfile). Validation and creation handled within service. |
| Update profile | `DoctorService.update_doctor()` | Single aggregate. |
| Deactivate/activate | `DoctorService.change_status()` | Single aggregate. No cross-module notifications in MVP. |
| Toggle availability/leave | `DoctorService` toggle methods | Single aggregate. |
| Schedule CRUD | `DoctorService` schedule methods | Single aggregate. |
| Specialization assignment | `DoctorService` methods | Within DoctorProfile aggregate boundary. |

---

## 3. When an Orchestrator Will Be Needed (Post-MVP)

| Workflow | Cross-Module Coordination Required | Future Phase |
|---|---|---|
| Deactivate doctor with active appointments | Cancel appointments + notify patients | Appointments module dependency |
| Leave approval workflow | Approve leave + block schedule + notify | Leave management (Phase A) |
| Commission rate change | Update billing rates + notify billing | Commission management (Phase B) |

These workflows span multiple bounded contexts and will require an Orchestrator when implemented.

---

## 4. Orchestrator Excluded from MVP

Per Phase 3 §2.4, the orchestration layer is explicitly excluded from the MVP. No `DoctorWorkflowOrchestrator` class is created in the MVP implementation.
