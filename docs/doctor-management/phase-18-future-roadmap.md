# Phase 18: Future Roadmap — Doctor Management Module

> **Status:** PASS | **Target:** 9.8/10
> **Purpose:** Features explicitly deferred from the MVP. MVP docs should NOT reference these as current requirements.

---

## 1. Phase Priority Matrix

| Priority | Phase | Timeline | Description |
|---|---|---|---|
| P1 | Phase A | Post-MVP Sprint 1 | Credential mgmt, leave requests |
| P2 | Phase B | Post-MVP Sprint 2 | Commission config, notifications |
| P3 | Phase C | Post-MVP Sprint 3 | Performance analytics, reporting |
| P4 | Phase D | Future Release | Multi-clinic, advanced HR |
| P5 | Phase E | Long-term | AI scheduling, teledentistry |

## 2. Phase A: Credential and Leave Management

### 2.1 Credential Entity

Track licenses, certifications, and CE credits.

**Table:** credentials (doctor_id FK, credential_type, credential_number, issuing_authority, issue_date, expiry_date, is_verified, document_url)

**Features:** CRUD, 30-day expiry warning, block scheduling if expired, document upload

**Endpoints:** GET/POST /doctors/{id}/credentials, PATCH/DELETE /doctors/{id}/credentials/{cid}

### 2.2 Leave Management

Replace simple on_leave toggle with full leave workflow.

**Table:** leave_records (doctor_id FK, leave_type, start_date, end_date, reason, status, approved_by, approved_at)

**Features:** Leave request, approve/reject workflow, auto-block availability, overlap detection

**Endpoints:** GET/POST /doctors/{id}/leaves, PATCH /doctors/{id}/leaves/{lid}/approve, PATCH /doctors/{id}/leaves/{lid}/reject

### 2.3 Schedule Overrides

**Table:** schedule_overrides (doctor_id FK, override_date, is_working, start_time, end_time, reason)

## 3. Phase B: Commission and Notifications

### 3.1 Commission Configuration

**Table:** commission_rates (doctor_id FK, commission_type, rate, effective_from, effective_to, is_active)

**Features:** Percentage/fixed/tiered, date ranges, active- rate constraint, billing integration

**Endpoints:** GET/POST /doctors/{id}/commissions, PATCH /doctors/{id}/commissions/{cid}

### 3.2 Notification Engine

License expiry alerts, leave notifications, schedule changes. Channels: in-app, email, SMS.

### 3.3 Background Jobs

Daily: license expiry checks. Daily: leave start/end. Weekly: performance metrics. Tools: Celery/APScheduler.

## 4. Phase C: Performance and Analytics

### 4.1 Performance Metrics

**Read Model:** performance_metrics (doctor_id, period, total_appts, completed, cancelled, no_show, completion_rate, revenue)

**Endpoints:** GET /doctors/{id}/performance, GET /doctors/analytics/summary

### 4.2 KPIs

Completion rate, no-show rate, avg patients/day, revenue per doctor.

## 5. Phase D: Multi-Clinic and Department Management

**Tables:** clinics, doctor_clinic_assignments, departments, doctor_departments

**Features:** Multi-clinic assignment, department org, attendance, payroll, shift scheduling

## 6. Phase E: Long-Term

AI scheduling, teledentistry, external credential verification, patient feedback/ratings

## 7. Entity Cross-Reference

| Future Entity | Referenced In MVP |
|---|---|
| Credential | Phase 4, 5, 8, 9 (excluded) |
| LeaveRecord | Phase 2, 4, 9 (excluded) |
| CommissionRate | Phase 2, 4, 9 (excluded) |
| PerformanceMetric | Phase 2 (excluded) |
| ScheduleOverride | Phase 3 ADR-002 trade-off |

## 8. Endpoints by Phase

| Endpoint | Phase |
|---|---|
| /doctors/{id}/credentials (GET/POST/DELETE) | A |
| /doctors/{id}/leaves (GET/POST) | A |
| /doctors/{id}/leaves/{lid}/approve | A |
| /doctors/{id}/commissions (GET/POST) | B |
| /doctors/{id}/performance (GET) | C |
| /doctors/analytics/* (GET) | C |
| /clinics (GET/POST) | D |

## 9. Migration Strategy

MVP schema is forward-compatible. Adding future tables requires no schema changes to existing tables. No breaking changes anticipated.
