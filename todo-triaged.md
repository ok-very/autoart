# AutoArt Todo List - Triaged & Organized

*Last Updated: 2026-01-25*

## Operating rules

- This file is the **triage source of record** for outstanding work.
- Do not track "completed" locally here; closeout happens by closing the linked GitHub issue.
- Every item must be either:
  - Linked to an **open** GitHub issue, or
  - Marked **(Needs GitHub issue)**.

---

## GitHub open issues (index)

### AutoArt (ok-very/autoart)

**AI/Gemini**
- #118 Gemini AI: drafts, filenames, contacts
- #117 Gemini Vision: deep crawl fallback

**Import/Export**
- #74 Import Workbench: runner + Gemini
- #17 InDesign data merge CSV

**Workspace/Surfaces**
- #68 Surfaces: header → dockable
- #66 Surface: Mail + mappings
- #65 Surface: Inspector + mappings
- #64 Electron SPA shell
- #62 Multi-window popouts

**Features**
- #87 Command Palette
- #86 Monday Sync Settings
- #85 Templating Engine
- #84 Email Notices API
- #83 Email Ingestion
- #82 User Accounts
- #81 Assignee Chip
- #79 Workflow Interactions
- #55 Automail Testing
- #44 Google OAuth (bug)
- #33 Composer UX

**Tooling**
- #8 Docs + Automation

### AutoHelper (ok-very/autohelper)

- #26 Runner + toasts + Gemini
- #25 PDF import + ref
- #12 Report endpoint
- #11 Intake manifest endpoint
- #10 Snapshot endpoint
- #9 Fetch endpoints

---

## 🔴 CRITICAL ISSUES

### 1. Dockview hard constraint nullifies workspace layouts

**Status:** Architecture Issue
**Location:** [MainLayout.tsx:409-411](frontend/src/ui/layout/MainLayout.tsx#L409-L411)

**Problem:** Panels are always added into the center workspace as tabs, ignoring `defaultPlacement` hints from `panelRegistry.ts`. This makes workspace presets (Plan, Act, Review) effectively non-functional.

**Tracking:** (Needs GitHub issue)

---

### 2. Import Step 6: Post-import navigation

**Status:** UX Issue
**Location:** [Step6Execute.tsx:94](frontend/src/workflows/import/wizard/steps/Step6Execute.tsx#L94)

**Problem:** After successful import, user is redirected to `/projects` (loses context) rather than being taken to the imported project.

**Tracking:** (Needs GitHub issue)

---

### 3. Google OAuth integration is cosmetic

**Status:** Bug

**Tracking:** (GitHub: [autoart#44](https://github.com/ok-very/autoart/issues/44))

---

## 🟡 UX IMPROVEMENTS

### 1. Import Step 5: Unclear purpose

**Status:** Functional but Confusing
**Location:** [Step5Preview.tsx](frontend/src/workflows/import/wizard/steps/Step5Preview.tsx)

**Tracking:** (Needs GitHub issue)

---

### 2. ClassificationPanel display conditions could be clearer

**Status:** Working as Designed, but Could Be Clearer
**Location:** [ImportWorkflowLayout.tsx:26-40](frontend/src/workspace/layouts/workflows/ImportWorkflowLayout.tsx#L26-L40)

**Tracking:** (Needs GitHub issue)

---

### 3. Step 2: Parent status pill enhancement

**Status:** Feature Request
**Location:** [Step2ConfigureMapping.tsx](frontend/src/workflows/import/wizard/steps/Step2ConfigureMapping.tsx)

**Tracking:** (Needs GitHub issue)

---

## 🟢 DATA MODEL MAINTENANCE

### Monday field definitions alignment (timeline + reduce "custom")

**Status:** Technical debt / data model decision

**Tracking:** (Needs GitHub issue)

Notes:

- Monday `timeline` needs explicit mapping to canonical types.
- Reduce reliance on `custom` semantic role.

---

## 📋 BACKLOG / LOWER PRIORITY

### Import/Export Workbench + Runner integration

- Import Workbench runner connector (GitHub: [autoart#74](https://github.com/ok-very/autoart/issues/74)).
- AutoHelper runner execution + progress + refs (GitHub: [autohelper#26](https://github.com/ok-very/autohelper/issues/26)).
- AutoHelper PDF artifact import + ref registration (GitHub: [autohelper#25](https://github.com/ok-very/autohelper/issues/25)).

---

### Export Workbench / Print

- InDesign data merge CSV export module (GitHub: [autoart#17](https://github.com/ok-very/autoart/issues/17)).

---

### Workspace shell / surfaces / popouts

- Migrate header navigation items into dockable surfaces (GitHub: [autoart#68](https://github.com/ok-very/autoart/issues/68)).
- Multi-window popouts + IPC context sync (GitHub: [autoart#62](https://github.com/ok-very/autoart/issues/62)).
- Electron SPA shell (GitHub: [autoart#64](https://github.com/ok-very/autoart/issues/64)).
- SelectionInspector surface + mappings UI (GitHub: [autoart#65](https://github.com/ok-very/autoart/issues/65)).
- Mail surface + email↔record/action mappings (GitHub: [autoart#66](https://github.com/ok-very/autoart/issues/66)).

---

### Product features

- Composer UX reevaluation (GitHub: [autoart#33](https://github.com/ok-very/autoart/issues/33)).
- Global Command Palette (GitHub: [autoart#87](https://github.com/ok-very/autoart/issues/87)).
- Monday Board Sync Settings (GitHub: [autoart#86](https://github.com/ok-very/autoart/issues/86)).

---

### Email / automation / accounts

- Automail Phase 4: Testing & Validation (GitHub: [autoart#55](https://github.com/ok-very/autoart/issues/55)).
- Email Ingestion & Comms Tab (GitHub: [autoart#83](https://github.com/ok-very/autoart/issues/83)).
- Email Notices API (GitHub: [autoart#84](https://github.com/ok-very/autoart/issues/84)).
- Templating Engine (GitHub: [autoart#85](https://github.com/ok-very/autoart/issues/85)).
- User Account Management (GitHub: [autoart#82](https://github.com/ok-very/autoart/issues/82)).

---

## 🔍 NEEDS INVESTIGATION

### Fields view & contact groups

**Tracking:** (Needs GitHub issue)

- Contact group auto-population: determine provenance, canonicalize categories.
- Inspector attachment: "Inspector doesn't attach to field view".
- Data migration/seed: re-migrate DB and validate useful seed data.

---

### ExportContextProvider / "aggregate" mode

**Tracking:** (Needs GitHub issue)

- Define what aggregate mode is.
- Identify which panels need export context.

---

### Step 4 column names

**Tracking:** (Needs GitHub issue)

- Clarify which Step 4 columns need renaming and the target names.

---

## 🧰 Tooling / docs

- Documentation + automation + maintenance tooling (GitHub: [autoart#8](https://github.com/ok-very/autoart/issues/8)).
