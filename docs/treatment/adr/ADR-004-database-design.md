# ADR-004: Database Design Decisions

| Field | Value |
|---|---|
| **ADR ID** | ADR-004 |
| **Status** | Accepted |
| **Date** | 2026-07-13 |
| **Module** | Treatment Plan |
| **Deciders** | Engineering Team |

---

## Context

The Treatment Plan module requires five new database tables. These tables must integrate with the existing DensCare schema (patients, doctors, users, appointments, patient_record_diagnoses) while following established naming conventions and design patterns.

## Problem

What database design decisions ensure referential integrity, query performance, and maintainability while integrating with the existing schema?

## Decision 1: UUID Primary Keys

**Decision:** All Treatment Plan entities (TreatmentPlan, TreatmentPlanItem, TreatmentPlanVersion, TreatmentPlanApproval) use UUID primary keys. The Procedure master table uses an auto-incrementing Integer PK.

| Entity | PK Type | Rationale |
|---|---|---|
| TreatmentPlan | UUID | Matches Patient UUID pattern; prevents ID enumeration |
| TreatmentPlanItem | UUID | Must be globally unique for API operations |
| TreatmentPlanVersion | UUID | Must be globally unique for API operations |
| TreatmentPlanApproval | UUID | Must be globally unique for API operations |
| Procedure | Integer (SERIAL) | Small master table (< 100 rows); Integer is more efficient for FK lookups |

**Why UUIDs?** UUIDs prevent resource enumeration attacks, enable client-side ID generation, and support future horizontal scaling. Integer PKs are retained for the Procedure table because it is a small reference table where sequential IDs are acceptable.

## Decision 2: Foreign Key Cascade Rules

| FK | From | To | On Delete | Rationale |
|---|---|---|---|---|
| patient_id | TreatmentPlan | patients.id | RESTRICT | Prevent plan from referencing a deleted patient |
| doctor_id | TreatmentPlan | doctors.id | RESTRICT | Prevent plan from referencing a deleted doctor |
| plan_id | TreatmentPlanItem | treatment_plans.id | CASCADE | Items have no meaning without their parent plan |
| plan_id | TreatmentPlanVersion | treatment_plans.id | CASCADE | Versions have no meaning without their parent plan |
| plan_id | TreatmentPlanApproval | treatment_plans.id | CASCADE | Approval has no meaning without its parent plan |
| procedure_id | TreatmentPlanItem | procedures.id | RESTRICT | Prevent items from referencing a deleted procedure |
| appointment_id | TreatmentPlanItem | appointments.id | SET NULL | Item remains if appointment is deleted |
| diagnosis_id | TreatmentPlanItem | patient_record_diagnoses.id | SET NULL | Item remains if diagnosis is deleted |
| created_by | TreatmentPlan | users.id | SET NULL | Audit trail preserved even if user is deleted |
| approved_by | TreatmentPlanApproval | users.id | SET NULL | Approval preserved even if user is deleted |

**Why CASCADE for child entities?** Items, versions, and approvals are owned exclusively by the parent plan. If a plan is deleted, all child data must be removed — orphaned child records would cause FK violations and data integrity issues.

**Why RESTRICT for patient/doctor/procedure?** A plan should never reference a non-existent patient, doctor, or procedure. RESTRICT prevents deletion of referenced entities until all referencing plans are handled.

**Why SET NULL for audit/optional FKs?** Deleting an appointment or diagnosis should not cascade-delete treatment items. Deleting a user should not remove audit history. SET NULL preserves the record while removing the FK reference.

## Decision 3: CHECK Constraints

| Table | Constraint | Purpose |
|---|---|---|
| treatment_plans | `status IN ('draft',...,'cancelled')` | Prevent invalid status values |
| treatment_plans | `valid_from <= valid_to` | Prevent logically impossible date ranges |
| treatment_plan_items | `estimated_cost >= 0` | Prevent negative costs |
| treatment_plan_items | `discount >= 0` | Prevent negative discounts |
| treatment_plan_items | `item_status IN ('pending',...,'deferred')` | Prevent invalid item status values |
| treatment_plan_items | `tooth_number BETWEEN 11 AND 48 OR BETWEEN 51 AND 85` | Enforce FDI tooth numbering |
| treatment_plan_versions | `version_number >= 1` | Prevent zero or negative version numbers |
| treatment_plan_approvals | `patient_status IN ('pending',...,'changes_requested')` | Prevent invalid acknowledgment statuses |
| procedures | `default_cost >= 0` | Prevent negative default costs |
| procedures | `category IN ('diagnostic',...,'other')` | Prevent invalid category values |

**Why CHECK constraints in addition to application validation?** Database-level CHECK constraints provide a last line of defense against data corruption. Application validation can have bugs; constraints ensure data integrity regardless of how data enters the system.

## Decision 4: Indexing Strategy

| Index | Type | Justification |
|---|---|---|
| `ix_tp_patient` (patient_id) | B-tree | All plans for a patient (common query) |
| `ix_tp_doctor` (doctor_id) | B-tree | All plans by a doctor (common query) |
| `ix_tp_status` (status) | B-tree | Filter by status (common query) |
| `ix_tp_active_status` (is_active, status) | Composite B-tree | Common filter pattern |
| `ix_tp_created_at` (created_at DESC) | B-tree descending | Recent plans (common list query) |
| `ix_tpi_plan_sequence` (plan_id, sequence_number) | Composite + Unique | Item ordering + sequence uniqueness |
| `ix_tpi_procedure` (procedure_id) | B-tree | Procedure usage analysis |
| `ix_tpi_status` (plan_id, item_status) | Composite B-tree | Item status summary per plan |
| `ix_tpi_appointment` (appointment_id) | B-tree | Appointment-to-plan lookup |
| `ix_tpv_plan_version` (plan_id, version_number DESC) | Composite B-tree | Version history ordered by version |
| `ix_procedures_active` (is_active) | B-tree | Active procedure listings |
| `ix_procedures_category` (category) | B-tree | Category-based procedure browsing |

**Why no GiST/GIN indexes?** JSONB is only used on the versions table for snapshots, and snapshots are always read as complete documents — never queried by internal field values. A GIN index on the JSONB column would add write overhead without any read benefit.

## Related ADRs

- ADR-001 (Aggregate Root) — defines which tables are created
- ADR-002 (Versioning Strategy) — defines JSONB column use
- ADR-005 (Cost Calculation Strategy) — defines financial column types
