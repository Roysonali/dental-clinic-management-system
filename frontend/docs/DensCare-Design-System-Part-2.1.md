# DensCare Enterprise Design System

## PART 2.1 — Design System Foundation


## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Vision & Mission](#2-design-vision--mission)
3. [Design Principles](#3-design-principles)
4. [Design Tokens](#4-design-tokens)
5. [Color System](#5-color-system)
6. [Typography](#6-typography)
7. [Spacing & Grid](#7-spacing--grid)
8. [Iconography](#8-iconography)
9. [Illustrations](#9-illustrations)
10. [Component Philosophy](#10-component-philosophy)
11. [Component Library](#11-component-library)
12. [Table System](#12-table-system)
13. [Form System](#13-form-system)
14. [Motion System](#14-motion-system)
15. [Responsive Strategy](#15-responsive-strategy)
16. [Accessibility](#16-accessibility)
17. [Developer Guidelines](#17-developer-guidelines)
18. [Design Governance](#18-design-governance)
19. [Future Expansion](#19-future-expansion)

---

## 1. Executive Summary

The DensCare Design System is a comprehensive, healthcare-grade visual language and component framework built for the DensCare Dental Clinic Management System. It serves as the single source of truth for all product interfaces — ensuring consistency, accessibility, and clinical safety across every screen.

### Scope

This design system covers:

- **Foundations:** Design tokens, color, typography, spacing, grid, icons
- **Components:** 30+ reusable UI components with all states and variants
- **Patterns:** Tables, forms, navigation, dashboards, wizards
- **Guidelines:** Accessibility, motion, responsive behavior, governance

### Design System Tenets

| Tenet | Description |
|-------|-------------|
| **Healthcare-first** | Every decision prioritizes clinical safety and data accuracy |
| **Enterprise-grade** | Built for 10+ years of product growth, not rapid prototyping |
| **Role-aware** | Components adapt to user permissions and context |
| **Accessible by default** | WCAG 2.1 AA+ minimum; AA target wherever feasible |
| **Desktop-primary** | Optimized for clinic desktop workflows; tablet/mobile secondary |
| **Themeable** | Token-driven architecture enables dark mode, multi-brand, high-contrast |

### Tech Stack Alignment

The design system is implemented using:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | React 19 + TypeScript 6 | Component implementation |
| **Styling** | Tailwind CSS 4 | Utility-first styling with design tokens |
| **Primitives** | shadcn/ui (Radix UI) | Accessible, headless component primitives |
| **Forms** | React Hook Form + Zod | Form validation and state management |
| **State** | Zustand + TanStack React Query | Client and server state |

---

## 2. Design Vision & Mission

### Design Vision

To create the most trusted, efficient, and humane interface in healthcare technology — where every pixel serves the clinician, every interaction protects the patient, and every screen earns its place through utility and clarity.

### Design Mission

To build a design system that makes complex clinical workflows feel simple, reduces cognitive load under pressure, prevents errors before they happen, and scales gracefully from a single-chair clinic to a multi-location enterprise — without ever feeling like "enterprise software."

---

## 3. Design Principles

### 3.1 Safety First, Always

**What it means:** Every design decision must consider: "Could this interaction lead to a clinical error?" If yes, the design must be changed. Patient data is protected through clear labeling, confirmation dialogs before destructive actions, and immutable states for finalized records.

**Why:** In dental clinics, a misclick can lead to wrong patient data, incorrect treatment plans, or missed diagnoses. The interface must be a safety net, not a source of errors.

**Application:**
- Destructive actions require confirmation dialogs with explicit language
- Finalized records show no edit controls — they are visually locked
- Patient identifiers (name + code + DOB) appear on every clinical screen
- Status changes show preview of what will happen before commitment

### 3.2 Clarity Over Creativity

**What it means:** The interface should be invisible to the user during their work. Every label is precise. Every action has a predictable result. No decorative elements that don't serve a purpose.

**Why:** Dental professionals work under time pressure. They should not have to interpret icons, decode metaphors, or hunt for actions. Direct manipulation and clear labels outperform clever design every time.

**Application:**
- Label all icon buttons with text or tooltips
- Use direct action labels ("Deactivate Patient") instead of vague ones ("Manage")
- Never use icons without text in clinical contexts
- All form fields have visible labels (no placeholder-as-label anti-pattern)

### 3.3 Progressive Disclosure

**What it means:** Show only what's needed for the current task. Reveal complexity progressively as the user drills down. Summary first, details on demand.

**Why:** Clinical data is inherently complex. A patient record contains years of history, dozens of encounters, and multiple treatment plans. Showing everything at once is overwhelming. Progressive disclosure lets users navigate complexity at their own pace.

**Application:**
- List views show 5-8 key columns; full detail on row click
- Patient overview shows recent activity; full history is one click away
- Long forms are grouped into expandable/collapsible sections
- Audit trails are available but hidden by default

### 3.4 Consistency Reduces Errors

**What it means:** The same action should work the same way everywhere. If "Cancel" is on the left in one dialog, it's on the left in all dialogs. If blue means "active" in one place, it means "active" everywhere.

**Why:** Consistency builds muscle memory. When users don't have to think about how to perform an action, they can focus on the clinical task. Inconsistency causes hesitation, which leads to errors under pressure.

**Application:**
- Single design system across all modules — no exceptions
- Consistent button ordering: Primary actions on the right, secondary on the left
- Uniform status badge colors across all entities
- Same keyboard shortcuts work across all contexts

### 3.5 Speed is a Feature

**What it means:** Every interaction should feel instantaneous. Frequent tasks require minimum clicks. The UI never waits for the user; the user never waits for the UI.

**Why:** A receptionist processes 100+ appointments per day. A doctor sees 10+ patients. Saving 5 seconds per interaction saves hours per week. Speed directly impacts clinic revenue and patient experience.

**Application:**
- Global search is accessible from any screen via `Cmd+K`
- Quick actions for frequent tasks (new patient, new appointment)
- Skeletons load immediately for perceived performance
- Tab key navigates forms in logical order for keyboard-fast data entry
- Debounced search (300ms) shows results as user types

### 3.6 Error Prevention Over Error Handling

**What it means:** Design to prevent errors before they can happen. Validation is proactive, not reactive. Users are guided, not blamed.

**Why:** In healthcare, errors have real consequences — wrong medication, wrong tooth, wrong patient. A red error message after submission is too late. The interface should prevent the error or catch it early.

**Application:**
- Inline validation on blur — users know immediately if a field is wrong
- Required fields are clearly marked before submission
- Duplicate detection warns before creating duplicate patients
- Appointment conflicts are detected and displayed in real-time
- Finalization requires deliberate action (not accidental click)

### 3.7 Respect the User's Expertise

**What it means:** Dental professionals are experts in dentistry, not software. The interface should adapt to their knowledge, not force them to learn ours. Use dental terminology. Follow clinical workflows. Don't reinvent familiar patterns.

**Why:** A dentist doesn't think in terms of "entities" and "CRUD operations." They think in terms of patients, teeth, procedures, and treatment plans. The interface should speak their language.

**Application:**
- Use dental terminology (FDI tooth numbers, quadrants, surfaces)
- Clinical forms follow clinical workflow (examination → diagnosis → treatment plan)
- Tooth chart uses standard FDI notation
- Procedure catalog uses dental industry categories
- Treatment plan wizard mirrors clinical decision process

### 3.8 Accessibility is Not Optional

**What it means:** WCAG 2.1 Level AA is the minimum. All components must be keyboard-navigable, screen-reader compatible, and color-independent for conveying information.

**Why:** Healthcare software must serve all clinicians, regardless of ability. Additionally, accessibility requirements are increasingly mandated by healthcare regulations. Building accessible components from the start is exponentially cheaper than retrofitting.

**Application:**
- All interactive elements are keyboard accessible
- Status uses icons + text + color (not color alone)
- Color contrast meets 4.5:1 minimum for text
- Focus indicators are visible on all elements
- `prefers-reduced-motion` is respected

---

## 4. Design Tokens

### 4.1 Token Philosophy

Design tokens are the atomic units of visual design. They create a consistent visual language across all components and screens. By centralizing tokens, we enable:

- **Global consistency:** One change updates everywhere
- **Theming:** Dark mode, high-contrast, and multi-brand via token swapping
- **Developer efficiency:** Designers and developers share the same vocabulary
- **Design governance:** Tokens constrain design decisions to approved values

### 4.2 Token Organization

Tokens follow a **Category → Role → Variant → State** hierarchy:

```
{category}-{role}-{variant}-{state}
Example: color-background-primary-hover
         color-text-secondary
         spacing-padding-card
```

### 4.3 Spacing Tokens

Based on a **4px base unit** (matching Tailwind CSS defaults):

| Token | Value | Tailwind Map | Usage |
|-------|-------|-------------|-------|
| `spacing-0` | 0px | `0` | None |
| `spacing-1` | 4px | `1` | Compact component spacing |
| `spacing-2` | 8px | `2` | Tight spacing, icon gaps |
| `spacing-3` | 12px | `3` | Between grouped elements |
| `spacing-4` | 16px | `4` | Card padding, form field vertical |
| `spacing-5` | 20px | `5` | Section spacing, form sections |
| `spacing-6` | 24px | `6` | Content padding, workspace padding |
| `spacing-8` | 32px | `8` | Major section spacing |
| `spacing-10` | 40px | `10` | Page section breaks |
| `spacing-12` | 48px | `12` | Large page margins |
| `spacing-16` | 64px | `16` | Very large spacing |

**Spacing rules:**
- **Card padding:** 16px (standard), 24px (content-heavy cards)
- **Form field vertical:** 20px between fields
- **Form field horizontal:** 12px between related fields
- **Table cell padding:** 12px horizontal, 10px vertical
- **Section spacing:** 32px between major sections
- **Page margins:** 24px (workspace content), 32px (dashboard)

### 4.4 Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0px | Buttons in toolbars, cards in data grids |
| `radius-sm` | 4px | Input fields, selects, small components |
| `radius-md` | 6px | Cards, dialogs, dropdowns, badges |
| `radius-lg` | 8px | Modals, large panels, toasts |
| `radius-xl` | 12px | Primary buttons (pill style) — use sparingly |
| `radius-full` | 9999px | Badges, avatars, chips |

**Rationale:** Dental software should feel precise and clinical, not playful. Overly rounded corners (16px+) suggest consumer apps. We use subtle rounding (4-8px) that feels professional and modern without being cartoonish.

**Where NOT to use radius:** Tables (use 0), sidebar items (use 0), data grids (use 0), form sections within cards (use 0).

### 4.5 Shadow/Elevation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | `0 0 0 0 transparent` | Flat surfaces |
| `shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Cards, subtle elevation |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)` | Dropdowns, popovers |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)` | Modals, dialogs |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.05)` | Toasts, notifications |
| `shadow-drawer` | `-4px 0 20px 0 rgba(0,0,0,0.10)` | Slide-out panels (right) |

**Rationale:** Shadows indicate depth hierarchy. Flat surfaces have no shadow. Interactive elements get subtle shadows on hover. Floating elements (modals, toasts) get more pronounced shadows. Never use flat shadows (no blur); they look unprofessional.

### 4.6 Border Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `border-width-none` | 0px | No border |
| `border-width-sm` | 1px | Standard borders (cards, inputs, tables) |
| `border-width-md` | 2px | Focus indicators, active states |

### 4.7 Opacity Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `opacity-disabled` | 0.5 | Disabled components |
| `opacity-subtle` | 0.7 | Secondary text, muted content |
| `opacity-overlay` | 0.5 | Modal/drawer backdrop |
| `opacity-skeleton` | 0.1 | Skeleton loading backgrounds |
| `opacity-hover` | 0.08 | Subtle hover state |

### 4.8 Z-Index Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `z-dropdown` | 50 | Dropdowns, popovers, tooltips |
| `z-sticky` | 100 | Sticky headers, sticky columns |
| `z-drawer` | 200 | Slide-out panels |
| `z-modal` | 300 | Modals, dialogs |
| `z-toast` | 400 | Toasts, notifications |
| `z-loader` | 500 | Full-page loading overlay |

### 4.9 Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `transition-fast` | 150ms | Hover, focus, active states |
| `transition-normal` | 200ms | Dropdown open/close, tooltips |
| `transition-slow` | 300ms | Modals, drawers, page transitions |
| `transition-easing` | `ease-in-out` | All transitions — consistent curve |

### 4.10 Breakpoint Tokens

| Token | Value | Target |
|-------|-------|--------|
| `breakpoint-sm` | 640px | Mobile landscape |
| `breakpoint-md` | 768px | Tablet |
| `breakpoint-lg` | 1024px | Tablet landscape, small desktop |
| `breakpoint-xl` | 1280px | Desktop (primary target) |
| `breakpoint-2xl` | 1536px | Large desktop |

---

## 5. Color System

### 5.1 Color Philosophy

The DensCare color palette is **purposeful, restrained, and clinical.** Every color serves a specific communication function. Colors are never decorative — they carry meaning.

**Key decisions:**
- **Blue** is the primary brand color — it communicates trust, calm, and professionalism. Blue is the standard for healthcare interfaces worldwide.
- **Cool grays** provide the neutral backdrop — they feel clean and clinical without being cold.
- **Semantic colors** are subdued — bright reds and greens are jarring in a clinical setting. We use muted, professional variants.
- **Red is used sparingly** — only for errors and destructive actions. Overusing red creates alert fatigue.

### 5.2 Primary Palette

| Token | Hex | Usage | Where to Use | Where NOT to Use |
|-------|-----|-------|-------------|-----------------|
| `color-primary-50` | #EFF6FF | Background tint | Active nav item bg, selected state bg | Text, borders |
| `color-primary-100` | #DBEAFE | Light background | Info banners, hover state bg | Primary text |
| `color-primary-200` | #BFDBFE | Border light | Selected borders, focus rings | Large surfaces |
| `color-primary-400` | #60A5FA | Muted accent | Links, secondary accents | Primary buttons |
| `color-primary-500` | #3B82F6 | Primary | Primary buttons, active links, selected state | Body text, backgrounds |
| `color-primary-600` | #2563EB | Primary hover | Button hover, link hover | Disabled states |
| `color-primary-700` | #1D4ED8 | Pressed state | Active/pressed button state | Text on dark surfaces |

**Rationale:** Blue-based primary palette because:
- Blue is universally associated with healthcare and trust
- It has high contrast against white surfaces (critical for readability)
- It color-blindsafe (most common color blindness affects red-green, not blue)
- It works well for both light mode and future dark mode

### 5.3 Neutral / Gray Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `color-neutral-50` | #F8FAFC | Page background, table row stripe |
| `color-neutral-100` | #F1F5F9 | Card background, sidebar background |
| `color-neutral-200` | #E2E8F0 | Borders, dividers, input borders |
| `color-neutral-300` | #CBD5E1 | Disabled borders, subtle dividers |
| `color-neutral-400` | #94A3B8 | Placeholder text, disabled text |
| `color-neutral-500` | #64748B | Secondary text, metadata labels |
| `color-neutral-600` | #475569 | Body text (low emphasis) |
| `color-neutral-700` | #334155 | Body text (medium emphasis) |
| `color-neutral-800` | #1E293B | Body text (high emphasis) |
| `color-neutral-900` | #0F172A | Headings, primary text |

**Rationale:** Cool slate grays (blue undertone) rather than warm grays. They harmonize with the blue primary palette and feel more clinical/sterile than warm beige grays. The 10-step scale provides precise control over visual hierarchy.

### 5.4 Semantic Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `color-success` | #059669 | Success states, completed status, active badges |
| `color-success-bg` | #ECFDF5 | Success banners, success toast bg |
| `color-warning` | #D97706 | Warning states, pending status, caution badges |
| `color-warning-bg` | #FFFBEB | Warning banners, warning toast bg |
| `color-danger` | #DC2626 | Error states, destructive actions, error messages |
| `color-danger-bg` | #FEF2F2 | Error banners, error toast bg |
| `color-info` | #2563EB | Informational states, info banners |
| `color-info-bg` | #EFF6FF | Info banners, info toast bg |

**Rationale:** Subdued semantic colors. For example, `success` is a muted emerald rather than bright green. Bright green creates visual noise and conflicts with clinical color coding. These muted variants communicate the same meaning without visual aggression.

### 5.5 Status Badge Colors

| Status | Token | Hex | Entity Examples |
|--------|-------|-----|-----------------|
| Active | `color-status-active` | #059669 | Patient, User, Doctor |
| Inactive | `color-status-inactive` | #94A3B8 | Patient, User, Doctor |
| Pending | `color-status-pending` | #D97706 | User approval, payment |
| Draft | `color-status-draft` | #6B7280 | Clinical record, treatment plan |
| In Progress | `color-status-progress` | #2563EB | Treatment, appointment |
| Completed | `color-status-completed` | #059669 | Treatment plan, appointment |
| Cancelled | `color-status-cancelled` | #DC2626 | Appointment, treatment plan |
| On Hold | `color-status-hold` | #D97706 | Treatment plan |
| Finalized | `color-status-finalized` | #4F46E5 | Clinical record |

### 5.6 Surface Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `color-surface-page` | #F8FAFC | Main page background |
| `color-surface-card` | #FFFFFF | Card, panel, dialog backgrounds |
| `color-surface-sidebar` | #FFFFFF | Sidebar background |
| `color-surface-navbar` | #FFFFFF | Top navigation bar |
| `color-surface-modal` | #FFFFFF | Modal dialog background |
| `color-surface-tooltip` | #1E293B | Tooltip dark background |
| `color-surface-overlay` | rgba(0,0,0,0.5) | Modal backdrop overlay |
| `color-surface-skeleton` | #F1F5F9 | Skeleton loading background |

### 5.7 Medical Alert Colors

These are for clinical alerts and warnings that require immediate attention:

| Alert Level | Token | Hex | Usage |
|-------------|-------|-----|-------|
| Critical | `color-alert-critical` | #DC2626 | Allergy warnings, contraindications |
| High | `color-alert-high` | #D97706 | Drug interactions, abnormal vitals |
| Medium | `color-alert-medium` | #2563EB | Clinical reminders, follow-up due |
| Low | `color-alert-low` | #6B7280 | Informational clinical notes |

### 5.8 Chart Colors

For data visualization (planned for future analytics):

```
chart-1: #3B82F6 (Blue)
chart-2: #059669 (Green)
chart-3: #D97706 (Amber)
chart-4: #8B5CF6 (Purple)
chart-5: #EC4899 (Pink)
chart-6: #06B6D4 (Cyan)
chart-7: #F97316 (Orange)
chart-8: #6B7280 (Gray)
```

### 5.9 Future Dark Mode Tokens

Dark mode will invert the luminance scale while preserving semantic meaning:

| Token | Light | Dark (Future) |
|-------|-------|---------------|
| `color-surface-page` | #F8FAFC | #0F172A |
| `color-surface-card` | #FFFFFF | #1E293B |
| `color-neutral-50` | #F8FAFC | #0F172A |
| `color-neutral-900` | #0F172A | #F8FAFC |

---

## 6. Typography

### 6.1 Typeface Selection

**Primary typeface: Inter**

- **Why Inter:** Open-source, excellent legibility at all sizes, designed for UI/body text, strong character distinction (lowercase `l`, uppercase `I`, digit `1` are visually distinct — critical for medical data), extensive weight range (400-700+), small x-height saves vertical space in data-dense tables.

**Monospace: JetBrains Mono** (for code, IDs, patient codes)

- **Why JetBrains Mono:** Open-source, designed for readability, clear distinction between similar characters, ligatures optional.

### 6.2 Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-display` | 30px / 1.875rem | 1.3 | 600 | Page titles, hero sections |
| `text-h1` | 24px / 1.5rem | 1.3 | 600 | Section headings |
| `text-h2` | 20px / 1.25rem | 1.4 | 600 | Card headings, modal titles |
| `text-h3` | 18px / 1.125rem | 1.4 | 600 | Sub-section headings |
| `text-h4` | 16px / 1rem | 1.5 | 600 | Group headings in forms |
| `text-body` | 14px / 0.875rem | 1.5 | 400 | Standard body text |
| `text-body-bold` | 14px / 0.875rem | 1.5 | 600 | Emphasized body text |
| `text-body-sm` | 13px / 0.8125rem | 1.5 | 400 | Data-dense tables, metadata |
| `text-caption` | 12px / 0.75rem | 1.5 | 400 | Helper text, timestamps, secondary info |
| `text-label` | 13px / 0.8125rem | 1.5 | 500 | Form labels, table headers |
| `text-small` | 11px / 0.6875rem | 1.4 | 400 | Badge text, notification timestamps |
| `text-button` | 14px / 0.875rem | 1 | 500 | Button text |
| `text-button-sm` | 13px / 0.8125rem | 1 | 500 | Small button text |
| `text-monospace` | 13px / 0.8125rem | 1.5 | 400 | Patient codes, plan codes, IDs |

### 6.3 Typography Rules

| Rule | Reason |
|------|--------|
| Body text is never smaller than 13px in data tables | Readability in clinical environments |
| Form labels use 500 weight (not 400) | Distinguish labels from values |
| Headings never use weights below 600 | Clear hierarchy |
| Line height for body text is 1.5 | Maximum readability for long text |
| Monospace for all auto-generated codes | Prevent misreading (PAT-000001 vs PAT-00000l) |
| No all-caps text except badge labels | ALL-CAPS reduces readability |

### 6.4 Color Hierarchy

| Text Role | Token | Contrast Ratio |
|-----------|-------|----------------|
| Primary / headings | `color-text-primary` (#0F172A) | ~15:1 on white |
| Body text | `color-text-body` (#334155) | ~10:1 on white |
| Secondary / metadata | `color-text-secondary` (#64748B) | ~5:1 on white |
| Placeholder | `color-text-placeholder` (#94A3B8) | ~3:1 on white |
| Disabled | `color-text-disabled` (#CBD5E1) | ~2:1 on white |
| On primary buttons | `color-text-on-primary` (#FFFFFF) | ~6:1 on primary blue |
| On dark surfaces | `color-text-on-dark` (#F8FAFC) | ~15:1 on dark |

### 6.5 Healthcare Typography Considerations

| Consideration | Application |
|---------------|-------------|
| **Patient identification** | Patient name in 16px bold (text-h4) on all clinical screens |
| **Data density** | Medical records use 13px body-sm for maximum information per view |
| **Error visibility** | Error messages use 13px regular with danger color — readable but not alarming |
| **Status changes** | Status badges use 11px small with uppercase for dense display |
| **Long text readability** | Clinical notes use 14px body with 1.5 line height for comfortable reading |

---

## 7. Spacing & Grid

### 7.1 Grid System

DensCare uses a **12-column flexible grid** with the following conventions:

**Desktop (primary, ≥1280px):**
- Container max-width: 1440px
- Content max-width: 1200px
- Column gap: 24px
- Content padding (workspace): 24px each side
- Left sidebar width: 240px (expanded), 64px (collapsed)

**Tablet (768-1023px):**
- Container: full-width
- Column gap: 16px
- Content padding: 16px each side
- Sidebar: collapsed (icon-only), overlays on open

**Mobile (<768px):**
- Container: full-width
- Column gap: 12px
- Content padding: 12px each side
- Sidebar: hidden, hamburger menu

### 7.2 Layout Patterns

**Standard page layout:**
```
┌─────────────────────────────────────────────┐
│ Page Header (title + breadcrumb + actions)  │  56px
├─────────────────────────────────────────────┤
│ Content Area                                │
│ ┌─────────┐ ┌────────────────────────┐      │
│ │ Filters │ │ Main Content           │      │
│ │ 240px   │ │ flex: 1               │      │
│ └─────────┘ └────────────────────────┘      │
│                                             │
│ Optional: Footer (actions, pagination)      │  48px
└─────────────────────────────────────────────┘
```

**Dashboard layout:**
```
┌─────────────────────────────────────────────┐
│ Dashboard Header (greeting + date)          │  48px
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │  Widget  │ │  Widget  │ │  Widget  │     │  equal columns
│ └──────────┘ └──────────┘ └──────────┘     │  gap: 24px
├─────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌──────────────────┐  │
│ │  Main Widget (2/3)│ │  Side (1/3)     │  │
│ └───────────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 8. Iconography

### 8.1 Icon Philosophy

Icons in DensCare are **utilitarian, not decorative.** Every icon communicates a specific action or state. Icons always accompany text in navigation; they never replace text in clinical contexts unless in a compact toolbar.

### 8.2 Icon Style

- **Style:** Outlined (stroke-based), 1.5px stroke weight
- **Family:** Lucide (open-source, consistent, MIT-licensed)
- **Sizes:** 16px (inline), 20px (sidebar), 24px (empty states, page headers)
- **Shape:** Rounded caps and joins, consistent corner radii
- **Filled variants:** Only for active states in navigation

**Rationale for outline style:** Filled icons compete with text. Outlined icons are more legible at small sizes and work better in data-dense interfaces. They also feel more professional and less cartoonish.

### 8.3 Icon Categories

| Category | Purpose | Sizes | Examples |
|----------|---------|-------|----------|
| **Navigation** | Sidebar and top bar actions | 20px | Dashboard, Patients, Calendar, Settings |
| **Action** | Buttons and interactive elements | 16px | Plus, Edit, Delete, Search, Filter |
| **Status** | Indicators and badges | 12-14px | Check, X, Alert, Clock, Info |
| **Medical** | Dental-specific representation | 20-24px | Tooth, Stethoscope, Prescription, X-ray |
| **File** | Document and attachment types | 16px | File, Image, PDF, Download |
| **Notification** | Alert center icons | 20px | Bell, Mail, Message, Warning |

### 8.4 Icon Rules

| Rule | Rationale |
|------|-----------|
| Icons never replace text in primary actions | Accessibility and clarity |
| Navigation uses icon + label always | Recognition and scanning |
| Toolbar buttons use icon + tooltip | Space efficiency with discoverability |
| Status indicators use icon + text + color | Color independence for accessibility |
| Same icon means same action everywhere | Consistency for muscle memory |

---

## 9. Illustrations

### 9.1 Illustration Philosophy

Illustrations in DensCare are **minimal, purposeful, and clinical.** They appear only in empty states, error states, and transitional moments. They are never decorative or playful.

### 9.2 Style Guidelines

- **Style:** Flat, minimal line art with subtle color fills
- **Color palette:** Drawn from the primary and neutral color tokens only
- **No human faces** — use abstract representations or silhouettes
- **No cartoon characters, animals, or whimsy**
- **Max 2 colors per illustration** (primary + neutral)
- **Subtle, not prominent** — illustrations should not distract from content

### 9.3 When to Use Illustrations

| State | Illustration | Emotion |
|-------|-------------|---------|
| Empty list | Empty folder/document with magnifying glass | Informational, not sad |
| No search results | Magnifying glass with question mark | Helpful, suggests alternatives |
| No data | Document with dash | Neutral, prompts action |
| Permission denied | Lock with shield | Secure, not punitive |
| 404 page | Broken link with map pin | Calm, provides navigation |
| Offline | Globe with disconnected line | Informational, not alarming |
| Success | Checkmark in circle | Positive but subdued |

### 9.4 When NOT to Use Illustrations

| Context | Alternative |
|---------|-------------|
| Loading states | Use skeleton loading instead |
| Error messages | Use text + icon instead |
| Tooltips and popovers | No illustration needed |
| Empty form fields | Just show the form |
| Dashboard widgets | Use data visualization |

---

## 10. Component Philosophy

### 10.1 Atomic Design Strategy

DensCare's component architecture follows a **simplified atomic design** model:

```
Atoms (Tokens) → Molecules (Inputs) → Organisms (Forms) → Templates (Pages)
```

| Level | Definition | Examples | Governance |
|-------|-----------|----------|------------|
| **Tokens** | Design primitives | Colors, spacing, typography | Centralized, immutable |
| **Atoms** | Single-purpose components | Button, Input, Badge, Avatar | Design system owned |
| **Molecules** | Composed atoms | SearchInput (Input + Button), FormField (Label + Input + Error) | Design system owned |
| **Organisms** | Complex composites | DataTable, FormSection, Wizard | Design system with module input |
| **Templates** | Page-level layouts | PatientProfile, AppointmentCalendar | Module team owned |
| **Pages** | Instantiated templates | PatientProfile: id=123 | Application owned |

### 10.2 Naming Convention

Components follow **PascalCase** with consistent suffixes:

```
{Purpose}{Type} 
Examples: PrimaryButton, PatientSearchInput, AppointmentTable
```

**Rules:**
- No abbreviations unless universally understood (e.g., `Btn`, `Nav`)
- Suffix indicates the HTML element or pattern: `Button`, `Input`, `Table`, `Dialog`, `Card`
- Boolean props are prefixed with `is-`, `has-`, or `show-`: `isDisabled`, `hasError`, `showSearch`

### 10.3 Composition Rules

| Rule | Rationale |
|------|-----------|
| Components accept `className` for layout overrides | Enables flexible positioning without breaking component internals |
| Components forward `ref` via `forwardRef` | Enables form libraries (React Hook Form) and focus management |
| Components accept `...rest` props for native HTML attributes | Enables ARIA attributes, test IDs, and data attributes |
| No component modifies global styles | Predictable rendering, no side effects |
| Every component has a `data-testid` prop | Enables automated testing without CSS class dependencies |

### 10.4 Variant Rules

| Pattern | Example | Guidelines |
|---------|---------|------------|
| **Style variants** | `primary`, `secondary`, `ghost`, `danger` | Max 5 variants per component |
| **Size variants** | `sm`, `md`, `lg` | Max 3 sizes per component |
| **State variants** | `default`, `hover`, `focus`, `disabled`, `error` | Every component has all states |
| **Orientation variants** | `horizontal`, `vertical` | Only when layout differs |

### 10.5 Accessibility Rules (Built-in)

Every component must:

1. Be keyboard navigable (Tab, Enter, Escape, Arrow keys)
2. Have visible focus indicators
3. Support ARIA labels and descriptions
4. Announce state changes to screen readers
5. Respect `prefers-reduced-motion`
6. Support high contrast mode

---

## 11. Component Library

### 11.1 Button

**Purpose:** Triggers an action or navigates to a destination.

**Variants:**

| Variant | Usage | When to Use | When NOT to Use |
|---------|-------|-------------|-----------------|
| `primary` | Main action on screen | Submit, Save, Create, Confirm | Destructive actions, secondary actions |
| `secondary` | Alternative action | Cancel, Back, Skip | Primary actions (creates confusion) |
| `ghost` | Low emphasis action | Edit inline, Remove item | High-importance actions |
| `danger` | Destructive action | Delete, Deactivate, Remove | Non-destructive actions |
| `link` | Text-only button | Navigate, "View all" | Primary actions |

**Sizes:** `sm` (32px), `md` (36px), `lg` (44px)

**States:** default, hover, focus, active, disabled, loading

**Keyboard:** Enter/Space to activate, Tab to navigate

**Accessibility:** Role="button", aria-label for icon-only variants, disabled attribute for disabled state

**Structure:**
```
┌─────────────────┐
│  [Icon]  Label   │
└─────────────────┘
```

### 11.2 Input

**Purpose:** Single-line text entry.

**Variants:** `default`, `error`, `disabled`, `readonly`

**Sizes:** `sm` (32px), `md` (36px), `lg` (44px)

**States:** default, hover, focus, filled, error, disabled, readonly

**Structure:**
```
┌─────────────────────────────────────────┐
│  Label (required *)                     │
├─────────────────────────────────────────┤
│  [Icon]  Input value            [Icon]  │
├─────────────────────────────────────────┤
│  Helper text or error message           │
└─────────────────────────────────────────┘
```

**Validation:** Inline validation on blur. Error state shows border color change + error icon + error message below.

### 11.3 Textarea

**Purpose:** Multi-line text entry for clinical notes, observations, and descriptions.

**Variants:** `default`, `error`, `disabled`

**Sizes:** `sm` (3 rows), `md` (5 rows), `lg` (8 rows)

**States:** Same as Input

**Clinical note consideration:** Minimum height of 3 rows to encourage adequate documentation. Auto-resize optional for longer notes.

### 11.4 Select / Dropdown

**Purpose:** Select from a predefined list of options.

**Variants:** `default`, `error`, `disabled`

**Sizes:** `sm`, `md`, `lg`

**States:** default, hover, focus, open, selected, error, disabled

**Searchable variant:** For options >15 items, show search input at top of dropdown

**Keyboard:** Arrow keys to navigate, Enter to select, Escape to close, Tab to move to next field

### 11.5 Autocomplete / Combobox

**Purpose:** Search and select from a large list, with type-ahead suggestions.

**Use cases:** Patient search, procedure search, doctor selection

**Behavior:**
- Debounced input (300ms)
- Shows suggestions after 2+ characters typed
- Keyboard navigable suggestions list
- Selected value becomes visible in input
- Clear button to reset

### 11.6 Checkbox

**Purpose:** Select multiple options from a set.

**Sizes:** `sm`, `md`

**States:** unchecked, checked, indeterminate, disabled, error

**Label position:** Right (default), Left (for table headers)

**Accessibility:** role="checkbox", aria-checked, aria-label

### 11.7 Radio Button

**Purpose:** Select exactly one option from a set.

**Sizes:** `sm`, `md`

**States:** unselected, selected, disabled, error

**Label position:** Right

**Group behavior:** Tab enters group, Arrow keys navigate within group

### 11.8 Switch / Toggle

**Purpose:** Toggle a binary setting on/off.

**Sizes:** `sm`, `md`

**States:** on, off, disabled

**Usage:** Settings, toggles, enable/disable features

**Label position:** Left (default)

### 11.9 Date Picker

**Purpose:** Select a single date or date range.

**Views:** Day (default), Month, Year

**Sizes:** `sm`, `md`, `lg`

**States:** default, hover, focus, selected, disabled, error, range-start, range-end, in-range

**Keyboard:** Arrow keys navigate days, Enter selects, Escape closes

**Clinical consideration:** Date of birth picker should allow quick year navigation (decade view). Appointment date picker should highlight available days based on working hours.

### 11.10 Time Picker

**Purpose:** Select a time slot.

**Views:** 15-minute intervals (matching backend allowed durations)

**Sizes:** `sm`, `md`, `lg`

**States:** default, hover, selected, disabled, error, unavailable

**Clinical consideration:** Only show available time slots based on doctor's schedule. Disable past times for same-day booking.

### 11.11 Calendar (Appointment Calendar)

**Purpose:** View and manage appointments in a calendar grid.

**Views:** Day (hourly slots), Week (5 columns + hours), Month (grid)

**States:** 
- Available time slot (empty)
- Booked (with patient name + procedure type)
- Selected (highlighted)
- Past (dimmed)
- Doctor unavailable (gray)
- Lunch/break (striped)

**Interaction:** Click to select, drag to create appointment, drag existing to reschedule

**Density:** 
- Day view: 60px per hour row, 15-min slots
- Week view: Column per day, 40px per hour
- Month view: Compact, shows patient count per day

### 11.12 Avatar

**Purpose:** Represent a user or entity visually.

**Variants:** `user` (initials), `patient` (initials), `doctor` (with status dot)

**Sizes:** `sm` (24px), `md` (32px), `lg` (40px), `xl` (56px)

**States:** default, with-status (active/inactive), clickable, disabled

**Fallback:** User initials on neutral background, generated color based on name hash

### 11.13 Badge

**Purpose:** Display status, count, or category.

**Variants:** `default`, `success`, `warning`, `danger`, `info`, `neutral`

**Sizes:** `sm` (18px height), `md` (22px height)

**States:** default, dismissible, with-icon

**Content:** Short text (1-3 words), optional icon, optional count number

**Clinical statuses:** Active (green), Inactive (gray), Pending (amber), Draft (gray), Completed (blue), Cancelled (red), Finalized (purple)

### 11.14 Chip / Tag

**Purpose:** Display compact labels for filtering, selections, or categorization.

**Variants:** `default`, `removable`, `selected`, `disabled`

**Sizes:** `sm` (22px), `md` (26px)

**States:** default, hover, selected, removed (animated), disabled

**Usage:** Specialty tags, procedure category tags, filter chips

### 11.15 Alert / Banner

**Purpose:** Display important system-level messages.

**Variants:** `info`, `success`, `warning`, `error`

**Sizes:** `compact` (single line), `default` (with description), `with-action` (with button)

**States:** visible, dismissible (with close button), transitioning out

**Content:** Icon + title + optional description + optional action

**Position:** Top of page or section, below breadcrumbs

### 11.16 Toast / Notification

**Purpose:** Brief, auto-dismissing feedback messages.

**Variants:** `success`, `error`, `warning`, `info`

**Position:** Top-right corner (stacked)

**Duration:** 4 seconds (info/success), 6 seconds (warning/error), manual dismiss always available

**Animation:** Slide in from right, fade out

**Content:** Icon + title + optional description + close button

### 11.17 Dialog / Modal

**Purpose:** Focused interaction that requires user attention.

**Sizes:** `sm` (400px), `md` (560px), `lg` (720px), `xl` (960px), `full` (viewport - 40px padding)

**States:** open (with backdrop), closing (animated), closed

**Structure:**
```
┌──────────────────────────────────────┐
│  [Title]                     [Close] │  Header
├──────────────────────────────────────┤
│                                      │  Content (scrollable)
│                                      │
├──────────────────────────────────────┤
│  [Secondary]               [Primary] │  Footer
└──────────────────────────────────────┘
```

**Backdrop:** Semi-transparent overlay, clicking closes (except for critical confirmations)

**Keyboard:** Escape to close, Tab trapped within modal, focus restored on close

**Clinical consideration:** Confirmation dialogs for FINALIZE, DEACTIVATE, CANCEL use explicit language ("This action cannot be undone") and prevent escape-to-close for FINALIZE.

### 11.18 Drawer / Slide-out Panel

**Purpose:** Secondary content panel that slides in from the right.

**Sizes:** `sm` (360px), `md` (480px), `lg` (640px)

**Positions:** Right (default), Left (for navigation on mobile)

**States:** open, closing, closed

**Usage:** Patient registration (quick form), notification panel, detail view (reference data)

**Keyboard:** Escape to close, Tab trapped within drawer

**Backdrop:** Optional (light overlay or no overlay for non-blocking drawers)

### 11.19 Tabs

**Purpose:** Organize related content into switchable panels.

**Variants:** `underline` (default), `pills` (secondary), `cards` (for dashboards)

**States:** default, hover, active, disabled

**Content:** Icon + label (optional), badge count

**Keyboard:** Tab to enter group, Arrow keys to switch tabs

**Clinical usage:** Patient profile tabs: Overview, Records, Treatment Plans, Appointments, Audit

### 11.20 Accordion

**Purpose:** Expand/collapse sections of content.

**Variants:** `single` (one open at a time), `multiple` (multiple open)

**States:** collapsed, expanded, hover, disabled

**Anatomy:** Header (clickable) → Expandable content panel

**Keyboard:** Tab to focus, Enter/Space to toggle, Arrow keys to navigate between accordions in a group

### 11.21 Card

**Purpose:** Container for related content.

**Variants:** `default` (bordered), `elevated` (with shadow), `clickable` (hover effect + cursor), `dashboard` (with header + content)

**Sizes:** Content-determined

**States:** default, hover (clickable only), selected, disabled

**Structure:**
```
┌──────────────────────────────────────┐
│  [Header]                   [Action] │  (optional)
├──────────────────────────────────────┤
│                                      │
│  Content                             │
│                                      │
└──────────────────────────────────────┘
```

### 11.22 Table

See [Section 12: Table System](#12-table-system)

### 11.23 Timeline

**Purpose:** Display chronological events.

**Usage:** Patient activity history, treatment plan version history, audit log

**Variants:** `default` (vertical with dots), `compact` (dense, shorter entries)

**States:** default, hover (clickable entries), active (current step)

**Content:** Date/time (left column), Event description, User who performed action, Status badge

### 11.24 Pagination

**Purpose:** Navigate through pages of data.

**Variants:** `default` (page numbers), `compact` (prev/next only), `load-more` (infinite scroll)

**Sizes:** `sm`, `md`

**States:** default, active, disabled (first/last page)

**Content:** [Prev] [1] [2] [3] [...] [10] [Next] — "Showing 1-20 of 156 results"

### 11.25 Breadcrumb

**Purpose:** Show current location in the navigation hierarchy.

**Variants:** `default` (with chevrons), `compact` (truncated with ellipsis)

**States:** default, hover, active (current page, not clickable)

**Content:** Home > Patients > {Patient Name} > Treatment Plans > {Plan Code}

### 11.26 Search Input

**Purpose:** Search within a specific context.

**Variants:** `default`, `global` (Cmd+K style), `filter` (with advanced options)

**Sizes:** `sm` (32px), `md` (36px), `lg` (44px)

**States:** default, focused, has-results, no-results, loading (spinner), error

**Keyboard:** `Cmd+K` for global search, Escape to clear/close, Arrow keys to navigate results

### 11.27 Global Search (Cmd+K)

**Purpose:** Search across all entities from any screen.

**Behavior:**
- Triggered by `Cmd+K` or clicking the search bar
- Modal overlay with search input focused
- Debounced (300ms) type-ahead results
- Results grouped by entity type with icons
- Keyboard navigable (Arrow keys + Enter)
- Recent searches shown when empty
- Escape to close

**Categories:** Patients, Appointments, Treatment Plans, Doctors, Users (admin only)

### 11.28 Filter Panel

**Purpose:** Filter data in list views.

**Variants:** `sidebar` (left panel), `dropdown` (per-column in table), `inline` (above table)

**Components:** Search input, checkbox groups, date range picker, select dropdowns, clear all button

**States:** default, has-active-filters (with badge count), expanded, collapsed

### 11.29 Sidebar

**Purpose:** Primary application navigation.

**Variants:** `expanded` (240px, icon + label), `collapsed` (64px, icon only)

**Sections:** Main, Clinical, Administrative, Future

**States:** default, hover (nav item), active (current module), collapsed, with-badge (pending count)

**Collapsed behavior:** Tooltip on hover shows label. Sub-menus expand on click as popover.

### 11.30 Top Navigation Bar

**Purpose:** Global actions and user context.

**Height:** 56px (fixed)

**Content:** Logo, Global Search, Context Switcher, Notifications Bell, Help Button, Profile Menu

**States:** sticky (stays on scroll), hide-on-scroll (for content-heavy pages)

### 11.31 Wizard / Stepper

**Purpose:** Guide users through multi-step processes.

**Usage:** Treatment plan creation, patient registration, complex forms

**Variants:** `horizontal` (steps across top), `vertical` (steps in sidebar)

**States:** completed (with checkmark), current (active), upcoming (disabled), error (with warning)

**Content:** Step number or icon, Step title, Optional description

**Keyboard:** Tab to navigate between steps and content, Enter to proceed

### 11.32 Progress Bar

**Purpose:** Show progress of a process or task.

**Variants:** `determinate` (known percentage), `indeterminate` (unknown duration)

**Sizes:** `sm` (4px), `md` (8px), `lg` (12px)

**States:** default, success (green), error (red), paused (amber)

**Content:** Label (optional), Percentage text (optional), Estimated time remaining (optional)

### 11.33 Loading Spinner

**Purpose:** Indicate an ongoing operation.

**Variants:** `circular` (default), `dots` (for inline loading)

**Sizes:** `sm` (16px), `md` (24px), `lg` (40px), `xl` (64px)

**Context:** In buttons (sm), inline with text (sm + label), section loading (md), full page (lg with backdrop)

### 11.34 Skeleton

**Purpose:** Placeholder content while data loads.

**Variants:** `text` (single line), `card` (rectangular block), `table` (row pattern), `avatar` (circle), `custom` (custom shape)

**Animation:** Shimmer effect (gradient sweep left to right)

**Duration:** Loop until content loads (average 200-500ms, max 3s before showing error)

### 11.35 Empty State

**Purpose:** Display when a list or search has no content.

**Structure:** Illustration (optional) + Title + Description + Action button (optional)

**Variants:** `no-data` (list is empty), `no-results` (search found nothing), `no-permission` (access denied), `no-connection` (offline)

### 11.36 Error State

**Purpose:** Display when an operation fails.

**Structure:** Error icon + Title + Error description + Retry button + Contact support link

**Variants:** `section` (error in a card/section), `page` (full page error), `inline` (form field error)

### 11.37 Metric Card / Stat Card

**Purpose:** Display a key performance indicator.

**Structure:** Icon (optional) + Label + Value + Trend indicator (optional) + Sparkline (optional)

**Sizes:** `sm` (compact, for sidebar), `md` (standard, for dashboard grids)

**States:** default, loading (skeleton), error (dash instead of value), updated (subtle highlight animation)

### 11.38 Tooltip

**Purpose:** Provide additional context on hover or focus.

**Position:** Top (default), Bottom, Left, Right

**Delay:** 500ms appear, 200ms disappear

**Content:** Short text only — no interactions, no links, no images

**Keyboard:** Focus on parent element shows tooltip

### 11.39 Notification Center

**Purpose:** View all system notifications.

**Trigger:** Bell icon in top bar

**Panel:** Drawer from right (480px)

**Groups:** Today, This Week, Earlier

**Items:** Icon (type-indicating) + Title + Description + Timestamp + Read/Unread indicator

**Actions:** Mark as read, Mark all as read, Click to navigate to context

**Empty state:** "No new notifications" with checkmark icon

---

## 12. Table System

### 12.1 Enterprise Table Guidelines

Tables are the primary data display pattern in DensCare. Every list view uses a table.

### 12.2 Table Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Search] [Filters ▼] [Export ▼]                    [Density ▼]    │  Toolbar
├─────────────────────────────────────────────────────────────────────┤
│  ☐  Name     │ Patient Code │ DOB       │ Phone        │ Status   │  Header (sticky)
├─────────────────────────────────────────────────────────────────────┤
│  ☐  Juan C.  │ PAT-000001   │ 1990-05-15│ +639123456789│ ● Active │  Row (striped)
│  ☐  Maria S. │ PAT-000002   │ 1985-11-20│ +639987654321│ ● Active │
│  ☐  Lisa W.  │ PAT-000003   │ 1978-03-08│ +639555123456│ ○ Inactive│
├─────────────────────────────────────────────────────────────────────┤
│  Showing 1-3 of 156 patients                    [1] [2] [3] [...]   │  Footer
└─────────────────────────────────────────────────────────────────────┘
```

### 12.3 Density Modes

| Mode | Row Height | Cell Padding | Usage |
|------|-----------|-------------|-------|
| `comfortable` | 52px | 16px horizontal, 14px vertical | Detail-oriented views |
| `standard` | 44px | 12px horizontal, 10px vertical | **Default** — balance of density and readability |
| `compact` | 36px | 8px horizontal, 6px vertical | Data-heavy views, admin panels |

### 12.4 Sticky Elements

- **Header:** Always sticky when scrolling vertically
- **First column** (name/identifier): Sticky when scrolling horizontally
- **Action column** (last): Sticky when scrolling horizontally
- **Selection checkbox:** Sticky, always visible

### 12.5 Bulk Selection

- Checkbox in header = select all (current page)
- Shift-click = range select
- `Cmd/Ctrl+A` = select all (all pages)
- Selected count shown in toolbar: "3 selected"
- Actions enabled when ≥1 selected: [Approve] [Deactivate] [Export]

### 12.6 Sorting & Filtering

- **Sorting:** Click column header to toggle asc/desc. Active sort column shows arrow indicator.
- **Filtering:** Per-column filter dropdown or top-level filter panel.
- **Multi-sort:** `Shift + Click` adds secondary sort.
- **Search:** Global search within table via toolbar search input.

### 12.7 Column Priorities

On smaller screens, columns are hidden based on priority:

| Priority | Behavior |
|----------|----------|
| 1 (Critical) | Always visible | 
| 2 (High) | Hidden on tablet |
| 3 (Medium) | Hidden on small desktop |
| 4 (Low) | Hidden on desktop, accessible via expand row |

---

## 13. Form System

### 13.1 Form Layout

**Standard form layout (single column):**
```
┌────────────────────────────────────────┐
│  Form Title                            │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐    │
│  │ Field Label *                  │    │
│  │ [Input                    ]    │    │
│  │ Helper text                    │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │ Field Label                    │    │
│  │ [Input                    ]    │    │
│  └────────────────────────────────┘    │
│  ┌────────────┐ ┌──────────────────┐   │
│  │ [Cancel]   │ │ [Save]           │   │
│  └────────────┘ └──────────────────┘   │
└────────────────────────────────────────┘
```

**Multi-column form (for related fields):**
```
┌────────────────────────────────────────┐
│  ┌──────────────┐ ┌──────────────┐     │
│  │ First Name * │ │ Last Name *  │     │
│  └──────────────┘ └──────────────┘     │
│  ┌────────────────────────────────┐    │
│  │ Address                        │    │
│  └────────────────────────────────┘    │
└────────────────────────────────────────┘
```

### 13.2 Sectioning

Long forms are divided into logical sections:

```
┌─ Form Section ──────────────────────────┐
│  Section Title (h4)                     │
│  ┌─────────────────────────────────┐    │
│  │ Field 1            Field 2      │    │
│  │ Field 3                         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
┌─ Form Section ──────────────────────────┐
│  Section Title (h4)                     │
│  ...                                    │
└─────────────────────────────────────────┘
```

### 13.3 Validation Strategy

| Level | Timing | Method |
|-------|--------|--------|
| **Inline** | On blur | Field-level validation (format, required, length) |
| **Section** | On section advance | Cross-field validation (date range, duplicate check) |
| **Form** | On submit | All-field validation + business rule validation via API |

**Error display:** Error icon + error message below the field. Red border on field.

**Success feedback:** Green checkmark icon appears briefly, then transitions to saved state.

### 13.4 Required vs Optional Fields

- Required fields marked with red asterisk `*` after label
- Optional fields explicitly labeled "(optional)" in label
- At least one required field must be visible before the fold
- Submit button disabled until all required fields are valid

### 13.5 Keyboard Navigation

- Tab moves forward through form fields
- Shift+Tab moves backward
- Enter submits the form (from any field)
- Escape closes the form (if modal/slide-out)
- Arrow keys navigate within select/radio/checkbox groups

### 13.6 Autosave Strategy (Future)

For long forms (treatment plans, clinical records):
- Autosave every 30 seconds while form has unsaved changes
- Show "Saving..." indicator → "Saved" confirmation
- Form can be saved as DRAFT at any point
- Unsaved changes warning on navigation away

---

## 14. Motion System

### 14.1 Motion Philosophy

Motion in DensCare is **functional, not ornamental.** Every animation serves one purpose: communicating what happened, what's happening, or what will happen. Motion is subtle (under 300ms), consistent (same easing everywhere), and never interferes with task completion.

### 14.2 Motion Duration Guidelines

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover state change | 100ms | ease-out |
| Focus ring appearance | 150ms | ease-out |
| Button click feedback | 100ms | ease-out |
| Dropdown open | 200ms | ease-out |
| Dropdown close | 150ms | ease-in |
| Tooltip appear | 200ms (delayed 500ms) | ease-out |
| Tooltip disappear | 100ms | ease-in |
| Modal open | 250ms | ease-out |
| Modal close | 200ms | ease-in |
| Drawer slide in | 300ms | ease-out |
| Drawer slide out | 250ms | ease-in |
| Page transition | 200ms | ease-in-out |
| Toast appear | 300ms | ease-out |
| Toast disappear | 200ms | ease-in |
| Skeleton shimmer | 1.5s loop | linear |
| Accordion expand | 200ms | ease-out |
| Progress bar fill | 300ms | ease-out |

### 14.3 Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:
- Remove all movement (no slide, fade, scale)
- Keep opacity transitions (0→1) for visibility changes
- Remove hover scale effects
- Remove skeleton shimmer animation (use static gray)
- Instant visibility for modals and drawers (no slide)

### 14.4 Page Transitions

- Route changes: Fade content out (150ms) → New content fades in (200ms)
- No slide transitions between pages (disorienting in clinical context)
- Dashboard widget refresh: Staggered fade (50ms delay between widgets)

---

## 15. Responsive Strategy

### 15.1 Desktop Primary (≥1280px)

This is the **primary target** — clinic workstations.

- Full sidebar (240px) with icon + label
- Multi-column layouts (2-3 columns in dashboards, 2 columns in forms)
- Standard table density
- Full page-width content
- Dashboard grids: 3-4 columns

### 15.2 Laptop / Small Desktop (1024-1279px)

- Sidebar collapses to icon-only (64px)
- Dashboard grids: 2-3 columns
- Tables remain full width but may hide low-priority columns
- Forms remain 2 columns where possible

### 15.3 Tablet (768-1023px)

- Sidebar hidden — hamburger menu toggle
- Dashboard grids: 2 columns → 1 column
- Tables: Hide priority 3+ columns, horizontal scroll allowed
- Forms: Single column layout
- Bottom navigation bar (icons only) for primary navigation
- Touch targets at least 44px

### 15.4 Mobile (<768px)

- Full-width single column layout
- Tables: Show only priority 1 columns, horizontal scroll
- Dashboards: Single column stack
- Sidebar: Full-screen overlay when open
- Bottom navigation with 4-5 primary destinations
- Forms: Single column, full-width inputs
- Dialogs: Full-screen (not modal)
- Touch targets: 44px minimum

### 15.5 Future Kiosk Mode

- Full-screen kiosk mode for patient check-in
- Simplified navigation (no sidebar, limited top bar)
- Large touch targets (48px+)
- High contrast mode
- Session timeout to return to home screen

---

## 16. Accessibility

### 16.1 Target Standard

**WCAG 2.1 Level AA** — minimum. Level AAA targeted for color contrast and text spacing.

### 16.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Navigate forward through focusable elements |
| Shift+Tab | Navigate backward |
| Enter / Space | Activate focused element |
| Escape | Close modal, drawer, dropdown, dismiss menu |
| Arrow keys | Navigate within a group (tabs, radio, select, table rows) |
| Cmd/Ctrl+K | Global search |
| Cmd/Ctrl+Shift+P/A/R/T | Quick actions (new patient/appointment/record/plan) |
| / | Focus local search |
| ? | Show keyboard shortcuts overlay |

### 16.3 Focus Indicators

- **Style:** 2px solid ring with 2px offset
- **Color:** `color-primary-500` (#3B82F6)
- **Visible on:** All interactive elements (links, buttons, inputs, selects, checkboxes, radios)
- **Never:** `outline: none` without providing an alternative focus style

### 16.4 ARIA Requirements

| Element | Required ARIA |
|---------|---------------|
| Button | `role="button"` (if not a `<button>`) |
| Input | `aria-label` or associated `<label>` |
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Alert | `role="alert"` |
| Tab panel | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` |
| Navigation | `role="navigation"`, `aria-label` |
| Table | `<caption>` or `aria-label` |
| Status | `role="status"` for live regions |
| Error | `aria-describedby` linking error text to input |
| Progress | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |

### 16.5 Screen Reader Support

- All images must have `alt` text
- Icons must have `aria-hidden="true"` (or `alt=""`) if decorative
- Status changes announced via `aria-live="polite"`
- Form validation errors announced via `aria-live="assertive"`
- Loading states announced via `aria-busy="true"`
- Dynamic content updates announced via `aria-live` regions

### 16.6 Color Contrast

| Element | Minimum Ratio | Target Ratio |
|---------|--------------|--------------|
| Normal text (<18px) | 4.5:1 | 7:1 |
| Large text (≥18px) | 3:1 | 4.5:1 |
| UI components | 3:1 | 4.5:1 |
| Disabled text | 3:1 | — |
| Placeholder text | 3:1 | 4.5:1 |

### 16.7 Touch Targets

- Minimum: 44×44px (WCAG 2.1)
- Target: 48×48px for frequently used actions
- Spacing: 8px minimum between touch targets

### 16.8 Text Scaling

- All text uses relative units (`rem`), not fixed pixels
- Layout must function correctly up to 200% zoom
- No horizontal scroll at 200% zoom (content reflows)
- Line height increases proportionally with text size

---

## 17. Developer Guidelines

### 17.1 Component Implementation Standards

| Standard | Practice |
|----------|----------|
| **File structure** | One component per file in `src/components/{component-name}/` |
| **Exports** | Named export for component, default export discouraged |
| **Props** | TypeScript interface exported as `{ComponentName}Props` |
| **Styling** | Tailwind CSS classes only — no inline styles, no CSS modules |
| **Class merging** | Use `cn()` utility (clsx + tailwind-merge) for conditional classes |
| **Forwarded refs** | All interactive components use `forwardRef` |
| **Testing** | Component test in `__tests__/{component-name}.test.tsx` |

### 17.2 Folder Structure

```
src/
├── components/              # Shared components
│   ├── ui/                  # Basic atoms (Button, Input, Badge)
│   ├── layout/              # Shell components (Sidebar, TopBar, Breadcrumb)
│   ├── data-display/        # Data components (Table, Timeline, StatCard)
│   ├── feedback/            # Feedback components (Toast, Alert, Dialog)
│   └── forms/               # Form components (FormField, DatePicker, Wizard)
├── features/                # Feature-specific components
│   ├── patients/
│   ├── appointments/
│   ├── treatment-plans/
│   └── ...
├── hooks/                   # Shared hooks
├── lib/                     # Utilities and helpers
├── stores/                  # Zustand stores
├── types/                   # Shared TypeScript types
└── styles/                  # Global styles and theme
```

### 17.3 Tailwind CSS Configuration

The Tailwind config extends the default theme with DensCare tokens:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: { 50: '#EFF6FF', ..., 700: '#1D4ED8' },
        neutral: { 50: '#F8FAFC', ..., 900: '#0F172A' },
        success: { DEFAULT: '#059669', bg: '#ECFDF5' },
        warning: { DEFAULT: '#D97706', bg: '#FFFBEB' },
        danger: { DEFAULT: '#DC2626', bg: '#FEF2F2' },
        info: { DEFAULT: '#2563EB', bg: '#EFF6FF' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '120': '30rem',
      },
    },
  },
};
```

### 17.4 `cn()` Utility

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 18. Design Governance

### 18.1 Design Review Process

| Stage | Reviewers | Criteria |
|-------|-----------|----------|
| **Token change** | Design Director | Only if existing tokens cannot serve the use case |
| **New component** | Design System Architect | Fits atomic design, no overlap with existing, all states covered |
| **Component change** | Design Team | Backward compatible, documented in changelog |
| **Page/screen design** | Lead Designer | Follows design system, no new patterns without discussion |
| **Accessibility** | Accessibility Specialist | WCAG 2.1 AA compliance verified |

### 18.2 Versioning

The design system follows semantic versioning:

| Version | Change Type | Example |
|---------|-------------|---------|
| **Major** | Breaking changes | Token restructuring, breaking API changes |
| **Minor** | Non-breaking additions | New component, new variant, new token |
| **Patch** | Bug fixes, refinements | Spacing adjustment, color refinement |

### 18.3 Contribution Guidelines

1. All component proposals must include: purpose, variants, states, keyboard behavior, accessibility considerations
2. No component is approved without all states documented (default, hover, focus, active, disabled, error, loading)
3. New tokens require approval from the Design Director
4. Changes to existing components must be backward compatible or clearly documented as breaking

---

## 19. Future Expansion

### 19.1 Dark Mode

The token structure supports dark mode via CSS custom properties:

```css
:root {
  --color-bg-page: #F8FAFC;
  --color-bg-card: #FFFFFF;
  --color-text-primary: #0F172A;
}

[data-theme="dark"] {
  --color-bg-page: #0F172A;
  --color-bg-card: #1E293B;
  --color-text-primary: #F8FAFC;
}
```

All components use CSS variables (via Tailwind) so dark mode is automatically applied.

### 19.2 High Contrast Mode

A separate token set for high contrast mode will use:
- Increased color contrast (7:1+ for all text)
- Thicker borders for component boundaries
- Solid backgrounds instead of transparent hover states
- Underlined links always

### 19.3 Multi-Brand Support (Future)

The token system supports multiple brand themes by swapping the `primary` palette:
- Replace `primary-*` values
- All component references to `primary-500` automatically update
- Neutral palette remains stable

### 19.4 Component Expansion Plan

| Phase | New Components |
|-------|---------------|
| **Current** | All components documented in Section 11 |
| **Phase 2** | File Upload, Rich Text Editor, Chart components (Recharts wrappers) |
| **Phase 3** | Kanban Board (for lab cases), Color Picker, Signature Pad |
| **Phase 4** | Gantt Chart (for treatment timelines), Org Chart (for multi-clinic) |

---

## Appendix A: Design System Checklist

| Requirement | Status |
|-------------|--------|
| Design tokens defined for all core properties | ✅ Complete |
| Color system with semantic, status, medical alert colors | ✅ Complete |
| Typography scale with Inter typeface | ✅ Complete |
| Spacing scale based on 4px unit | ✅ Complete |
| Grid system for desktop, tablet, mobile | ✅ Complete |
| Iconography guidelines with Lucide family | ✅ Complete |
| Illustration style defined | ✅ Complete |
| Component philosophy with atomic design | ✅ Complete |
| All 30+ components documented with states | ✅ Complete |
| Table system with density and sticky behavior | ✅ Complete |
| Form system with validation strategy | ✅ Complete |
| Motion system with timing guidelines | ✅ Complete |
| Responsive strategy for all breakpoints | ✅ Complete |
| Accessibility to WCAG 2.1 AA+ | ✅ Complete |
| Developer guidelines with code examples | ✅ Complete |
| Design governance and contribution process | ✅ Complete |

---

> **Document Status:** Final  
> **Next Document:** DensCare UI/UX Design (Part 2.2) — Wireframes, Mockups, and Prototypes  
> **Version:** 1.0.0  
> **Design System Token Reference:** See `src/styles/theme.css` (to be generated)
