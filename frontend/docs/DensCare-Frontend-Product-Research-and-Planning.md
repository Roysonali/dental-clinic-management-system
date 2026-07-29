# DensCare Frontend Product Research & Planning

---
## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Business Analysis](#3-business-analysis)
4. [Research Findings](#4-research-findings)
5. [Competitor Insights](#5-competitor-insights)
6. [Personas](#6-personas)
7. [User Journeys](#7-user-journeys)
8. [Information Architecture](#8-information-architecture)
9. [Navigation Architecture](#9-navigation-architecture)
10. [UX Principles](#10-ux-principles)
11. [Design Philosophy](#11-design-philosophy)
12. [Design System Philosophy](#12-design-system-philosophy)
13. [Application Structure](#13-application-structure)
14. [Dashboard Strategy](#14-dashboard-strategy)
15. [Component Inventory](#15-component-inventory)
16. [Screen Inventory](#16-screen-inventory)
17. [API Mapping Strategy](#17-api-mapping-strategy)
18. [Future Expansion Planning](#18-future-expansion-planning)
19. [Assumptions](#19-assumptions)
20. [Risks](#20-risks)
21. [Recommendations](#21-recommendations)
22. [Next Steps](#22-next-steps)

---

## 1. Executive Summary

DensCare is a production-grade Dental Clinic Management System (DCMS) built for real multi-specialty dental clinics. The backend is complete — 9 modules, 115 REST API endpoints, 20 database tables, 7 RBAC roles, 870 automated tests — and ready for frontend development. This document lays the complete product foundation for the DensCare frontend application.

The frontend will be a modern, enterprise-grade React single-page application serving seven distinct user roles across three primary workspaces: **Clinical** (doctors, dental assistants), **Administrative** (receptionists, administrators), and **Managerial** (chief doctors, administrators). The application must prioritize speed, clinical safety, data accuracy, and role-appropriate information delivery above all else.

### Current Project Status

| Dimension | Status |
|-----------|--------|
| Backend Modules | 9 of 14 planned — Complete & Production Ready |
| REST API Endpoints | 115 verified |
| Database Tables | 20 |
| User Roles | 7 (RBAC enforced) |
| Automated Tests | 870+ |
| Frontend Scaffold | React 19 + Vite + TypeScript (scaffolded) |
| Frontend Architecture | Not yet designed |

### Key Strategic Decisions

1. **Three-workspace architecture** — Clinical, Administrative, and Managerial workspaces with role-gated access
2. **Patient-centric navigation** — Every workflow revolves around the patient as the central entity
3. **Progressive disclosure** — Clinical interfaces reveal information on demand, never overwhelming the user
4. **Offline resilience** — Patient lookup and appointment viewing must work with degraded network
5. **Audit transparency** — Immutable audit trails are visible but non-intrusive

---

## 2. Product Vision

### Vision Statement

DensCare will become the definitive dental practice management platform — delivering a seamless, intelligent, and auditable experience that transforms how dental clinics operate. By putting clinical workflow efficiency and patient safety at the center of every interaction, DensCare will eliminate paper, reduce administrative overhead, and empower dental professionals to focus on what matters most: patient care.

### Mission Statement

To build a secure, scalable, and intuitive frontend that unlocks the full potential of the DensCare backend — enabling every clinic role to perform their work faster, with fewer errors, and with complete confidence in the system's accuracy and auditability.

### Product Goals

| Goal                                                 | Priority |                Success Metric |
|------------------------------------------------------|----------|--------------------------------------------|
| Complete patient lifecycle management in the browser | Critical | Every clinical interaction possible within 3 clicks of the patient record |
| Zero-training-required receptionist workflow | Critical | Receptionist can register a patient and book an appointment without training |
| Clinical documentation in under 2 minutes per patient | Critical | Average clinical note creation time ≤ 120 seconds |
| Treatment plan creation and approval in under 5 minutes | High | Average treatment plan workflow completion ≤ 5 minutes |
| Role-appropriate dashboards that show only relevant data | High | User satisfaction score ≥ 4.5/5 for dashboard relevance |
| Sub-second page transitions for all list views | High | List view render time ≤ 500ms for 100 items |
| Complete offline resilience for patient lookup | Medium | Patient search works with cached data when offline |

### Business Goals

| Goal | How Frontend Delivers |
|------|----------------------|
| Reduce administrative overhead | Streamlined forms with smart defaults, auto-complete, and duplicate detection |
| Eliminate paper records | Complete digital documentation with structured data entry |
| Enable multi-clinic scalability | Architecture supports branch switching from day one |
| Provide medico-legal compliance | Immutable audit trail viewing built into every record |
| Drive patient satisfaction | Treatment plan visualization, cost transparency, acknowledgment workflow |

### UX Goals

| Goal | Principle | Measurement |
|------|-----------|-------------|
| **Speed** | Every action should require minimum clicks | Clicks-per-task ratio benchmarked per role |
| **Clarity** | Users should never wonder "what do I do next?" | Task completion rate without training |
| **Safety** | Prevent data entry errors before they happen | Error prevention rate (blocked vs. submitted errors) |
| **Confidence** | Users trust the data they see and enter | Audit trail visibility and undo support |
| **Efficiency** | Frequent tasks should be muscle-memory fast | Keyboard shortcuts for all frequent actions |

### Long-term Vision

DensCare evolves from a practice management system to an intelligent clinical platform:
- **Year 1:** Complete frontend for all existing backend modules
- **Year 2:** Billing, inventory, lab management, and patient portal
- **Year 3:** AI-assisted diagnosis, treatment recommendations, and predictive analytics
- **Year 4:** Multi-clinic enterprise platform with central administration

---

## 3. Business Analysis

### Core Business Domain

DensCare operates in the dental practice management domain — a specialized vertical within healthcare IT. Dental clinics have distinct workflows that differ significantly from general medical practices:

1. **Appointment-driven care** — Patients visit on scheduled appointments, not walk-in (generally)
2. **Multi-visit treatments** — Many procedures require multiple appointments (root canals, crowns, orthodontics)
3. **Chairside documentation** — Clinicians document while treating patients, often gloved and unable to type
4. **Visual diagnosis** — Treatment planning relies heavily on visual examination and radiographs
5. **Treatment plan approval** — Patients must review and approve costly treatment plans before work begins
6. **Quadrant-based treatment** — Dental work is organized by mouth quadrants and tooth numbers
7. **Insurance and billing complexity** — Dental insurance has unique coding systems (ADA CDT codes)

### Business Value Chain

```
Patient Acquisition → Scheduling → Examination → Diagnosis
    → Treatment Planning → Approval → Treatment → Follow-up → Billing
```

The frontend must support every step of this chain with zero friction.

### Current Pain Points (Assumed — To Be Validated with Users)

| Pain Point | Impact | Frontend Solution |
|------------|--------|-------------------|
| Paper records lost or illegible | Patient safety risk | Structured digital records with search |
| Double-booking due to manual scheduling | Revenue loss, patient frustration | Real-time conflict detection with visual calendar |
| Treatment plans discussed verbally, no documentation | Medico-legal risk | Structured plan creation with patient acknowledgment |
| Patient information scattered across systems | Inefficiency, errors | Unified patient record as single source of truth |
| Difficult to track treatment progress | Poor patient outcomes | Treatment plan dashboard with visual status indicators |
| Time spent on data entry instead of patient care | Reduced productivity | Smart defaults, auto-complete, template-driven entry |

### Revenue Impact

| Efficiency Gain | Estimated Impact |
|----------------|------------------|
| 5 minutes saved per patient visit | +2-3 patients per doctor per day |
| Reduced scheduling conflicts | +5-10% appointment utilization |
| Faster treatment plan approval | +15% case acceptance rate |
| Reduced billing errors | +3-5% revenue recovery |

---

## 4. Research Findings

### Healthcare UX Research Synthesis

Our research into enterprise healthcare UX (Epic, Athenahealth, Cerner) and modern dental PMS platforms (Dentrix, Open Dental, Curve Dental, CareStack, Cliniko, Halaxy) reveals consistent patterns that should inform DensCare's frontend design.

#### 4.1 The Unified Patient Record Pattern

Every modern dental PMS uses a **unified patient record** as the central organizing principle. When a user selects a patient, they enter a persistent "patient context" that follows them across all modules — appointments, clinical records, treatment plans, prescriptions, and billing.

**Why this works:** Dental workflow is inherently patient-centric. A doctor treats one patient at a time, and needs access to all that patient's data without navigating away. The unified record eliminates context-switching.

**DensCare application:** The patient record is the central hub. From a patient record, users can:
- View appointment history and upcoming appointments
- Access clinical records (diagnoses, prescriptions, attachments, follow-ups)
- View and manage treatment plans
- See audit trail for all clinical actions
- Access patient demographics and contact information

#### 4.2 Role-Specific Dashboards

Leading platforms provide role-specific dashboards that show only relevant information. A receptionist sees today's appointments, pending check-ins, and new patient registrations. A doctor sees their schedule, pending treatment plan approvals, and follow-ups due.

**Why this works:** Each role has fundamentally different information needs. A dashboard designed for one role is noise for another. Role-specific views reduce cognitive load and speed up daily workflow.

**DensCare application:** Seven distinct dashboard views, each tailored to the role's daily tasks and permissions.

#### 4.3 Progressive Disclosure in Clinical Contexts

Clinical interfaces in Epic and Athenahealth use progressive disclosure extensively — showing only essential information initially, with drill-down capabilities for details. This is critical in clinical environments where information overload can lead to errors.

**Why this works:** Clinicians under time pressure need to find information quickly. A flat interface with all data visible creates visual noise that slows down information retrieval.

**DensCare application:** Treatment plan summaries show key data at a glance; full details expand on demand. Patient records show recent activity; full history is one click away.

#### 4.4 The "Always-On" Patient Header

Enterprise EHR systems use a persistent patient header (or "patient banner") that stays visible as clinicians navigate between sections — similar to Epic's "patient header" pattern.

**Why this works:** In fast-paced clinical environments, clinicians need constant awareness of who they're working with. The persistent header prevents disorientation when switching between patient data sections.

**DensCare application:** A compact patient banner persists at the top of all patient-context screens, showing patient name, code, age, gender, and status badge.

#### 4.5 Structured Data Entry with Templates

Modern dental PMS platforms have moved away from free-text notes toward structured data entry with templates, picklists, and smart defaults. This improves data quality, enables analytics, and speeds up documentation.

**Why this works:** Free-text notes are slow to enter, hard to search, and impossible to analyze. Structured data enables decision support, audit trails, and outcome tracking.

**DensCare application:** All clinical documentation uses structured forms with diagnosis picklists, procedure catalogs, tooth charts, and template-driven notes.

#### 4.6 Visual Treatment Planning

Curve Dental and CareStack excel at visual treatment planning — using tooth charts and graphical interfaces to show proposed work. This improves patient understanding and case acceptance.

**Why this works:** Dental treatment is visual by nature. Patients understand their treatment better when they can see it on a tooth chart. Visual plans also reduce miscommunication between clinicians.

**DensCare application:** Treatment plan items are displayed on a visual tooth chart (FDI notation) with color-coded status indicators.

#### 4.7 The "Day-at-a-Glance" Appointment Calendar

Appointment scheduling in dental PMS typically uses a day/week view showing time slots with patient names, procedure types, and status colors. Drag-and-drop rescheduling is standard.

**Why this works:** Dental appointments are the heartbeat of the clinic. The calendar must be glanceable — showing enough information at a distance for staff to understand the day's flow.

**DensCare application:** Three-view calendar (day/week/month) with color-coded appointment types, drag-and-drop rescheduling, and conflict detection.

---

## 5. Competitor Insights

### Competitive Landscape Analysis

| Platform | Strengths | Weaknesses | Key UX Pattern to Learn |
|----------|-----------|------------|------------------------|
| **Dentrix** | Comprehensive feature set, strong reporting | Outdated UI, steep learning curve, Windows-only | Appointment calendar with color-coded status |
| **Open Dental** | Highly customizable, powerful database | Complex setup, inconsistent UX, desktop-focused | Patient search with advanced filtering |
| **Curve Dental** | Modern cloud UI, good mobile experience | Limited customization, newer to market | Visual treatment planning with tooth chart |
| **CareStack** | All-in-one platform, built-in billing | Expensive, complex for small clinics | Unified patient record with rich sidebar |
| **Denticon** | Enterprise-grade, multi-location support | Complex, expensive, steep learning curve | Role-based dashboards with clear KPIs |
| **Cliniko** | Clean, modern UI, great UX | No treatment planning, limited dental-specific features | Clean interface design, excellent search |
| **Halaxy** | Free tier, broad feature set | Cluttered interface, too many features | Patient portal with self-service booking |
| **SimplePractice** | Excellent UX, good for solo practitioners | General practice focused, limited dental features | Clean form design, intuitive navigation |
| **Athenahealth** | Strong revenue cycle management | Enterprise-focused, expensive | Intelligent workflow automation |
| **Epic** | Enterprise EHR leader, interoperability | Overwhelming complexity | Persistent patient header pattern |

### Key Competitive Insights

1. **Cloud-native platforms win on UX.** Curve Dental, CareStack, and Cliniko demonstrate that modern web interfaces with clean design outperform legacy desktop software on user satisfaction.

2. **Specialization matters.** General practice EHR interfaces (Athenahealth, Epic, SimplePractice) lack dental-specific features like tooth charting, FDI notation, and procedure catalogs. DensCare's dental-specific focus is a competitive advantage.

3. **Mobile is table stakes.** Most modern platforms offer mobile apps or responsive web interfaces. DensCare must be fully responsive from day one, with a mobile-optimized experience for clinical staff using tablets chairsid.

4. **Unified platforms beat best-of-breed.** The trend is toward all-in-one platforms that handle scheduling, clinical records, treatment planning, billing, and patient communication in one system — eliminating the need for third-party integrations.

5. **Visual treatment planning drives case acceptance.** Platforms with visual treatment planning tools (Curve, CareStack) report higher case acceptance rates. This is a critical feature for DensCare.

6. **Search must be instant and global.** Every modern platform has a global search bar that searches across patients, appointments, and records. Google-like instant search is expected.

### What NOT to Copy

| Anti-Pattern | Why to Avoid | Example |
|-------------|--------------|---------|
| Information-dense screens with tiny fonts | Clinical errors from misreading | Open Dental |
| Modal-heavy workflows | Context switching disorientation | Old Dentrix |
| Non-standard UI components | Training overhead, inconsistency | Custom desktop UI patterns |
| Too many clicks for common tasks | Reduced productivity | Systems requiring 5+ clicks to view a patient |
| Inconsistent navigation patterns | Learning curve frustration | Legacy platforms with mixed menu systems |

---

## 6. Personas

### 6.1 Administrator — "Alex"

| Attribute | Detail |
|-----------|--------|
| **Role** | System administrator, clinic operations manager |
| **Background** | 10+ years in clinic management, moderate technical skills |
| **Responsibilities** | User management, role assignment, clinic configuration, system oversight, audit review |
| **Daily Tasks** | Approve pending users, manage doctor profiles, review audit logs, configure system settings, generate reports |
| **Pain Points** | Users requesting access changes, tracking who did what, maintaining system security |
| **Goals** | Complete system visibility, efficient user lifecycle management, bulletproof audit trail |
| **Technical Skill** | Moderate — comfortable with forms and tables but not complex interfaces |
| **Primary Screens** | Admin Dashboard, User Management, Doctor Management, Audit Log, Reports |
| **Secondary Screens** | Patient Management, Appointment Calendar (read-only) |
| **Permissions** | Full access to all modules |
| **Navigation Needs** | Quick access to user approval queue, doctor management, audit logs |
| **Frequency of Use** | Daily, 2-4 hours |
| **Current Problems** | Manually tracking user activity, no central oversight dashboard |
| **Expected Experience** | Clean admin panel with clear KPIs, easy user approval workflow, searchable audit logs |

### 6.2 Chief Doctor — "Dr. Chen"

| Attribute | Detail |
|-----------|--------|
| **Role** | Senior clinician, clinical supervisor |
| **Background** | 15+ years in dentistry, owns/manages the clinic |
| **Responsibilities** | Treatment plan review and approval, clinical oversight, specialization routing, complex case handling |
| **Daily Tasks** | Review pending treatment plans, approve/reject plans, manage doctor schedules, review clinical records |
| **Pain Points** | Ensuring treatment plan quality, tracking junior doctors' work, managing specialty referrals |
| **Goals** | Clinical excellence, complete oversight of patient care, efficient treatment approval workflow |
| **Technical Skill** | Low-Moderate — prefers simple interfaces, uses computer mainly for records |
| **Primary Screens** | Chief Dashboard, Treatment Plan Review, Patient Clinical Record, Doctor Management |
| **Secondary Screens** | Appointment Calendar, Treatment Plan Creation, Reports |
| **Permissions** | All clinical + administrative read + plan approval, doctor management |
| **Navigation Needs** | Quick access to pending review queue, patient search, schedule view |
| **Frequency of Use** | Daily, 4-6 hours |
| **Current Problems** | Paper-based treatment proposal review, no centralized approval tracking, difficulty tracking junior doctor performance |
| **Expected Experience** | Clear pending action queue, easy approve/reject workflow, summary view of clinic performance |

### 6.3 General Doctor — "Dr. Patel"

| Attribute | Detail |
|-----------|--------|
| **Role** | General dental practitioner |
| **Background** | 5-8 years in dentistry, performs general procedures |
| **Responsibilities** | Clinical examination, diagnosis, treatment planning, treatment execution, clinical documentation |
| **Daily Tasks** | View today's appointments, access patient records, record diagnoses, create prescriptions, create and manage treatment plans, write clinical notes |
| **Pain Points** | Documentation takes too long, treatment plan approval process is slow, searching for patient history |
| **Goals** | Efficient clinical documentation, quick treatment plan creation, easy access to patient history |
| **Technical Skill** | Low — wants the system to stay out of the way, high preference for template-driven input |
| **Primary Screens** | Doctor Dashboard, Patient Clinical Record, Treatment Plan Creation, Prescription Form, Diagnosis Entry |
| **Secondary Screens** | Appointment Calendar, Patient Search, Treatment Plan Review |
| **Permissions** | Clinical workflows, own patients, treatment plan creation |
| **Navigation Needs** | Quick patient search, today's appointments list, one-click access to clinical documentation |
| **Frequency of Use** | Daily, 6-8 hours chairside |
| **Current Problems** | Manual paper records, slow documentation, difficulty tracking patient treatment progress |
| **Expected Experience** | Fast documentation with templates, visual treatment planning, seamless patient record access |

### 6.4 Specialist Doctor — "Dr. Rodriguez"

| Attribute | Detail |
|-----------|--------|
| **Role** | Specialist (endodontist, orthodontist, periodontist, oral surgeon) |
| **Background** | 10+ years with specialized training |
| **Responsibilities** | Specialist consultations, complex procedures within specialty, referral treatment |
| **Daily Tasks** | View referred patients, access clinical records, perform specialist procedures, update treatment plan items |
| **Pain Points** | Receiving incomplete referrals, lack of patient history context, coordinating with referring doctors |
| **Goals** | Clear referral context, efficient specialist documentation, seamless handoff to referring doctor |
| **Technical Skill** | Low-Moderate |
| **Primary Screens** | Doctor Dashboard (specialist view), Patient Clinical Record, Procedure Documentation |
| **Secondary Screens** | Treatment Plan View, Appointment Calendar |
| **Permissions** | Clinical workflows, specialty-scoped procedures |
| **Navigation Needs** | Referral queue, patient search with referral context |
| **Frequency of Use** | Daily, 4-6 hours |
| **Current Problems** | No structured referral system, incomplete patient information on referral |
| **Expected Experience** | Clear referral information, relevant patient history pre-loaded, easy specialist documentation |

### 6.5 Consulting Doctor — "Dr. Williams"

| Attribute | Detail |
|-----------|--------|
| **Role** | Part-time visiting consultant |
| **Background** | Senior specialist, visits 1-2 days per week |
| **Responsibilities** | Second opinions, complex case consultation, limited procedures |
| **Daily Tasks** | View assigned consultations, access patient records, provide consultation notes, recommend treatment |
| **Pain Points** | Limited time, needs quick access to relevant patient data, may not be familiar with system |
| **Goals** | Fast patient context, minimal learning curve, efficient consultation documentation |
| **Technical Skill** | Variable — may be low |
| **Primary Screens** | Consultation Dashboard, Patient Clinical Record (read), Consultation Notes |
| **Secondary Screens** | Treatment Plan View |
| **Permissions** | Limited clinical, own profile, read-only patient records |
| **Navigation Needs** | Today's consultation list, patient search |
| **Frequency of Use** | Weekly, 4-8 hours on consulting days |
| **Current Problems** | Paper-based consultations, no access to patient history before visit |
| **Expected Experience** | Quick login, clear list of assigned consultations, one-click access to relevant patient data |

### 6.6 Receptionist — "Maya"

| Attribute | Detail |
|-----------|--------|
| **Role** | Front desk operations |
| **Background** | 2-5 years in clinic front desk, basic computer skills |
| **Responsibilities** | Patient registration, appointment booking, patient check-in/check-out, phone call handling |
| **Daily Tasks** | Register new patients, search for existing patients, book appointments, check in patients, print appointment slips, manage cancellations |
| **Pain Points** | Multi-tasking between phone and computer, finding patient records quickly, managing appointment changes |
| **Goals** | Fast patient registration, conflict-free scheduling, quick patient lookup |
| **Technical Skill** | Moderate — spends all day on the computer, values efficiency |
| **Primary Screens** | Reception Dashboard, Appointment Calendar, Patient Registration Form, Patient Search |
| **Secondary Screens** | Patient Profile (read), Doctor Schedule View |
| **Permissions** | Patient management (create/update/read — NOT activate/deactivate/delete), appointment management (create/update/read/cancel), patient records (create/update/read — NOT status change/finalize/delete/audit), doctor view (read-only) |
| **Navigation Needs** | Quick access to schedule, patient search should be global and instant, one-click patient registration |
| **Frequency of Use** | Daily, 8+ hours at front desk |
| **Current Problems** | Manual appointment book, paper registration forms, slow patient lookup |
| **Expected Experience** | Fast everything — instant search, one-click booking, auto-complete forms, clear schedule view |

### 6.7 Dental Assistant — "James"

| Attribute | Detail |
|-----------|--------|
| **Role** | Clinical support staff |
| **Background** | Certified dental assistant, works chairside with doctors |
| **Responsibilities** | Prepare treatment rooms, assist during procedures, update clinical records (under doctor supervision), manage instrument inventory |
| **Daily Tasks** | View today's appointments, prepare patient records for doctor, update treatment item status, record clinical notes (assisted) |
| **Pain Points** | Need quick access to today's schedule and patient preparation info, limited time between patients |
| **Goals** | Efficient patient handoff, clear understanding of planned procedures for each patient |
| **Technical Skill** | Low — primarily focuses on clinical tasks, computer use is secondary |
| **Primary Screens** | Assistant Dashboard, Today's Schedule, Patient Clinical Record (read/limited write) |
| **Secondary Screens** | Treatment Plan View |
| **Permissions** | ⚠️ **BACKEND GAP:** The backend currently does not grant DENTAL_ASSISTANT explicit access to patient records in either `_PATIENT_RECORD_READ_ROLES` or `_PATIENT_RECORD_WRITE_ROLES` (see `patient_records/dependencies/permissions.py`). The frontend should either: (1) Hide patient record functionality for dental assistants, or (2) Coordinate with the backend team to add DENTAL_ASSISTANT to the appropriate permission lists. Currently limited to appointment view, doctor schedule view, and treatment plan view (read-only). | |
| **Navigation Needs** | Today's appointments for assigned doctor(s), quick patient context |
| **Frequency of Use** | Daily, 8 hours |
| **Current Problems** | No visibility into treatment plans before patient arrives, paper-based preparation notes |
| **Expected Experience** | Clear view of planned procedures per appointment, easy patient context access, minimal documentation burden |

### Future Roles (Placeholders)

| Role | Description | When |
|------|-------------|------|
| **Accountant** | Manages billing, invoicing, financial reports | Phase 2 |
| **Inventory Manager** | Tracks supplies, equipment, reorder alerts | Phase 2 |
| **Laboratory Technician** | Manages lab cases, digital impressions, prosthetics | Phase 2 |
| **Cashier** | Handles payments, prints receipts, manages daily collections | Phase 2 |
| **Clinic Owner** | High-level business analytics, multi-branch overview | Phase 3 |
| **Patient Portal User** | Self-service appointment booking, record viewing, online payments | Phase 3 |

---

## 7. User Journeys

### 7.1 Receptionist: New Patient Registration + Appointment Booking

**Role:** Receptionist (Maya)  
**Frequency:** 10-20 times per day  
**Time Target:** Under 2 minutes total

```
Step 1: Login
  → Navigate to Reception Dashboard (default landing page)
  → Dashboard shows: today's appointments, quick actions (Register Patient, Find Patient)
  → [HAPPY PATH] Dashboard loads in <1 second

Step 2: Patient Search (prevent duplicate)
  → Type patient name in global search bar
  → System shows instant results as user types (debounced 300ms)
  → [HAPPY PATH] No existing patient found → proceed to registration
  → [ALTERNATE PATH] Duplicate found → warn user, show existing record
  → [EDGE CASE] Partial match → show similar names, prompt to create anyway

Step 3: Patient Registration
  → Click "Register New Patient"
  → Slide-out panel opens (not full page navigation — maintains context)
  → Auto-filled fields: patient code generated automatically
  → Required fields: First Name, Last Name, Date of Birth, Gender, Phone
  → Optional fields: Middle Name, Email, Address, Emergency Contact
  → Smart defaults: Date of Birth as date picker, Phone with country code mask
  → Validate phone format in real-time
  → [HAPPY PATH] All fields valid → Submit → 201 response → Patient record created
  → [FAILURE PATH] Validation error → Highlight field, show message, prevent submission
  → [EDGE CASE] Network error → Cache form data, show retry option

Step 4: Book Appointment
  → After patient created, system prompts: "Would you like to book an appointment?"
  → [HAPPY PATH] Click "Yes" → Appointment booking panel opens within patient context
  → Select: Doctor, Date, Time, Appointment Type, Duration
  → Doctor picker shows: available doctors for selected date/time
  → Time slot picker shows: available slots based on doctor's schedule
  → Conflict detection: real-time validation when selecting time
  → [HAPPY PATH] Slot available → Submit → 201 → Appointment created
  → [FAILURE PATH] Conflict → Show message "Dr. X is not available at this time. Suggested alternatives: [...]"
  → [ALTERNATE PATH] Patient wants future date → Calendar picker with quick navigation
  → [EDGE CASE] Doctor on leave → Doctor filtered out automatically

Step 5: Print/Share Appointment Slip
  → After booking, system shows confirmation with appointment details
  → Options: Print, Email, SMS (future)
  → [HAPPY PATH] Click Print → Browser print dialog
  → [ALTERNATE PATH] Click Email → Opens email draft
  → [EDGE CASE] Printer not available → System stores printable version

Step 6: Complete → Back to Dashboard
  → Return to reception dashboard
  → Today's appointment list now includes the new booking
```

### 7.2 General Doctor: Patient Treatment Workflow

**Role:** General Doctor (Dr. Patel)  
**Frequency:** 8-12 times per day  
**Time Target:** Under 10 minutes (entire consultation + documentation)

```
Step 1: Login → Doctor Dashboard
  → Dashboard shows: Today's Appointments (time-sorted), Pending Actions (treatment plan approvals, follow-ups due)
  → [HAPPY PATH] Dashboard loads with today's schedule
  → [EDGE CASE] No appointments → Message: "No appointments scheduled for today"
  → Quick stats: Total patients today, pending documentation count

Step 2: View Next Patient
  → Click on patient in today's schedule
  → Patient clinical workspace opens with patient banner at top
  → Banner shows: Patient Name, Code, Age, Gender, Allergies/Warnings
  → Workspace sections: Overview, Clinical Records, Treatment Plans, Prescriptions
  → Overview tab shows: Last visit summary, active treatment plans, upcoming appointments

Step 3: Review Patient History
  → Patient Overview loads with recent activity timeline
  → Timeline shows: Last 5 clinical encounters with dates, types, doctors
  → Quick view: Active diagnoses, current medications, ongoing treatment plans
  → [HAPPY PATH] Relevant history visible at a glance
  → [ALTERNATE PATH] Need more history → Expand full history with date range filter

Step 4: Create Clinical Record
  → Click "New Clinical Record"
  → Record creation form opens with:
    → Appointment auto-linked (from schedule context)
    → Clinical Notes (structured template)
    → Diagnosis section (pick from existing or create new)
    → Prescription section (if needed)
  → [HAPPY PATH] Fill structured notes, add diagnoses, save as DRAFT
  → [ALTERNATE PATH] Need to add prescription → Prescription form opens in same panel
  → [ALTERNATE PATH] Need to schedule follow-up → Follow-up form opens
  → [EDGE CASE] Patient requires attachment (X-ray, photo) → Attachment upload (metadata only for MVP)

Step 5: Create Treatment Plan (if needed)
  → From clinical record, click "Create Treatment Plan"
  → Treatment Plan Wizard opens:
    → Step 1: Plan details (doctor assignment, clinical notes)
    → Step 2: Add procedures from catalog (search by name/category)
    → Step 3: Specify tooth numbers (FDI), surfaces, quadrants via tooth chart
    → Step 4: Review costs, apply discounts
    → Step 5: Submit for review (or save as DRAFT)
  → [HAPPY PATH] Create plan with items, submit for review
  → [ALTERNATE PATH] Save as DRAFT, complete later
  → [FAILURE PATH] Validation error (missing required field) → Highlight, prevent submission

Step 6: Finalize Consultation
  → Mark appointment as COMPLETED
  → Clinical record status remains as is (DRAFT / IN_PROGRESS) — finalization is a deliberate action, not automatic.
  → Doctor can finalize the record via explicit status transition (PATCH /records/{id}/status → FINALIZED)
  → ⚠️ FINALIZED is a terminal, immutable state — once finalized, records cannot be edited or deleted
  → System prompts: "Would you like to finalize this record?" and "Schedule follow-up appointment?"
  → [HAPPY PATH] Doctor defers finalization → Record stays IN_PROGRESS, can be completed later
  → [ALTERNATE PATH] Doctor finalizes → Record becomes immutable, shows confirmation toast
  → [ALTERNATE PATH] Follow-up needed → Quick appointment booking within workspace
  → [FAILURE PATH] Attempting to edit a FINALIZED record → All edit controls are disabled; error toast shown

Step 7: Next Patient → Start from Step 2
```

### 7.3 Administrator: User Approval + Doctor Setup

**Role:** Administrator (Alex)  
**Frequency:** 2-5 times per week  
**Time Target:** Under 3 minutes per approval

```
Step 1: Login → Admin Dashboard
  → Dashboard shows:
    → Pending user approvals (count + list)
    → System health indicators
    → Recent activity summary
    → Quick access to: User Management, Doctor Management, Audit Log

Step 2: Approve Pending Users
  → Click on "Pending Approvals" widget
  → User approval list loads with: Name, Email, Registration Date, Role selection dropdown
  → Each row: [Approve] [Reject] buttons
  → [HAPPY PATH] Select role from dropdown → Click Approve → User activated
  → [ALTERNATE PATH] Click user row → View full registration details before approving
  → [FAILURE PATH] Attempting to approve with no role selected → Validation error
  → [EDGE CASE] Suspicious registration → Reject with optional reason

Step 3: Create Doctor Profile (after user approval)
  → From approved user, system prompts: "Create doctor profile?"
  → Click "Create Doctor Profile"
  → Doctor creation form pre-filled with user data
  → Required: Primary Phone, Qualifications, Registration Number, Consultation Fee
  → Optional: Date of Birth, Gender, Address, Emergency Contact, Biography, Languages
  → [HAPPY PATH] Fill required fields → Submit → Doctor profile created
  → [FAILURE PATH] User not a DOCTOR role → Error message

Step 4: Configure Doctor Specializations
  → On doctor profile, click "Add Specialization"
  → Specialization picker shows available specializations (master list)
  → Select primary specialization (required) and secondary (optional)
  → [HAPPY PATH] Select primary → Click Save → Specialization assigned
  → [FAILURE PATH] Try to add same specialization twice → Duplicate error
  → [EDGE CASE] Doctor has no specializations available → Must add to master list first

Step 5: Set Doctor Schedule
  → On doctor profile, click "Schedule" tab
  → Weekly grid view: Monday-Saturday, time slots
  → Click on day → Add time slot (start_time, end_time)
  → [HAPPY PATH] Add morning + evening slots for each working day
  → [FAILURE PATH] Overlapping slots → Conflict detected, prevented
  → [ALTERNATE PATH] Bulk set schedule → Copy from template or another doctor

Step 6: Doctor Ready for Booking
  → Doctor now visible in appointment booking interface
  → Doctor availability based on schedule template
```

### 7.4 Chief Doctor: Treatment Plan Approval

**Role:** Chief Doctor (Dr. Chen)  
**Frequency:** 5-10 times per day  
**Time Target:** Under 2 minutes per plan review

```
Step 1: Login → Chief Dashboard
  → Dashboard shows pending review queue prominently
  → Number of plans pending review (badge/count)
  → Each pending plan: Patient name, Plan code, Doctor name, Created date, Total cost

Step 2: Review Treatment Plan
  → Click on pending plan → Plan detail view
  → Shows: Plan summary, itemized procedures with costs, tooth chart, clinical notes
  → Side panel: Doctor's clinical notes, observations, recommendations
  → Action buttons: [Approve Review] [Reject Review] [Return to Draft]
  → [HAPPY PATH] Review items, check clinical accuracy → Click "Approve Review"
  → [ALTERNATE PATH] Plan needs revision → Click "Return to Draft" with notes
  → [ALTERNATE PATH] Plan should not proceed → Click "Reject" with reason
  → [FAILURE PATH] Try to approve plan with no items → Prevented

Step 3: Provide Feedback (if returning/rejecting)
  → If returning/rejecting, mandatory reason field appears
  → Select from common reasons: "Incomplete items", "Cost needs adjustment", "Missing clinical justification"
  → Or type custom reason
  → [HAPPY PATH] Select reason → Submit → Plan returned or rejected
  → [EDGE CASE] Plan already reviewed → Prevent double review

Step 4: Dashboard Updated
  → Plan moves from "Pending Review" to appropriate status
  → Dashboard count updates
```

### 7.5 Administrator: Audit Trail Review

**Role:** Administrator (Alex)  
**Frequency:** Weekly or as needed  
**Time Target:** Flexible

```
Step 1: Navigate to Audit Log
  → From Admin Dashboard, click "Audit Log"
  → Audit log view loads: Filterable, searchable, paginated log of all system mutations

Step 2: Filter and Search
  → Filters: Date range, Module (User, Patient, Appointment, Doctor, Record, Treatment Plan)
  → Entity ID filter: Search by specific record ID
  → Action type filter: Create, Update, Delete, Status Change
  → User filter: Actions performed by specific user
  → [HAPPY PATH] Set date range + module → Results load quickly
  → [ALTERNATE PATH] Search for specific patient code → All actions on that patient

Step 3: View Audit Entry
  → Click on any audit entry → Expand to show:
    → Timestamp (human-readable)
    → User who performed action (name + role)
    → Entity affected (type + ID)
    → Previous value (for updates)
    → New value (for updates)
    → Action type
  → [HAPPY PATH] All information clear and readable
  → [ALTERNATE PATH] Export audit log for compliance reporting (future)

Step 4: Investigate if Needed
  → If auditing specific incident, follow chain of related entries
  → Each entry links to the affected entity for context
  → [EDGE CASE] Export needed for legal/compliance → Print or export to CSV (future)
```

---

## 8. Information Architecture

### 8.1 Site Map

```
DensCare
├── Authentication
│   ├── Login
│   ├── Register
│   └── Password Reset (future)
│
├── Dashboard (role-specific)
│   ├── Admin Dashboard
│   ├── Chief Doctor Dashboard
│   ├── General Doctor Dashboard
│   ├── Specialist Doctor Dashboard
│   ├── Consulting Doctor Dashboard
│   ├── Reception Dashboard
│   └── Dental Assistant Dashboard
│
├── Patients
│   ├── Patient List (searchable, filterable)
│   └── Patient Profile
│       ├── Overview
│       ├── Appointments
│       ├── Clinical Records
│       │   ├── Diagnoses
│       │   ├── Prescriptions
│       │   ├── Attachments
│       │   └── Follow-ups
│       ├── Treatment Plans
│       │   ├── Plan Detail
│       │   │   ├── Items
│       │   │   ├── Versions
│       │   │   └── Approval
│       │   └── Plan Wizard
│       ├── Audit Log
│       └── Patient Info (demographics)
│
├── Appointments
│   ├── Calendar (Day/Week/Month views)
│   ├── Appointment List
│   ├── Appointment Detail
│   └── Quick Book
│
├── Doctors
│   ├── Doctor List
│   └── Doctor Profile
│       ├── Profile Details
│       ├── Specializations
│       ├── Schedule
│       └── Treatment Plans (list)
│
├── Specializations (admin)
│   └── Specialization List
│
├── Procedures Catalog (admin)
│   ├── Procedure List
│   └── Procedure Create/Edit
│
├── Users (admin)
│   ├── User List
│   └── User Detail
│
├── Reports (future)
│   ├── Clinical Reports
│   ├── Operational Reports
│   ├── Financial Reports
│   └── Custom Reports
│
├── Settings (future)
│   ├── Clinic Profile
│   ├── Working Hours
│   ├── Notification Templates
│   └── System Configuration
│
├── Audit Log (admin, chief doctor)
│   └── Audit Log Viewer
│
└── Profile
    └── My Profile
```

### 8.2 Module Hierarchy

```
Level 0: Application Shell (persistent)
├── Global Navigation (sidebar)
├── Top Bar (search, notifications, profile)
└── Workspace (content area)

Level 1: Primary Modules (from sidebar)
├── Dashboard
├── Patients
├── Appointments
├── Doctors
├── Users (admin only)
├── Procedures Catalog (admin only)
├── Reports (future)
├── Settings (future)
└── Audit Log (admin only)

Level 2: Sub-modules (within patient context)
├── Patient Info
├── Clinical Records
├── Treatment Plans
└── Appointments

Level 3: Detail Views (within sub-modules)
├── Clinical Record Detail
├── Treatment Plan Detail
├── Prescription Detail
└── Appointment Detail
```

### 8.3 Navigation Depth

| View | Depth | Breadcrumbs |
|------|-------|-------------|
| Dashboard | 0 | Dashboard |
| Patient List | 1 | Patients |
| Patient Profile | 2 | Patients > {Patient Name} |
| Clinical Record | 3 | Patients > {Patient Name} > Clinical Records > {Record Date} |
| Treatment Plan | 3 | Patients > {Patient Name} > Treatment Plans > {Plan Code} |
| Appointment Calendar | 1 | Appointments |
| Appointment Detail | 2 | Appointments > {Appointment Time} |
| Doctor Profile | 2 | Doctors > {Doctor Name} |
| User Management | 1 | Users |
| Audit Log | 1 | Audit Log (Admin / Chief Doctor) |

**Design decision:** Depth should never exceed 3 levels without a breadcrumb. All Level 2+ views should have breadcrumbs.

### 8.4 Cross-Module Navigation Patterns

| From | To | Trigger | Pattern |
|------|----|---------|---------|
| Appointment Calendar | Patient Profile | Click patient name | Opens patient in same tab, preserves appointment context in browser history |
| Patient Profile | New Appointment | Click "Book Appointment" | Opens appointment form with patient pre-selected |
| Clinical Record | Treatment Plan | Click "Create Treatment Plan" | Opens plan wizard with diagnoses pre-populated |
| Treatment Plan | Appointment | Click "Schedule Procedure" | Opens appointment form with procedure pre-selected |
| Doctor Profile | Doctor's Schedule | Click "Schedule" tab | Tab within doctor profile |
| User List | Doctor Profile | Click "Create Doctor Profile" | Transitions from user management to doctor creation |

### 8.5 Search Strategy

#### Global Search

A persistent global search bar in the top bar area (similar to Atlassian, Linear, Notion patterns).

**Search scope:** Patients (by name, code, phone), Patient Records (by most recent), Appointments (by number), Treatment Plans (by code), Users (admin only), Doctors (by name, code)

**Search behavior:**
- **Instant results:** Show results as user types (debounced 300ms)
- **Categorized results:** Group by entity type with icons
- **Keyboard navigation:** Arrow keys + Enter to select
- **Recent searches:** Show last 5 searches
- **Keyboard shortcut:** `Cmd/Ctrl + K` to focus search bar

**Result prioritization:**
1. Patients (by name, code, phone)
2. Treatment Plans (by code)
3. Appointments (by number)
4. Doctors (by name, code)

### 8.6 Quick Actions

Quick actions are available from the sidebar or top bar for common tasks:

| Action | Roles | Shortcut |
|--------|-------|----------|
| Register New Patient | Reception, Admin | `Cmd/Ctrl + Shift + P` |
| Book Appointment | Reception, Admin | `Cmd/Ctrl + Shift + A` |
| Create Treatment Plan | All Doctors | `Cmd/Ctrl + Shift + T` |
| New Clinical Record | All Doctors | `Cmd/Ctrl + Shift + R` |
| Global Search | All | `Cmd/Ctrl + K` |

---

## 9. Navigation Architecture

### 9.1 Navigation System Overview

The DensCare navigation system follows a **sidebar + top bar** layout, which is the dominant pattern in enterprise SaaS applications. This layout provides persistent context while allowing deep navigation into modules.

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────┐  Top Bar                                              │
│  │ Logo │  [Global Search (Cmd+K)]  [Notifications] [Profile]   │
│  └──────┘                                                        │
│  ┌──────────┐  ┌─────────────────────────────────────────────┐  │
│  │ Sidebar  │  │  Workspace (content area)                    │  │
│  │          │  │                                              │  │
│  │ Dashboard│  │  Breadcrumb > Current > Location             │  │
│  │ Patients │  │                                              │  │
│  │ Appt'ments│  │  ┌─────────────────────────────────────┐   │  │
│  │ Doctors  │  │  │  Main Content                        │   │  │
│  │ ──────── │  │  │                                       │   │  │
│  │ Admin ▼  │  │  │                                       │   │  │
│  │  Users   │  │  │                                       │   │  │
│  │  Procs   │  │  └─────────────────────────────────────┘   │  │
│  │  Audit   │  │                                              │  │
│  │ ──────── │  │                                              │  │
│  │ Reports  │  │                                              │  │
│  │ Settings │  │                                              │  │
│  └──────────┘  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Sidebar

**Design principles:**
- **Collapsible:** Sidebar can be collapsed to icon-only mode for more workspace space
- **Role-filtered:** Menu items are shown/hidden based on user role
- **Active state:** Current module is visually highlighted
- **Section headers:** Logically grouped sections with subtle dividers
- **Badges:** Unread count or pending actions shown as badges on icons

**Sidebar sections (role-dependent):**

| Section | Items | Visible To |
|---------|-------|------------|
| Main | Dashboard | All |
| Clinical | Patients, Appointments, Doctors | All |
| Administrative | Users, Procedures, Audit Log | Admin only |
| Future | Reports, Settings, Billing | All (locked with "Coming Soon" badge) |

**Collapsed state:** When collapsed to icon-only mode, tooltips show the item name on hover.

### 9.3 Top Bar

The top bar is persistent across all views and contains:

| Element | Description |
|---------|-------------|
| **Logo/Brand** | DensCare logo, links to dashboard |
| **Global Search** | `Cmd/Ctrl + K` to focus, instant results |
| **Context Switcher** | Current patient name (when in patient context), with quick switch dropdown |
| **Notifications** | Bell icon with badge count, notification dropdown |
| **Profile Menu** | User avatar/initials, dropdown: My Profile, Settings, Logout |

### 9.4 Patient Context Header

When viewing a patient record, a persistent patient header appears below the top bar:

```
┌─────────────────────────────────────────────────────────────────┐
│ [← Back to Patients]  Patient Code: PAT-000001                 │
│ Juan Dela Cruz  |  34 yrs  |  Male  |  📞 +639123456789       │
│ Status: ● Active  |  Last Visit: 2026-07-15                    │
│ [Overview] [Records] [Treatment Plans] [Appointments] [Audit]  │
└─────────────────────────────────────────────────────────────────┘
```

This header:
- **Persists** across all patient sub-sections
- **Shows key identifying information** at all times
- **Provides tab navigation** for patient sub-sections
- **Shows status badge** (Active/Inactive)

### 9.5 Breadcrumbs

Breadcrumbs appear below the top bar (or patient header when in patient context):

```
Patients > Juan Dela Cruz > Treatment Plans > TXN-000001
```

Breadcrumbs help users understand their current location and provide quick navigation back to parent levels.

### 9.6 Navigation Rules

| Rule | Rationale |
|------|-----------|
| Sidebar items are role-filtered at render time | Prevents unauthorized navigation options from appearing |
| Patient context header stays visible across all patient sub-sections | Prevents disorientation when switching between patient data views |
| Breadcrumbs appear at depth 2+ | Users should always know where they are |
| Global search is accessible from any screen | Patient lookup is the most frequent action across all roles |
| Quick actions use keyboard shortcuts | Power users (receptionists) need muscle-memory efficiency |
| Navigation preserves scroll position when returning | Users should not lose their place when navigating back |

---

## 10. UX Principles

### 10.1 Design Philosophy

DensCare's UX philosophy is rooted in three pillars: **Safety, Speed, and Clarity.**

**Safety first:** Every interface decision must consider the clinical context. A misclick can lead to incorrect patient data, missed diagnoses, or treatment errors. We design to prevent errors before they happen.

**Speed always:** Dental professionals work under time pressure. Every interaction should feel instantaneous. If it takes more than 2 seconds, show a loading state. If it takes more than 5 seconds, show a progress indicator.

**Clarity above all:** Users should never wonder "what does this mean?" or "what do I do next?" Every screen has a clear primary action, and every piece of data has clear labeling.

### 10.2 Consistency

The system must feel like a single, cohesive application — not a collection of pages.

| Consistency Dimension | Standard |
|----------------------|----------|
| **Visual language** | Single design system, shared components, consistent spacing |
| **Interaction patterns** | Same action same way everywhere — e.g., all "create" flows use slide-out panels |
| **Information density** | Consistent density across all data tables and detail views |
| **Error handling** | Uniform error display: inline for form fields, toast for system errors, alert banners for page-level errors |
| **Loading states** | Uniform skeleton loading for all list views, spinner for actions |
| **Empty states** | All empty states have illustration + message + action button |
| **Date/time format** | Consistent format: "Jul 16, 2026" for dates, "10:30 AM" for times |

### 10.3 Minimal Clicks

Every task should be achievable with the minimum number of clicks possible.

| Task | Current Click Count (estimate) | Target |
|------|-------------------------------|--------|
| Register new patient | 8+ | ≤5 |
| Book appointment | 10+ | ≤6 |
| Create clinical note | 15+ | ≤8 |
| Create treatment plan | 20+ | ≤12 |
| Approve treatment plan | 5+ | ≤3 |
| Search for patient | 3+ | ≤2 |

### 10.4 Progressive Disclosure

Clinical interfaces inherently deal with large amounts of data. Progressive disclosure ensures users see only what they need, when they need it.

**Patterns:**
- **Summarize then expand:** List views show key columns; clicking reveals detail
- **Tabs for related data:** Clinical records, treatment plans, and appointments are tabs within the patient context
- **Expandable sections:** Long forms are grouped into expandable/collapsible sections
- **Show on demand:** Audit trail is available but hidden by default, shown when requested
- **Hover to preview:** Hovering over a patient name shows a quick preview card

### 10.5 Error Prevention

Clinical data errors can have serious consequences. We design to prevent errors at every layer.

| Prevention Technique | Application |
|---------------------|-------------|
| **Confirmation dialogs** | Before destructive actions (deactivate patient, cancel appointment, finalize record) |
| **Inline validation** | Form fields validate on blur, show error messages before submission |
| **Required field indicators** | Clear visual indication of required vs. optional fields |
| **Duplicate detection** | Patient registration checks for duplicates before creating |
| **Conflict detection** | Appointment booking checks for schedule conflicts in real-time |
| **Undo support** | Soft deletes allow reversal; status changes show confirmation |
| **Mass assignment protection** | All API requests use `extra="forbid"` — no unexpected fields |
| **Read-only after finalization** | Finalized records show no edit controls |

### 10.6 Accessibility (WCAG 2.1 Level AA)

| Requirement | Implementation |
|-------------|----------------|
| **Color contrast** | Minimum 4.5:1 ratio for text, 3:1 for large text and UI components |
| **Keyboard navigation** | All actions accessible via keyboard, visible focus indicators |
| **Screen reader support** | ARIA labels, semantic HTML, proper heading hierarchy |
| **Error identification** | Errors described in text, not just color |
| **Focus management** | Focus moves predictably, skip links for navigation |
| **Zoom support** | Layout works up to 200% zoom without horizontal scroll |
| **Color independence** | Status indicators use icons + text, not just color |
| **Motion reduction** | `prefers-reduced-motion` respected for all animations |

### 10.7 Clinical Safety

| Principle | Implementation |
|-----------|----------------|
| **Patient identification** | Patient name + code + date of birth shown on all clinical screens |
| **Data integrity** | Read-only states for finalized/immutable records |
| **Audit transparency** | Every data point has a "view audit trail" option |
| **Warn before override** | Modifying finalized data (if permitted) requires explicit confirmation |
| **Role-appropriate views** | Clinical staff see clinical data; admin staff see administrative data |
| **Session timeout** | Automatic logout after inactivity with 2-minute warning |

### 10.8 Keyboard Navigation

Power users (especially receptionists and doctors who type notes) benefit from keyboard shortcuts.

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd/Ctrl + K` | Global search | Global |
| `G then D` | Go to Dashboard | Global |
| `G then P` | Go to Patients list | Global |
| `G then A` | Go to Appointments | Global |
| `Cmd/Ctrl + Shift + P` | New Patient | Global |
| `Cmd/Ctrl + Shift + A` | New Appointment | Global |
| `Cmd/Ctrl + Shift + R` | New Clinical Record | Patient context |
| `Cmd/Ctrl + Shift + T` | New Treatment Plan | Patient context |
| `Escape` | Close modal/drawer/panel | Contextual |
| `?` | Show keyboard shortcuts help | Global |

### 10.9 Feedback and States

Every user action must produce immediate feedback.

| Action | Feedback |
|--------|----------|
| Form submission | Button shows loading spinner, becomes disabled |
| Successful save | Brief toast notification ("Patient created"), auto-dismisses |
| Error | Inline error for field errors, toast for system errors |
| Async operation | Skeleton loading for lists, spinner for actions |
| Long operation (>3s) | Progress bar with estimated time remaining |
| Empty state | Illustration + message + suggested next action |
| Network offline | Banner at top: "You're offline. Showing cached data." |

### 10.10 Responsive Design Principles

While DensCare is primarily a desktop application (used in clinic computers), responsive design is essential for:
- Tablet use during chairside consultations
- Doctor's personal devices for after-hours review
- Future mobile access

| Breakpoint | Target | Layout Changes |
|------------|--------|----------------|
| ≥1280px | Desktop (primary) | Full sidebar, multi-column layouts |
| 1024-1279px | Small desktop | Sidebar collapses to icons |
| 768-1023px | Tablet | Sidebar hidden (hamburger menu), stacked layouts |
| <768px | Mobile | Single column, full-width forms, bottom navigation |

---

## 11. Design Philosophy

### 11.1 Visual Character

DensCare's visual design must communicate: **Professional, Premium, Medical, Minimal.**

| Attribute | Expression |
|-----------|------------|
| **Professional** | Clean lines, generous whitespace, consistent spacing, no gimmicks |
| **Premium** | Subtle shadows, refined typography, deliberate use of accent colors |
| **Medical** | Clean, sterile feel without being cold. Blue-based palette (trust, calm) |
| **Minimal** | Content-forward design. Every element earns its place. Nothing decorative without purpose |

### 11.2 Design Tone

| Dimension | Positioning |
|-----------|-------------|
| **Seriousness** | High — this is medical software, not a consumer app |
| **Complexity** | Moderate — simplify without dumbing down |
| **Personality** | Subtle — professional with slight warmth |
| **Visual hierarchy** | Strong — clear what's important and what's secondary |

### 11.3 What DensCare Should NOT Feel Like

| Reject | Reason |
|--------|--------|
| Cartoonish illustrations | Undermines clinical trust |
| Playful colors | Unprofessional for medical setting |
| Gaming-inspired UI | Distracting, inappropriate for clinical context |
| Overly colorful | Increases cognitive load, can hide important alerts |
| Dense, text-heavy | Hard to scan, increases error rate |
| Skeleton-only (no content) | Feels empty, reduces confidence |

### 11.4 Inspiration References

| Reference | What to Learn | What to Avoid |
|-----------|---------------|---------------|
| **Linear** | Clean UI, minimal chrome, fast interactions | Too simple for clinical complexity |
| **Notion** | Flexible blocks, good typography | Too unstructured for medical data |
| **Superhuman** | Keyboard-first design, muscle memory | Too opinionated for varied roles |
| **Stripe** | Premium feel, clear data presentation | Not designed for clinical workflows |
| **Atlassian** | Enterprise patterns, navigation, tables | Too dense, too many features |
| **Epic** | Clinical safety patterns, patient header | Too complex, dated UI |

---

## 12. Design System Philosophy

### 12.1 Component Philosophy

| Principle | Description |
|-----------|-------------|
| **Composable** | Components are building blocks that can be combined flexibly |
| **Role-aware** | Components adapt behavior based on user role and permissions |
| **Stateful** | Every component handles loading, empty, error, and success states |
| **Accessible** | Keyboard navigable, screen-reader friendly, high contrast |
| **Testable** | Components accept props and render predictably |
| **Themeable** | Design tokens drive appearance; no hardcoded colors/spacing |

### 12.2 Spacing Philosophy

Use a **4px base unit** with a scale:
- 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

**Spacing rules:**
- Content padding: 24px (workspace), 16px (cards)
- Component spacing: 16px (vertical), 12px (horizontal)
- Form field spacing: 20px vertical between fields
- Table cell padding: 12px horizontal, 10px vertical
- Section spacing: 32px between major sections

### 12.3 Typography Philosophy

**Primary typeface:** Inter (open-source, excellent legibility at all sizes)

**Scale:**
- Headings: 24px / 20px / 18px / 16px
- Body: 14px (standard), 13px (data-dense), 12px (metadata)
- Labels: 13px
- Small: 12px

**Weight:** 400 (regular), 500 (medium), 600 (semibold)

**Line height:** 1.5 (body), 1.3 (headings), 1.2 (labels)

**Color hierarchy:**
- Primary text: nearly black (#1a1a2e or similar)
- Secondary text: dark gray
- Placeholder text: medium gray
- Disabled text: light gray

### 12.4 Elevation Philosophy

Use shadows purposefully — to indicate depth and hierarchy, not decoration.

| Level | Use Case | Shadow |
|-------|----------|--------|
| 0 | Flat surfaces (cards, panels) | No shadow |
| 1 | Interactive elements (buttons, inputs) on hover | Subtle (2px blur) |
| 2 | Dropdowns, popovers, tooltips | Moderate (8px blur) |
| 3 | Modals, dialogs | Pronounced (16px blur) |
| 4 | Notifications, toasts | Highest (24px blur) |

### 12.5 Color Philosophy (Placeholder)

**Primary palette:** Blue-based (trust, medical, calm)
- Primary blue: Used for primary actions, links, active states
- Primary dark: Used for hover states, active tabs

**Neutral palette:** Cool grays for text, backgrounds, borders
- Background: Off-white (#f8f9fa body, #ffffff cards)
- Text: Near-black
- Borders: Light gray

**Semantic colors:**
- Success: Green (but subdued, not bright)
- Warning: Amber
- Error: Red
- Info: Blue

**Status colors (for badges):**
- Active: Green
- Inactive: Gray
- Pending: Amber
- Draft: Gray
- Completed: Blue
- Cancelled: Red

**Note:** Exact hex values will be determined during the design phase (Part 2).

### 12.6 Interaction Philosophy

| Interaction | Behavior |
|-------------|----------|
| **Hover** | Subtle background change or elevation increase |
| **Click** | Brief scale or color feedback (under 100ms) |
| **Focus** | Visible ring (2px) with offset |
| **Drag** | Cursor change, opacity shift |
| **Transition** | Smooth, 150-200ms, ease-in-out |
| **Page transition** | Fade or slide, 200ms |

### 12.7 Animation Philosophy

| Principle | Application |
|-----------|-------------|
| **Purposeful** | Every animation communicates something — state change, hierarchy, direction |
| **Subtle** | Animations are felt, not noticed. Under 300ms |
| **Performant** | Use `transform` and `opacity` only. GPU-accelerated |
| **Reduced motion** | `prefers-reduced-motion` disables all non-essential animations |
| **Consistent** | Same easing curve everywhere (`ease-in-out`) |

---

## 13. Application Structure

### 13.1 Application Shell

The application shell is the persistent container that wraps all content.

```
┌──────────────────────────────────────────────────────────────────┐
│  Top Bar                                                         │
│  ┌────┐ ┌────────────────────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │Logo│ │ Global Search      │ │Notifs│ │Help  │ │Profile ▼  │  │
│  └────┘ └────────────────────┘ └──────┘ └──────┘ └───────────┘  │
├──────────┬─────────────────────────────────────────────────────┤ │
│ Sidebar  │  Breadcrumb Bar (conditional)                       │  │
│          │                                                      │  │
│ 📊 Dash  │  Patient Context Header (conditional)               │  │
│ 👥 Pats  │  ┌────────────────────────────────────────────┐     │  │
│ 📅 Appts │  │  Main Workspace                             │     │  │
│ 🩺 Docs  │  │                                             │     │  │
│          │  │  (Content changes based on navigation)      │     │  │
│ ──────── │  │                                             │     │  │
│ ⚙️ Admin  │  │                                             │     │  │
│  Users   │  │                                             │     │  │
│  Procs   │  │                                             │     │  │
│  Audit   │  └────────────────────────────────────────────┘     │  │
│ ──────── │                                                      │  │
│ 📈 Rpts  │                                                      │  │
└──────────┴──────────────────────────────────────────────────────┘
```

### 13.2 Shell Components

#### Sidebar Components

| Component | Description |
|-----------|-------------|
| **Logo** | Application logo/brand, links to dashboard |
| **Nav Item** | Icon + label, active state, badge support |
| **Nav Section** | Group heading for related navigation items |
| **Collapse Toggle** | Button to collapse/expand sidebar |
| **User Avatar (bottom)** | Small user avatar with logout option |

#### Top Bar Components

| Component | Description |
|-----------|-------------|
| **Logo (mobile)** | Logo visible when sidebar is collapsed on mobile |
| **Global Search** | Search input with `Cmd/Ctrl+K` shortcut, instant results dropdown |
| **Notification Bell** | Icon with badge count, click to open notification panel |
| **Help Button** | Quick help, keyboard shortcuts reference, documentation links |
| **Profile Menu** | User avatar/initials, dropdown: Profile, Settings, Logout |

#### Patient Context Header Components

| Component | Description |
|-----------|-------------|
| **Back Button** | Returns to patient list |
| **Patient Identity** | Name, code, age, gender, contact |
| **Status Badge** | Active/inactive status |
| **Quick Actions** | New record, new treatment plan, book appointment |
| **Section Tabs** | Overview, Records, Treatment Plans, Appointments, Audit |

### 13.3 Global Features

#### Notifications

A notification center accessible from the top bar bell icon.

| Feature | Description |
|---------|-------------|
| **Types** | Appointment reminders, pending approvals, system alerts |
| **Priority** | Urgent (red), Important (amber), Informational (blue) |
| **Actions** | Click notification navigates to relevant context |
| **Mark as read** | Single click, mark all as read |
| **Empty state** | "No new notifications" with checkmark illustration |

#### Profile Menu

| Item | Action |
|------|--------|
| My Profile | View/edit personal information |
| Change Password | Password update form |
| App Settings | Theme, language, notification preferences |
| Keyboard Shortcuts | Reference card |
| Logout | Clear session, redirect to login |

### 13.4 Workspace Patterns

The main workspace uses the following content patterns:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **List + Detail** | Left panel list, right panel detail | Patients, Doctors, Appointments |
| **Single Column** | Full-width content, scrollable | Forms, detail views |
| **Split View** | Two equal panels | Clinical record with diagnosis list |
| **Calendar Grid** | Time-based grid | Appointment calendar |
| **Wizard** | Step-by-step flow | Treatment plan creation |
| **Dashboard Grid** | Card-based widgets | Role-specific dashboards |
| **Tabbed View** | Horizontal tabs with content panels | Patient profile sections |

---

## 14. Dashboard Strategy

### 14.1 Dashboard Philosophy

Dashboards in DensCare are **action centers**, not passive data displays. Each dashboard is designed for a specific role and prioritizes:

1. **What needs attention now** — Pending actions, alerts, today's schedule
2. **What's happening today** — Key metrics for the current day
3. **What's changing** — Trends and recent activity

**Rule:** If a dashboard widget doesn't lead to an action, it shouldn't be on the dashboard.

### 14.2 Role-Specific Dashboards

#### Reception Dashboard

**Purpose:** Manage front desk operations — patient check-in, appointment management

```
┌──────────────────────────────────────────────────────────────────┐
│ Good Morning, Maya!                    Today: Jul 18, 2026      │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌────────────────────────────────────┐ │
│ │ TODAY'S APPOINTMENTS │ │ QUICK ACTIONS                      │ │
│ │                      │ │ [Register Patient] [Book Appt]     │ │
│ │ 09:00  Juan Cruz    │ │ [Find Patient]   [Check In]        │ │
│ │ 09:30  Maria Santos │ └────────────────────────────────────┘ │
│ │ 10:00  [Available]  │                                         │
│ │ 10:30  Dr. Chen     │ ┌────────────────────────────────────┐ │
│ │ 11:00  Lisa Wang    │ │ RECENT PATIENTS                    │ │
│ │ 12:00  Break        │ │ Maria Santos - Just registered     │ │
│ │ ...                 │ │ Juan Cruz - Appointment booked     │ │
│ └──────────────────────┘ └────────────────────────────────────┘ │
│ ┌──────────────────────┐ ┌────────────────────────────────────┐ │
│ │ PENDING CHECK-INS    │ │ TODAY'S STATS                      │ │
│ │ ● Juan Cruz          │ │ Appointments: 24 │ Checked in: 8   │ │
│ │ ○ Maria Santos       │ │ New Patients: 3  │ No-shows: 0     │ │
│ └──────────────────────┘ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Doctor Dashboard

**Purpose:** Manage clinical day — see schedule, pending tasks, recent patients

```
┌──────────────────────────────────────────────────────────────────┐
│ Dr. Patel                              Today: Jul 18, 2026      │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌────────────────────────────────────┐ │
│ │ MY SCHEDULE          │ │ PENDING ACTIONS                    │ │
│ │                      │ │                                      │ │
│ │ 09:00  ● Juan Cruz   │ │ Treatment Plans: 3 pending review   │ │
│ │        Checkup       │ │ Clinical Records: 2 to finalize     │ │
│ │ 10:00  ● Lisa Wang   │ │ Follow-ups due: 1                   │ │
│ │        RCT Start     │ └────────────────────────────────────┘ │
│ │ 11:00  ○ [Open]      │                                         │
│ │ 12:00  Lunch         │ ┌────────────────────────────────────┐ │
│ │ 14:00  ○ [Open]      │ │ RECENT PATIENTS                    │ │
│ │ 15:00  ● Mark Tan    │ │                                      │ │
│ │        Extraction    │ │ Maria Santos - Jul 16 (RCT plan)    │ │
│ └──────────────────────┘ │ Juan Cruz - Jul 16 (Checkup done)  │ │
│                          │ Lisa Wang - Jul 15 (X-ray review)   │ │
│ ┌──────────────────────┐ └────────────────────────────────────┘ │
│ │ MY STATS             │                                         │
│ │ Today: 6 patients     │                                         │
│ │ This week: 24 pts    │                                         │
│ │ Pending docs: 4      │                                         │
│ └──────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────┘
```

#### Chief Doctor Dashboard

**Purpose:** Clinical oversight — review pending plans, monitor clinic activity

```
┌──────────────────────────────────────────────────────────────────┐
│ Dr. Chen                                Today: Jul 18, 2026     │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────────────────────────────┐ │
│ │ PENDING REVIEWS          │ │ CLINIC OVERVIEW                 │ │
│ │                          │ │                                  │ │
│ │ ⚠ TXN-000042 - Juan Cruz │ │ Doctors: 8 │ Pts today: 42     │ │
│ │   Dr. Patel · 3 items    │ │ Appts: 38  │ Checked in: 28    │ │
│ │ ⚠ TXN-000043 - Lisa Wang │ │ New pts: 5                      │ │
│ │   Dr. Kim · 5 items      │ └────────────────────────────────┘ │
│ │ ⚠ TXN-000044 - Mark Tan  │                                    │
│ │   Dr. Santos · 2 items   │ ┌────────────────────────────────┐ │
│ │                          │ │ SPECIALIZATION ROUTING          │ │
│ │ [View All →]             │ │ ● Dr. Kim → Ortho: 3 referrals │ │
│ └──────────────────────────┘ │ ● Dr. Lee → Endo: 2 referrals  │ │
│                              │ ● Dr. Ray → OS: 1 referral     │ │
│ ┌──────────────────────────┐ └────────────────────────────────┘ │
│ │ TODAY'S CLINIC SCHEDULE   │                                    │
│ │ Time │ Doctor │ Patient  │                                    │
│ │ 09:00│ Patel  │ Juan Cruz│                                    │
│ │ 09:00│ Kim    │ Lisa Wang│                                    │
│ │ 10:00│ Santos │ Mark Tan │                                    │
│ └──────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

#### Admin Dashboard

**Purpose:** System oversight — user management, approvals, system health

```
┌──────────────────────────────────────────────────────────────────┐
│ Admin Dashboard                           Today: Jul 18, 2026   │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────────────────────────────┐ │
│ │ PENDING APPROVALS        │ │ SYSTEM OVERVIEW                │ │
│ │                          │ │                                  │ │
│ │ ● 3 new user registrations│ │ Total Users: 45                │ │
│ │ ● 1 doctor profile pending│ │ Active Today: 32               │ │
│ │                          │ │ Pending Users: 3                │ │
│ │ [Review Now →]           │ │ Inactive Users: 5               │ │
│ └──────────────────────────┘ └────────────────────────────────┘ │
│                              ┌────────────────────────────────┐ │
│ ┌──────────────────────────┐ │ RECENT ACTIVITY                 │ │
│ │ USER MANAGEMENT          │ │ 09:15 - Dr. Patel created plan │ │
│ │                          │ │ 09:00 - Maya registered patient│ │
│ │ [Manage Users →]         │ │ 08:45 - Admin approved user    │ │
│ │ [Manage Doctors →]       │ │ 08:30 - System backup complete │ │
│ │ [Audit Log →]            │ └────────────────────────────────┘ │
│ └──────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

#### Dental Assistant Dashboard

**Purpose:** Support clinical day — room preparation, patient handoff

```
┌──────────────────────────────────────────────────────────────────┐
│ James - Assigned to: Dr. Patel           Today: Jul 18, 2026    │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌────────────────────────────────────┐ │
│ │ TODAY'S SCHEDULE     │ │ PATIENT PREPARATION                │ │
│ │ (Dr. Patel)          │ │                                      │ │
│ │                      │ │ ● Juan Cruz - 09:00                 │ │
│ │ 09:00  Juan Cruz     │ │   Planned: Checkup, X-rays         │ │
│ │        Checkup       │ │   Prep: Room 2, X-ray ready        │ │
│ │ 10:00  Lisa Wang     │ │                                      │ │
│ │        RCT Start     │ │ ● Lisa Wang - 10:00                 │ │
│ │ 15:00  Mark Tan      │ │   Planned: RCT (tooth 36)          │ │
│ │        Extraction    │ │   Prep: Room 3, Endo kit            │ │
│ └──────────────────────┘ └────────────────────────────────────┘ │
│                          ┌────────────────────────────────────┐ │
│ ┌──────────────────────┐ │ MY TASKS                            │ │
│ │ PREVIOUS PATIENT     │ │ ● Sterilize instruments (done)     │ │
│ │ Juan Cruz - Checkup  │ │ ● Restock Room 2 (pending)        │ │
│ │ Notes: X-rays taken,  │ │ ● Prepare endo kit (pending)      │ │
│ │ mild decay detected   │ └────────────────────────────────────┘ │
│ └──────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────┘
```

### 14.3 Widget Categories

| Category | Examples | Roles |
|----------|----------|-------|
| **Agenda** | Today's schedule, pending check-ins | All roles |
| **Action Items** | Pending approvals, pending documentation, due follow-ups | Clinical roles |
| **Quick Actions** | Register patient, book appointment, create record | All roles |
| **Statistics** | Today's counts, weekly trends | Admin, Chief Doctor |
| **Activity Feed** | Recent actions, system events | Admin |
| **Alerts** | Late patients, schedule conflicts, system warnings | All roles |
| **Favorites** | Frequently accessed patients, pinned items | All roles |

---

## 15. Component Inventory

### 15.1 Core UI Components

| Component | Description | States |
|-----------|-------------|--------|
| **Button** | Primary, secondary, ghost, danger, icon-only | Default, hover, active, disabled, loading |
| **Input** | Text, email, phone, number, password | Default, hover, focus, disabled, error, readonly |
| **Select** | Single select, searchable select | Default, open, disabled, error |
| **Multi-Select** | Tag-based multi-select | Default, open, selected, disabled |
| **Textarea** | Multi-line text input | Default, focus, error, disabled |
| **Date Picker** | Calendar date selector | Default, open, range, disabled |
| **Time Picker** | Time slot selector | Default, open, disabled |
| **Checkbox** | Single checkbox, checkbox group | Unchecked, checked, indeterminate, disabled |
| **Radio** | Radio button group | Unselected, selected, disabled |
| **Toggle** | On/off switch | On, off, disabled |
| **Search Input** | Search with debounce, clear button | Default, focused, has-results, no-results |
| **Badge** | Status indicator dot + text | Color variants: active, pending, completed, cancelled, draft |
| **Avatar** | User avatar with initials/photo | Default, with status indicator, sizes: sm/md/lg |
| **Chip** | Inline tag/label | Default, removable, disabled |
| **Tooltip** | Hover tooltip with text | Show, hide (200ms delay) |
| **Popover** | Click-triggered floating content | Open, close |
| **Modal** | Dialog overlay | Open, close, loading |
| **Drawer** | Slide-out panel | Open (from right), close |
| **Toast** | Brief notification | Info, success, warning, error; auto-dismiss |
| **Progress Bar** | Linear progress indicator | Determinate, indeterminate |
| **Skeleton** | Content placeholder | Loading state for lists, cards, text |
| **Empty State** | No data placeholder | Illustration + message + action |
| **Error State** | Error display | Message + retry button |
| **Permission State** | Insufficient permissions | Message + request access button |

### 15.2 Data Display Components

| Component | Description | Variants |
|-----------|-------------|----------|
| **Table** | Data table with sort, filter, pagination | Default, dense, striped, with selection |
| **Data Card** | Card displaying entity summary | Default, clickable, with actions |
| **Data Grid** | Multi-column card grid | 2-col, 3-col, 4-col |
| **Timeline** | Chronological event list | Default, compact |
| **Activity Feed** | User activity stream | Default, filterable |
| **Stat Card** | Metric display card | Default, trend indicator, clickable |
| **KPI Widget** | Dashboard metric widget | With chart sparkline, trend arrow |
| **Calendar** | Appointment calendar | Day, week, month views |
| **Tooth Chart** | FDI dental chart | Interactive (select teeth), readonly (display) |
| **Status Badge** | Colored status label | All status types across modules |
| **Progress Steps** | Step indicator for wizards | Horizontal, vertical |

### 15.3 Navigation Components

| Component | Description |
|-----------|-------------|
| **Sidebar** | Primary navigation rail with icons and labels |
| **Top Bar** | Global application bar |
| **Breadcrumb** | Location breadcrumb trail |
| **Tabs** | Horizontal tab navigation |
| **Pagination** | Page navigation for lists |
| **Patient Header** | Persistent patient context header |
| **Global Search** | Command palette search (`Cmd+K`) |
| **Quick Action Menu** | Shortcut action menu |

### 15.4 Form Components

| Component | Description |
|-----------|-------------|
| **Form Field** | Label + input + error wrapper |
| **Form Section** | Grouped form fields with heading |
| **Form Actions** | Submit/cancel button row |
| **File Upload** | Drag-and-drop file upload (future) |
| **Rich Text Editor** | Clinical notes editor (future) |

### 15.5 Layout Components

| Component | Description |
|-----------|-------------|
| **Page Header** | Page title + breadcrumb + actions |
| **Content Card** | White card container with padding |
| **Section Header** | Section title with optional action |
| **Split Panel** | Resizable left/right panels |
| **Slide-Out Panel** | Contextual side panel for secondary content |

---

## 16. Screen Inventory

### 16.1 Authentication Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Login | `/login` | Email + password login form | Public |
| Register | `/register` | New user registration form | Public |

### 16.2 Dashboard Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Admin Dashboard | `/dashboard` | System overview, pending approvals, activity | Admin |
| Chief Dashboard | `/dashboard` | Pending reviews, clinic overview, specialization routing | Chief Doctor |
| Doctor Dashboard | `/dashboard` | My schedule, pending actions, recent patients | General/Specialist/Consulting Doctor |
| Reception Dashboard | `/dashboard` | Today's appointments, quick actions, check-ins | Receptionist |
| Assistant Dashboard | `/dashboard` | Assigned doctor schedule, patient preparation | Dental Assistant |

### 16.3 Patient Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Patient List | `/patients` | Searchable, filterable patient table | All staff |
| Patient Profile | `/patients/:id` | Unified patient record with tabs | All staff |
| Patient Create | `/patients/new` | Patient registration form | Reception, Admin |
| Patient Edit* | `/patients/:id/edit` | Patient info edit | Reception, Admin |

*Patient Edit could be implemented as a slide-out panel from Patient Profile.

### 16.4 Clinical Record Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Record List | `/patients/:id/records` | Clinical records timeline | Clinical roles |
| Record Detail | `/patients/:id/records/:rid` | Full clinical record view | Clinical roles |
| Record Create | `/patients/:id/records/new` | New clinical record form | Clinical roles |
| Diagnosis List | `/patients/:id/records/:rid/diagnoses` | Diagnosis management | Clinical roles |
| Prescription Create | `/patients/:id/records/:rid/prescriptions/new` | New prescription form | Clinical roles |
| Prescription Detail | `/patients/:id/records/:rid/prescriptions/:pid` | Prescription view | Clinical roles |
| Follow-up Create | `/patients/:id/records/:rid/followups/new` | Follow-up scheduling | Clinical roles |

### 16.5 Treatment Plan Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Plan List | `/patients/:id/plans` | Patient's treatment plans | Clinical roles |
| Plan Detail | `/patients/:id/plans/:pid` | Full plan with items, versions, approval | Clinical roles |
| Plan Wizard | `/patients/:id/plans/new` | Step-by-step plan creation wizard | Clinical roles |
| Plan Review | `/plans/review` | Pending review queue | Chief Doctor |
| Plan Approval | `/plans/approval` | Pending approval queue | Clinical roles |
| Version History | `/patients/:id/plans/:pid/versions` | Plan version timeline | Clinical roles |

### 16.6 Appointment Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Calendar | `/appointments` | Multi-view appointment calendar | All staff |
| Appointment Detail | `/appointments/:id` | Appointment details | All staff |
| Quick Book | `/appointments/new` | Quick appointment booking | Reception, Admin |
| Today's List | `/appointments/today` | Today's appointment list | All staff |

### 16.7 Doctor Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| Doctor List | `/doctors` | Searchable doctor list | Admin, Reception |
| Doctor Profile | `/doctors/:id` | Full doctor profile with tabs | Admin, Clinical roles |
| Doctor Create | `/doctors/new` | Doctor profile creation | Admin |
| Doctor Schedule | `/doctors/:id/schedule` | Weekly schedule management | Admin |
| Doctor Specializations | `/doctors/:id/specializations` | Specialization assignment | Admin |

### 16.8 Administrative Screens

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| User List | `/admin/users` | User management table | Admin |
| User Detail | `/admin/users/:id` | User details and role management | Admin |
| Procedure List | `/admin/procedures` | Procedure catalog management | Admin |
| Procedure Create | `/admin/procedures/new` | New procedure form | Admin |
| Specialization List | `/admin/specializations` | Specialization management | Admin |
| Audit Log | `/admin/audit` | Audit trail viewer (filterable by module, action, user, date range) | Admin, Chief Doctor |

### 16.9 Profile Screen

| Screen | Route | Description | Roles |
|--------|-------|-------------|-------|
| My Profile | `/profile` | User profile, password change, notification preferences, keyboard shortcuts reference | All |

### 16.10 Appointment Type Reference

The backend defines 6 appointment types (`appointments/enums.py`):

| Type | Description | Color Code (Suggested) |
|------|-------------|----------------------|
| `CONSULTATION` | Initial consultation / examination | Blue |
| `FOLLOW_UP` | Follow-up visit after treatment | Green |
| `EMERGENCY` | Emergency / urgent care | Red |
| `PROCEDURE` | Scheduled procedure | Purple |
| `REVIEW` | Treatment plan / case review | Amber |
| `OTHER` | Other appointment types | Gray |

### 16.11 Appointment Status Lifecycle (7 States)

The backend defines 7 appointment statuses (`appointments/enums.py`) with the following workflow:

```
SCHEDULED ──► CONFIRMED ──► CHECKED_IN ──► IN_TREATMENT ──► COMPLETED
                              │                                    │
                              │                          CANCELLED ◄───┘
                              │                                    │
                              └──► CANCELLED                       
                                   NO_SHOW
```

**Transition endpoints:**
- `PATCH /appointments/{id}/cancel` — Cancels from any non-terminal state
- Appointment status can be updated via `PUT /appointments/{id}` status field
- The frontend should render status badges with appropriate colors for each of the 7 states

### 16.12 Patient Record Status Lifecycle (5 States)

The backend defines 5 record statuses (`patient_records/enums/record_status.py`) with the following workflow:

```
DRAFT ◄──► IN_PROGRESS ◄──► UNDER_REVIEW ──► COMPLETED ──► FINALIZED
```

**Rules:**
- `DRAFT` and `IN_PROGRESS` are editable — users can freely modify
- `UNDER_REVIEW` is read-only for most users, modifiable by reviewers
- `COMPLETED` is read-only — can be reopened to `IN_PROGRESS` by admin only
- `FINALIZED` is the terminal state — **completely immutable**, no edits or deletes allowed
- Status transitions are gated by `require_patient_record_status_change()` — restricted to `ADMIN` and `DOCTOR_ROLES`

---

## 17. API Mapping Strategy

### 17.1 API Mapping Methodology

Every frontend screen maps to one or more backend API endpoints. The following approach ensures complete coverage:

1. **Identify the screen's data requirements** — What entities and fields are needed?
2. **Map to backend endpoints** — Which endpoints provide this data?
3. **Identify composite views** — Screens that aggregate data from multiple endpoints
4. **Plan loading strategies** — Sequential vs. parallel data loading

### 17.2 Endpoint-to-Screen Mapping

#### Authentication

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Login | POST | `/auth/login` | Returns JWT token |
| Login | GET | `/auth/me` | Load current user profile after login |
| Register | POST | `/auth/register` | Creates pending user |

#### Patient Management

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Patient List | GET | `/patients?page=&page_size=&search=&is_active=` | Paginated, searchable |
| Patient Profile | GET | `/patients/{id}` | Single patient detail |
| Patient Profile | GET | `/patients/{id}/profile` | Rich profile with computed fields |
| Patient Create | POST | `/patients` | Create | 
| Patient Edit | PATCH | `/patients/{id}` | Partial update |
| Patient Activate | PATCH | `/patients/{id}/activate` | Toggle active |
| Patient Deactivate | PATCH | `/patients/{id}/deactivate` | Toggle inactive |

#### Appointment Management

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Appointment Calendar | GET | `/appointments?date=&dentist_id=&status=` | Filterable |
| Today's List | GET | `/appointments/today` | Today's appointments |
| Appointment Detail | GET | `/appointments/{id}` | Single appointment |
| Appointment Create | POST | `/appointments` | Create |
| Appointment Update | PUT | `/appointments/{id}` | Full update |
| Appointment Cancel | PATCH | `/appointments/{id}/cancel` | Cancel |

#### Doctor Management

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Doctor List | GET | `/doctors?search=&specialization=&available=` | Multi-filter |
| Doctor Profile | GET | `/doctors/{id}` | Single doctor |
| Doctor Profile | GET | `/doctors/{id}/profile` | Full profile |
| Doctor Profile | GET | `/doctors/user/{user_id}` | By user ID |
| Doctor Create | POST | `/doctors` | Create |
| Doctor Update | PATCH | `/doctors/{id}` | Partial update |
| Doctor Activate | PATCH | `/doctors/{id}/activate` | Toggle active |
| Doctor Deactivate | PATCH | `/doctors/{id}/deactivate` | Toggle inactive |
| Doctor Leave | PATCH | `/doctors/{id}/leave` | Toggle leave |
| Doctor Availability | PATCH | `/doctors/{id}/availability` | Toggle availability |
| Specializations List | GET | `/doctors/specializations` | | 
| Schedule List | GET | `/doctors/{id}/schedules` | Weekly schedule |
| Schedule Bulk Replace | PUT | `/doctors/{id}/schedules` | Bulk update |

#### Clinical Records (Patient Records)

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Record List | GET | `/records?patient_id=&page=&page_size=` | By patient |
| Record Detail | GET | `/records/{id}` | Full record |
| Record Create | POST | `/records` | Create |
| Record Status Update | PATCH | `/records/{id}/status` | State machine transition |
| Diagnoses | GET/POST | `/records/{id}/diagnoses` | CRUD |
| Prescriptions | GET/POST | `/records/{id}/prescriptions` | CRUD |
| Prescription Items | GET/POST | `/prescriptions/{id}/items` | CRUD |
| Attachments | GET/POST | `/records/{id}/attachments` | Metadata only |
| Follow-ups | GET/POST | `/records/{id}/followups` | CRUD |
| Audit Logs | GET | `/records/{id}/audit` | Immutable audit trail |

#### Treatment Plans

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Plan List | GET | `/treatment-plans?patient_id=&status=` | Filterable |
| Plan Detail | GET | `/treatment-plans/{id}` | Full aggregate |
| Plan Create | POST | `/treatment-plans` | Create with approval |
| Plan Search | GET | `/treatment-plans/search?term=` | Code search |
| Pending Reviews | GET | `/treatment-plans/pending-review` | Chief review queue |
| Pending Approval | GET | `/treatment-plans/pending-approval` | Approval queue |
| Dashboard Summary | GET | `/treatment-plans/dashboard` | KPIs |
| Add Item | POST | `/treatment-plans/{id}/items` | Add procedure |
| Update Item | PATCH | `/treatment-plans/{id}/items/{item_id}` | Partial update |
| Remove Item | DELETE | `/treatment-plans/{id}/items/{item_id}` | Remove |
| Reorder Items | PUT | `/treatment-plans/{id}/items/reorder` | Change sequence |
| Submit for Review | POST | `/treatment-plans/{id}/submit-for-review` | DRAFT → UNDER_REVIEW |
| Approve Review | POST | `/treatment-plans/{id}/approve-review` | UNDER_REVIEW → PROPOSED |
| Reject Review | POST | `/treatment-plans/{id}/reject-review` | UNDER_REVIEW → DRAFT |
| Accept Plan | POST | `/treatment-plans/{id}/accept` | PROPOSED → ACCEPTED |
| Decline Plan | POST | `/treatment-plans/{id}/decline` | PROPOSED → REJECTED |
| Cancel Plan | POST | `/treatment-plans/{id}/cancel` | Various → CANCELLED |
| Start Treatment | POST | `/treatment-plans/{id}/start-treatment` | ACCEPTED → IN_PROGRESS |
| Hold | POST | `/treatment-plans/{id}/hold` | IN_PROGRESS → ON_HOLD |
| Resume | POST | `/treatment-plans/{id}/resume` | ON_HOLD → IN_PROGRESS |
| Complete | POST | `/treatment-plans/{id}/complete` | → COMPLETED |
| Doctor Approve | POST | `/treatment-plans/{id}/doctor-approve` | Set approval — requires PLAN status = PROPOSED |
| Doctor Revoke | DELETE | `/treatment-plans/{id}/doctor-revoke` | Revoke approval — reset approved_by to NULL |
| Patient Acknowledge | POST | `/treatment-plans/{id}/patient-acknowledge` | Patient accepts/rejects plan — requires PLAN status = PROPOSED |
| Get Versions | GET | `/treatment-plans/{id}/versions` | Returns list of version snapshots ordered by version number |
| Get Version Detail | GET | `/treatment-plans/{id}/versions/{vid}` | Full version snapshot including items_snapshot JSONB |
| Restore Version | POST | `/treatment-plans/{id}/versions/{vid}/restore` | Restore plan items from a historical version snapshot |
| Get Versions | GET | `/treatment-plans/{id}/versions` | Version list |
| Get Version Detail | GET | `/treatment-plans/{id}/versions/{vid}` | Full snapshot |
| Restore Version | POST | `/treatment-plans/{id}/versions/{vid}/restore` | Rollback |
| Procedures List | GET | `/procedures?search=&category=|active=` | Catalog |
| Procedure Create | POST | `/procedures` | Admin only |
| Procedure Update | PATCH | `/procedures/{id}` | Admin only |
| Count by Status | GET | `/treatment-plans/count-by-status` | Status breakdown |
| Count by Doctor | GET | `/treatment-plans/count-by-doctor` | Doctor breakdown |
| Count by Patient | GET | `/treatment-plans/count-by-patient` | Patient breakdown |
| Plans by Patient | GET | `/treatment-plans/by-patient/{patient_id}` | Patient's plans |
| Plans by Doctor | GET | `/treatment-plans/by-doctor/{doctor_id}` | Doctor's plans |

#### User Management

| Screen | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Users List | GET | `/users?search=&status=&page=&page_size=` | Admin only |
| User Detail | GET | `/users/{id}` | Admin only |
| Pending Users | GET | `/auth/users/pending` | Approval queue |
| Approve User | PATCH | `/auth/users/{id}/approve` | Requires role |
| Deactivate User | PATCH | `/auth/users/{id}/deactivate` | Admin |
| Change Role | PATCH | `/users/{id}/role` | Admin |
| Activate User | PATCH | `/users/{id}/activate` | Admin |

### 17.3 Composite View Mapping

Some screens aggregate data from multiple endpoints:

| Screen | Endpoint(s) | Loading Strategy |
|--------|-------------|------------------|
| Reception Dashboard | `GET /appointments/today`, `GET /patients?is_active=true&page_size=5` | Parallel |
| Doctor Dashboard | `GET /appointments/today?dentist_id=`, `GET /treatment-plans/pending-review?doctor_id=`, `GET /patients/recent?doctor_id=` | Parallel |
| Chief Dashboard | `GET /treatment-plans/pending-review`, `GET /appointments/today`, `GET /treatment-plans/dashboard` | Parallel |
| Patient Profile | `GET /patients/{id}/profile`, `GET /appointments?patient_id=`, `GET /treatment-plans/by-patient/{id}?page_size=5` | Patient first, parallel after |
| Treatment Plan Detail | `GET /treatment-plans/{id}`, `GET /treatment-plans/{id}/versions` | Parallel |
| Audit Log | `GET /records/{id}/audit?page=&page_size=` | Single endpoint |

---

## 18. Future Expansion Planning

### 18.1 Phase 2 — Remaining Modules

#### Billing & Invoicing

| Feature | Frontend Requirements | Integration Points |
|---------|----------------------|-------------------|
| Invoice generation | Invoice list, invoice detail, print layout | Treatment plan cost data |
| Payment tracking | Payment form, payment history | Appointments, treatment plans |
| Insurance claims | Claim form, claim status tracking | Patients, treatment plans |
| Receipt printing | Receipt template, print dialog | Payments |

**Navigation placement:** New sidebar item under "Financial" section
**Cost data architecture:** The backend computes `total_estimated_cost` at the mapper layer from individual item costs — it is NOT stored in the database. The billing frontend should either:
  1. Accept the computed total from `TreatmentPlanResponse.total_estimated_cost` and `TreatmentPlanItemResponse.estimated_cost`
  2. Or compute totals client-side from item-level cost + discount data
  This design decision prevents data inconsistency (stored costs could become stale when item costs change).
**Components needed:** Invoice table, payment form, receipt preview, claim status badge

#### Dashboard & Analytics

| Feature | Frontend Requirements | Integration Points |
|---------|----------------------|-------------------|
| Operational KPIs | KPI dashboard widgets | All modules |
| Clinical statistics | Charts, trend lines | Clinical records, treatment plans |
| Revenue reporting | Financial charts, export | Billing module |
| Provider performance | Doctor metrics dashboard | Doctors, appointments, treatment plans |

**Navigation placement:** Dashboard enhancements + new "Reports" section  
**Components needed:** Charts (bar, line, pie), data export button, date range picker, metric comparison card

#### Notifications

| Feature | Frontend Requirements | Integration Points |
|---------|----------------------|-------------------|
| In-app notifications | Notification center panel | All modules |
| Email reminders | Email template management | Appointments |
| SMS reminders | SMS template management | Appointments |
| Notification preferences | Per-user notification settings | User profile |

**Navigation placement:** Notification bell (top bar) + Settings > Notifications  
**Components needed:** Notification list, notification item, notification preferences form

#### Inventory Management

| Feature | Frontend Requirements | Integration Points |
|---------|----------------------|-------------------|
| Supply catalog | Product list, product detail | Procedure catalog |
| Stock tracking | Stock level indicators, reorder alerts | — |
| Purchase orders | PO creation, PO status tracking | — |
| Usage tracking | Usage logging per procedure | Treatment plans |

**Navigation placement:** New sidebar item under "Operations" section  
**Components needed:** Data table with stock levels, status badges (in stock/low/out of stock), PO form

#### Laboratory Management

| Feature | Frontend Requirements | Integration Points |
|---------|----------------------|-------------------|
| Lab case tracking | Case list, case detail, status workflow | Treatment plans |
| Digital impression upload | File upload, case attachment | Patient records |
| Lab order form | Structured order form | Doctors, procedures |
| Case status dashboard | Lab dashboard view | — |

**Navigation placement:** New sidebar item under "Operations" section  
**Components needed:** File upload component, case status timeline, lab order form wizard

### 18.2 Phase 3 — Patient Portal

| Feature | Frontend Requirements | Tech Consideration |
|---------|----------------------|-------------------|
| Patient self-registration | Public registration form | Separate app or subdomain |
| Appointment self-booking | Patient-facing calendar view | Separate auth system or limited JWT |
| Treatment plan viewing | Read-only plan views | Secure data sharing |
| Online payments | Payment form integration | PCI compliance |
| Medical history intake | Patient-facing questionnaire | Structured form data |

**Architecture consideration:** The patient portal could be a separate lightweight React application sharing the same design system but with its own authentication and restricted API access. This provides security isolation while maintaining brand consistency.

### 18.3 Phase 4 — Infrastructure

| Feature | Frontend Requirements |
|---------|----------------------|
| Multi-clinic support | Branch selector in top bar, branch-filtered data |
| Docker containerization | Environment-based API URL configuration |
| CI/CD pipeline | Automated build, test, deploy |
| Rate limiting | Rate limit notification in UI |
| Performance monitoring | Performance metrics dashboard |

### 18.4 Phase 5 — AI/ML Features

| Feature | Frontend Requirements |
|---------|----------------------|
| Diagnosis assistant | AI-suggested diagnoses in clinical record form |
| Treatment recommendation | AI-suggested procedures in treatment plan |
| No-show prediction | Risk indicator on appointment cards |
| Clinical outcome prediction | Outcome probability indicators |

---

## 19. Assumptions

The following assumptions underpin this frontend planning document:

| # | Assumption | Rationale |
|---|------------|-----------|
| A-01 | All backend API endpoints return consistent JSON with the same error format | Planning assumes standardized API responses; any deviation should be addressed in backend before frontend development |
| A-02 | Authentication uses JWT Bearer tokens with configurable expiry | Frontend must handle token refresh, expiry detection, and secure storage |
| A-03 | Clinic staff use modern browsers (Chrome, Edge, Firefox latest 2 versions) | No IE11 support needed; can use modern CSS and JS features |
| A-04 | Primary devices are desktop computers (1920×1080 or larger) | Tablet support is secondary; mobile support is phase 3 |
| A-05 | Internet connectivity is generally reliable but not guaranteed | Graceful degradation and offline caching needed for critical operations |
| A-06 | Clinic operates 6 days a week (Monday-Saturday) with split shifts | Calendar and schedule views must support this pattern |
| A-07 | All users have unique email addresses | Email is used as primary identifier for login and notifications |
| A-08 | Patient data is entered by clinic staff, not imported | No bulk import UI needed in MVP |
| A-09 | Treatment plan approval requires sequential doctor→patient flow | UI must enforce the correct order of the approval workflow |
| A-10 | Audit logs are append-only and immutable | Audit log viewer is read-only; no edit/delete functionality |
| A-11 | The system will be used by multiple users simultaneously | Real-time conflict detection for appointments; optimistic locking for treatment plans |
| A-12 | Clinic operating hours are fixed (10-13, 17-21) | Schedule validation can reference constants |
| A-13 | User roles are assigned during user approval | Role determines which UI elements are visible |
| A-14 | Frontend will be deployed as a separate SPA from the backend | Uses Vite dev server in development; static build in production |

---

## 20. Risks

### 20.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Backend API changes during frontend development | High | High | API contract testing, versioned endpoints, shared OpenAPI spec |
| Authentication token expiry without refresh | Medium | High | Implement token refresh interceptor in Axios; clear UX for session expiry |
| Large patient datasets causing slow list rendering | Medium | Medium | Virtual scrolling for large lists; server-side pagination; debounced search |
| Network latency affecting real-time validation | Medium | Medium | Client-side validation first; server validation as backup; optimistic UI updates |
| Browser compatibility issues with modern features | Low | Medium | Use established libraries (React 19, Radix UI); polyfills for edge cases |
| State management complexity in multi-tab operation | Low | Medium | Use React Query for server state; Zustand for client state; avoid duplicating server state |

### 20.2 UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Information overload in clinical interfaces | Medium | High | Progressive disclosure; role-based filtering; user testing with real clinicians |
| Training burden for non-technical staff | Medium | High | Onboarding flow; contextual help; consistent patterns; minimal learning curve |
| Accessibility compliance gaps | Medium | High | WCAG 2.1 AA as requirement from start; automated testing; accessibility audit |
| Mobile responsiveness breaking critical workflows | Low | Medium | Desktop-first design; tablet testing; progressive enhancement |
| Keyboard navigation not discovered by power users | Medium | Medium | Keyboard shortcut guide (`?` shortcut); visual hints for power users |

### 20.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep during frontend development | High | High | Strict MVP scope defined in this document; feature requests deferred to roadmap |
| Real user feedback contradicting design assumptions | Medium | High | Early user testing; iterative design; analytics to validate assumptions |
| Lack of user adoption due to workflow changes | Medium | High | Change management plan; training materials; gradual rollout |
| Compliance requirements discovered late | Low | High | Consult with healthcare compliance early; HIPAA-aware design from start |

---

## 21. Recommendations

### 21.1 Technology Recommendations

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **UI Library** | React 19 with TypeScript | Already scaffolded; strongest ecosystem for enterprise applications |
| **Styling** | Tailwind CSS 4 | Already in project; utility-first approach enables consistent design tokens |
| **Component Library** | shadcn/ui (Radix UI primitives) | Accessible by default; composable; customizable; works with Tailwind |
| **State Management** | Zustand (client state) + TanStack React Query (server state) | Already in project; React Query for API caching and synchronization; Zustand for UI state |
| **Forms** | React Hook Form + Zod validation | Already in project; performant forms; Zod matches Pydantic-style validation |
| **Routing** | React Router v7 | Already in project; standard choice for React SPAs |
| **API Client** | Axios (with interceptors) | Already in project; interceptors for JWT handling and error normalization |
| **Date Handling** | date-fns | Lightweight; tree-shakable; comprehensive date utilities |
| **Tables** | TanStack Table (React Table) | Headless, flexible; handles sorting, filtering, pagination, virtualization |
| **Charts** | Recharts (for analytics phase) | Declarative, composable; good healthcare dashboard examples |
| **Calendar** | Custom (with react-day-picker as base) | Dental scheduling has specific requirements (split shifts, block scheduling) |
| **Testing** | Vitest + React Testing Library | Fast; compatible with Vite; encourages testing behavior over implementation |
| **Build Tool** | Vite 8 | Already in project; fast builds and HMR |

### 21.2 Architecture Recommendations

| Recommendation | Rationale |
|----------------|-----------|
| **Feature-based folder structure** | `features/patients`, `features/appointments`, etc. Each feature is self-contained with components, hooks, types, and API calls |
| **API layer abstraction** | Centralized API client with interceptors for auth, error handling, and caching via React Query |
| **Role-based route protection** | Route guards that check user role and redirect unauthorized users |
| **Persistent query cache** | React Query with stale-while-revalidate for instant patient lookups |
| **Progressive loading** | Route-level code splitting with lazy loading for faster initial load |
| **Design token system** | CSS custom properties for all colors, spacing, typography — enables theming and dark mode |
| **Error boundary per feature** | Granular error boundaries prevent one feature's crash from taking down the entire app |
| **Feature flags** | Toggle future features on/off without deployment |

### 21.3 Design Recommendations

| Recommendation | Rationale |
|----------------|-----------|
| **Start with reception and doctor dashboards** | These are the highest-frequency, highest-impact workflows |
| **Invest heavily in the patient unified record** | This is the central organizing principle of the entire application |
| **Invest in global search early** | Patient lookup is the single most frequent action across all roles |
| **Design empty states for every list** | Empty states are the first thing new users see; they set the tone for the entire experience |
| **Prioritize keyboard navigation** | Power users (receptionists, data-entry staff) will spend 8+ hours/day in the system |
| **Test with real clinic staff** | Schedule usability testing sessions with actual receptionists and dentists |
| **Start with desktop-first; adapt to mobile** | Clinic workflows are primarily desktop-based; mobile optimization comes later |
| **Build the design system iteratively** | Don't try to build all components upfront; grow the system as needed |

### 21.4 Development Recommendations

| Recommendation | Rationale |
|----------------|-----------|
| **Use OpenAPI code generation** | Generate TypeScript API client from backend OpenAPI spec to ensure type safety |
| **Implement end-to-end testing** | Playwright tests for critical workflows (patient registration → appointment booking) |
| **Storybook for component development** | Isolated component development, visual regression testing, documentation |
| **Feature branch per module** | Frontend development follows the same pattern as backend (feature/treatment-plan-ui) |
| **API contract testing in CI** | Validate frontend types against backend API responses |
| **Responsive design testing in CI** | Automated visual regression testing at multiple viewport sizes |

### 21.5 Phased Development Recommendation

| Phase | Modules | Timeline (estimate) |
|-------|---------|---------------------|
| **Phase 1 — Foundation** | Application shell, authentication, routing, sidebar, design system, global search | 4-6 weeks |
| **Phase 2 — Reception** | Reception dashboard, patient management, appointment calendar | 4-6 weeks |
| **Phase 3 — Clinical** | Doctor dashboard, clinical records, diagnosis, prescriptions, follow-ups | 6-8 weeks |
| **Phase 4 — Treatment Plans** | Treatment plan wizard, plan management, state transitions, version history | 6-8 weeks |
| **Phase 5 — Administrative** | Admin dashboard, user management, doctor management, audit log, procedures catalog | 4-6 weeks |
| **Phase 6 — Polish** | Testing, accessibility audit, performance optimization, documentation | 4-6 weeks |

**Total estimated timeline: 28-40 weeks (7-10 months)**

---

## 22. Next Steps

### Immediate (Next 2 Weeks)

| # | Action | Owner |
|---|--------|-------|
| 1 | Review and approve this Product Research & Planning document | Product Team |
| 2 | Validate user personas with actual clinic staff | Product Manager |
| 3 | Map detailed user flows for top 10 workflows (see below) | UX Researcher |
| 4 | Finalize technology choices and architecture decisions | Software Architect |
| 5 | Set up frontend project infrastructure (Vite, folder structure, linting) | Frontend Architect |

### Short-term (Weeks 3-6)

| # | Action | Owner |
|---|--------|-------|
| 6 | Begin Part 2 — UI Design: wireframes, mockups, prototypes | UI Designer |
| 7 | Build foundation components (sidebar, top bar, layout, search) | Frontend Developer |
| 8 | Implement authentication flow (login, register, token management) | Frontend Developer |
| 9 | Set up React Query integration with backend APIs | Frontend Developer |
| 10 | Implement global search functionality | Frontend Developer |

### Top 10 User Flows to Detail Next

| # | Flow | Priority |
|---|------|----------|
| 1 | Patient registration + duplicate detection | Critical |
| 2 | Appointment booking + conflict detection | Critical |
| 3 | Doctor's daily clinical workflow (view schedule → treat → document) | Critical |
| 4 | Treatment plan creation wizard | Critical |
| 5 | Treatment plan review and approval (chief doctor flow) | Critical |
| 6 | Patient search (global + filtered) | Critical |
| 7 | Clinical record creation with diagnosis and prescription | High |
| 8 | Doctor profile and schedule management | High |
| 9 | User approval and role assignment (admin flow) | High |
| 10 | Audit trail viewing and filtering | Medium |

---

## Appendix A: Detailed API Endpoint Reference

*See `backend/main.py` and individual module routers (`backend/app/modules/*/routes.py`) for the complete list of 115 endpoints.*

## Appendix B: Design System Reference (Future)

*To be created in Part 2 — UI Design phase.*

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| DCMS | Dental Clinic Management System |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| FDI | Fédération Dentaire Internationale — international tooth numbering system |
| Aggregate Root | Root entity that guarantees consistency for a group of related entities |
| State Machine | Model defining valid transitions between statuses for an entity |
| Progressive Disclosure | UI pattern showing essential information first with drill-down for details |
| SPA | Single Page Application |
| React Query | TanStack library for server state management and caching |
| shadcn/ui | Component collection built on Radix UI primitives |
| PHI | Protected Health Information |
| WCAG | Web Content Accessibility Guidelines |
| BAA | Business Associate Agreement (HIPAA) |

---

> **Document Status:** Draft for Review  
> **Next Document:** DensCare Frontend UI/UX Design (Part 2) — Wireframes, Mockups, and Prototypes  
> **Version:** 1.0.0  
> **Last Updated:** July 18, 2026
