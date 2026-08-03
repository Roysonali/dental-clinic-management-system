# Glossary — Treatment Plan Module

> **Purpose:** Standardized terminology reference for all stakeholders.
> **Scope:** All business and technical terms used across the Treatment Plan documentation.

---

## A

### Aggregate Root
- **Definition:** The root entity that guarantees consistency within an aggregate boundary. All mutations to aggregate children must go through the root.
- **Context:** TreatmentPlan is the aggregate root; TreatmentPlanItem, TreatmentPlanVersion, and TreatmentPlanApproval are child entities.
- **Example:** Adding an item to a plan must go through `TreatmentPlanService.add_item()`, not through direct repository access.
- **Related:** Entity, Value Object, Bounded Context

### Approval Workflow
- **Definition:** The process of obtaining doctor approval and patient acknowledgment for a proposed treatment plan.
- **Context:** A plan must reach "proposed" status before approval can begin. Doctor approves first, then patient acknowledges.
- **Related:** TreatmentPlanApproval, PatientAcknowledgment, Status Transition

### Arch (Dental)
- **Definition:** The upper or lower jaw structure.
- **Context:** Used in treatment plan items to specify which jaw a procedure targets.
- **Example:** "upper" (maxilla), "lower" (mandible)
- **Related:** Tooth Number, Quadrant

---

## B

### Bounded Context
- **Definition:** A logical boundary within which a domain model applies and terms have specific meanings. Part of Domain-Driven Design.
- **Context:** The Treatment Plan module operates within the "Clinical Workflow" bounded context, separate from "Staffing & Scheduling" (Doctor Management) and "Patient Identity" (Patient Management).
- **Related:** Aggregate Root, Ubiquitous Language

---

## C

### Change Reason
- **Definition:** A mandatory textual description explaining why a treatment plan version was created.
- **Context:** Required when modifying an accepted/in-progress plan. Stored on TreatmentPlanVersion.
- **Related:** Version, Version Snapshot

### Cost Estimation
- **Definition:** The anticipated cost of a dental procedure before actual billing.
- **Context:** Each treatment plan item has an estimated cost (defaulting from the Procedure catalog, overridable). Total plan cost is computed as sum of (cost - discount).
- **Related:** Estimated Cost, Discount, Procedure

---

## D

### Diagnosis Linkage
- **Definition:** Optional association between a treatment plan item and a diagnosis from the Patient Records module.
- **Context:** Provides clinical justification for why a procedure is recommended. Links `treatment_plan_items.diagnosis_id` to `patient_record_diagnoses.id`.
- **Related:** PatientRecordDiagnosis, Patient Records

### Discount
- **Definition:** A reduction applied to the estimated cost of a treatment plan item.
- **Context:** Per-item, non-negative. A discount equal to or exceeding the cost makes the item complimentary.
- **Related:** Estimated Cost, Cost Estimation

### Draft
- **Definition:** The initial status of a newly created treatment plan. Only editable by the creating doctor.
- **Context:** Plans must have at least one item to transition out of Draft.
- **Related:** Status Transition, State Machine

---

## E

### Entity
- **Definition:** A domain object with a distinct identity that persists over time.
- **Context:** TreatmentPlan, TreatmentPlanItem, TreatmentPlanVersion, TreatmentPlanApproval, Procedure are all entities.
- **Related:** Aggregate Root, Value Object

### Estimated Cost
- **Definition:** The projected cost of a procedure for quotation purposes.
- **Context:** Defaults from the Procedure catalog; can be overridden per item. Non-negative. Single source of truth for patient quotations.
- **Related:** Cost Estimation, Discount, Procedure

---

## F

### FDI Notation
- **Definition:** Fédération Dentaire Internationale two-digit tooth numbering system. First digit = quadrant (1-4 permanent, 5-8 primary). Second digit = tooth position (1-8).
- **Context:** All tooth numbers in the system use FDI notation: 11-48 (permanent), 51-85 (primary).
- **Example:** Tooth 36 = lower left first molar (quadrant 3, tooth 6).
- **Related:** Tooth Number, Tooth Surface

---

## G

### Guarded Transition
- **Definition:** A state machine rule that prevents invalid status changes. Each transition has explicit from→to validation.
- **Context:** Plan status changes must pass through the state machine validation before being applied.
- **Example:** Draft → Completed is rejected because the transition map only allows Draft → UnderReview or Draft → Cancelled.
- **Related:** State Machine, Status Transition

---

## I

### Immutable Snapshot
- **Definition:** A JSONB record of treatment plan items at a specific point in time, stored as part of a TreatmentPlanVersion. Never modified after creation.
- **Context:** Created automatically when an accepted plan is modified. Preserves the exact state of all items at version-creation time.
- **Related:** Version, Version Snapshot, JSONB

### Item Status
- **Definition:** The status of an individual procedure item within a treatment plan.
- **Values:** pending, in_progress, completed, cancelled, deferred
- **Context:** Item status is independent from plan status. Individual items can be completed while the plan remains in progress.
- **Related:** TreatmentPlanItem, Status Transition

---

## J

### JSONB
- **Definition:** PostgreSQL's binary JSON data type used for storing immutable version snapshots.
- **Context:** The `items_snapshot` column on `treatment_plan_versions` stores a JSONB array of serialized items at version creation time.
- **Related:** Immutable Snapshot, Version

---

## P

### Patient Acknowledgment
- **Definition:** Digital record of a patient accepting, rejecting, or requesting changes to a proposed treatment plan.
- **Values:** pending, accepted, rejected, changes_requested
- **Context:** Acceptance triggers automatic transition to "accepted" status. Rejection or changes_requested keeps the plan in "proposed" status for revision.
- **Related:** Approval Workflow, TreatmentPlanApproval

### Plan Code
- **Definition:** Auto-generated unique human-readable identifier for a treatment plan.
- **Format:** TXN-{6-digit sequence} (e.g., TXN-000001)
- **Context:** Used for display and reference purposes alongside the UUID.
- **Related:** TreatmentPlan

### Procedure
- **Definition:** A dental procedure from the master catalog used as a line item in treatment plans.
- **Context:** Each procedure has a unique code, name, description, default cost, and category. Procedures are seeded at deployment and maintained by administrators.
- **Related:** TreatmentPlanItem, Procedure Catalog

### Procedure Catalog
- **Definition:** The master list of all dental procedures available for treatment planning.
- **Context:** Seeded with 30 standard procedures at deployment. Managed via `/procedures` API endpoints.
- **Related:** Procedure

---

## Q

### Quadrant (Dental)
- **Definition:** One of four sections of the mouth: UR (upper right), UL (upper left), LL (lower left), LR (lower right).
- **Context:** Used optionally on treatment plan items to identify the general area of treatment.
- **Related:** Tooth Number, Arch

---

## S

### Sequence Number
- **Definition:** An integer defining the order of a procedure item within a treatment plan.
- **Context:** Items are ordered by sequence_number within a plan. Sequence numbers are unique per plan. Gaps may exist from deleted items.
- **Related:** TreatmentPlanItem, Reorder

### State Machine
- **Definition:** A config-driven transition table that defines all valid status transitions for treatment plans and items.
- **Context:** Implemented as a dictionary in `constants.py`, consumed by `validate_status_transition()` and `validate_item_status_transition()`.
- **Related:** Guarded Transition, Status Transition

### Status Transition
- **Definition:** The act of moving a treatment plan or item from one status to another.
- **Context:** Every transition is validated against the state machine before being applied. Invalid transitions are rejected with error code `INVALID_PLAN_OPERATION`.
- **Related:** Guarded Transition, State Machine

---

## T

### Tooth Number
- **Definition:** A two-digit integer identifying a specific tooth using FDI notation.
- **Context:** Optional field on TreatmentPlanItem. Null means the procedure is not tooth-specific.
- **Related:** FDI Notation, Tooth Surface

### Tooth Surface
- **Definition:** An abbreviation identifying the specific surface(s) of a tooth being treated.
- **Valid Values:** M (mesial), D (distal), B (buccal), L (lingual), O (occlusal), I (incisal), plus combinations (MO, OD, MOD, etc.)
- **Context:** Optional field on TreatmentPlanItem. Uppercase string, no separators.
- **Related:** Tooth Number, FDI Notation

### TreatmentPlan
- **Definition:** The aggregate root entity representing a comprehensive treatment proposal for a dental patient.
- **Context:** Contains items (procedures), versions (immutable snapshots), and approval records. Has a defined lifecycle through the state machine.
- **Related:** TreatmentPlanItem, TreatmentPlanVersion, TreatmentPlanApproval

### TreatmentPlanApproval
- **Definition:** Entity tracking the doctor's approval and patient's acknowledgment of a treatment plan.
- **Context:** 1:1 relationship with TreatmentPlan. Created during the approval workflow when the plan is in "proposed" status.
- **Related:** Approval Workflow, Patient Acknowledgment

### TreatmentPlanItem
- **Definition:** A single procedure line item within a treatment plan.
- **Context:** References a Procedure from the master catalog, optionally a tooth number/surface, and has its own cost, discount, and status.
- **Related:** TreatmentPlan, Procedure

### TreatmentPlanVersion
- **Definition:** An immutable snapshot of plan items created when an accepted plan is modified.
- **Context:** Contains a JSONB snapshot of all items at version-creation time, version number, change reason, and audit information.
- **Related:** Version, Immutable Snapshot

---

## V

### Value Object
- **Definition:** An immutable object whose equality is based on its attributes, not an identifier.
- **Context:** CostEstimate, ToothIdentifier, PlanStatus are value objects in the Treatment Plan domain.
- **Related:** Aggregate Root, Entity

### Version
- **Definition:** A numbered revision of a treatment plan preserving the state of items at a point in time.
- **Context:** Version numbers start at 1 and increment with each post-acceptance modification. Plans in editable statuses (draft, under_review, proposed) are edited in-place without creating versions.
- **Related:** TreatmentPlanVersion, Immutable Snapshot

### Version Snapshot
- **Definition:** The JSONB data stored in a TreatmentPlanVersion containing a serialized copy of all items.
- **Context:** Captured at version creation time. Contains item ID, procedure, tooth info, costs, discounts, status.
- **Related:** Immutable Snapshot, JSONB
