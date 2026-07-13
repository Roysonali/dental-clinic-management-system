# Phase 16: Manual QA — Doctor Management Module

> **Status:** PASS | **Target:** 9.8/10
> **MVP Scope:** Only QA items for Doctor Profile, Specialization, and Schedule management.

---

## 1. Doctor CRUD

- [ ] Create doctor with all required fields — success 201
- [ ] Create doctor with optional fields — success
- [ ] Create with duplicate doctor code — 409
- [ ] Create with non-existent user — 404
- [ ] Create with non-doctor user (Receptionist) — 422
- [ ] Create with existing user_id profile — 409
- [ ] View doctor by valid ID — 200 + full profile
- [ ] View doctor by non-existent ID — 404
- [ ] Update fields via PATCH (partial) — 200
- [ ] Update with invalid data — 422
- [ ] Deactivate active doctor — is_active=false
- [ ] Reactivate inactive doctor — is_active=true
- [ ] Deactivate already inactive — 409

## 2. Search and Filtering

- [ ] List doctors — paginated results
- [ ] Search by partial name — filtered
- [ ] Search by doctor code — exact match
- [ ] Filter by specialization — correct subset
- [ ] Filter by active status — only active/inactive
- [ ] Filter by availability — only available
- [ ] Sort by name ASC — alphabetical (via User.full_name)
- [ ] Sort by name DESC — reverse alphabetical
- [ ] Empty search — 0 results + total=0
- [ ] Page size > 100 — limited to 100

## 3. Specializations

- [ ] List all specializations — 200
- [ ] Create specialization — 201
- [ ] Create duplicate name — 422
- [ ] Assign specialization to doctor — 201
- [ ] Assign duplicate specialization — 422
- [ ] Remove specialization — 204
- [ ] Remove non-existent — 404
- [ ] Set primary specialization — primary flag updated

## 4. Schedules

- [ ] Create schedule entry — 201
- [ ] Create overlapping schedule — 409
- [ ] Create with end_time < start_time — 422
- [ ] Create with invalid day_of_week (e.g., 6 or 7) — 422
- [ ] Create with consultation_duration < 15 min — 422
- [ ] Inactive doctor toggles available_for_appointment — 409
- [ ] Delete schedule entry — 204
- [ ] Update schedule entry — 200
- [ ] View doctor schedules — correct list

## 5. Status Toggles

- [ ] Toggle available_for_appointment — flag toggles
- [ ] Toggle on_leave — flag toggles
- [ ] Availability check when on_leave=true — available=false
- [ ] Availability check when all active — available=true

## 6. Auth and RBAC

- [ ] Unauthenticated request — 401
- [ ] Expired JWT — 401
- [ ] Receptionist creates doctor — 403
- [ ] Assistant creates doctor — 403
- [ ] Admin creates doctor — 201
- [ ] Chief Doctor creates doctor — 201
- [ ] Doctor views own profile — 200
- [ ] Doctor deactivates another doctor — 403
- [ ] Doctor toggles own availability — 200
- [ ] Receptionist toggles doctor availability — 403

## 7. Excluded from MVP

| Item | Reason |
|---|---|
| Credential CRUD | Credential management |
| Leave request/approve/reject | Leave workflow |
| Commission CRUD | Commission management |
| Performance dashboard | Analytics not in MVP |
| Multi-clinic filter | Multi-clinic not in MVP |
