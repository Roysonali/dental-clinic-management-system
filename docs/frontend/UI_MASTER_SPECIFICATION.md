# DensCare — UI Master Specification

## Screen-by-Screen UI Specification for Frontend Implementation

---

**Document Type:** Enterprise UI Specification
**Version:** 1.1.0
**Last Updated:** July 28, 2026
**Status:** Final — Implementation-Ready
**Owner:** Product Design Consultancy
**Classification:** Confidential — Internal Use Only
**Primary Audience:** Lovable, Cursor, Frontend Developers, QA Engineers, AI Assistants

---

## Table of Contents

1. [How to Use This Document](#1-how-to-use-this-document)
2. [Authentication Screens](#2-authentication-screens)
3. [Application Shell & Navigation](#3-application-shell--navigation)
4. [Dashboard Screens](#4-dashboard-screens)
5. [Patient Screens](#5-patient-screens)
6. [Doctor Screens](#6-doctor-screens)
7. [Appointment Screens](#7-appointment-screens)
8. [Clinical Records Screens](#8-clinical-records-screens)
    - 8.1 Record List
    - 8.2 Record Detail
    - 8.3 Create Record
    - 8.4 Diagnosis Management
    - 8.5 Prescription Management
    - 8.6 Attachment Management
    - 8.7 Follow-up Management
    - 8.8 Record Audit Log
    - 8.9 Medical History
9. [Treatment Plan Screens](#9-treatment-plan-screens)
    - 9.1 Plan List
    - 9.2 Create Plan
    - 9.3 Plan Detail
    - 9.4 Procedure Catalog
    - 9.5 Version Diff
10. [Billing & Invoicing Screens](#10-billing--invoicing-screens)
    - 10.1 Invoice List
    - 10.2 Create Invoice
    - 10.3 Invoice Detail
    - 10.4 Record Payment
    - 10.5 Payment List
    - 10.6 Receipt
    - 10.7 Refund
    - 10.8 Credit Note List
    - 10.9 Refund List
    - 10.10 Payment Allocation
    - 10.11 Billing Dashboard
    - 10.12 Invoice Print Preview
11. [User Management Screens](#11-user-management-screens)
12. [Administration Screens](#12-administration-screens)
13. [Profile & Notification Screens](#13-profile--notification-screens)
14. [Error & Utility Screens](#14-error--utility-screens)
15. [Cross-Screen Specifications](#15-cross-screen-specifications)

---

---

## 1. How to Use This Document

### 1.1 Purpose

This document is the **authoritative UI specification** for the DensCare frontend. Every screen in the application is documented here with:

- Screen purpose and business context
- Route, accessible roles, and layout
- Complete component tree
- Field-level specifications
- Table specifications
- Button and action specifications
- Modal dialog specifications
- API integration contracts (endpoint, method, request/response DTOs)
- State management requirements
- Validation rules
- Empty, loading, error, and success states
- Responsive behavior
- Accessibility requirements
- UX notes and future enhancements

### 1.2 Document Conventions

| Convention | Meaning |
|------------|---------|
| `PathParam` | Route parameter (e.g., `:id`) |
| `QueryParam` | URL query parameter |
| `POST /path` | API endpoint reference |
| `[Component]` | UI component reference |
| `[Icon]` | Lucide icon reference |
| `❌` | Feature not yet implemented (backend) |
| `🔮` | Future enhancement |

### 1.3 Backend API Base URL

```
Base URL: http://127.0.0.1:8000
```

All API endpoints are prefixed with the base URL. The Axios instance is configured with this base URL by default.

### 1.4 Auth Token

All authenticated endpoints require:
```
Authorization: Bearer {access_token}
```

The token is obtained from `POST /auth/login` and stored in the Zustand auth store.

### 1.5 Common Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "details": {}
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "details": {}
}
```

### 1.6 Pagination Format

All list endpoints accept:
- `page` (int, default: 1)
- `size` (int, default: 20, max: 100)
- `sort_by` (string)
- `sort_order` (asc | desc)

Paginated response:
```json
{
  "items": [...],
  "total": 156,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

---

## 2. Authentication Screens

### 2.1 Login Screen

#### 2.1.1 Screen Purpose

**Business goal:** Authenticate users and grant access to the system based on their role.
**User goal:** Sign in quickly to begin their daily workflow.

#### 2.1.2 Route

`/auth/login`

#### 2.1.3 Accessible Roles

All roles (public — no authentication required)

#### 2.1.4 Page Layout

```
┌────────────────────────────────────────────────────────────┐
│                    [DensCare Logo]                         │
│                                                           │
│              ┌────────────────────────────┐               │
│              │     Sign in to DensCare    │               │
│              │                            │               │
│              │  Email                     │               │
│              │  ┌──────────────────────┐  │               │
│              │  │ [Input]              │  │               │
│              │  └──────────────────────┘  │               │
│              │                            │               │
│              │  Password                  │               │
│              │  ┌──────────────────────┐  │               │
│              │  │ [Input]        [👁️]  │  │               │
│              │  └──────────────────────┘  │               │
│              │                            │               │
│              │  ☐ Remember me             │               │
│              │                            │               │
│              │  [Sign In Button]          │               │
│              │                            │               │
│              │  Forgot password?          │               │
│              │  Register here             │               │
│              └────────────────────────────┘               │
│                                                           │
│              © 2026 DensCare. All rights reserved.        │
└────────────────────────────────────────────────────────────┘
```

#### 2.1.5 Component Tree

```
AuthLayout
├── Logo (DensCare branding, clickable → /)
├── LoginCard
│   ├── CardHeader ("Sign in to DensCare")
│   ├── Form (react-hook-form)
│   │   ├── FormField (Email)
│   │   │   ├── Label ("Email")
│   │   │   └── Input (type="email", placeholder="Enter your email")
│   │   ├── FormField (Password)
│   │   │   ├── Label ("Password")
│   │   │   ├── PasswordInput (type="password")
│   │   │   └── ToggleVisibilityIcon
│   │   ├── Checkbox (Remember me)
│   │   └── Button (primary, "Sign In", full-width)
│   ├── ForgotPasswordLink ("Forgot password?")
│   ├── RegisterLink ("Register here")
│   └── ErrorBanner (conditional)
└── Footer ("© 2026 DensCare")
```

#### 2.1.6 Field-Level Specification

| Field | Type | Required | Placeholder | Validation | Max |
|-------|------|----------|-------------|------------|-----|
| Email | Email | Yes | "Enter your email" | Valid email format, case-insensitive, normalized to lowercase | 255 |
| Password | Password | Yes | "Enter your password" | Cannot be blank | 128 |
| Remember Me | Checkbox | No | — | — | — |

#### 2.1.7 Buttons & Actions

| Action | Type | Visibility | API Call | Confirmation |
|--------|------|-----------|----------|-------------|
| Sign In | Submit (primary) | Always | `POST /auth/login` | No |
| Forgot Password | Link | Always | — | No |
| Register | Link | Always | — | No |
| Toggle Password | Icon | Always | — | No |

#### 2.1.8 API Integration

| Endpoint | Method | Request DTO | Response DTO |
|----------|--------|-------------|-------------|
| `/auth/login` | POST | `{ username: string (email), password: string }` | `{ access_token: string, token_type: string }` |

**Note:** The backend expects `form-urlencoded` body, NOT JSON. The `username` field is the email address.

**Post-login flow:**
1. Store `access_token` in Zustand auth store (persisted)
2. Call `GET /auth/me` to get user profile
3. Store user object in Zustand auth store
4. Redirect to role-specific dashboard

#### 2.1.9 State Management

- **Server State:** None (mutation only)
- **Client State:** Form state (react-hook-form), loading state, error state
- **Form State:** React Hook Form with Zod validation schema
- **URL State:** None

#### 2.1.10 Validation Rules

| Field | Rule | Message |
|-------|------|---------|
| Email | Required | "Email is required" |
| Email | Valid email format | "Please enter a valid email address" |
| Password | Required | "Password is required" |

#### 2.1.11 States

**Default:** Email field auto-focused. "Sign In" button disabled until both fields non-empty.

**Loading:** Button shows spinner + "Signing in...". All inputs disabled.

**Error — Invalid credentials:** Inline error below form: "Invalid email or password."

**Error — Account pending:** Alert banner: "Your account is pending approval. Please contact your administrator."

**Error — Account inactive:** Alert banner: "Your account has been deactivated. Please contact your administrator."

**Error — Network:** Toast: "Unable to connect. Please check your internet connection."

**Error — Rate limit:** Alert banner: "Too many login attempts. Please try again in 15 minutes."

**Remember Me:** If checked, token persisted in localStorage; if unchecked, session-only (not persisted).

#### 2.1.12 Responsive Behavior

| Breakpoint | Layout Changes |
|------------|---------------|
| ≥1280px | Centered card, max-width 420px |
| 1024-1279px | Same as desktop |
| 768-1023px | Full-width card, reduced padding |
| <768px | Full-screen, no card border, no footer |

#### 2.1.13 Accessibility

- All fields have visible `<label>` elements (no placeholder-as-label)
- Error messages use `aria-live="polite"` for screen reader announcements
- Form has `role="form"` and `aria-label="Sign in form"`
- Focus trapped within the card (no tabbing to background)
- Password visibility toggle has `aria-label="Show password"`
- Keyboard: Tab → Email → Password → Remember Me → Sign In → Forgot Password → Register

#### 2.1.14 UX Notes

- Email field auto-focused on mount to reduce interaction steps
- Password visibility toggle allows users to verify they typed correctly
- Generic error message ("Invalid email or password") prevents email enumeration
- "Remember Me" checkbox: checked by default for clinic workstations

#### 2.1.15 Future Enhancements

- SSO / Google OAuth login
- Biometric authentication (fingerprint on mobile)
- Multi-factor authentication (TOTP)
- Quick PIN login for receptionists

---

### 2.2 Register Screen

#### 2.2.1 Screen Purpose

**Business goal:** Allow new users to self-register for an account.
**User goal:** Create a new account to gain system access.

#### 2.2.2 Route

`/auth/register`

#### 2.2.3 Accessible Roles

All roles (public — no authentication required)

#### 2.2.4 Page Layout

Same as Login layout but with registration form.

#### 2.2.5 Component Tree

```
AuthLayout
├── Logo
├── RegisterCard
│   ├── CardHeader ("Create Your Account")
│   ├── Form
│   │   ├── FormField (Full Name)
│   │   │   ├── Label ("Full Name")
│   │   │   └── Input (placeholder="Enter your full name")
│   │   ├── FormField (Email)
│   │   │   ├── Label ("Email Address")
│   │   │   └── Input (type="email", placeholder="Enter your email")
│   │   ├── FormField (Password)
│   │   │   ├── Label ("Password")
│   │   │   ├── PasswordInput
│   │   │   ├── PasswordStrengthIndicator
│   │   │   └── PasswordRequirements
│   │   ├── FormField (Confirm Password)
│   │   │   ├── Label ("Confirm Password")
│   │   │   └── PasswordInput
│   │   ├── Checkbox (Terms of Service)
│   │   └── Button (primary, "Create Account", full-width)
│   ├── SignInLink ("Already have an account? Sign in")
│   └── ErrorBanner (conditional)
└── Footer
```

#### 2.2.6 Field-Level Specification

| Field | Type | Required | Validation | Max |
|-------|------|----------|------------|-----|
| Full Name | Text | Yes | 2+ chars, letters and spaces only | 150 |
| Email | Email | Yes | Valid email, lowercase | 255 |
| Password | Password | Yes | 8+ chars, upper + lower + digit + special | 128 |
| Confirm Password | Password | Yes | Must match Password | 128 |
| Terms of Service | Checkbox | Yes | Must be checked | — |

#### 2.2.7 API Integration

| Endpoint | Method | Request DTO | Response DTO |
|----------|--------|-------------|-------------|
| `/auth/register` | POST | `{ full_name: string, email: string, password: string }` | `{ id: string, full_name: string, email: string, status: string }` |

#### 2.2.8 Password Strength Indicator

```
Weak:    ██░░░░░░░░  (red)     — Only lowercase or <8 chars
Medium:  ██████░░░░  (amber)   — Meets minimum requirements
Strong:  ██████████  (green)   — 12+ chars, all character types
```

#### 2.2.9 States

**Success:** Redirect to login with toast: "Account created! Please wait for admin approval."

**Error — Email exists:** "An account with this email already exists. Sign in instead."

**Error — Weak password:** "Password must contain at least 8 characters, including uppercase, lowercase, digit, and special character."

**Error — Passwords don't match:** "Passwords do not match."

---

### 2.3 Forgot Password Screen

#### 2.3.1 Screen Purpose

**Business goal:** Allow users to request a password reset email.
**User goal:** Recover access to their account.

#### 2.3.2 Route

`/auth/forgot-password`

#### 2.3.3 Accessible Roles

All roles (public)

#### 2.3.4 Layout

Compact card with single email field.

#### 2.3.5 Component Tree

```
AuthLayout
├── Logo
├── ForgotPasswordCard
│   ├── CardHeader ("Forgot Password")
│   ├── Description ("Enter your email to receive a reset link")
│   ├── FormField (Email)
│   ├── Button ("Send Reset Link", primary)
│   └── BackLink ("Back to Sign In")
└── Footer
```

#### 2.3.6 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `/auth/forgot-password` | POST | `{ email: string }` |

**⚠️ Backend note:** This endpoint may not yet be implemented. The frontend should handle a 501/404 gracefully.

#### 2.3.7 States

**Success:** Always show success message (prevents email enumeration): "If an account exists with this email, you will receive a password reset link."

**Error:** "Unable to process your request. Please try again."

---

### 2.4 Reset Password Screen

#### 2.4.1 Screen Purpose

**Business goal:** Allow users to set a new password via a reset token.
**User goal:** Create a new password to regain account access.

#### 2.4.2 Route

`/auth/reset-password?token={token}`

#### 2.4.3 Layout

Same as Register layout.

#### 2.4.4 Component Tree

```
AuthLayout
├── Logo
├── ResetPasswordCard
│   ├── CardHeader ("Reset Password")
│   ├── FormField (New Password)
│   │   ├── PasswordInput
│   │   └── StrengthIndicator
│   ├── FormField (Confirm Password)
│   ├── Button ("Reset Password", primary)
│   └── SignInLink
└── Footer
```

#### 2.4.5 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `/auth/reset-password` | POST | `{ token: string, password: string }` |

#### 2.4.6 States

**Token invalid/expired:** Error card: "This reset link is invalid or has expired." + "Request new link" button.

**Success:** "Password updated successfully." → Redirect to login.

---

### 2.5 Change Password Screen

#### 2.5.1 Screen Purpose

**Business goal:** Allow authenticated users to change their password.
**User goal:** Update password for security purposes.

#### 2.5.2 Route

`/profile/change-password`

#### 2.5.3 Accessible Roles

All authenticated roles

#### 2.5.4 Layout

Standard form card within profile section.

#### 2.5.5 Component Tree

```
Page
├── PageHeader ("Change Password")
├── Form
│   ├── FormField (Current Password) → PasswordInput
│   ├── FormField (New Password) → PasswordInput + StrengthIndicator
│   ├── FormField (Confirm New Password) → PasswordInput
│   └── ActionRow
│       ├── Button ("Cancel", secondary)
│       └── Button ("Update Password", primary)
└── SuccessToast (conditional)
```

#### 2.5.6 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `/auth/change-password` | PUT | `{ current_password: string, new_password: string }` |

#### 2.5.7 Validation

- Current password must not be empty
- New password: same rules as registration
- Confirm must match new password
- New password must differ from current password

---

### 2.6 Session Expired Screen

#### 2.6.1 Screen Purpose

**Business goal:** Inform users their session has expired and prompt re-login.
**User goal:** Re-authenticate to continue work.

#### 2.6.2 Route

`/auth/session-expired`

#### 2.6.3 Layout

Full-screen centered card with icon, message, and "Sign In Again" button.

#### 2.6.4 Component Tree

```
FullPageCard
├── ClockIcon (Lucide `Clock`, 48px, color-danger)
├── Title ("Session Expired")
├── Description ("Your session has expired. Please sign in again.")
├── Button ("Sign In Again", primary, navigate → /auth/login)
└── Link ("Go to Homepage", navigate → /)
```

---

### 2.7 Unauthorized Screen

#### 2.7.1 Screen Purpose

**Business goal:** Display when a user attempts to access a page without authentication.
**User goal:** Understand they need to log in.

#### 2.7.2 Route

`/401` (redirect for 401 responses)

#### 2.7.3 Layout

Full-screen centered card.

#### 2.7.4 Component Tree

```
FullPageCard
├── ShieldAlertIcon (Lucide `ShieldAlert`, 48px, color-warning)
├── Title ("Unauthorized")
├── Description ("Please sign in to access this page.")
├── Button ("Sign In", primary, navigate → /auth/login)
└── Link ("Go to Homepage")
```

---

### 2.8 Forbidden Screen

#### 2.8.1 Screen Purpose

**Business goal:** Display when a user lacks permission for a resource.
**User goal:** Understand access restrictions and navigate elsewhere.

#### 2.8.2 Route

`/403`

#### 2.8.3 Layout

Full-screen centered card.

#### 2.8.4 Component Tree

```
FullPageCard
├── LockIcon (Lucide `Lock`, 48px, color-danger)
├── Title ("Access Denied")
├── Description ("You do not have permission to access this page.")
├── Button ("Go to Dashboard", primary, navigate → /)
└── SupportLink ("Contact support if you need access")
```

---

## 3. Application Shell & Navigation

### 3.1 Application Shell Overview

The app shell is persistent across all authenticated screens.

#### 3.1.1 Layout

```
┌─ EnvironmentBanner (28px, conditional) ─────────────────┐
├─ Header (56px, sticky) ───────────────────────────────┤
│ [Logo] [Global Search ⌘K] [Tasks] [Notif] [Help] [Profile]│
├──────────┬─────────────────────────────────────────────┤
│ Sidebar  │ Breadcrumb (40px, conditional)              │
│ 240/64px │ PatientContextHeader (64px, conditional)    │
│          │ PageTitle (32px, conditional)                │
│          │ ┌───────────────────────────────────────┐   │
│          │ │ Workspace (flex: 1, overflow-y: auto) │   │
│          │ │                                       │   │
│          │ └───────────────────────────────────────┘   │
│          │ Footer (32px, conditional)                  │
└──────────┴─────────────────────────────────────────────┘
```

#### 3.1.2 Sidebar Navigation

**States:** Expanded (240px), Collapsed (64px), Hidden (mobile)

**Sections:**

| Section | Items | Role Visibility |
|---------|-------|----------------|
| Main | Dashboard | All roles |
| Clinical | Patients, Appointments, Doctors | Admin + Clinical roles |
| Clinical | Treatment Plans | Admin + Doctor roles |
| Administrative | Users | Admin only |
| Administrative | Procedures Catalog | Admin + Chief Doctor |
| Administrative | Audit Log | Admin + Chief Doctor |
| Financial | Billing — Invoices | Admin, Receptionist |
| Financial | Billing — Payments | Admin, Receptionist |
| Financial | Billing — Dashboard | Admin, Chief Doctor |

#### 3.1.3 Global Search (⌘K)

See Section 15.4 for global search specification.

---

## 4. Dashboard Screens

### 4.1 Admin Dashboard

#### 4.1.1 Screen Purpose

**Business goal:** Provide system-level oversight — user management, system health, operational KPIs.
**User goal:** Monitor clinic operations and manage pending administrative tasks.

#### 4.1.2 Route

`/` (redirect from `/admin/dashboard`)

#### 4.1.2.1 Role-Based Dashboard Resolution

The application shell resolves the landing page based on the authenticated user's role:

| Role | Landing Route | Component |
|------|---------------|-----------|
| `ADMIN` | `/` | AdminDashboard |
| `CHIEF_DOCTOR` | `/` | ChiefDoctorDashboard |
| `GENERAL_DOCTOR` | `/` | DoctorDashboard |
| `SPECIALIST_DOCTOR` | `/` | DoctorDashboard (specialist variant) |
| `CONSULTING_DOCTOR` | `/` | DoctorDashboard (consultant variant) |
| `RECEPTIONIST` | `/` | ReceptionDashboard |
| `DENTAL_ASSISTANT` | `/` | AssistantDashboard |

**Implementation:** Use a role-to-component mapping in the route resolver. No role sees a dashboard that doesn't belong to them.

#### 4.1.3 Accessible Roles

`ADMIN`

#### 4.1.4 Page Layout

```
┌─ Greeting + Date ──────────────────────────────────────┐
├─ KPI Row (4 metric cards) ─────────────────────────────┤
├─ Main Content (2/3) ───────────┬─ Right Panel (1/3) ──┤
│ Pending User Approvals         │ Quick Actions         │
│ Today's Overview               │ System Health         │
│ Doctor Availability            │ Recent Activity       │
│ Billing Snapshot               │ System Alerts         │
├─ Weekly Appointment Trend (full width) ───────────────┤
```

#### 4.1.5 Component Tree

```
DashboardLayout
├── GreetingHeader
│   ├── Text ("Good morning/afternoon/evening, {Name}")
│   └── Text (current date, formatted)
├── KpiRow
│   ├── KpiCard ("Pending Approvals", value, icon, clickable)
│   ├── KpiCard ("Active Users", value, icon, clickable)
│   ├── KpiCard ("Active Doctors", value, icon, clickable)
│   └── KpiCard ("Today's Appointments", value, icon, clickable)
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── PendingApprovalCard (user list with approve/reject actions)
│   │   ├── TodayOverviewCard (appointment funnel)
│   │   ├── DoctorAvailabilityCard (status list)
│   │   └── BillingSnapshotCard (revenue, pending, overdue)
│   └── RightColumn
│       ├── QuickActionsCard
│       │   ├── ActionButton ("Create User")
│       │   ├── ActionButton ("New Patient")
│       │   ├── ActionButton ("Book Appointment")
│       │   └── ActionButton ("View Audit Log")
│       ├── SystemHealthCard
│       │   ├── HealthIndicator ("Database: Online")
│       │   ├── HealthIndicator ("API: 245ms avg")
│       │   └── HealthIndicator ("Storage: 2.3GB")
│       ├── RecentActivityCard (activity feed list)
│       └── SystemAlertsCard (alert list)
└── WeeklyChartRow
    └── BarChart (appointment volume per day)
```

#### 4.1.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /users/count-by-status` | GET | User metrics |
| `GET /appointments/count-by-date?date=today` | GET | Today's appointment count |
| `GET /doctors/availability` | GET | Doctor availability |
| `GET /billing/dashboard` | GET | Financial summary (Sprint 7) |
| `GET /appointments/weekly-trend` | GET | Weekly appointment data |

#### 4.1.7 States

**Empty (fresh system):**
```
Welcome to DensCare
Your system is ready. Start by adding users and configuring clinic settings.
[Create First User] [Settings]
```

**Loading:** Skeleton cards for KPI row, skeleton list for each section.

**Error:** Individual card shows error state with retry button.

---

### 4.2 Reception Dashboard

#### 4.2.1 Screen Purpose

**Business goal:** Command center for front-desk operations — patient check-in, appointment management, registration.
**User goal:** Process patients quickly and manage the daily queue.

#### 4.2.2 Route

`/` (redirect from `/reception/dashboard`)

#### 4.2.3 Accessible Roles

`RECEPTIONIST`

#### 4.2.4 Page Layout

```
┌─ Greeting + Date ──────────────────────────────────────┐
├─ KPI Row (4 metric cards) ─────────────────────────────┤
├─ Main Content (2/3) ───────────┬─ Right Panel (1/3) ──┤
│ Today's Queue (table)          │ Quick Actions         │
│ Status Legend                  │ Doctor Availability   │
│                                │ Waiting Room          │
│                                │ Pending Follow-ups    │
├─ Upcoming Week (mini calendar view) ───────────────────┤
```

#### 4.2.5 Component Tree

```
DashboardLayout
├── GreetingHeader
├── KpiRow (Today's Appointments, Checked In, Waiting, New Patients)
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── TodayQueueTable
│   │   │   ├── Columns: Time, Patient, Doctor, Status, Actions
│   │   │   ├── Sortable by time
│   │   │   ├── Click row → patient context
│   │   │   └── Status badges: Scheduled, Checked In, In Treatment, Completed, No Show
│   │   └── StatusLegend
│   └── RightColumn
│       ├── QuickActionsCard
│       │   ├── ActionButton ("Register Patient") → slide-out panel
│       │   ├── ActionButton ("Book Appointment") → calendar
│       │   ├── ActionButton ("Find Patient") → global search
│       │   └── ActionButton ("Today's Schedule") → appointment calendar
│       ├── DoctorAvailabilityCard (compact list)
│       ├── WaitingRoomCard (patients checked in, wait time)
│       └── PendingFollowupsCard (list with call actions)
└── WeeklyMiniCalendar (compact bar chart)
```

#### 4.2.6 Table Specification: Today's Queue

| Column | Sortable | Filterable | Width | Sticky |
|--------|----------|------------|-------|--------|
| Time | Yes | No | 80px | No |
| Patient Name | Yes | Yes (search) | 200px | Yes |
| Doctor | Yes | Yes (dropdown) | 150px | No |
| Procedure Type | No | Yes (dropdown) | 150px | No |
| Status | Yes | Yes (badge filter) | 120px | No |
| Actions | No | No | 100px | Yes |

**Empty state:** "No appointments scheduled for today."
**Loading:** Skeleton table rows.

#### 4.2.7 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /appointments?date=today` | GET | Today's appointments |
| `GET /doctors/availability` | GET | Doctor statuses |
| `GET /patients/recent` | GET | Recently registered patients |

#### 4.2.8 States

**Empty:** "No appointments today. It looks like today is quiet." with CTA buttons.

---

### 4.3 Doctor Dashboard

#### 4.3.1 Screen Purpose

**Business goal:** Clinician's daily workflow hub — schedule, patient queue, clinical alerts, pending documentation.
**User goal:** See today's patients, manage clinical work, and prioritize tasks.

#### 4.3.2 Route

`/` (redirect from `/doctor/dashboard`)

#### 4.3.3 Accessible Roles

`GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 4.3.4 Page Layout

```
┌─ Greeting + Date ──────────────────────────────────────┐
├─ KPI Row (Today's Patients, In Treatment, Pending Records, Follow-ups Due)
├─ Main Content (2/3) ───────────┬─ Right Panel (1/3) ──┤
│ Today's Schedule (table)        │ Clinical Alerts       │
│ Pending Documentation (list)    │ Recent Patients       │
│ Active Treatment Plans (table)  │ Clinical Shortcuts    │
└──────────────────────────────────┴─────────────────────┘
```

#### 4.3.5 Component Tree

```
DashboardLayout
├── GreetingHeader
├── KpiRow
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── TodayScheduleTable
│   │   │   ├── Columns: Time, Patient, Type, Status
│   │   │   ├── Click → patient clinical workspace
│   │   │   └── Status: Completed, In Progress, Scheduled, No Show
│   │   ├── PendingDocumentationCard
│   │   │   ├── Items: Patient, Procedure, Date, Status, Continue button
│   │   │   └── Links to clinical records
│   │   └── ActiveTreatmentPlansCard
│   │       ├── Columns: Code, Patient, Status, Progress, Total
│   │       └── Click → treatment plan detail
│   └── RightColumn
│       ├── ClinicalAlertsCard
│       │   ├── Severity: Critical (red), High (amber), Medium (blue), Low (gray)
│       │   └── Clickable → relevant context
│       ├── RecentPatientsCard (compact list)
│       └── ClinicalShortcutsCard
│           ├── Button ("New Record")
│           ├── Button ("New Prescription")
│           ├── Button ("New Plan")
│           └── Button ("Schedule Follow-up")
```

#### 4.3.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /appointments?doctor_id=me&date=today` | GET | Today's schedule |
| `GET /records?doctor_id=me&status=draft,in_progress` | GET | Pending records |
| `GET /treatment-plans/by-doctor/{doctor_id}` | GET | Active plans |
| `GET /doctors/me/alerts` | GET | Clinical alerts (future) |

---

### 4.4 Chief Doctor Dashboard

#### 4.4.1 Screen Purpose

**Business goal:** Clinical oversight — treatment plan reviews, doctor management, clinic-wide clinical metrics.
**User goal:** Review treatment plans, monitor doctor performance, manage clinical quality.

#### 4.4.2 Route

`/` (redirect from `/chief/dashboard`)

#### 4.4.3 Accessible Roles

`CHIEF_DOCTOR`

#### 4.4.4 Layout

```
┌─ Greeting + Date ──────────────────────────────────────┐
├─ KPI Row ──────────────────────────────────────────────┤
│ [Pending Reviews] [Active Doctors] [Today's Appts]     │
│ [Clinic-wide Records] [Avg Completion Rate]            │
├─ Main Content (2/3) ──────────┬─ Right Panel (1/3) ───┤
│ Pending Review Queue (table)  │ Quick Actions          │
│ Doctor Utilization (grid)     │ Recent Activity        │
│ Clinical Quality Metrics      │ System Alerts          │
├─ Weekly Trends Chart (full width) ─────────────────────┤
```

**Key differences from Doctor Dashboard:**
- KPIs show clinic-wide metrics (not personal)
- Pending Review Queue replaces personal schedule as primary content
- Doctor Utilization grid shows all doctors' status at a glance
- Clinical Quality Metrics shows aggregate documentation stats

#### 4.4.5 Component Tree

```
DashboardLayout
├── GreetingHeader
├── KpiRow
│   ├── KpiCard ("Pending Reviews", count, clickable → pending plans)
│   ├── KpiCard ("Active Doctors", count, clickable → doctor list)
│   ├── KpiCard ("Today's Appointments", count, clickable → calendar)
│   ├── KpiCard ("Clinic-wide Records", count)
│   └── KpiCard ("Avg Completion Rate", percentage, trend indicator)
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── PendingReviewCard (treatment plans needing chief's approval)
│   │   │   ├── Table: Code, Patient, Doctor, Status, Created, Actions
│   │   │   ├── Click plan → treatment plan detail (review mode)
│   │   │   ├── Action: "Review" button → opens plan with approve/reject
│   │   │   └── Empty: "No pending reviews"
│   │   └── DoctorUtilizationCard
│   │       ├── Doctor grid list: Avatar, Name, Status, Today's Patients, Pending Records
│   │       ├── Status indicators: Available (green), Busy (blue), On Leave (amber)
│   │       ├── Click → doctor detail
│   │       └── Empty: "No doctors configured"
│   └── RightColumn
│       ├── QuickActionsCard
│       │   ├── ActionButton ("Review Plans")
│       │   ├── ActionButton ("View Schedule")
│       │   ├── ActionButton ("Doctor Performance")
│       │   └── ActionButton ("View Audit Log")
│       ├── RecentActivityCard (clinic-wide feed)
│       └── ClinicalMetricsCard
│           ├── Metric: Completed Records (count, period)
│           ├── Metric: Avg Documentation Time (days)
│           ├── Metric: Treatment Plan Completion Rate (%)
│           └── Metric: Pending Documentation (count)
└── WeeklyTrendsChart (appointment + procedure volume)
```

#### 4.4.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /treatment-plans/pending-review` | GET | Plans awaiting chief's review |
| `GET /treatment-plans/dashboard` | GET | Plan dashboard summary |
| `GET /doctors?page_size=100` | GET | All doctors for utilization view |
| `GET /appointments?date=today` | GET | Today's appointments count |
| `GET /patient-records?page_size=1` | GET | Total records count |

---

### 4.5 Assistant Dashboard

#### 4.5.1 Screen Purpose

**Business goal:** Support the dental assistant's workflow — preparing treatment rooms, managing patient transitions, and supporting doctors.
**User goal:** See the day's schedule from the assistant's perspective, manage chair readiness, and track patient flow.

#### 4.5.2 Route

`/` (redirect from `/assistant/dashboard`)

#### 4.5.3 Accessible Roles

`DENTAL_ASSISTANT`

#### 4.5.4 Backend Constraints

The backend currently restricts `DENTAL_ASSISTANT` access:
- **Can view:** Appointments (status, time, doctor), patient names and codes, doctor schedules
- **Cannot view:** Clinical records, treatment plan details, diagnoses, prescriptions
- **Dashboard scope:** Read-only appointment view, no patient data access

#### 4.5.5 Layout

```
┌─ Greeting + Date ──────────────────────────────────────┐
├─ KPI Row ──────────────────────────────────────────────┤
│ [Today's Appts] [In Treatment] [Room Prep Needed]      │
│ [Assigned Doctor's Patients]                            │
├─ Main Content (2/3) ──────────┬─ Right Panel (1/3) ───┤
│ Doctor Schedule Overview      │ Quick Actions          │
│ Today's Queue (compact)       │ Room Status            │
│                                │ Preparation Checklist  │
└──────────────────────────────────┴─────────────────────┘
```

#### 4.5.6 Component Tree

```
DashboardLayout
├── GreetingHeader
├── KpiRow
│   ├── KpiCard ("Today's Appointments", count)
│   ├── KpiCard ("In Treatment", count, blue)
│   ├── KpiCard ("Room Prep Needed", count, amber)
│   └── KpiCard ("Doctor's Patients", count)
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── DoctorScheduleOverview
│   │   │   ├── Mini schedule per doctor (time slots)
│   │   │   ├── Shows: Doctor Name, Current Patient, Next Patient, Room #
│   │   │   └── Status colors: Available, Busy, Preparing
│   │   └── TodayQueueTable (read-only)
│   │       ├── Columns: Time, Patient Name, Doctor, Status, Room
│   │       └── Status: Checked In, In Treatment, Prep Done, Completed
│   └── RightColumn
│       ├── QuickActionsCard
│       │   ├── ActionButton ("Prepare Room")
│       │   ├── ActionButton ("View Doctor Schedule")
│       │   └── ActionButton ("Mark Room Ready")
│       ├── RoomStatusCard
│       │   ├── Room item: Room #, Status (Ready/Occupied/Needs Cleaning)
│       │   └── Action: "Mark Ready" toggle per room
│       └── PreparationChecklistCard
│           ├── Item: Patient Name, Doctor, Required prep items
│           └── Checkbox per item
└── CompactWeekView
```

#### 4.5.7 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /appointments?date=today` | GET | Today's schedule (read-only) |
| `GET /doctors/availability` | GET | Doctor availability |

#### 4.5.8 States

**Empty:** "No appointments scheduled for today."
**Loading:** Skeleton for schedule blocks and queue.
**Error:** "Unable to load schedule. Please try again."

---

## 5. Patient Screens

### 5.1 Patient List Screen

#### 5.1.1 Screen Purpose

**Business goal:** Browse, search, and manage all patients in the system.
**User goal:** Find a patient quickly to view details, create records, or manage appointments.

#### 5.1.2 Route

`/patients`

#### 5.1.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 5.1.4 Page Layout

```
┌─ Page Header ──────────────────────────────────────────┐
│ "Patients"                    [+ Register Patient]     │
├─ Search & Filters ─────────────────────────────────────┤
│ [Search Input] [Status ▼] [Date Range ▼] [Filter]     │
├─ Data Table ───────────────────────────────────────────┤
│ Columns: Name, Code, DOB, Phone, Email, Status, Actions│
│ (sticky header, striped rows, pagination)              │
└─ Pagination ───────────────────────────────────────────┘
```

#### 5.1.5 Component Tree

```
Page
├── PageHeader
│   ├── Title ("Patients", h1)
│   ├── Breadcrumb ("Home > Patients")
│   └── PrimaryButton ("+ Register Patient", navigate → /patients/register)
├── SearchFilterBar
│   ├── SearchInput (debounced, placeholder "Search by name, code, phone...")
│   ├── StatusFilter (Dropdown: All, Active, Inactive)
│   ├── DateFilter (Date range: created from/to)
│   └── ClearFiltersButton (visible when filters active)
├── PatientTable
│   ├── TableHeader (sticky, sortable columns)
│   ├── TableBody (striped rows)
│   │   └── PatientRow (clickable → patient detail)
│   │       ├── Checkbox (bulk selection)
│   │       ├── Name + Avatar (initials)
│   │       ├── PatientCode (monospace)
│   │       ├── DOB (formatted)
│   │       ├── Phone (formatted)
│   │       ├── Email
│   │       ├── StatusBadge (Active/Inactive)
│   │       └── ActionsDropdown (View, Edit, Deactivate)
│   └── EmptyState (conditional)
├── BulkActionBar (visible when items selected)
│   ├── Text ("3 selected")
│   ├── Button ("Export Selected")
│   ├── Button ("Deactivate Selected")
│   └── Button ("Clear Selection")
├── Pagination
│   ├── PageInfo ("Showing 1-20 of 156 patients")
│   ├── PageButtons (Prev, 1, 2, 3, ..., Next)
│   └── PageSizeSelector (20, 50, 100)
└── RowCount (total count badge)
```

#### 5.1.6 Table Specification

| Column | Sortable | Filterable | Width | Sticky | Priority |
|--------|----------|------------|-------|--------|----------|
| ☐ (checkbox) | No | No | 40px | Yes | 1 (critical) |
| Patient Name | Yes | Yes (search) | 200px | Yes | 1 (critical) |
| Patient Code | Yes | Yes (search) | 140px | No | 2 (high) |
| DOB | Yes | No | 120px | No | 3 (medium) |
| Phone | No | No | 140px | No | 4 (low) |
| Email | No | No | 200px | No | 4 (low) |
| Status | Yes | Yes (dropdown) | 100px | No | 2 (high) |
| Actions | No | No | 80px | Yes | 1 (critical) |

**Bulk actions:** Export, Deactivate, Activate

**Empty state:** Illustration + "No patients found" + "Register your first patient" button

**Loading state:** Skeleton rows (6-8)

#### 5.1.7 Buttons & Actions

| Action | Type | Visibility | API Call |
|--------|------|-----------|----------|
| Register Patient | Button (primary) | All roles | Navigate → `/patients/register` |
| Search | Debounced input | Always | Client-side filter with API call |
| Filter by Status | Dropdown | Always | `?status=active` |
| View Patient | Row click / dropdown | All roles | Navigate → `/patients/:id` |
| Edit Patient | Dropdown | Admin, Receptionist | Navigate → `/patients/:id/edit` |
| Deactivate | Dropdown | Admin | `PATCH /patients/:id/deactivate` |

#### 5.1.8 API Integration

| Endpoint | Method | Query Params | Response |
|----------|--------|-------------|----------|
| `GET /patients` | GET | `page`, `size`, `sort_by`, `sort_order`, `status`, `search`, `created_from`, `created_to` | `PaginatedResponse<Patient[]>` |

**Patient response shape:**
```json
{
  "id": "uuid",
  "patient_code": "PAT-000001",
  "full_name": "Juan Dela Cruz",
  "date_of_birth": "1990-05-15",
  "gender": "male",
  "phone": "+639123456789",
  "email": "juan@example.com",
  "address": "123 Rizal St.",
  "status": "active",
  "created_at": "2026-07-18T10:30:00Z",
  "updated_at": "2026-07-18T10:30:00Z"
}
```

#### 5.1.9 State Management

- **Server State:** TanStack Query with `queryKeys.patients.all` and `queryKeys.patients.list(filters)`
- **Client State:** Filters (URL search params), pagination (URL params), selected rows (local state)
- **URL State:** `?page=1&size=20&status=active&search=juan`

#### 5.1.10 Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| ≥1280px | Full table, all columns visible |
| 1024-1279px | Hide Email, Phone columns |
| 768-1023px | Hide DOB, Email, Phone; horizontal scroll |
| <768px | Card layout instead of table; search collapsed to icon |

---

### 5.2 Create Patient Screen

#### 5.2.1 Screen Purpose

**Business goal:** Register a new patient in the system.
**User goal:** Enter patient demographic information quickly and accurately.

#### 5.2.2 Route

`/patients/register`

#### 5.2.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`

#### 5.2.4 Layout

Slide-out panel (preferred) or full-page form. The slide-out panel (480px, from right) is the default implementation to allow receptionists to register patients without losing context of the patient list.

#### 5.2.5 Component Tree

```
Drawer (or Page)
├── DrawerHeader ("Register New Patient" + Close button)
├── Form (react-hook-form + Zod)
│   ├── FormSection ("Personal Information")
│   │   ├── FormField (First Name) → Input
│   │   ├── FormField (Middle Name) → Input (optional)
│   │   ├── FormField (Last Name) → Input
│   │   ├── FormField (Date of Birth) → DatePicker
│   │   ├── FormField (Gender) → Select: Male, Female, Other
│   │   └── FormField (Blood Type) → Select: A+, A-, B+, B-, AB+, AB-, O+, O- (optional)
│   ├── FormSection ("Contact Information")
│   │   ├── FormField (Phone) → PhoneInput
│   │   ├── FormField (Email) → Input, optional
│   │   └── FormField (Address) → Textarea
│   ├── FormSection ("Emergency Contact")
│   │   ├── FormField (Emergency Contact Name) → Input
│   │   ├── FormField (Emergency Contact Phone) → PhoneInput
│   │   └── FormField (Relationship) → Input
│   ├── FormSection ("Medical Information")
│   │   ├── FormField (Medical History Notes) → Textarea (optional)
│   │   └── FormField (Allergies) → Textarea (optional)
│   └── DuplicateWarningDialog (conditional, shown on potential duplicate detected)
├── DrawerFooter
│   ├── Button ("Cancel", secondary, close drawer)
│   └── Button ("Register Patient", primary, submit)
└── SuccessToast (conditional, "Patient registered successfully")
```

#### 5.2.6 Field-Level Specification

| Field | Type | Required | Validation | Max |
|-------|------|----------|------------|-----|
| First Name | Text | Yes | 2+ chars, letters/hyphens/spaces | 100 |
| Middle Name | Text | No | Letters/hyphens/spaces | 100 |
| Last Name | Text | Yes | 2+ chars, letters/hyphens/spaces | 100 |
| Date of Birth | Date | Yes | Must be past date, not future | — |
| Gender | Select | Yes | One of: male, female, other | — |
| Phone | Phone | Yes | Valid phone format (E.164) | 20 |
| Email | Email | No | Valid email format | 255 |
| Address | Textarea | No | — | 500 |
| Emergency Contact Name | Text | No | — | 100 |
| Emergency Contact Phone | Phone | No | Valid phone format | 20 |
| Relationship | Text | No | — | 50 |

#### 5.2.7 Buttons & Actions

| Action | Type | Behavior |
|--------|------|----------|
| Register Patient | Submit (primary) | `POST /patients`, on success → toast + close drawer + invalidate list |
| Cancel | Button (secondary) | Close drawer, discard unsaved changes (with confirmation if dirty) |

#### 5.2.8 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /patients` | POST | `{ full_name, date_of_birth, gender, phone, ... }` |

**⚠️ Note:** The backend `POST /patients` expects `full_name` (single string), not separate first/middle/last name fields. The frontend should concatenate name parts before sending.

#### 5.2.9 Validation Rules

- **Duplicate detection (frontend):** After user types 3+ characters in name fields, debounced check against existing patients
- **Duplicate warning dialog:** Show dialog with matching patients if potential duplicates found
- **Inline validation on blur** for all fields

#### 5.2.10 States

**Loading:** Button spinner + "Registering..."

**Success:** Toast: "Patient registered successfully" → Close drawer → Invalidate patient list cache

**Error — Duplicate:** Dialog: "We found similar patients. Please verify this is not a duplicate."

**Error — Validation:** Inline field errors

**Error — API:** Alert banner: "Unable to register patient. Please try again."

---

### 5.3 Patient Detail Screen

#### 5.3.1 Screen Purpose

**Business goal:** View comprehensive patient information in one place — the central hub for all patient-related activities.
**User goal:** Access patient demographics, medical history, appointments, treatment plans, and records.

#### 5.3.2 Route

`/patients/:patientId`

#### 5.3.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 5.3.4 Page Layout

```
┌─ Patient Context Header (persistent, sticky) ────────┐
│ [Avatar] [Name] [Code] [DOB, Age] [Gender] [Status]  │
│ [+ New Record] [+ New Appt] [+ New Plan] [Actions ▼] │
├─ Tabs ────────────────────────────────────────────────┤
│ [Overview] [Timeline] [Records] [Treatment Plans]    │
│ [Appointments] [Medical History] [Documents] [Notes] │
├─ Tab Content ─────────────────────────────────────────┤
│ (Renders based on selected tab)                       │
└───────────────────────────────────────────────────────┘
```

#### 5.3.5 Component Tree

```
Page
├── PatientContextHeader (sticky)
│   ├── Avatar (56px, initials, color-generated)
│   ├── PatientIdentity
│   │   ├── Name (text-h3, bold)
│   │   ├── PatientCode (monospace, text-caption)
│   │   └── Demographics (DOB, Age, Gender — text-body-sm)
│   ├── StatusBadge
│   ├── ActionButtons
│   │   ├── Button ("+ New Record")
│   │   ├── Button ("+ New Appointment")
│   │   ├── Button ("+ New Plan")
│   │   └── DropdownMenu ("Edit", "Deactivate", "Delete")
│   └── QuickInfo (phone, email, address — condensed)
├── Tabs
│   ├── Tab ("Overview") → PatientOverviewPanel
│   │   ├── SummaryCards (age, last visit, total appointments, active plans)
│   │   ├── RecentActivity (last 5 events)
│   │   └── MedicalAlerts (allergies, conditions)
│   ├── Tab ("Timeline") → PatientTimeline (see 5.4)
│   ├── Tab ("Records") → RecordsList (see 8.1)
│   ├── Tab ("Treatment Plans") → TreatmentPlanList (see 9.1)
│   ├── Tab ("Appointments") → AppointmentList (see 7.5)
│   ├── Tab ("Medical History") → MedicalHistoryPanel
│   ├── Tab ("Documents") → DocumentList (attachments)
│   └── Tab ("Notes") → PatientNotesPanel
└── Lazy loading: Tabs load content on first activation
```

#### 5.3.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /patients/:id` | GET | Patient details |
| `GET /patients/:id/profile` | GET | Extended profile data |
| `GET /patients/:id/appointments` | GET | Patient appointments |
| `GET /patients/:id/treatment-plans` | GET | Patient treatment plans |
| `GET /patients/:id/timeline` | GET | Patient activity timeline |

#### 5.3.7 States

**Loading:** Skeleton for header + tabs.

**Error — 404:** "Patient not found" with back button.

**Error — 403:** "You do not have permission to view this patient."

---

### 5.4 Patient Timeline Tab

#### 5.4.1 Screen Purpose

**Business goal:** Chronological view of all patient activity.
**User goal:** See the complete history of interactions, records, and events for a patient.

#### 5.4.2 Component Tree

```
TimelinePanel
├── TimelineFilter
│   ├── DateRangePicker
│   ├── EventTypeFilter (All, Records, Appointments, Plans, Notes)
│   └── SortOrder (Newest first / Oldest first)
├── TimelineList
│   ├── TimelineItem (Record created) → Date, Type, Doctor, Summary
│   ├── TimelineItem (Appointment completed) → Date, Doctor, Procedure
│   ├── TimelineItem (Treatment plan created) → Date, Plan Code, Status
│   └── TimelineItem (Note added) → Date, Author, Preview
├── LoadMoreButton (pagination)
└── EmptyState ("No activity recorded")
```

#### 5.4.3 API Integration

| Endpoint | Method | Params |
|----------|--------|--------|
| `GET /patients/:id/timeline` | GET | `page`, `size`, `type`, `from_date`, `to_date` |

---

### 5.5 Edit Patient Screen

#### 5.5.1 Screen Purpose

**Business goal:** Update patient demographic information.
**User goal:** Correct or update patient details.

#### 5.5.2 Route

`/patients/:patientId/edit`

#### 5.5.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`

#### 5.5.4 Layout

Same form as Create Patient, pre-populated with existing data.

#### 5.5.5 Component Tree

```
Drawer (or Page)
├── DrawerHeader ("Edit Patient: {Name}")
├── Form (same fields as Create, pre-filled)
├── DrawerFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Save Changes", primary)
└── SuccessToast
```

#### 5.5.6 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `PATCH /patients/:id` | PATCH | `{ ...fields to update }` |

---

### 5.6 Merge Duplicate Patients (Future)

#### 5.6.1 Screen Purpose

**Business goal:** Merge duplicate patient records to maintain data integrity.
**User goal:** Combine two patient records into one.

#### 5.6.2 Route

`/patients/:patientId/merge`

#### 5.6.3 Accessible Roles

`ADMIN`

#### 5.6.4 Component Tree

```
MergePage
├── PageHeader ("Merge Duplicate Patients")
├── SourcePatientCard (patient to keep)
├── TargetPatientCard (patient to merge into source)
├── ComparisonTable
│   ├── Row: Field, Source Value, Target Value, Keep/Replace selector
│   └── For each conflicting field
├── MergePreview
├── ConfirmationDialog
└── SuccessToast
```

**Note:** This feature depends on backend merge endpoint (not yet implemented).

---

## 6. Doctor Screens

### 6.1 Doctor List Screen

#### 6.1.1 Screen Purpose

**Business goal:** Browse and manage all doctors in the system.
**User goal:** Find doctors, view profiles, manage schedules.

#### 6.1.2 Route

`/admin/doctors`

#### 6.1.3 Accessible Roles

`ADMIN`

#### 6.1.4 Layout

Similar to Patient List — table with search, filters, pagination.

#### 6.1.5 Component Tree

```
Page
├── PageHeader ("Doctors" + "Add Doctor" button)
├── SearchFilterBar
├── DoctorTable
│   ├── Columns: Name, Code, Specialization(s), Status, Phone, Email, Actions
│   ├── Row click → doctor detail
│   └── Status: Active (green), Inactive (gray), On Leave (amber)
├── Pagination
```

#### 6.1.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /doctors` | GET | List doctors |
| `GET /doctors/{id}` | GET | Doctor details |

---

### 6.2 Create Doctor Screen

#### 6.2.1 Screen Purpose

**Business goal:** Add a new doctor to the system.
**User goal:** Enter doctor credentials, specializations, and schedule.

#### 6.2.2 Route

`/admin/doctors/create`

#### 6.2.3 Accessible Roles

`ADMIN`

#### 6.2.4 Component Tree

```
Drawer (or Page)
├── DrawerHeader ("Add New Doctor")
├── Form
│   ├── FormSection ("Account Information")
│   │   ├── Full Name → Input
│   │   ├── Email → Input
│   │   └── Role → Select (preset to a doctor role)
│   ├── FormSection ("Professional Information")
│   │   ├── License Number → Input
│   │   ├── Specializations → MultiSelect
│   │   └── Bio → Textarea (optional)
│   ├── FormSection ("Schedule")
│   │   ├── Working Days → MultiSelect (Mon-Sat)
│   │   ├── Morning Hours → TimeRange (start-end)
│   │   └── Evening Hours → TimeRange (start-end)
│   └── FormSection ("Contact")
│       ├── Phone → Input
│       └── Address → Textarea
├── DrawerFooter (Cancel + Create)
```

#### 6.2.5 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /doctors` | POST | `{ full_name, email, specialization_ids, ... }` |

---

### 6.3 Doctor Detail Screen

#### 6.3.1 Screen Purpose

**Business goal:** View comprehensive doctor profile.
**User goal:** Access doctor information, schedule, performance.

#### 6.3.2 Route

`/admin/doctors/:doctorId`

#### 6.3.3 Layout

Similar to Patient Detail — header + tabs.

#### 6.3.4 Tabs

| Tab | Content |
|-----|---------|
| Overview | Profile summary, contact, status |
| Schedule | Weekly schedule grid, time slots |
| Appointments | Doctor's appointments list |
| Patients | Recent patients treated |
| Performance | Metrics (future) |

---

### 6.4 Doctor Schedule Screen

#### 6.4.1 Screen Purpose

**Business goal:** Manage doctor working hours and availability.
**User goal:** Set weekly schedule, mark days off, manage time slots.

#### 6.4.2 Route

`/admin/doctors/:doctorId/schedule` or `/admin/doctors/schedule`

#### 6.4.3 Component Tree

```
SchedulePage
├── PageHeader ("Doctor Schedule" + "Add Schedule" button)
├── WeekView
│   ├── DayColumn (Mon-Sat)
│   │   ├── Date header
│   │   ├── Morning Session (time slots)
│   │   ├── Break indicator
│   │   └── Evening Session (time slots)
│   └── Each slot is clickable → edit modal
├── DoctorSelector (dropdown to switch doctor)
└── ScheduleModal
    ├── Day selection
    ├── Time range (start, end)
    ├── Session type (morning, evening, full day)
    └── Notes (optional)
```

#### 6.4.4 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /doctors/{id}/schedule` | GET | Get doctor schedule |
| `POST /doctors/{id}/schedule` | POST | Create schedule entry |
| `PATCH /doctors/{id}/schedule/{schedule_id}` | PATCH | Update schedule entry |

---

## 7. Appointment Screens

### 7.1 Appointment Calendar Screen

#### 7.1.1 Screen Purpose

**Business goal:** Central appointment management — view, create, reschedule, and cancel appointments.
**User goal:** Manage the clinic's appointment schedule efficiently.

#### 7.1.2 Route

`/appointments`

#### 7.1.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 7.1.4 Page Layout

```
┌─ Page Header ───────────────────────────────────────────┐
│ "Appointments"                     [+ Book Appointment] │
├─ Calendar Toolbar ──────────────────────────────────────┤
│ [Today] [<] [July 18, 2026] [>]  [Day] [Week] [Month]  │
│ [Doctor ▼] [Status ▼] [Patient Search]                 │
├─ Calendar Content ──────────────────────────────────────┤
│ (View-switchable: Day / Week / Month)                   │
└─ AppointmentDetailPanel (slide-out, conditional) ───────┘
```

#### 7.1.5 Calendar Views

**Day View:**
```
┌─ Time slots (60px per hour, 15-min increments) ─┐
│ 09:00 ┌──────────────┐                           │
│       │ J. Cruz      │                           │
│ 09:30 │ Dr. Santos   │  Available slot           │
│       │ Check-up     │                           │
│ 10:00 ├──────────────┤ ┌──────────────────────┐  │
│       │              │ │ M. Reyes             │  │
│ 10:30 │              │ │ Dr. Patel            │  │
│       │              │ │ RCT #36              │  │
│ 11:00 └──────────────┘ └──────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**Week View:** 5-6 columns (Mon-Sat), rows for hours, appointments as colored blocks.

**Month View:** Calendar grid, each day shows dot + count of appointments. Click → day view.

#### 7.1.6 Appointments on Calendar

Each appointment block shows:
- Patient name (bold)
- Doctor name (if multi-doctor view)
- Procedure type (truncated)
- Duration indicator (height proportional to duration)
- Color coded by status

#### 7.1.7 Component Tree

```
Page
├── PageHeader ("Appointments" + "Book Appointment" button)
├── CalendarToolbar
│   ├── DateNavigation (Today button + prev/next arrows)
│   ├── DateDisplay (formatted date range)
│   ├── ViewToggle (Day, Week, Month buttons)
│   ├── DoctorFilter (dropdown, "All Doctors" or specific)
│   ├── StatusFilter (dropdown: All, Scheduled, Confirmed, Checked In, etc.)
│   └── PatientSearchInput
├── CalendarContent
│   ├── DayView (time-grid)
│   │   ├── TimeColumn (hour labels)
│   │   ├── DoctorColumns (one per selected doctor)
│   │   │   └── AppointmentBlock (draggable, clickable)
│   │   └── NowIndicator (red line at current time)
│   ├── WeekView (day columns + hour rows)
│   │   ├── DayHeaders (Mon-Sat with date)
│   │   └── AppointmentBlocks (colored by status)
│   └── MonthView (calendar grid)
│       ├── WeekRow × 4-6
│       │   └── DayCell (date number + appointment dots)
├── AppointmentDetailDrawer (slide-out on appointment click)
└── QuickCreateDrawer (slide-out for quick appointment booking)
```

#### 7.1.8 API Integration

| Endpoint | Method | Params |
|----------|--------|--------|
| `GET /appointments` | GET | `date`, `doctor_id`, `status`, `page`, `size` |
| `GET /appointments/today` | GET | Returns today's appointments |

#### 7.1.9 Interactions

- **Click empty slot:** Opens Create Appointment drawer (time pre-filled)
- **Click appointment:** Opens Appointment Detail drawer
- **Drag appointment:** Reschedule (change time slot)
- **Drop on different day:** Reschedule to different date
- **Ctrl+Click:** Quick-edit appointment duration

---

### 7.2 Create Appointment Screen

#### 7.2.1 Screen Purpose

**Business goal:** Book a new appointment for a patient.
**User goal:** Schedule a patient with a doctor at an available time.

#### 7.2.2 Route

Slide-out drawer from calendar page.

#### 7.2.3 Component Tree

```
Drawer
├── DrawerHeader ("Book Appointment")
├── Form
│   ├── FormField (Patient) → AutocompleteSearch (search by name/code)
│   ├── FormField (Doctor) → Select (filtered by available doctors)
│   ├── FormField (Date) → DatePicker (shows available days)
│   ├── FormField (Time) → TimeSlotPicker (shows available slots)
│   ├── FormField (Duration) → Select (15, 30, 45, 60 min)
│   ├── FormField (Procedure Type) → Select
│   ├── FormField (Notes) → Textarea (optional)
│   ├── ConflictWarning (shown if overlap detected)
│   └── PatientSummaryCard (shown when patient selected)
├── DrawerFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Book Appointment", primary)
```

#### 7.2.4 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /appointments` | POST | `{ patient_id, doctor_id, date, time, duration, notes }` |

#### 7.2.5 Conflict Detection

When doctor and time are selected, the system checks for conflicts:
- Same doctor, overlapping time → show inline warning: "Dr. Santos has an appointment at this time. Please choose another time or doctor."
- Patient already has an appointment at that time → warning

---

### 7.3 Appointment Detail Screen

#### 7.3.1 Screen Purpose

**Business goal:** View appointment details and perform actions.
**User goal:** See appointment information, check in patient, update status.

#### 7.3.2 Route

Slide-out drawer from calendar.

#### 7.3.3 Component Tree

```
Drawer
├── DrawerHeader ("Appointment Details" + Close)
├── StatusBadge (large, colored per status)
├── AppointmentInfo
│   ├── PatientCard (clickable → patient profile)
│   │   ├── Name, Code, DOB, Phone
│   │   └── "View Profile" link
│   ├── DoctorCard (clickable → doctor profile)
│   │   └── Name, Specialization
│   ├── DateTimeInfo
│   │   ├── Date (formatted)
│   │   ├── Time (start - end)
│   │   └── Duration
│   └── Notes (if any)
├── ActionButtons (role-gated, status-based)
│   ├── "Check In" (when status = scheduled/confirmed)
│   ├── "Start Treatment" (when status = checked_in)
│   ├── "Complete" (when status = in_treatment)
│   ├── "Reschedule" → reschedule flow
│   ├── "Cancel" → cancellation dialog
│   └── "No Show" → mark as no-show
├── StatusHistory (timeline of status changes)
└── RelatedLinks
    ├── "View Clinical Record" (if exists)
    └── "View Invoice" (if exists)
```

#### 7.3.4 Appointment Status Transitions

| Current Status | Next Actions |
|----------------|-------------|
| Scheduled | Check In, Cancel, Reschedule |
| Confirmed | Check In, Cancel, Reschedule |
| Checked In | Start Treatment, No Show |
| In Treatment | Complete |
| Completed | — (terminal) |
| Cancelled | — (terminal) |
| No Show | — (terminal) |

#### 7.3.5 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /appointments/{id}` | GET | Appointment details |
| `PUT /appointments/{id}` | PUT | Update appointment |
| `PATCH /appointments/{id}/cancel` | PATCH | Cancel appointment |
| `PATCH /appointments/{id}/check-in` | PATCH | Check in patient (future) |

---

### 7.4 Reschedule Appointment

#### 7.4.1 Screen Purpose

**Business goal:** Change an appointment's date/time.
**User goal:** Find a new available slot and update the appointment.

#### 7.4.2 Flow

1. Click "Reschedule" from Appointment Detail
2. Modal opens with current date/time pre-filled
3. Select new date → available time slots shown
4. Select new time
5. Reason for rescheduling (optional)
6. Confirm → `PUT /appointments/{id}` with new time

#### 7.4.3 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `PUT /appointments/{id}` | PUT | `{ date, time, duration, notes?, status? }` |
| `PATCH /appointments/{id}/cancel` | PATCH | Cancel appointment (no request body needed — or optional reason) |

#### 7.4.4 Appointment Status Flow

```
[Scheduled] ──→ [Confirmed] ──→ [Checked In] ──→ [In Treatment] ──→ [Completed]
      │               │                                            (terminal)
      ├── [Cancel]────┘
      │
      └── [Reschedule] ──→ Updates time, stays in Scheduled/Confirmed
```

**Note:** The backend does NOT have a dedicated check-in endpoint (`PATCH /appointments/{id}/check-in`). 
Check-in is performed by updating the appointment status via `PUT /appointments/{id}` with the new status value.

---

### 7.5 Patient Appointment List

#### 7.5.1 Screen Purpose

**Business goal:** View a specific patient's appointment history.
**User goal:** See past and upcoming appointments for a patient.

#### 7.5.2 Location

Tab on Patient Detail page.

#### 7.5.3 Component Tree

```
AppointmentTable
├── Columns: Date, Time, Doctor, Procedure, Status, Actions
├── Sortable by date (default: newest first)
├── Filterable by status
├── Actions: View Detail, Reschedule (if future), Cancel (if future)
└── Empty: "No appointments recorded for this patient."
```

---

---

### 7.5 Patient Appointment List

#### 7.5.1 Screen Purpose

**Business goal:** View a specific patient's appointment history.
**User goal:** See past and upcoming appointments for a patient.

#### 7.5.2 Location

Tab on Patient Detail page.

#### 7.5.3 Component Tree

```
AppointmentTable
├── Columns: Date, Time, Doctor, Procedure, Status, Actions
├── Sortable by date (default: newest first)
├── Filterable by status
├── Actions: View Detail, Reschedule (if future), Cancel (if future)
└── Empty: "No appointments recorded for this patient."
```

---

## 8. Clinical Records Screens

### 8.1 Clinical Record List

#### 8.1.1 Screen Purpose

**Business goal:** Browse clinical records for a specific patient or system-wide.
**User goal:** Find and access patient's clinical documentation.

#### 8.1.2 Route

- Patient-level: Tab on Patient Detail page: `/patients/:patientId?tab=records`
- System-wide: `/patient-records` (admin/doctor view)

#### 8.1.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.1.4 Backend Route Alignment

⚠️ **Important:** The backend API uses a flat route structure (not nested under patients):

| Backend Route | Purpose |
|---------------|---------|
| `GET /patient-records` | List records (filterable by `patient_id`, `status`, `is_finalized`, `search`) |
| `GET /patient-records/patient/{patient_id}` | List records for specific patient |
| `GET /patient-records/{record_id}` | Get single record detail |
| `GET /patient-records/appointment/{appointment_id}` | Get record by appointment |

#### 8.1.5 Component Tree

```
RecordsList
├── PageHeader ("Clinical Records" + "+ New Record" button)
├── RecordsToolbar
│   ├── SearchInput (search by chief complaint, clinical notes)
│   ├── PatientFilter (autocomplete — system-wide view only)
│   ├── DateRangeFilter
│   ├── StatusFilter (DRAFT, IN_PROGRESS, COMPLETED, LOCKED)
│   ├── FinalizedFilter (Yes/No/All)
│   └── DoctorFilter (which doctor created)
├── RecordsTable
│   ├── Columns: Date, Patient Name, Doctor, Chief Complaint, Status, Finalized, Actions
│   ├── Sortable by date
│   ├── Status badges: DRAFT (gray), IN_PROGRESS (blue), COMPLETED (green), LOCKED (purple)
│   ├── Finalized indicator: checkmark or lock icon
│   ├── Click → record detail
│   └── Actions: View, Edit (if not finalized), Delete (admin only)
├── Pagination
└── EmptyState ("No clinical records yet")
```

#### 8.1.6 API Integration

| Endpoint | Method | Params |
|----------|--------|--------|
| `GET /patient-records` | GET | `page`, `page_size`, `patient_id`, `status`, `is_finalized`, `search` |
| `GET /patient-records/patient/{patient_id}` | GET | `page`, `page_size` |

**Note:** Records are returned with summary fields: `id`, `status`, `is_finalized`, `chief_complaint`, `created_at`, `updated_at`, `diagnosis_count`, `prescription_count`, `attachment_count`, `followup_count`.

---

### 8.2 Clinical Record Detail

#### 8.2.1 Screen Purpose

**Business goal:** View a complete clinical record with all its components.
**User goal:** Read clinical notes, diagnoses, prescriptions, and follow-ups.

#### 8.2.2 Route

`/patient-records/:recordId`

#### 8.2.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`, `RECEPTIONIST`

#### 8.2.4 Layout

```
┌─ Record Header (sticky) ──────────────────────────────┐
│ [Patient Name] [Code] [Date] [Doctor] [Status] [Finalized]│
│ [Edit] [Finalize] [Add Diagnosis] [Add Prescription] [Print]│
├─ Record Content Tabs ─────────────────────────────────┤
│ [Clinical Info] [Diagnoses] [Prescriptions] [Attachments]│
│ [Follow-ups] [Audit Log]                                │
├─ Tab Content ──────────────────────────────────────────┤
│ (Renders based on selected tab)                         │
└───────────────────────────────────────────────────────┘
```

#### 8.2.5 Component Tree

```
Page
├── RecordHeader (sticky)
│   ├── PatientIdentity (name, code — clickable → patient detail)
│   ├── RecordMeta (date, doctor name)
│   ├── StatusBadge (DRAFT, IN_PROGRESS, COMPLETED, LOCKED)
│   ├── FinalizedIndicator (lock icon if finalized)
│   └── ActionButtons
│       ├── Button ("Edit", if not finalized)
│       ├── Button ("Finalize", if not finalized)
│       ├── Button ("Add Diagnosis")
│       ├── Button ("Add Prescription")
│       └── DropdownMenu ("Print", "Delete")
├── RecordTabs
│   ├── Tab ("Clinical Info") → ClinicalInfoPanel
│   │   ├── ChiefComplaint
│   │   ├── ClinicalNotes (rich text)
│   │   ├── DoctorRemarks
│   │   ├── TreatmentRecommendation
│   │   ├── SystemicDiseases
│   │   ├── Surgeries
│   │   ├── Medications
│   │   ├── Habits
│   │   ├── MedicalAlerts (highlighted)
│   │   ├── Allergies (highlighted with alert styling)
│   │   └── DentalHistory
│   ├── Tab ("Diagnoses") → DiagnosisSection (see 8.4)
│   ├── Tab ("Prescriptions") → PrescriptionSection (see 8.5)
│   ├── Tab ("Attachments") → AttachmentSection (see 8.6)
│   ├── Tab ("Follow-ups") → FollowupSection (see 8.7)
│   └── Tab ("Audit Log") → RecordAuditLog (see 8.8)
└── Lazy loading: Tabs load content on first activation
```

#### 8.2.6 Record Statuses (Backend-Aligned)

The backend uses four record statuses:

| Status | Meaning | Editable | Can Finalize |
|--------|---------|----------|-------------|
| `DRAFT` | Initial state, being documented | ✅ Yes | ✅ Yes |
| `IN_PROGRESS` | Active documentation in progress | ✅ Yes | ✅ Yes |
| `COMPLETED` | Documentation complete | ❌ No | ✅ Yes (if not finalized) |
| `LOCKED` | Finalized — immutable | ❌ No | ❌ No |

**Status transitions allowed:**
- `DRAFT → IN_PROGRESS`
- `DRAFT → COMPLETED`
- `IN_PROGRESS → DRAFT`
- `IN_PROGRESS → COMPLETED`
- `COMPLETED → IN_PROGRESS` (reopen)
- Any → `LOCKED` (via finalize) — one-way, irreversible

#### 8.2.7 Finalization Dialog

```
┌──────────────────────────────────────────────┐
│  ⚠️ Finalize Clinical Record                  │
│                                              │
│  Are you sure you want to finalize this      │
│  clinical record? This action cannot be      │
│  undone.                                     │
│                                              │
│  Type "CONFIRM" to proceed:                  │
│  [Input: must type CONFIRM]                  │
│                                              │
│  [Cancel]              [Finalize Record]     │
└──────────────────────────────────────────────┘
```

**⚠️ Note:** The backend finalize endpoint requires `{ "confirm": true }` (as a boolean, not text). The frontend must send this exact payload.

#### 8.2.8 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /patient-records/{record_id}` | GET | Record details with all nested entities (diagnoses, prescriptions, followups, attachments, audit_logs) |
| `PATCH /patient-records/{record_id}` | PATCH | Update record fields |
| `PATCH /patient-records/{record_id}/status?new_status=COMPLETED` | PATCH | Status transition |
| `POST /patient-records/{record_id}/finalize` | POST | **Finalize** — requires `{ "confirm": true }` body |
| `DELETE /patient-records/{record_id}` | DELETE | Soft-delete (admin only) |

#### 8.2.9 Record Response Shape

```json
{
  "id": "uuid",
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "status": "DRAFT",
  "is_finalized": false,
  "chief_complaint": "Pain in lower right molar",
  "clinical_notes": "Patient reports sensitivity...",
  "doctor_remarks": null,
  "treatment_recommendation": "RCT #36 recommended",
  "systemic_diseases": "None",
  "allergies": "Penicillin",
  "diagnoses": [],
  "prescriptions": [],
  "followups": [],
  "attachments": [],
  "audit_logs": [],
  "created_at": "2026-07-18T10:30:00Z",
  "updated_at": "2026-07-18T10:30:00Z"
}
```

---

### 8.3 Create Clinical Record

#### 8.3.1 Screen Purpose

**Business goal:** Document a clinical encounter.
**User goal:** Enter clinical notes for a patient visit.

#### 8.3.2 Route

`/patient-records/new?patient_id={patientId}&appointment_id={appointmentId}`

#### 8.3.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.3.4 Page Layout

Slide-out drawer (from patient detail) or full-page form.

#### 8.3.5 Component Tree

```
Drawer (or Page)
├── DrawerHeader ("New Clinical Record" + "— {Patient Name}")
├── Form (react-hook-form + Zod)
│   ├── FormSection ("Chief Complaint")
│   │   └── Textarea (max 5000 chars, placeholder "Describe the patient's primary complaint...")
│   ├── FormSection ("Clinical Notes")
│   │   └── Textarea (max 10000 chars, placeholder "Clinical examination findings...")
│   ├── FormSection ("Doctor Remarks")
│   │   └── Textarea (max 5000 chars)
│   ├── FormSection ("Treatment Recommendation")
│   │   └── Textarea (max 5000 chars)
│   ├── FormSection ("Medical History")
│   │   ├── SystemicDiseases → Textarea (optional, max 5000)
│   │   ├── Surgeries → Textarea (optional, max 5000)
│   │   ├── Medications → Textarea (optional, max 5000)
│   │   ├── Habits → Textarea (optional, max 5000)
│   │   └── DentalHistory → Textarea (optional, max 5000)
│   ├── FormSection ("Medical Alerts & Allergies")
│   │   ├── MedicalAlerts → Textarea (optional, max 5000)
│   │   └── Allergies → Textarea (optional, max 5000)
│   └── Hidden fields (patient_id, appointment_id — populated from URL params)
├── DrawerFooter
│   ├── Button ("Save as Draft", secondary)
│   ├── Button ("Cancel", ghost)
│   └── Button ("Save", primary)
└── SuccessToast
```

#### 8.3.6 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /patient-records` | POST | `{ patient_id, appointment_id, chief_complaint, clinical_notes, doctor_remarks, treatment_recommendation, systemic_diseases, surgeries, medications, habits, medical_alerts, allergies, dental_history }` |

#### 8.3.7 Save Behavior

- "Save as Draft": `POST /patient-records` (record defaults to DRAFT status)
- "Save": `POST /patient-records` (same endpoint)
- Diagnoses, prescriptions, and follow-ups are created **separately** after the record is created (see Sections 8.4–8.7)
- Autosave every 30 seconds while form has unsaved changes (future)

---

---

### 8.4 Diagnosis Management Section (Within Record Detail)

#### 8.4.1 Screen Purpose

**Business goal:** Manage diagnoses within a clinical record.
**User goal:** Add, view, update, and remove diagnoses tied to a patient encounter.

#### 8.4.2 Route

Tab on Record Detail page: `/patient-records/:recordId?tab=diagnoses`

**Backend routes:**
- `POST /patient-records/{record_id}/diagnoses` — Create
- `GET /patient-records/{record_id}/diagnoses` — List (paginated, filterable by type)
- `GET /diagnoses/{diagnosis_id}` — Detail
- `PATCH /diagnoses/{diagnosis_id}` — Update
- `DELETE /diagnoses/{diagnosis_id}` — Delete (soft-delete)

#### 8.4.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.4.4 Component Tree

```
DiagnosisSection
├── SectionHeader ("Diagnoses" + "+ Add Diagnosis" button — if not finalized)
├── DiagnosisFilter
│   ├── TypeFilter (All, PROVISIONAL, CONFIRMED)
│   └── SearchInput
├── DiagnosisList
│   ├── DiagnosisCard
│   │   ├── Type Badge (PROVISIONAL = amber, CONFIRMED = green)
│   │   ├── Description (text)
│   │   ├── Tooth Number (if applicable, FDI format)
│   │   ├── Notes
│   │   ├── Created by, Date
│   │   └── ActionsDropdown ("Edit", "Delete" — if not finalized)
│   └── Empty: "No diagnoses recorded"
├── CreateDiagnosisModal
│   ├── DiagnosisType → Select (PROVISIONAL / CONFIRMED)
│   ├── Description → Textarea (required, max 5000)
│   ├── ToothNumber → Input (optional, FDI format: 11-48, 51-85)
│   ├── Notes → Textarea (optional)
│   └── Footer: Cancel + Save
└── EditDiagnosisModal (same fields, pre-filled)
    └── Footer: Cancel + Update
```

#### 8.4.5 API Integration

| Endpoint | Method | Request/Params |
|----------|--------|----------------|
| `POST /patient-records/{record_id}/diagnoses` | POST | `{ diagnosis_type, description, tooth_number?, notes? }` |
| `PATCH /diagnoses/{diagnosis_id}` | PATCH | Partial update of mutable fields |
| `DELETE /diagnoses/{diagnosis_id}` | DELETE | Soft-delete |

#### 8.4.6 Validation Rules

- Description required (max 5000 chars)
- Tooth number (if provided): must be valid FDI (11-48, 51-85)
- Diagnosis type required: PROVISIONAL or CONFIRMED
- Cannot modify if parent record is finalized

---

### 8.5 Prescription Management Section (Within Record Detail)

#### 8.5.1 Screen Purpose

**Business goal:** Manage prescriptions within a clinical record.
**User goal:** Prescribe medications with dosage, frequency, and duration.

#### 8.5.2 Route

Tab on Record Detail page: `/patient-records/:recordId?tab=prescriptions`

**Backend routes:**
- `POST /patient-records/{record_id}/prescriptions` — Create (with items)
- `GET /patient-records/{record_id}/prescriptions` — List
- `GET /prescriptions/{prescription_id}` — Detail
- `PATCH /prescriptions/{prescription_id}` — Update notes only
- `DELETE /prescriptions/{prescription_id}` — Delete (soft-delete)
- `POST /patient-records/{record_id}/prescriptions/{prescription_id}/items` — Add item
- `POST /patient-records/{record_id}/prescriptions/{prescription_id}/items/batch` — Batch add items
- `GET /patient-records/{record_id}/prescriptions/{prescription_id}/items` — List items
- `DELETE /prescription-items/{item_id}` — Delete item

#### 8.5.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.5.4 Component Tree

```
PrescriptionSection
├── SectionHeader ("Prescriptions" + "+ New Prescription" button — if not finalized)
├── PrescriptionList
│   ├── PrescriptionCard
│   │   ├── PrescribedBy (doctor name)
│   │   ├── Date
│   │   ├── Notes
│   │   ├── ItemsList
│   │   │   ├── PrescriptionItemRow
│   │   │   │   ├── Medicine Name
│   │   │   │   ├── Dosage (e.g., "500mg")
│   │   │   │   ├── Frequency (e.g., "3x daily")
│   │   │   │   ├── Duration (e.g., "7 days")
│   │   │   │   ├── Notes
│   │   │   │   └── RemoveButton (if editable)
│   │   │   └── Empty: "No items"
│   │   └── ActionsDropdown ("Edit", "Delete")
│   └── Empty: "No prescriptions recorded"
├── CreatePrescriptionModal
│   ├── Prescription Notes → Textarea (optional)
│   ├── FormSection ("Medicine Items")
│   │   ├── MedicineItemRow × N
│   │   │   ├── MedicineName → Input (required)
│   │   │   ├── Dosage → Input (required)
│   │   │   ├── Frequency → Select (1x, 2x, 3x daily, etc.)
│   │   │   ├── Duration → Input (required)
│   │   │   ├── DurationUnit → Select (days, weeks, months)
│   │   │   ├── Notes → Input (optional)
│   │   │   └── RemoveButton
│   │   └── "+ Add Medicine" button
│   └── Footer: Cancel + Create
└── EditPrescriptionModal (notes only — items managed separately)
```

#### 8.5.5 API Integration

| Endpoint | Method | Request/Params |
|----------|--------|----------------|
| `POST /patient-records/{record_id}/prescriptions` | POST | `{ notes?, items: [{ medicine_name, dosage, frequency, duration, duration_unit, notes? }] }` |
| `PATCH /prescriptions/{prescription_id}` | PATCH | `{ notes? }` — only notes mutable |
| `DELETE /prescriptions/{prescription_id}` | DELETE | Soft-delete |

#### 8.5.6 Validation Rules

- At least 1 medicine item required
- Medicine name required
- Dosage required
- Duration required
- Cannot modify if parent record is finalized

---

### 8.6 Attachment Management Section (Within Record Detail)

#### 8.6.1 Screen Purpose

**Business goal:** Manage file attachments within a clinical record.
**User goal:** Upload, view, and delete X-rays, documents, and images.

#### 8.6.2 Route

Tab on Record Detail page: `/patient-records/:recordId?tab=attachments`

**Backend routes:**
- `POST /patient-records/{record_id}/attachments` — Upload
- `GET /patient-records/{record_id}/attachments` — List
- `GET /attachments/{attachment_id}` — Detail
- `PATCH /attachments/{attachment_id}` — Update metadata
- `DELETE /attachments/{attachment_id}` — Delete (soft-delete)

#### 8.6.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.6.4 Component Tree

```
AttachmentSection
├── SectionHeader ("Attachments" + "+ Upload" button — if not finalized)
├── AttachmentGrid (or List)
│   ├── AttachmentCard
│   │   ├── FileIcon (based on MIME type: image, document, video)
│   │   ├── FileName
│   │   ├── FileType
│   │   ├── FileSize (formatted)
│   │   ├── UploadedBy, Date
│   │   ├── ViewButton → opens file in new tab / download
│   │   └── DeleteButton (if not finalized)
│   └── Empty: "No attachments uploaded"
├── UploadAttachmentModal
│   ├── FileUpload (drag-and-drop, click to browse)
│   │   ├── Supported types: images (JPEG, PNG), documents (PDF, DOC), limited video
│   │   ├── Max file size: 50 MB
│   │   └── Multiple file upload supported
│   └── Footer: Cancel + Upload
└── FilePreview (modal, for images/PDFs)
```

#### 8.6.5 API Integration

| Endpoint | Method | Request/Params |
|----------|--------|----------------|
| `POST /patient-records/{record_id}/attachments` | POST | Multipart form: file + metadata |
| `DELETE /attachments/{attachment_id}` | DELETE | Soft-delete |

#### 8.6.6 Validation Rules

- Max file size: 50 MB
- Allowed MIME types: image/jpeg, image/png, application/pdf, etc.
- Cannot upload if parent record is finalized

---

### 8.7 Follow-up Management Section (Within Record Detail)

#### 8.7.1 Screen Purpose

**Business goal:** Schedule follow-up appointments within a clinical record.
**User goal:** Set follow-up dates and notes for patient return visits.

#### 8.7.2 Route

Tab on Record Detail page: `/patient-records/:recordId?tab=followups`

**Backend routes:**
- `POST /patient-records/{record_id}/followups` — Create
- `GET /patient-records/{record_id}/followups` — List
- `GET /followups/upcoming` — Upcoming follow-ups (system-wide)
- `GET /followups/{followup_id}` — Detail
- `PATCH /followups/{followup_id}` — Update
- `DELETE /followups/{followup_id}` — Delete (soft-delete)

#### 8.7.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 8.7.4 Component Tree

```
FollowupSection
├── SectionHeader ("Follow-ups" + "+ Schedule Follow-up" button — if not finalized)
├── FollowupList
│   ├── FollowupCard
│   │   ├── Date (formatted, highlighted if upcoming)
│   │   ├── Notes
│   │   ├── Status (Scheduled, Completed, Cancelled)
│   │   ├── Created by, Date
│   │   └── ActionsDropdown ("Edit", "Mark Completed", "Delete")
│   └── Empty: "No follow-ups scheduled"
├── CreateFollowupModal
│   ├── FollowUpDate → DatePicker (required, must be today or future)
│   ├── Notes → Textarea (optional)
│   └── Footer: Cancel + Schedule
└── EditFollowupModal (same fields, pre-filled)
    └── Footer: Cancel + Update
```

#### 8.7.5 API Integration

| Endpoint | Method | Request/Params |
|----------|--------|----------------|
| `POST /patient-records/{record_id}/followups` | POST | `{ followup_date, notes? }` |
| `PATCH /followups/{followup_id}` | PATCH | Partial update |
| `DELETE /followups/{followup_id}` | DELETE | Soft-delete |

#### 8.7.6 Validation Rules

- Follow-up date must be today or a future date
- Cannot modify if parent record is finalized

---

### 8.8 Record Audit Log Section (Within Record Detail)

#### 8.8.1 Screen Purpose

**Business goal:** View the audit trail for a specific clinical record.
**User goal:** See who created, updated, or finalized the record and when.

#### 8.8.2 Route

Tab on Record Detail page: `/patient-records/:recordId?tab=audit`

**Backend routes:**
- `GET /patient-records/{record_id}/audit` — List audit entries for record
- `GET /audit/{audit_id}` — Single audit entry
- `GET /audit/user/{user_id}` — Audit entries by user

#### 8.8.3 Component Tree

```
AuditSection
├── SectionHeader ("Audit Log")
├── AuditTimeline
│   ├── AuditItem
│   │   ├── Action (Created, Updated, Status Changed, Finalized, etc.)
│   │   ├── Actor (user name)
│   │   ├── Timestamp (formatted)
│   │   ├── Changes Summary (what fields changed, old → new values)
│   │   └── Metadata (IP address if available)
│   └── Empty: "No audit records"
└── LoadMoreButton (pagination)
```

---

### 8.9 Medical History Section

#### 8.9.1 Screen Purpose

**Business goal:** View and manage patient's medical history (aggregated across all records).
**User goal:** See allergies, chronic conditions, past surgeries, medications.

#### 8.9.2 Route

Tab on Patient Detail page.

#### 8.9.3 Component Tree

```
MedicalHistoryPanel
├── MedicalAlertsCard
│   ├── AlertItem (Critical: Penicillin allergy)
│   │   ├── Severity indicator (Critical = red, High = amber)
│   │   ├── Description
│   │   └── Date recorded / Source record link
│   └── Empty: "No medical alerts"
├── ChronicConditionsCard
│   ├── ConditionItem (Diabetes, Hypertension, etc.)
│   │   ├── Name, Status, Notes
│   │   └── "View Records" link → patient records with relevant info
│   └── Empty: "No chronic conditions recorded"
├── PastSurgeriesCard
│   ├── SurgeryItem (Date, Procedure, Notes)
│   └── Empty: "No past surgeries"
└── CurrentMedicationsCard
    ├── MedicationItem (Name, Dosage, Frequency, Prescribed by)
    └── Empty: "No current medications"
```

#### 8.9.4 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /patient-records/patient/{patient_id}` | GET | Fetch all records to aggregate medical history |

---

## 9. Treatment Plan Screens

### 9.1 Treatment Plan List Screen

#### 9.1.1 Screen Purpose

**Business goal:** Browse all treatment plans — searchable, filterable list.
**User goal:** Find a specific plan, view dashboard statistics, monitor plan statuses.

#### 9.1.2 Route

`/treatment-plans`

#### 9.1.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 9.1.4 Page Layout

```
┌─ Page Header ────────────────────────────────────────────┐
│ "Treatment Plans"             [+ Create Treatment Plan]  │
├─ Dashboard Strips ───────────────────────────────────────┤
│ [Total] [Draft] [Proposed] [Accepted] [In Progress] [Completed]│
├─ Search & Filters ───────────────────────────────────────┤
│ [Search] [Status ▼] [Doctor ▼] [Patient Search] [Date ▼]│
├─ Data Table ─────────────────────────────────────────────┤
│ Columns: Code, Patient, Doctor, Status, Items, Total, ▼ │
└─ Pagination ─────────────────────────────────────────────┘
```

#### 9.1.5 Component Tree

```
Page
├── PageHeader ("Treatment Plans" + "Create Plan" button)
├── DashboardStatsRow
│   ├── StatCard ("Total Plans", count)
│   ├── StatCard ("Draft", count, gray)
│   ├── StatCard ("Under Review", count, amber)
│   ├── StatCard ("Proposed", count, amber)
│   ├── StatCard ("Accepted", count, blue)
│   ├── StatCard ("In Progress", count, green)
│   ├── StatCard ("Completed", count, green)
│   ├── StatCard ("Pending Acknowledgment", count, amber)
│   └── StatCard ("Active Plans", count, blue)
├── SearchFilterBar
│   ├── SearchInput (search by code, patient name)
│   ├── StatusFilter (multi-select)
│   ├── DoctorFilter (dropdown)
│   ├── PatientPicker (autocomplete)
│   └── DateRangeFilter
├── TreatmentPlanTable
│   ├── Columns: Code, Patient, Doctor, Status, Items, Total (₱), Created, Actions
│   ├── Sortable: Code, Patient, Status, Created, Total
│   ├── Status badge: color-coded per status
│   ├── Progress bar for IN_PROGRESS plans
│   ├── Row click → plan detail
│   └── Actions: View, Edit (if draft), Delete (if draft)
├── Pagination
└── EmptyState
```

#### 9.1.6 Table Specification

| Column | Sortable | Filterable | Width | Priority |
|--------|----------|------------|-------|----------|
| Plan Code | Yes | Yes (search) | 140px | 1 (critical) |
| Patient | Yes | Yes (search) | 200px | 1 (critical) |
| Doctor | Yes | Yes (dropdown) | 150px | 2 (high) |
| Status | Yes | Yes (badge filter) | 120px | 1 (critical) |
| Items | No | No | 80px | 3 (medium) |
| Total (₱) | Yes | No | 120px | 3 (medium) |
| Created | Yes | Yes (date) | 120px | 4 (low) |
| Actions | No | No | 80px | 2 (high) |

**Empty state:** "No treatment plans found. Create your first treatment plan to get started." + [Create Plan] button.

#### 9.1.7 API Integration

| Endpoint | Method | Params | Purpose |
|----------|--------|--------|---------|
| `GET /treatment-plans` | GET | `page, size, sort_by, sort_order, status, search, doctor_id` | List plans |
| `GET /treatment-plans/search` | GET | `q` | Search plans |
| `GET /treatment-plans/count-by-status` | GET | — | Dashboard stats |
| `GET /treatment-plans/dashboard` | GET | — | Dashboard summary |

---

### 9.2 Create Treatment Plan Screen

#### 9.2.1 Screen Purpose

**Business goal:** Create a new treatment plan for a patient.
**User goal:** Add procedures, set costs, and initiate the treatment planning workflow.

#### 9.2.2 Route

`/treatment-plans/create`

#### 9.2.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 9.2.4 Layout

Multi-step wizard:

```
Step 1: Patient & Doctor Selection
Step 2: Add Procedure Items
Step 3: Review & Cost Summary
Step 4: Confirm & Create
```

#### 9.2.5 Component Tree

```
WizardPage
├── WizardStepper (4 steps, horizontal)
├── StepContent
│   ├── Step 1: PatientDoctorSelection
│   │   ├── PatientPicker (autocomplete, search by name/code)
│   │   ├── DoctorPicker (autocomplete)
│   │   └── PlanNotes → Textarea (optional)
│   ├── Step 2: ProcedureItems
│   │   ├── ProcedureSearch (autocomplete from procedure catalog)
│   │   ├── AddedItemsList
│   │   │   ├── ItemRow
│   │   │   │   ├── Procedure Name
│   │   │   │   ├── Tooth Number → Input (FDI format: 11-48, 51-85)
│   │   │   │   ├── Surface Code → Input (M/D/B/L/O/I)
│   │   │   │   ├── Quantity → NumberInput
│   │   │   │   ├── Unit Price → CurrencyInput (auto-filled from catalog, editable)
│   │   │   │   ├── Line Total → Calculated (read-only)
│   │   │   │   └── RemoveButton
│   │   │   └── Empty: "No items added yet. Search procedures above."
│   │   └── Subtotal Display (calculated in real-time)
│   ├── Step 3: ReviewSummary
│   │   ├── PlanSummaryCard (patient, doctor, notes)
│   │   ├── ItemsTable (read-only, all added items)
│   │   │   ├── Columns: #, Procedure, Tooth, Surface, Qty, Unit Price, Total
│   │   │   └── Subtotal, Discount (if applicable), Grand Total
│   │   └── Notes → Textarea (editable)
│   └── Step 4: Confirmation
│       ├── SuccessAnimation (checkmark)
│       ├── PlanCode display (auto-generated)
│       ├── Status: DRAFT
│       └── Actions: "View Plan" or "Go to Plans List"
└── WizardFooter
    ├── Button ("Back", secondary) — hidden on step 1
    ├── Button ("Cancel", ghost)
    └── Button ("Next Step" / "Create Plan", primary)
```

#### 9.2.6 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /treatment-plans` | POST | `{ patient_id, doctor_id, notes, items: [{ procedure_id, tooth_number?, surface_code?, quantity, unit_price }] }` |

#### 9.2.7 Validation Rules

- At least 1 procedure item required
- Tooth number (if provided): must be valid FDI format (11-48, 51-85)
- Surface code (if provided): must be valid (M/D/B/L/O/I)
- Quantity must be ≥ 1
- Unit price must be ≥ 0
- Patient and doctor are required

#### 9.2.8 States

**Loading on create:** Button spinner + "Creating plan..."

**Success:** Green checkmark animation, plan code displayed, redirect options.

**Error — Validation:** Inline errors on specific fields.

**Error — Duplicate tooth:** "Item for tooth #36 already exists in this plan."

---

### 9.3 Treatment Plan Detail Screen

#### 9.3.1 Screen Purpose

**Business goal:** Full view of a treatment plan with its workflow, items, versions, and approvals.
**User goal:** Review, edit, approve, and manage the plan through its lifecycle.

#### 9.3.2 Route

`/treatment-plans/:planId`

#### 9.3.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 9.3.4 Page Layout

```
┌─ Plan Header (sticky) ─────────────────────────────────┐
│ [Code] [Status Badge] [Patient Name] [Doctor Name]    │
│ [Total: ₱XX,XXX]                                       │
├─ Workflow Progress Bar ────────────────────────────────┤
│ Draft → Under Review → Proposed → Accepted → ...      │
├─ Tabs ─────────────────────────────────────────────────┤
│ [Items] [Workflow] [Versions] [Approvals]              │
├─ Tab Content ──────────────────────────────────────────┤
└─ Action Bar (sticky bottom) ──────────────────────────┘
│ [Submit for Review] [Approve] [Cancel] [etc.]          │
```

#### 9.3.5 Component Tree

```
Page
├── PlanHeader (sticky)
│   ├── PlanCode (monospace, large)
│   ├── StatusBadge (color-coded per status)
│   ├── PatientLink (clickable → patient detail)
│   ├── DoctorLink (clickable → doctor detail)
│   ├── GrandTotal (formatted currency)
│   └── CreatedDate
├── WorkflowProgressBar
│   ├── Steps: Draft → Under Review → Proposed → Accepted → In Progress → On Hold → Completed
│   ├── Current step highlighted
│   ├── Completed steps show checkmark
│   └── Rejected steps show X (from Under Review → Draft loop)
├── Tabs
│   ├── Tab ("Items") → ItemsPanel
│   │   ├── ItemsTable (read-only)
│   │   │   ├── Columns: #, Procedure, Tooth, Surface, Qty, Unit Price, Total, Status
│   │   │   └── Item status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED, DEFERRED
│   │   └── AddItemButton (if plan is DRAFT status)
│   ├── Tab ("Workflow") → WorkflowPanel
│   │   ├── StateMachineDiagram (visual — current state + possible transitions)
│   │   ├── TransitionHistory (timeline of status changes)
│   │   └── ActionsForCurrentState (buttons for allowed transitions)
│   ├── Tab ("Versions") → VersionsPanel
│   │   ├── VersionList (timeline)
│   │   │   ├── VersionNumber, Created, CreatedBy, Changes summary
│   │   │   ├── Click → version detail (diff view)
│   │   │   └── Action: "Restore Version" (with confirmation)
│   │   ├── CreateVersionButton (if plan is DRAFT)
│   │   └── Empty: "No versions yet"
│   └── Tab ("Approvals") → ApprovalsPanel
│       ├── DoctorApprovalCard
│       │   ├── Status (Approved/Not Approved)
│       │   ├── Approved by, Date
│       │   └── RevokeButton (if approved)
│       ├── PatientAcknowledgmentCard
│       │   ├── Status (Accepted/Declined/Pending)
│       │   ├── Date, Notes
│       │   └── Detail link
│       └── Empty: "No approvals recorded"
└── ActionBar (sticky bottom, buttons change based on status)
    ├── Status: DRAFT → [Submit for Review] [Add Items] [Edit]
    ├── Status: UNDER_REVIEW → [Approve Review] [Reject Review]
    ├── Status: PROPOSED → [Accept] [Decline] [Cancel]
    ├── Status: ACCEPTED → [Start Treatment]
    ├── Status: IN_PROGRESS → [Complete] [Hold] [Cancel]
    ├── Status: ON_HOLD → [Resume] [Cancel]
    └── Always: [Doctor Approve] [Doctor Revoke] [Patient Acknowledge]
```

#### 9.3.6 State Machine Transitions

| From | To | Action |
|------|----|--------|
| DRAFT | UNDER_REVIEW | Submit for Review |
| UNDER_REVIEW | DRAFT | Reject Review |
| UNDER_REVIEW | PROPOSED | Approve Review |
| PROPOSED | ACCEPTED | Accept |
| PROPOSED | CANCELLED | Decline |
| ACCEPTED | IN_PROGRESS | Start Treatment |
| IN_PROGRESS | ON_HOLD | Hold |
| ON_HOLD | IN_PROGRESS | Resume |
| IN_PROGRESS | COMPLETED | Complete |
| Any (non-terminal) | CANCELLED | Cancel |

#### 9.3.7 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /treatment-plans/{id}` | GET | Plan details |
| `POST /treatment-plans/{id}/submit-for-review` | POST | Status transition |
| `POST /treatment-plans/{id}/approve-review` | POST | Status transition |
| `POST /treatment-plans/{id}/reject-review` | POST | Status transition |
| `POST /treatment-plans/{id}/accept` | POST | Status transition |
| `POST /treatment-plans/{id}/decline` | POST | Status transition |
| `POST /treatment-plans/{id}/cancel` | POST | Status transition |
| `POST /treatment-plans/{id}/start-treatment` | POST | Status transition |
| `POST /treatment-plans/{id}/hold` | POST | Status transition |
| `POST /treatment-plans/{id}/resume` | POST | Status transition |
| `POST /treatment-plans/{id}/complete` | POST | Status transition |
| `POST /treatment-plans/{id}/doctor-approve` | POST | Approval action |
| `POST /treatment-plans/{id}/doctor-revoke` | POST | Approval action |
| `POST /treatment-plans/{id}/patient-acknowledge` | POST | Patient action |
| `POST /treatment-plans/{id}/patient-decline` | POST | Patient action |
| `GET /treatment-plans/{id}/versions` | GET | Version history |
| `GET /treatment-plans/{id}/versions/{version_id}` | GET | Version detail |

#### 9.3.8 Confirmation Dialogs

**Cancel Plan:**
```
┌──────────────────────────────────────────────┐
│  ⚠️ Cancel Treatment Plan                     │
│                                              │
│  Are you sure you want to cancel             │
│  TXN-0042? This action cannot be undone.     │
│                                              │
│  Reason for cancellation:                    │
│  [Textarea: required]                        │
│                                              │
│  [No, Keep Plan]       [Yes, Cancel Plan]    │
└──────────────────────────────────────────────┘
```

**Complete Plan:**
```
┌──────────────────────────────────────────────┐
│  ✅ Complete Treatment Plan                   │
│                                              │
│  Mark TXN-0042 as completed? All items       │
│  must be completed or cancelled.             │
│                                              │
│  [Cancel]              [Complete Plan]        │
└──────────────────────────────────────────────┘
```

---

### 9.4 Procedure Catalog Screen

#### 9.4.1 Screen Purpose

**Business goal:** Manage the master list of dental procedures.
**User goal:** Browse, search, create, edit, and activate/deactivate procedures.

#### 9.4.2 Route

`/procedures`

#### 9.4.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR` (full access), other doctors (read-only)

#### 9.4.4 Layout

Same pattern as Patient List — table with search, filters, create/edit actions.

#### 9.4.5 Component Tree

```
Page
├── PageHeader ("Procedure Catalog" + "Add Procedure" button — Admin only)
├── SearchFilterBar
│   ├── SearchInput (search by name, code, category)
│   ├── CategoryFilter (dropdown: Diagnostic, Preventive, Restorative, etc.)
│   └── StatusFilter (Active/Inactive)
├── ProcedureTable
│   ├── Columns: Code, Name, Category, Default Price, Duration (min), Active, Actions
│   ├── Row click → procedure detail (optional modal)
│   └── Actions: Edit, Activate/Deactivate
├── Pagination
└── CreateEditModal
    ├── Code → Input (auto-generated from category prefix)
    ├── Name → Input
    ├── Category → Select
    ├── Description → Textarea (optional)
    ├── Default Price → CurrencyInput
    ├── Default Duration → NumberInput (minutes)
    ├── Required Tooth Number → Checkbox (if procedure needs tooth #)
    ├── Active → Switch
    └── Footer: Cancel + Save
```

#### 9.4.6 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /procedures` | GET | List procedures |
| `GET /procedures/active` | GET | Active only |
| `GET /procedures/count` | GET | Count by category |
| `GET /procedures/{id}` | GET | Procedure detail |
| `POST /procedures` | POST | Create procedure |
| `PATCH /procedures/{id}` | PATCH | Update procedure |
| `PATCH /procedures/{id}/activate` | PATCH | Activate |
| `PATCH /procedures/{id}/deactivate` | PATCH | Deactivate |
| `DELETE /procedures/{id}` | DELETE | Delete procedure |

---

### 9.5 Treatment Plan — Version Diff Screen

#### 9.5.1 Screen Purpose

**Business goal:** Compare two versions of a treatment plan to see what changed.
**User goal:** Review modifications between versions before restoring or approving.

#### 9.5.2 Route

`/treatment-plans/:planId/versions/:versionId/diff`

Accessible from Version History tab by clicking "Compare" on any two versions.

#### 9.5.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`

#### 9.5.4 Component Tree

```
Modal (or Page)
├── VersionDiffHeader
│   ├── Title: "Version Comparison"
│   ├── VersionSelector (From: v1, To: v2 — dropdowns)
│   └── CloseButton
├── DiffSummary
│   ├── Stat: "3 items changed"
│   ├── Stat: "2 items added"
│   ├── Stat: "1 item removed"
│   └── Stat: "Total cost changed: ₱12,500 → ₱14,800 (+₱2,300)"
├── ItemsDiffList
│   ├── DiffItem
│   │   ├── StatusBadge (Added = green, Removed = red, Modified = amber)
│   │   ├── Procedure Name
│   │   ├── Tooth Number (if changed, show old → new)
│   │   ├── Estimated Cost (if changed, show old → new with +/-)
│   │   └── Notes (if changed, show old → new)
│   └── Empty: "No differences between versions"
├── CostComparisonCard
│   ├── Old Total, New Total, Difference
│   └── Change breakdown
└── ActionBar
    ├── Button ("Restore to Version", primary)
    └── Button ("Close", secondary)
```

#### 9.5.5 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /treatment-plans/{plan_id}/versions/{version_id}` | GET | Get version detail with items snapshot |
| `GET /treatment-plans/{plan_id}` | GET | Get current plan items for comparison |
| `POST /treatment-plans/{plan_id}/versions/{version_id}/restore` | POST | Restore to a previous version |

#### 9.5.6 States

**Loading:** Skeleton for diff list and cost card.
**Empty (identical):** "Versions are identical" with checkmark.
**Error:** "Unable to load version data" with retry.

---

## 10. Billing & Invoicing Screens

### 10.1 Invoice List Screen

#### 10.1.1 Screen Purpose

**Business goal:** Browse and manage all invoices.
**User goal:** Find invoices, view status, issue, cancel, or process payments.

#### 10.1.2 Route

`/billing/invoices`

#### 10.1.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR` (read-only), Doctors (own patients)

#### 10.1.4 Page Layout

```
┌─ Page Header ───────────────────────────────────────────┐
│ "Invoices"                         [+ Create Invoice]   │
├─ Dashboard Strips ──────────────────────────────────────┤
│ [Total] [Draft] [Issued] [Partially Paid] [Paid] [Overdue]│
├─ Search & Filters ──────────────────────────────────────┤
│ [Search] [Status ▼] [Patient ▼] [Date Range ▼]         │
├─ Data Table ────────────────────────────────────────────┤
│ Columns: Invoice #, Patient, Date, Due Date, Total,     │
│          Status, Actions                                 │
└─ Pagination ────────────────────────────────────────────┘
```

#### 10.1.5 Component Tree

```
Page
├── PageHeader ("Invoices" + "Create Invoice" button)
├── DashboardStatsRow
│   ├── StatCard ("Draft", count, gray)
│   ├── StatCard ("Issued", count, blue)
│   ├── StatCard ("Partially Paid", count, amber)
│   ├── StatCard ("Paid", count, green)
│   └── StatCard ("Overdue", count, red)
├── SearchFilterBar
│   ├── SearchInput (search by invoice #, patient name)
│   ├── StatusFilter (multi-select)
│   ├── PatientFilter (autocomplete)
│   └── DateRangeFilter (issue date)
├── InvoiceTable
│   ├── Columns: Invoice # (monospace), Patient, Issue Date, Due Date, Grand Total, Balance Due, Status, Actions
│   ├── Sortable: Invoice #, Date, Total, Status
│   ├── Status badges: Draft (gray), Issued (blue), Partially Paid (amber), Paid (green), Overdue (red), Cancelled (gray strikethrough), Void (gray strikethrough)
│   ├── Balance due shown for partially paid
│   ├── Row click → invoice detail
│   └── Actions: View, Issue (if draft), Cancel (if issued), Print, Download PDF
├── Pagination
└── EmptyState ("No invoices yet")
```

#### 10.1.6 API Integration

| Endpoint | Method | Params |
|----------|--------|--------|
| `GET /billing/invoices` | GET | `page, size, sort_by, status, patient_id, date_from, date_to` |

**Invoice response shape:**
```json
{
  "id": "uuid",
  "invoice_number": "INV-00001",
  "patient_id": "uuid",
  "patient_name": "Juan Dela Cruz",
  "issue_date": "2026-07-18",
  "due_date": "2026-08-17",
  "subtotal": "15000.00",
  "discount_total": "0.00",
  "tax_total": "0.00",
  "grand_total": "15000.00",
  "amount_paid": "5000.00",
  "balance_due": "10000.00",
  "status": "partially_paid",
  "items": [],
  "created_at": "2026-07-18T10:30:00Z"
}
```

---

### 10.2 Create Invoice Screen

#### 10.2.1 Screen Purpose

**Business goal:** Create a new invoice for a patient.
**User goal:** Add line items, set discounts/taxes, and generate an invoice.

#### 10.2.2 Route

Slide-out drawer from Invoice List (or `/billing/invoices/create`).

#### 10.2.3 Component Tree

```
Drawer (or Page)
├── DrawerHeader ("Create Invoice")
├── Form
│   ├── FormSection ("Invoice Details")
│   │   ├── PatientPicker (autocomplete, required)
│   │   ├── InvoiceDate → DatePicker (default: today)
│   │   ├── DueDate → DatePicker (default: +30 days)
│   │   └── Currency → Select (default: USD)
│   ├── FormSection ("Line Items")
│   │   ├── LineItemList
│   │   │   ├── LineItemRow
│   │   │   │   ├── Description → Input (required)
│   │   │   │   ├── Quantity → NumberInput (min: 1)
│   │   │   │   ├── Unit Price → CurrencyInput (required)
│   │   │   │   ├── Tax Rate → NumberInput (%, optional)
│   │   │   │   ├── Total → Read-only (calculated)
│   │   │   │   └── RemoveButton
│   │   │   └── Empty: "No items added"
│   │   └── "+ Add Item" button
│   ├── FormSection ("Discounts & Adjustments")
│   │   ├── DiscountType → Select (Percentage / Fixed Amount)
│   │   ├── DiscountValue → NumberInput
│   │   └── DiscountReason → Input (optional, required if > threshold)
│   └── FormSection ("Summary")
│       ├── Subtotal (calculated)
│       ├── Discount (calculated)
│       ├── Tax (calculated)
│       └── Grand Total (calculated, read-only)
├── DrawerFooter
│   ├── Button ("Save as Draft", secondary)
│   ├── Button ("Cancel", ghost)
│   └── Button ("Create & Issue", primary)
```

#### 10.2.4 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /billing/invoices` | POST | `{ patient_id, issue_date, due_date, currency, items: [{ description, quantity, unit_price, tax_rate }] }` |

#### 10.2.5 Validation

- At least 1 line item required
- Patient required
- Description required for each item
- Quantity ≥ 1
- Unit Price ≥ 0
- Due date must be after issue date
- Discount reason required if discount exceeds threshold (configurable)

---

### 10.3 Invoice Detail Screen

#### 10.3.1 Screen Purpose

**Business goal:** View complete invoice with all details, status, and payment allocations.
**User goal:** Review invoice, manage payments, print, download.

#### 10.3.2 Route

`/billing/invoices/:invoiceId`

#### 10.3.3 Component Tree

```
Page
├── InvoiceHeader (sticky)
│   ├── InvoiceNumber (monospace, large)
│   ├── StatusBadge (large)
│   ├── GrandTotal
│   ├── BalanceDue (if partial)
│   └── ActionButtonsRow
│       ├── Button ("Issue Invoice") — if draft
│       ├── Button ("Record Payment") — if issued or partially_paid
│       ├── Button ("Cancel") — if issued
│       ├── Button ("Void") — if paid
│       ├── Button ("Print")
│       └── DropdownMenu (Download PDF, Send Email, Create Credit Note)
├── InvoicePreview
│   ├── ClinicInfo (name, address, phone, email — from settings)
│   ├── PatientInfo (name, address, phone)
│   ├── InvoiceMeta (number, date, due date, currency)
│   ├── LineItemsTable
│   │   ├── Columns: #, Description, Qty, Unit Price, Tax, Total
│   │   └── Subtotal, Discount, Tax, Grand Total rows
│   ├── PaymentTerms (net 30, etc.)
│   └── Notes (if any)
├── PaymentAllocationCard
│   ├── PaymentAllocationsList
│   │   ├── AllocationRow
│   │   │   ├── Date, Payment #, Amount, Method, Status
│   │   │   └── Click → payment detail
│   │   └── Empty: "No payments recorded"
│   └── TotalPaid vs GrandTotal vs BalanceDue
├── RelatedDocumentsCard
│   ├── Credit Notes (if any)
│   ├── Receipts (if any)
│   └── Refunds (if any)
├── AuditTimelineCard
│   └── Timeline of invoice status changes + financial actions
└── ActionBar (sticky bottom)
```

#### 10.3.4 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /billing/invoices/{id}` | GET | Invoice details with items |
| `POST /billing/invoices/{id}/issue` | POST | Issue invoice |
| `POST /billing/invoices/{id}/cancel` | POST | Cancel invoice |

#### 10.3.5 Invoice Actions by Status

| Status | Available Actions |
|--------|-------------------|
| DRAFT | Issue, Edit, Delete |
| ISSUED | Record Payment, Cancel, Print, Download, Create Credit Note |
| PARTIALLY_PAID | Record Payment, Cancel, Print, Download |
| PAID | Void, Print, Download, Create Credit Note |
| OVERDUE | Record Payment, Print, Download |
| CANCELLED | Print, Download |
| VOID | Print, Download |

---

### 10.4 Record Payment Screen

#### 10.4.1 Screen Purpose

**Business goal:** Record a payment against an invoice.
**User goal:** Enter payment details and allocate to invoice.

#### 10.4.2 Route

Modal/Drawer from Invoice Detail.

#### 10.4.3 Component Tree

```
Modal
├── ModalHeader ("Record Payment")
├── Form
│   ├── InvoiceInfo (invoice number, grand total, balance due — read-only)
│   ├── FormField (Payment Amount) → CurrencyInput (max: balance due)
│   ├── FormField (Payment Method) → Select: Cash, Card, UPI, Bank Transfer, Cheque, Insurance, Wallet
│   ├── FormField (Payment Date) → DatePicker (default: today)
│   ├── FormField (Reference Number) → Input (optional, for card/cheque)
│   ├── FormField (Notes) → Textarea (optional)
│   ├── OverpaymentWarning (if amount > balance due)
│   │   └── "Amount exceeds balance due. Remaining will be recorded as patient credit."
│   └── AllocationPreview
│       ├── Invoice: ₱15,000.00
│       ├── Payment: ₱10,000.00
│       └── Remaining Balance: ₱5,000.00
├── ModalFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Record Payment", primary)
```

#### 10.4.4 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /billing/payments` | POST | `{ invoice_id, amount, payment_method, payment_date, reference_number?, notes? }` |
| `POST /billing/payments/{id}/complete` | POST | Complete payment |
| `POST /billing/payments/{id}/allocate` | POST | Allocate payment to invoice |

#### 10.4.5 Overpayment Handling

If payment amount > balance due, show overpayment warning and create patient credit for the excess.

---

### 10.5 Payment List Screen

#### 10.5.1 Screen Purpose

**Business goal:** Browse all payments recorded.
**User goal:** View payment history, status, and allocations.

#### 10.5.2 Route

`/billing/payments`

#### 10.5.3 Page Layout

```
┌─ Page Header ───────────────────────────────────────────┐
│ "Payments"                                               │
├─ Search & Filters ──────────────────────────────────────┤
│ [Search] [Status ▼] [Method ▼] [Date Range ▼]          │
├─ Data Table ────────────────────────────────────────────┤
│ Columns: Payment #, Patient, Invoice #, Amount, Method, │
│          Date, Status, Actions                           │
└─ Pagination ────────────────────────────────────────────┘
```

#### 10.5.4 Component Tree

```
Page
├── PageHeader ("Payments")
├── SearchFilterBar
├── PaymentTable
│   ├── Columns: Payment # (monospace), Patient, Invoice #, Amount, Payment Method, Date, Status, Actions
│   ├── Status: Pending (amber), Completed (green), Failed (red), Void (gray)
│   ├── Row click → payment detail
│   └── Actions: Complete (if pending), Void (if pending), View Allocations
├── Pagination
└── EmptyState
```

#### 10.5.5 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /billing/payments` | GET | List payments |
| `GET /billing/payments/{id}` | GET | Payment detail |
| `GET /billing/payments/{id}/allocations` | GET | Payment allocations |

---

### 10.6 Receipt Screen

#### 10.6.1 Screen Purpose

**Business goal:** Generate and view official payment receipts.
**User goal:** Print or download a receipt for a completed payment.

#### 10.6.2 Route

Modal or slide-out from Payment Detail.

#### 10.6.3 Component Tree

```
Modal
├── ModalHeader ("Payment Receipt — RCT-00001")
├── ReceiptContent
│   ├── ClinicHeader (name, address, GST — if applicable)
│   ├── ReceiptNumber (monospace, large)
│   ├── ReceiptDate
│   ├── PatientInfo (name, patient code)
│   ├── PaymentInfo
│   │   ├── Invoice #, Payment #, Amount, Method, Reference
│   │   └── Amount in words (formatted)
│   ├── LineItems (from invoice)
│   └── Footer (thank you message, refund policy)
├── ActionRow
│   ├── Button ("Print", secondary)
│   ├── Button ("Download PDF", secondary)
│   └── Button ("Close", ghost)
```

#### 10.6.4 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /billing/receipts` | POST | Generate receipt |
| `GET /billing/receipts/{id}` | GET | View receipt |
| `POST /billing/receipts/{id}/regenerate` | POST | Regenerate receipt |

---

### 10.7 Refund Screen

#### 10.7.1 Screen Purpose

**Business goal:** Process refunds with approval workflow.
**User goal:** Create, approve, and complete refunds.

#### 10.7.2 Route

Modal from Invoice Detail or Payment Detail.

#### 10.7.3 Component Tree

```
Modal (Create Refund)
├── ModalHeader ("Process Refund")
├── Form
│   ├── InvoiceInfo (read-only)
│   ├── PaymentInfo (read-only)
│   ├── FormField (Refund Amount) → CurrencyInput
│   ├── FormField (Refund Reason) → Select + Textarea
│   │   ├── Reasons: Overpayment, Service Cancellation, Duplicate Payment, Other
│   │   └── Detailed reason → Textarea (required)
│   ├── FormField (Refund Method) → Select (same as payment methods)
│   └── RefundPreview (amount, fees, net refund)
├── ModalFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Submit Refund", primary)
```

#### 10.7.4 Refund Approval Flow

```
Create Refund (PENDING) → Admin/Manager approves (APPROVED) → Refund processed (COMPLETED)
                         → Admin/Manager rejects (REJECTED) → Terminal
```

#### 10.7.5 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /billing/refunds` | POST | Create refund request |
| `POST /billing/refunds/{id}/approve` | POST | Approve refund |
| `POST /billing/refunds/{id}/reject` | POST | Reject refund |
| `POST /billing/refunds/{id}/complete` | POST | Complete refund |

---

### 10.8 Credit Note List Screen

#### 10.8.1 Screen Purpose

**Business goal:** View and manage all credit notes issued.
**User goal:** Browse, issue, void, and apply credit notes against invoices.

#### 10.8.2 Route

`/billing/credit-notes`

#### 10.8.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, other doctors

#### 10.8.4 Backend Limitations

⚠️ **Note:** The current backend sprint does **not** expose `GET /billing/credit-notes` list or `GET /billing/credit-notes/{id}` detail endpoints. Credit notes can only be created and managed via workflow endpoints. The list/detail views are documented here for when these endpoints are added.

#### 10.8.5 Component Tree

```
Page
├── PageHeader ("Credit Notes")
├── SearchFilterBar
│   ├── SearchInput (search by CN number, invoice number)
│   ├── StatusFilter (Draft, Issued, Applied, Void, Expired)
│   └── DateRangeFilter
├── CreditNoteTable
│   ├── Columns: CN # (monospace), Invoice #, Patient, Amount, Status, Expiry, Actions
│   ├── Row click → credit note detail (slides out or navigates)
│   ├── Actions: Issue (if draft), Apply (if issued), Void (if draft/issued), View
│   └── Status: Draft (gray), Issued (blue), Applied (green), Void (gray strikethrough), Expired (amber)
├── Pagination
└── EmptyState ("No credit notes yet")
```

#### 10.8.6 Create Credit Note Modal

```
Modal (Create Credit Note)
├── ModalHeader ("Create Credit Note")
├── Form
│   ├── InvoiceInfo (read-only: invoice number, grand total, balance)
│   ├── PatientInfo (read-only: patient name, code)
│   ├── FormField (Credit Amount) → CurrencyInput (max: invoice grand total)
│   ├── FormField (Reason) → Textarea (required, max 500 chars)
│   ├── FormField (Expiry Date) → DatePicker (optional)
│   └── CreditPreview (amount, remaining invoice balance)
├── ModalFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Create Credit Note", primary)
└── SuccessToast
```

**Post-create:** Credit note is created in DRAFT status. User can then issue it via workflow.

#### 10.8.7 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /billing/credit-notes` | POST | `{ invoice_id, patient_id, amount, reason, expiry_date? }` |
| `POST /billing/credit-notes/{id}/issue` | POST | — |
| `POST /billing/credit-notes/{id}/void` | POST | `{ void_reason }` |
| `POST /billing/credit-notes/{id}/apply` | POST | — |

---

### 10.9 Refund List Screen

#### 10.9.1 Screen Purpose

**Business goal:** View and manage refund requests with approval workflow.
**User goal:** Create, approve, reject, and complete refunds.

#### 10.9.2 Route

`/billing/refunds`

#### 10.9.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, other doctors

#### 10.9.4 Backend Limitations

⚠️ **Note:** The current backend sprint does **not** expose `GET /billing/refunds` list or `GET /billing/refunds/{id}` detail endpoints. Refunds can only be created and managed via workflow endpoints. The list/detail views are documented here for when these endpoints are added.

#### 10.9.5 Component Tree

```
Page
├── PageHeader ("Refunds")
├── SearchFilterBar
│   ├── SearchInput (search by refund number, payment number)
│   ├── StatusFilter (Pending, Approved, Rejected, Completed)
│   └── DateRangeFilter
├── RefundTable
│   ├── Columns: Refund # (monospace), Payment #, Patient, Amount, Reason, Status, Created, Actions
│   ├── Status badges: Pending (amber), Approved (blue), Rejected (red), Completed (green)
│   ├── Row click → refund detail
│   └── Actions: Approve (if pending), Reject (if pending), Complete (if approved)
├── Pagination
└── EmptyState ("No refund requests")
```

#### 10.9.6 Create Refund Modal

```
Modal (Create Refund)
├── ModalHeader ("Create Refund")
├── Form
│   ├── PaymentInfo (read-only: payment number, amount, method)
│   ├── InvoiceInfo (read-only: invoice number, balance)
│   ├── FormField (Refund Amount) → CurrencyInput (max: payment amount)
│   ├── FormField (Reason) → Textarea (required, max 500 chars)
│   └── RefundPreview
├── ModalFooter
│   ├── Button ("Cancel", secondary)
│   └── Button ("Submit Refund", primary)
└── SuccessToast
```

#### 10.9.7 Refund Approval Workflow Visual

```
[Create] ──→ PENDING ──→ [Approve] ──→ APPROVED ──→ [Complete] ──→ COMPLETED
              │                                          (terminal)
              ├── [Reject] ──→ REJECTED (terminal)
              │
              └── Can re-attempt as new refund if rejected
```

#### 10.9.8 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /billing/refunds` | POST | `{ payment_id, amount, reason }` |
| `POST /billing/refunds/{id}/approve` | POST | `{ reason? }` |
| `POST /billing/refunds/{id}/reject` | POST | `{ reason? }` |
| `POST /billing/refunds/{id}/complete` | POST | — |

---

### 10.10 Payment Allocation Screen

#### 10.10.1 Screen Purpose

**Business goal:** View and manage payment allocations to invoices.
**User goal:** See how a payment is distributed across invoices and manage allocations.

#### 10.10.2 Route

Tab on Payment Detail page or modal.

#### 10.10.3 Accessible Roles

`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`

#### 10.10.4 Component Tree

```
PaymentAllocationPanel
├── SectionHeader ("Allocations" + "+ Allocate" button — if completed)
├── AllocationSummary
│   ├── Payment Total
│   ├── Allocated Total (sum of all allocations)
│   ├── Unallocated Balance
│   └── Progress Bar (green = allocated, gray = unallocated)
├── AllocationsList
│   ├── AllocationRow
│   │   ├── Invoice # (monospace, clickable → invoice detail)
│   │   ├── Allocated Amount
│   │   ├── Allocated By
│   │   ├── Date
│   │   └── DeallocateButton (if payment can be modified)
│   └── Empty: "No allocations yet"
├── AllocateModal
│   ├── InvoicePicker (autocomplete, search by invoice # or patient)
│   │   ├── Shows: Invoice #, Patient, Grand Total, Outstanding Balance
│   │   └── Filters: Only payable invoices (Issued, Partially Paid, Overdue)
│   ├── FormField (Allocation Amount) → CurrencyInput (max: min(payment unallocated, invoice outstanding))
│   ├── AllocationPreview (payment unallocated after, invoice balance after)
│   ├── OverAllocationWarning (if amount exceeds invoice balance)
│   └── Footer: Cancel + Allocate
└── DeallocateConfirmDialog
    ├── Warning: "This will remove the allocation. Invoice balance will increase."
    └── Footer: Cancel + Confirm
```

#### 10.10.5 API Integration

| Endpoint | Method | Request DTO |
|----------|--------|-------------|
| `POST /billing/payments/{id}/allocate` | POST | `{ invoice_id, amount }` |
| `POST /billing/payments/{id}/deallocate` | POST | `{ invoice_id }` |
| `GET /billing/payments/{id}/allocations` | GET | Returns allocation summary list |

#### 10.10.6 Validation Rules

- Allocation amount must be positive
- Allocation amount cannot exceed payment's unallocated balance
- Allocation amount cannot exceed invoice's outstanding balance
- Cannot allocate to a paid/cancelled/void invoice
- Payment must be in COMPLETED status to allocate

---

### 10.11 Payment Fail & Void Workflow

#### 10.11.1 Payment Status Flow

```
[Create] ──→ PENDING ──→ [Complete] ──→ COMPLETED ──→ [Refund] ──→ REFUNDED
              │                                           (via refund module)
              ├── [Fail] ──→ FAILED ──→ [Retry] ──→ PENDING
              │
              ├── [Void] ──→ VOID (terminal)
              │
              └── [Delete] ──→ Hard deleted (PENDING only, admin only)
```

#### 10.11.2 Fail Payment Modal

```
Modal
├── Title: "Mark Payment as Failed"
├── Reason → Textarea (optional)
└── Footer: [Cancel] [Mark as Failed]
```

#### 10.11.3 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /billing/payments/{id}/fail` | POST | Mark payment as failed |
| `POST /billing/payments/{id}/void` | POST | Void a payment |
| `DELETE /billing/payments/{id}` | DELETE | Delete pending payment (admin only) |

---

---

### 10.11 Billing Dashboard Screen

#### 10.11.1 Screen Purpose

**Business goal:** Financial overview — revenue, outstanding amounts, payment trends.
**User goal:** Monitor clinic financial health at a glance.

#### 10.11.2 Route

`/billing/dashboard`

#### 10.11.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`

#### 10.11.4 Component Tree

```
Page
├── PageHeader ("Billing Dashboard" + "View Full Report" button)
├── KpiRow
│   ├── KpiCard ("Today's Revenue", amount, trend)
│   ├── KpiCard ("Monthly Revenue", amount, trend)
│   ├── KpiCard ("Outstanding", amount, clickable → overdue invoices)
│   ├── KpiCard ("Refunds This Month", amount)
│   └── KpiCard ("Credit Notes Issued", count)
├── TwoColumnLayout
│   ├── MainColumn
│   │   ├── RevenueChart (bar/line chart — daily/weekly/monthly)
│   │   ├── PaymentMethodDistribution (pie/donut chart)
│   │   └── RecentTransactions (list of last 10 payments)
│   └── RightColumn
│       ├── OverdueInvoicesCard (list with amounts)
│       ├── RecentRefundsCard
│       └── QuickActionsCard
│           ├── "View Invoices"
│           ├── "View Payments"
│           ├── "Revenue Report"
│           └── "Export Financial Summary"
└── MonthlyTrendChart (full width — 12-month view)
```

#### 10.11.5 API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /billing/dashboard` | GET | Dashboard data (totals, counts, recent activity) |
| `GET /billing/summary` | GET | Financial summary (aggregated revenue) |

#### 10.11.6 States

**Empty:** "No billing data yet. Create your first invoice to get started."
**Loading:** Skeleton for KPI row and chart placeholders.
**Error:** Individual card error states with retry.
---

### 10.12 Invoice Print Preview

#### 10.14.1 Screen Purpose

**Business goal:** Print-friendly invoice view.
**User goal:** Print or save as PDF.

#### 10.14.2 Route

Modal triggered from Invoice Detail.

#### 10.14.3 Print Layout
```
┌────────────────────────────────────────────────────────────┐
│  [Clinic Logo]          [Clinic Name]                      │
│                         123 Dental Street                  │
│                         Phone: +1-234-567-8900             │
│                         Email: info@denscare.com           │
├────────────────────────────────────────────────────────────┤
│                    INVOICE                                  │
│                    INV-00001                                │
├────────────────────────────────────────────────────────────┤
│  Bill To:                         Invoice Date: Jul 18    │
│  Juan Dela Cruz                   Due Date: Aug 17, 2026  │
│  123 Rizal St.                    Payment Terms: Net 30   │
│  Manila, Philippines                                       │
├──────────┬──────────┬──────┬──────────┬──────┬───────────┤
│ Item     │ Qty      │ Rate │ Discount │ Tax  │ Amount    │
├──────────┼──────────┼──────┼──────────┼──────┼───────────┤
│ RCT #36  │    1     │ 8000 │    0     │  0%  │  8,000.00 │
│ Filling  │    2     │ 2500 │    0     │  0%  │  5,000.00 │
├──────────┴──────────┴──────┴──────────┴──────┼───────────┤
│                                          Total │ 13,000.00│
│                                     Discount │      0.00 │
│                                           Tax │      0.00 │
│                                    Grand Total│ 13,000.00│
│                                    Paid      │  5,000.00 │
│                                    Balance   │  8,000.00 │
├────────────────────────────────────────────────────────────┤
│  Thank you for your visit!                                  │
│  Payment is due within 30 days.                             │
└────────────────────────────────────────────────────────────┘
```

---

## 11. User Management Screens

### 11.1 User List Screen

#### 11.1.1 Screen Purpose

**Business goal:** Manage all system users — create, approve, activate, deactivate.
**User goal:** Browse users, approve pending accounts, manage access.

#### 11.1.2 Route

`/admin/users`

#### 11.1.3 Accessible Roles

`ADMIN`

#### 11.1.4 Page Layout

Standard table layout with filters.

#### 11.1.5 Component Tree

```
Page
├── PageHeader ("Users" + "Create User" button)
├── SearchFilterBar
│   ├── SearchInput (name, email)
│   ├── StatusFilter (Pending, Active, Inactive)
│   └── RoleFilter (dropdown)
├── UserTable
│   ├── Columns: Name, Email, Role, Status, Created, Actions
│   ├── Pending users highlighted (amber background)
│   ├── Actions: Approve (if pending), Deactivate/Activate, Edit, Delete
│   ├── Self-actions disabled (admin cannot deactivate/change own role)
│   └── Row click → user detail
├── Pagination
└── CreateUserModal (or navigate to registration)
    ├── Full Name → Input (required)
    ├── Email → Input (required, validated as email)
    ├── Role → Select (dropdown of available roles)
    └── Status → Select (Active, Inactive, Pending — default: Active)
    
    ⚠️ **Note:** Admin creates users via `POST /auth/register` (same endpoint as
    self-registration) but with an admin context. The backend user management
    endpoints (GET/PATCH /users) are read/manage only — there is no dedicated
    `POST /users` endpoint for admin user creation.
```

#### 11.1.6 Backend API Reference

| Endpoint | Method | Purpose | Request/Params |
|----------|--------|---------|----------------|
| `GET /users` | GET | List users (paginated) | `?search=&role_id=&status=&page=&page_size=` |
| `GET /users/{user_id}` | GET | User details | — |
| `PATCH /users/{user_id}/role` | PATCH | Change user role | `{ role_id }` (self-change forbidden) |
| `PATCH /users/{user_id}/activate` | PATCH | Activate user | — (self-activation forbidden) |
| `PATCH /users/{user_id}/deactivate` | PATCH | Deactivate user | — (self-deactivation forbidden) |
| `POST /auth/register` | POST | Create user (admin or self) | `{ full_name, email, password }` |

**User ID type:** The backend uses integer IDs for users (not UUIDs). The frontend should handle this consistently.

**Self-action restrictions:**
- Admin cannot change their own role → 400 error from backend
- Admin cannot deactivate themselves → 400 error from backend
- Admin cannot activate themselves → 400 error from backend

---

### 11.2 User Detail Screen

#### 11.2.1 Screen Purpose

**Business goal:** View and manage individual user details.
**User goal:** Edit user role, status, and profile information.

#### 11.2.2 Route

`/admin/users/:userId`

#### 11.2.3 Component Tree

```
Page
├── UserHeader (avatar, name, email, role, status badge)
├── Tabs
│   ├── Tab ("Profile") → ProfileForm
│   │   ├── Full Name → Input
│   │   ├── Email → Input
│   │   ├── Role → Select (admin-only)
│   │   ├── Status → Badge (read-only)
│   │   └── Save Button
│   ├── Tab ("Activity") → ActivityTimeline
│   │   └── Recent actions performed by this user
│   └── Tab ("Permissions") → PermissionsMatrix (read-only)
│       └── Grid of module × permission (view, create, edit, delete)
└── DangerZone (admin-only)
    ├── "Deactivate User" button (with confirmation)
    └── "Delete User" button (with confirmation, may be soft-delete)
```

---

## 12. Administration Screens

### 12.1 Audit Log Screen

#### 12.1.1 Screen Purpose

**Business goal:** System-wide audit trail for all data changes.
**User goal:** Investigate who changed what and when.

#### 12.1.2 Route

`/admin/audit-log`

#### 12.1.3 Accessible Roles

`ADMIN`, `CHIEF_DOCTOR`

#### 12.1.4 Component Tree

```
Page
├── PageHeader ("Audit Log")
├── SearchFilterBar
│   ├── EntityFilter (Patient, Appointment, Invoice, etc.)
│   ├── ActionFilter (Created, Updated, Deleted, etc.)
│   ├── UserFilter (who performed the action)
│   ├── DateRangeFilter
│   └── SearchInput (search by entity ID, description)
├── AuditTable
│   ├── Columns: Timestamp, User, Entity Type, Entity ID, Action, Changes Summary, IP Address
│   ├── Default sort: newest first
│   ├── Row expansion: show detailed diff of changes
│   └── Click → navigate to entity detail (if applicable)
├── Pagination
└── EmptyState ("No audit records found")
```

#### 12.1.5 API Integration

| Endpoint | Method | Params |
|----------|--------|--------|
| `GET /audit/logs` | GET | `page, size, entity_type, action, user_id, from_date, to_date` |

---

### 12.2 Clinic Settings Screen

#### 12.2.1 Screen Purpose

**Business goal:** Configure clinic-wide settings.
**User goal:** Update clinic information, working hours, and system preferences.

#### 12.2.2 Route

`/admin/settings`

#### 12.2.3 Accessible Roles

`ADMIN`

#### 12.2.4 Component Tree

```
Page
├── PageHeader ("Clinic Settings")
├── FormSections (vertical tabs or accordion)
│   ├── FormSection ("Clinic Information")
│   │   ├── Clinic Name → Input
│   │   ├── Address → Textarea
│   │   ├── Phone → Input
│   │   ├── Email → Input
│   │   └── Logo → FileUpload
│   ├── FormSection ("Working Hours")
│   │   ├── Working Days → MultiSelect (Mon-Sun)
│   │   ├── Morning Session Start → TimePicker
│   │   ├── Morning Session End → TimePicker
│   │   ├── Evening Session Start → TimePicker
│   │   ├── Evening Session End → TimePicker
│   │   └── Default Appointment Duration → Select (15, 30, 45, 60)
│   ├── FormSection ("Invoice Settings")
│   │   ├── Default Currency → Select
│   │   ├── Default Payment Terms → Input (days)
│   │   ├── Tax Rate → NumberInput (%)
│   │   ├── Invoice Prefix → Input
│   │   └── Receipt Prefix → Input
│   ├── FormSection ("Notification Preferences")
│   │   ├── Appointment Reminders → Toggle
│   │   ├── Reminder Timing → Select (1hr, 2hr, 24hr before)
│   │   ├── Payment Receipts → Toggle (auto-send)
│   │   └── New User Approval → Toggle (notify admin)
│   └── FormSection ("Security")
│       ├── Password Policy → Min Length, Complexity
│       ├── Session Timeout → Select (15, 30, 60 min)
│       └── Max Login Attempts → NumberInput
└── ActionBar (Save Changes button)
```

**⚠️ Backend note:** Settings endpoints are not yet implemented. This UI should show "Coming Soon" or be stubbed.

---

### 12.3 System Configuration (Future)

#### 12.3.1 Screen Purpose

**Business goal:** Advanced system configuration.
**User goal:** Configure integrations, backups, and system-level options.

#### 12.3.2 Route

`/admin/system`

#### 12.3.3 Sections

- Database Status
- Backup Configuration
- Email Server Settings (SMTP)
- Audit Log Retention
- Integration Settings (SMS, Payment Gateway → future)
- Feature Flags (enable/disable modules)

---

## 13. Profile & Notification Screens

### 13.1 User Profile Screen

#### 13.1.1 Screen Purpose

**Business goal:** Allow users to view and edit their own profile.
**User goal:** Update personal information, change password, manage preferences.

#### 13.1.2 Route

`/profile`

#### 13.1.3 Accessible Roles

All authenticated roles

#### 13.1.4 Component Tree

```
Page
├── ProfileHeader
│   ├── Avatar (large, editable)
│   ├── Name, Email, Role
│   └── Status badge
├── Tabs
│   ├── Tab ("Profile") → ProfileForm
│   │   ├── Full Name → Input
│   │   ├── Email → Input (read-only)
│   │   ├── Phone → Input
│   │   └── Save Button
│   ├── Tab ("Password") → ChangePasswordForm
│   │   ├── Current Password → PasswordInput
│   │   ├── New Password → PasswordInput + StrengthIndicator
│   │   └── Confirm Password → PasswordInput
│   ├── Tab ("Preferences") → PreferencesForm
│   │   ├── Theme → Select (Light/Dark/System — future)
│   │   ├── Language → Select (English only for MVP)
│   │   ├── Notification Preferences
│   │   │   ├── Email Notifications → Toggle
│   │   │   └── In-App Notifications → Toggle
│   │   └── Default Dashboard → Select (role-default or custom)
│   └── Tab ("Activity") → MyActivityTimeline
│       └── Recent actions performed by this user
```

---

### 13.2 Notification Center

#### 13.2.1 Screen Purpose

**Business goal:** Central location for all system notifications.
**User goal:** View, manage, and act on notifications.

#### 13.2.2 Route

Slide-out drawer (from header bell icon) or `/notifications` page.

#### 13.2.3 Component Tree

```
Drawer (480px, from right)
├── DrawerHeader ("Notifications" + "Mark All Read" link)
├── NotificationGroups
│   ├── Group ("Today")
│   │   ├── NotificationItem
│   │   │   ├── Icon (type-indicating: appointment, payment, approval, etc.)
│   │   │   ├── Title (bold if unread)
│   │   │   ├── Description
│   │   │   ├── Timestamp
│   │   │   ├── Read/Unread dot
│   │   │   └── Click → navigate to relevant context
│   │   └── ...
│   ├── Group ("This Week")
│   └── Group ("Earlier")
└── EmptyState ("No new notifications" with checkmark icon)
```

#### 13.2.4 Notification Types

| Type | Icon | Trigger |
|------|------|---------|
| Appointment Reminder | Calendar | Upcoming appointment |
| New Patient Registration | UserPlus | Patient registered |
| Payment Received | DollarSign | Payment recorded |
| Treatment Plan Approval | Stethoscope | Plan needs approval |
| Treatment Plan Status Change | ArrowRight | Plan status changed |
| User Approval Needed | ShieldCheck | New user registered |
| Invoice Overdue | AlertTriangle | Invoice past due |
| System Alert | Bell | System notification |

---

## 14. Error & Utility Screens

### 14.1 404 Not Found Screen

#### 14.1.1 Screen Purpose

**Business goal:** Gracefully handle invalid routes.
**User goal:** Navigate back to a valid page.

#### 14.1.2 Route

`*` (catch-all)

#### 14.1.3 Layout

```
┌────────────────────────────────────────────────────────────┐
│                                                           │
│                    🔍 (search icon, large)                  │
│                    Page Not Found                          │
│                                                           │
│        The page you're looking for doesn't exist or       │
│        has been moved.                                     │
│                                                           │
│              [Go to Dashboard]  [Go Back]                  │
│                                                           │
└────────────────────────────────────────────────────────────┘
```

### 14.2 Offline Screen

#### 14.2.1 Screen Purpose

**Business goal:** Inform users when the application loses connection.
**User goal:** Understand connectivity issues and retry.

#### 14.2.2 Behavior

- **Banner at top:** "You are offline. Some features may be unavailable."
- **Automatic retry** when connection is restored
- **Manual retry** button on the banner

#### 14.2.3 Component

```
OfflineBanner
├── Icon (WifiOff)
├── Text ("You are offline. Connecting...")
└── Button ("Retry")
```

---

## 15. Cross-Screen Specifications

### 15.1 Navigation Map

```
┌─ Public Routes ────────────────────────────────────┐
│ /auth/login                                         │
│ /auth/register                                      │
│ /auth/forgot-password                               │
│ /auth/reset-password?token=                         │
│ /auth/session-expired                               │
│ /401, /403, /404                                    │
└─────────────────────────────────────────────────────┘

┌─ Authenticated Routes ─────────────────────────────┐
│ /  → Role-based dashboard                           │
│                                                     │
│ ┌─ Patients ──────────────────────────────────────┐ │
│ │ /patients                                       │ │
│ │ /patients/register                              │ │
│ │ /patients/:patientId                            │ │
│ │ /patients/:patientId/edit                       │ │
│ │ /patients/:patientId?tab=timeline|records|...   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Appointments ──────────────────────────────────┐ │
│ │ /appointments                                    │ │
│ │ /appointments?view=day|week|month               │ │
│ │ /appointments/:appointmentId                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Treatment Plans ───────────────────────────────┐ │
│ │ /treatment-plans                                 │ │
│ │ /treatment-plans/create                          │ │
│ │ /treatment-plans/:planId                         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Procedures ────────────────────────────────────┐ │
│ │ /procedures                                       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Clinical Records ──────────────────────────────┐ │
│ │ /patient-records                                │ │
│ │ /patient-records/:recordId                      │ │
│ │ /patient-records/new                            │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Treatment Plans (with Version Diff) ────────────┐ │
│ │ /treatment-plans/:planId/versions/:versionId/diff│ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Billing ───────────────────────────────────────┐ │
│ │ /billing/invoices                                │ │
│ │ /billing/invoices/:invoiceId                     │ │
│ │ /billing/payments                                │ │
│ │ /billing/payments/:paymentId                     │ │
│ │ /billing/credit-notes                            │ │
│ │ /billing/refunds                                 │ │
│ │ /billing/dashboard                               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Administration ────────────────────────────────┐ │
│ │ /admin/users                                     │ │
│ │ /admin/users/:userId                             │ │
│ │ /admin/doctors                                   │ │
│ │ /admin/doctors/:doctorId                         │ │
│ │ /admin/doctors/schedule                          │ │
│ │ /admin/audit-log                                 │ │
│ │ /admin/settings                                  │ │
│ │                                                  │ │
│ ┌─ Patient Records ───────────────────────────────┐ │
│ │ /patient-records                                 │ │
│ │ /patient-records/:recordId                       │ │
│ │ /patient-records/new                             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Profile ───────────────────────────────────────┐ │
│ │ /profile                                          │ │
│ │ /profile/change-password                         │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 15.2 User Journey Maps

#### 15.2.1 Receptionist Journey

```
Login → Reception Dashboard
         ├── Register New Patient → Slide-out form → Patient List
         ├── Book Appointment → Calendar → Appointment Detail
         ├── View Today's Queue
         │     ├── Click patient → Check In
         │     ├── Click patient → View Patient Detail
         │     │     ├── View Appointments
         │     │     └── View Records (read-only)
         │     └── Click status → Update appointment status
         ├── Record Payment → Invoice List → Payment Modal
         └── Find Patient → Global Search → Patient Detail
```

#### 15.2.2 Doctor Journey

```
Login → Doctor Dashboard
         ├── View Today's Schedule
         │     ├── Click patient → Patient Clinical Workspace
         │     │     ├── View Medical History
         │     │     ├── Create Clinical Record
         │     │     │     ├── Add diagnosis
         │     │     │     ├── Add prescription
         │     │     │     ├── Add attachments
         │     │     │     └── Add follow-up
         │     │     ├── View Treatment Plans
         │     │     └── View Appointments
         │     └── Click status → Update appointment
         ├── View Pending Documentation → Continue Record
         ├── View Active Treatment Plans
         │     ├── Create new plan → Wizard
         │     └── Open plan → Detail → Submit for Review
         └── View Clinical Alerts → Act on alerts
```

#### 15.2.3 Admin Journey

```
Login → Admin Dashboard
         ├── Approve Pending Users → User List → Approve modal
         ├── View System Health
         ├── Manage Users → User List
         │     ├── Create User → Modal
         │     └── Edit User → User Detail
         ├── Manage Doctors → Doctor List
         │     ├── Create Doctor → Modal
         │     ├── Edit Schedule → Schedule View
         │     └── View Doctor Detail
         ├── Manage Procedures → Procedure Catalog
         │     ├── Create Procedure → Modal
         │     └── Edit/Activate/Deactivate
         ├── View Billing Dashboard
         │     ├── View Invoices
         │     ├── View Payments
         │     └── View Reports
         └── View Audit Log
```

### 15.3 Global Search Behavior

**Trigger:** `⌘K` (Mac) / `Ctrl+K` (Windows) or click search bar in header.

**Modal Behavior:**
```
┌────────────────────────────────────────────────────────────┐
│  🔍 Search patients, appointments, treatment plans...  [⌘K]  │
├────────────────────────────────────────────────────────────┤
│  Recent Searches:                                           │
│  🕐 Juan Dela Cruz — PAT-000001                             │
│  🕐 TXN-0042 — Treatment Plan                               │
│                                                             │
│  Results grouped by category (shown after typing):          │
│  ── Patients (3) ──                                         │
│  🧑 Juan Dela Cruz    PAT-000001    Active                  │
│  🧑 Maria Santos      PAT-000042    Active                  │
│                                                             │
│  ── Treatment Plans (2) ──                                  │
│  📋 TXN-0042    Juan Dela Cruz    IN_PROGRESS               │
│  📋 TXN-0039    Maria Santos      PROPOSED                  │
│                                                             │
│  ── Appointments (1) ──                                     │
│  📅 Juan Dela Cruz    Dr. Santos    Today 09:00             │
└────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Debounced search (300ms) after 2+ characters typed
- Results grouped by entity type with icons
- Keyboard navigable (Arrow keys + Enter)
- Escape closes
- Click result navigates to entity detail
- Recent searches shown when input is empty
- Clear recent searches option

### 15.4 Notification Patterns

| Pattern | Used For | Position | Duration |
|---------|----------|----------|----------|
| **Toast (success)** | Successful operations | Top-right | 4 seconds |
| **Toast (error)** | Failed operations | Top-right | 6 seconds |
| **Toast (warning)** | Non-critical warnings | Top-right | 5 seconds |
| **Toast (info)** | Informational | Top-right | 4 seconds |
| **Alert Banner** | Page-level messages | Below breadcrumb | Persistent |
| **Inline Error** | Form field errors | Below field | Until corrected |
| **Modal Dialog** | Confirmations | Center | User dismisses |
| **Banner (top)** | System-wide messages | Top of screen | Persistent |

### 15.5 Loading Pattern Guidelines

| Context | Pattern | Implementation |
|---------|---------|---------------|
| Page load | Skeleton layout | Skeleton cards, table rows, text lines |
| Section refresh | Spinner + dim | Circular spinner in section |
| Table data | Skeleton rows | 5-8 animated rows matching column widths |
| Button action | Spinner in button | Small spinner replaces icon/text |
| Form submission | Button spinner | Button shows spinner + "Saving..." |
| Search results | Shimmer list | Animated placeholder rows |
| Initial app load | Full-page skeleton | Logo + skeleton layout |
| Image/attachment | Placeholder + spinner | Gray box with loading indicator |
| Background refresh | Silent (no indicator) | Data refreshes without user notification |

### 15.6 Empty State Guidelines

| Context | Illustration | Title | Description | Action |
|---------|-------------|-------|-------------|--------|
| Patient list | Empty folder | "No patients found" | "Register your first patient to get started." | "Register Patient" button |
| Appointment list | Empty calendar | "No appointments today" | "It looks like today is quiet." | "Book Appointment" button |
| Treatment plans | Empty document | "No treatment plans" | "Create your first treatment plan." | "Create Plan" button |
| Invoices | Empty wallet | "No invoices yet" | "Create an invoice to get started with billing." | "Create Invoice" button |
| Search results | Search with ? | "No results found" | "Try adjusting your search or filters." | "Clear Filters" link |
| Notifications | Checkmark | "No notifications" | "You're all caught up!" | — |
| Audit log | Empty log | "No audit records" | "Audit records will appear here as actions are performed." | — |
| Clinical records | Empty clipboard | "No clinical records" | "Clinical records will appear here after the first patient visit." | "New Record" button |

### 15.7 Error Pattern Guidelines

| Error | User Message | UI Treatment | Recovery Action |
|-------|-------------|-------------|-----------------|
| 400 Bad Request | "Invalid request. Please check your input." | Inline field errors | Correct fields |
| 401 Unauthorized | "Your session has expired." | Redirect to login | Re-authenticate |
| 403 Forbidden | "You don't have permission." | Full page error | "Go to Dashboard" |
| 404 Not Found | "Resource not found." | Full page error | "Go Back" or "Dashboard" |
| 409 Conflict | "This record was modified by another user. Please refresh." | Toast + banner | Refresh page |
| 422 Validation | "Please check your input." | Inline field errors | Correct fields |
| 429 Rate Limit | "Too many requests. Please wait." | Banner | Wait and retry |
| 500 Server Error | "Something went wrong. Please try again." | Toast + retry button | Retry |
| 502/503 Unavailable | "Service temporarily unavailable." | Banner | Auto-retry |
| Network Error | "Unable to connect. Check your internet." | Offline banner | Manual retry |

### 15.8 Design Consistency Rules

#### Spacing
- Card padding: 16px (standard), 24px (content-heavy)
- Form field vertical gap: 20px
- Form field horizontal gap: 12px
- Table cell padding: 12px horizontal, 10px vertical
- Section gap: 32px
- Page margins: 24px (workspace), 32px (dashboard)

#### Typography
| Element | Token | Size | Weight |
|---------|-------|------|--------|
| Page title | `text-display` | 30px | 600 |
| Section heading | `text-h2` | 20px | 600 |
| Card heading | `text-h3` | 18px | 600 |
| Body text | `text-body` | 14px | 400 |
| Table cell | `text-body-sm` | 13px | 400 |
| Form label | `text-label` | 13px | 500 |
| Caption | `text-caption` | 12px | 400 |
| Badge text | `text-small` | 11px | 400 |
| Button text | `text-button` | 14px | 500 |
| Monospace | `text-monospace` | 13px | 400 |

#### Color Application
| Element | Token |
|---------|-------|
| Primary actions | `color-primary-500` |
| Body text | `color-neutral-800` |
| Secondary text | `color-neutral-500` |
| Borders | `color-neutral-200` |
| Page background | `color-surface-page` |
| Card background | `color-surface-card` |
| Error | `color-danger` |
| Success | `color-success` |
| Warning | `color-warning` |

#### Components
| Component | Border Radius | Shadow | Border |
|-----------|--------------|--------|--------|
| Cards | `radius-md` (6px) | `shadow-sm` | 1px `neutral-200` |
| Buttons | `radius-md` (6px) | None | None |
| Inputs | `radius-sm` (4px) | None | 1px `neutral-200` |
| Modals | `radius-lg` (8px) | `shadow-lg` | None |
| Dropdowns | `radius-md` (6px) | `shadow-md` | 1px `neutral-200` |
| Badges | `radius-full` (9999px) | None | None |
| Tables | `radius-none` (0px) | None | 1px `neutral-200` |
| Sidebar items | `radius-none` (0px) | None | None |

### 15.9 Responsive Design Rules

| Breakpoint | Sidebar | Tables | Forms | Modals |
|------------|---------|--------|-------|--------|
| ≥1280px | Expanded (240px) | All columns | 2-column | Centered modal |
| 1024-1279px | Collapsed (64px) | Hide low-priority cols | 2-column | Centered modal |
| 768-1023px | Hamburger (hidden) | Horizontal scroll + priority cols | 1-column | Full-width |
| <768px | Overlay menu | Card list instead of table | 1-column full-width | Full-screen drawer |

### 15.10 Accessibility Standards

**Target:** WCAG 2.1 Level AA minimum.

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All interactive elements focusable via Tab |
| Focus indicators | 2px solid ring with 2px offset, `color-primary-500` |
| Color independence | Status uses icon + text + color (never color alone) |
| ARIA labels | All interactive elements have descriptive labels |
| Contrast ratio | Text: 4.5:1 minimum, Large text: 3:1 minimum |
| Screen reader support | `aria-live` for dynamic content, `aria-required` for required fields |
| Form labels | Visible `<label>` elements (never placeholder-as-label) |
| Modal focus trap | Tab focus trapped within open modal |
| Skip navigation | "Skip to content" link at top of page |
| Motion respect | All animations respect `prefers-reduced-motion: reduce` |
| Error announcements | Errors use `aria-describedby` on fields |
| Status announcements | Status changes use `role="status"` or `aria-live="polite"` |

---

## End of Document

**Version:** 1.1.0
**Last Updated:** July 28, 2026
**Status:** Final — Implementation-Ready
**Total Screens Documented:** 35+
**Total API Endpoints Referenced:** 100+
