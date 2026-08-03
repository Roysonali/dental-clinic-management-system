# Risk Register — Treatment Plan Module

> **Purpose:** Document and track all identified risks with severity ratings and mitigation strategies.
> **Status:** Live | **Review Cycle:** Quarterly

---

## Risk Rating Legend

| Rating | Color | Definition |
|---|---|---|
| **Critical** | 🔴 | Will cause system failure or data loss if realized |
| **High** | 🟠 | Significant impact on system functionality or user trust |
| **Medium** | 🟡 | Moderate impact; degraded experience or manual workaround |
| **Low** | 🟢 | Minor inconvenience; cosmetic or edge case |

---

## 1. Architectural Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| AR-01 | **Aggregate grows too large** — a treatment plan accumulates hundreds of items, making loading the aggregate expensive | 🟢 Low | Very Low | Medium | Dental plans rarely exceed 20 items. If this becomes a concern, pagination can be added to item loading. |
| AR-02 | **Version snapshot storage growth** — frequent version creation generates large JSONB storage | 🟢 Low | Low | Low | Each snapshot ~2-5 KB. Even 10 versions/plan × 10,000 plans = ~500 MB. Monitor at deployment. |
| AR-03 | **Single point of failure in state machine** — if the transition dictionary is misconfigured, invalid transitions become possible | 🟠 High | Low | High | Exhaustive parameterized tests cover all 72 possible (from, to) combinations. Code review required for state machine changes. |

---

## 2. Business Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| BR-01 | **Low adoption** — doctors continue using ad-hoc verbal treatment proposals instead of the module | 🟠 High | Medium | High | Training sessions, UI integration with existing workflows, showing cost benefits. Track adoption metrics (Phase 1 success metrics). |
| BR-02 | **Cost estimates differ from actual billing** — patients expect quoted costs; actual charges may vary | 🟡 Medium | High | Medium | Clear UI labeling that costs are "estimates only." Future billing integration will sync actual vs estimated. |
| BR-03 | **Patient disputes accepted plan scope** — patient claims a procedure was not agreed upon | 🟡 Medium | Low | Medium | Immutable version history serves as the authoritative record. The audit trail captures exactly what was accepted. |
| BR-04 | **Doctor bypasses status workflow** — doctors want to fast-track directly to "in_progress" without proposing | 🟡 Medium | Medium | Medium | Guarded transitions prevent this. If business rules change, the state machine may need reconfiguration. |

---

## 3. Technical Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| TR-01 | **JSONB version snapshots become inconsistent** — item serialization format changes between versions, making historical snapshots unreadable | 🟠 High | Low | High | Serialization format is explicitly defined in ItemMapper.to_item_dict(). Any format change requires coordinated migration or backward-compatible parsing. |
| TR-02 | **FK constraint violations during diagnosis lookup** — treatment plan references a diagnosis that was soft-deleted in Patient Records | 🟡 Medium | Medium | Medium | The FK uses ON DELETE SET NULL, but soft-deletes don't trigger FK actions. Service layer must filter `is_deleted=False` explicitly. |
| TR-03 | **Race condition in sequence number assignment** — two concurrent requests assign the same sequence number | 🟡 Medium | Low | Medium | UniqueConstraint on (plan_id, sequence_number) prevents duplicates. The second write receives a DB constraint violation. |
| TR-04 | **Concurrent version creation** — two users modify an accepted plan simultaneously, both triggering version creation | 🟡 Medium | Low | Medium | Each write increments the version number. Both succeed (two versions created) — this is the correct behavior. |

---

## 4. Performance Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| PR-01 | **Plan list query degrades with volume** — ILIKE search against patient name joined across tables slows down | 🟡 Medium | Low | Medium | Composite indexes on treatment_plans(patient_id) and patient name fields. Consider full-text search if performance degrades. |
| PR-02 | **Version snapshot retrieval latency** — large JSONB snapshots take time to deserialize | 🟢 Low | Very Low | Low | JSONB deserialization is sub-millisecond for typical snapshot sizes (< 50 items). Monitor during load testing. |
| PR-03 | **High concurrent plan creation** — multiple receptionists creating plans simultaneously during peak hours | 🟢 Low | Low | Low | Connection pooling handles concurrency. Plan creation is a single INSERT with no contention. |

---

## 5. Data Integrity Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| DIR-01 | **Plan status and item status become inconsistent** — all items completed but plan remains in "in_progress" | 🟡 Medium | Medium | Medium | Service layer checks: InProgress → Completed transition requires all items terminal. If the check fails (bug), plans can be manually transitioned via admin API. |
| DIR-02 | **Sequence number gaps cause confusion** — deleted items leave gaps in the sequence (1, 2, 5, 6) | 🟢 Low | Always | Low | Sequence gaps are natural and expected. The UI should display sequence numbers as-is. Reorder API can renumber if desired. |
| DIR-03 | **Version snapshot and active items diverge** — items are modified after a version snapshot is created | 🟢 Low | Low | Low | Immutability is enforced at the service layer — version snapshots are never modified after creation. DB-level triggers could provide defense-in-depth if needed. |

---

## 6. Concurrency Risks

| ID | Risk | Rating | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| CR-01 | **Two doctors modify the same item simultaneously** | 🟡 Medium | Low | Medium | Last-writer-wins for item field updates. Version creation on conflict provides an audit trail. No data loss — both writes succeed sequentially. |
| CR-02 | **Patient acknowledgment received during plan modification** | 🟡 Medium | Low | Medium | Acceptance transitions the plan to "accepted", locking items. Any concurrent modification attempt after acceptance will trigger versioning. |
| CR-03 | **Optimistic locking failure** — multiple versions created for the same logical change | 🟢 Low | Low | Low | Acceptable — extra versions are small (2-5 KB) and provide additional audit granularity. |

---

## 7. Mitigation Strategy Summary

| Approach | Applied To |
|---|---|
| **DB constraints** (CHECK, UNIQUE, FK) | All data integrity risks (DIR-01, DIR-02) |
| **Service-layer validation** | Business rule violations, state machine (AR-03, BR-04) |
| **Exhaustive testing** | State machine transitions (AR-03), validator functions |
| **Monitoring & alerting** | Performance degradation (PR-01), storage growth (AR-02) |
| **Training & documentation** | Adoption risks (BR-01), user errors |
| **Immutable data structures** | Audit trail integrity (BR-03, DIR-03) |

---

## 8. Accepted Risks (No Mitigation)

| ID | Risk | Rationale |
|---|---|---|
| AR-01 | Aggregate growth | Dental plans naturally have few items. Mitigation is trivial if needed. |
| PR-02 | Snapshot retrieval latency | Technically infeasible to mitigate — reading stored data always takes time. Acceptable at expected scale. |
| CR-03 | Extra versions from concurrency | Incorrect but harmless — versions provide additional audit value. |
