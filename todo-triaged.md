# AutoArt Todo List - Triaged & Organized
*Last Updated: 2026-01-24*

## Operating rules

- This file is the **triage source of record** for outstanding work.
- Do not track “completed” locally here; closeout happens by closing the linked GitHub issue.
- Every item must be either:
  - Linked to an **open** GitHub issue, or
  - Marked **(Needs GitHub issue)**.

---

## GitHub open issues (index)

### AutoArt (ok-very/autoart)

- [autoart#72](https://github.com/ok-very/autoart/issues/72) Add shared Gantt projection + print layout types in `@autoart/shared`.
- [autoart#73](https://github.com/ok-very/autoart/issues/73) Export Workbench: Gantt timeline with cursor selection, DAW zoom, and PDF export via print route.
- [autoart#74](https://github.com/ok-very/autoart/issues/74) Import Workbench: Runner connector (AutoCollector) + HTML preview → Export module + optional Gemini review/repair.
- [autoart#68](https://github.com/ok-very/autoart/issues/68) Surface modules: migrate header navigation items into dockable surfaces.
- [autoart#62](https://github.com/ok-very/autoart/issues/62) Multi-window popouts: Dockview popout + Electron IPC context sync.
- [autoart#64](https://github.com/ok-very/autoart/issues/64) Electron SPA shell: desktop packaging + secure preload bridge + popout-capable entrypoint.
- [autoart#65](https://github.com/ok-very/autoart/issues/65) Surface: SelectionInspector (dock/drawer/popout) + cross-surface mappings UI.
- [autoart#66](https://github.com/ok-very/autoart/issues/66) Surface: Mail (inbox/triage) as SPA panel + popout, with email↔record/action mappings.
- [autoart#55](https://github.com/ok-very/autoart/issues/55) Automail Phase 4: Testing & Validation.
- [autoart#44](https://github.com/ok-very/autoart/issues/44) Google OAuth integration is cosmetic - does not trigger actual OAuth flow.
- [autoart#9](https://github.com/ok-very/autoart/issues/9) Fix dropdown flicker in header UI.
- [autoart#33](https://github.com/ok-very/autoart/issues/33) UX: Reevaluate Composer page layout and functionality.
- [autoart#87](https://github.com/ok-very/autoart/issues/87) [Agent] Global Command Palette.
- [autoart#86](https://github.com/ok-very/autoart/issues/86) [Agent] Monday.com Board Sync Settings.
- [autoart#80](https://github.com/ok-very/autoart/issues/80) [Agent] Implement Monday OAuth.
- [autoart#85](https://github.com/ok-very/autoart/issues/85) [Agent] Templating Engine.
- [autoart#84](https://github.com/ok-very/autoart/issues/84) [Agent] Email Notices API.
- [autoart#83](https://github.com/ok-very/autoart/issues/83) [Agent] Email Ingestion & Comms Tab.
- [autoart#82](https://github.com/ok-very/autoart/issues/82) [Agent] User Account Management.
- [autoart#81](https://github.com/ok-very/autoart/issues/81) [Agent] Enhance Record Inspector Assignee Chip.
- [autoart#79](https://github.com/ok-very/autoart/issues/79) [Agent] Enhance Workflow View Interactions.
- [autoart#16](https://github.com/ok-very/autoart/issues/16) Implement PDF export module with Carlito font support.
- [autoart#17](https://github.com/ok-very/autoart/issues/17) Implement InDesign data merge export module (CSV with field selection).
- [autoart#8](https://github.com/ok-very/autoart/issues/8) Phase 5: Documentation, Automation, and Maintenance Tooling.
- [autoart#89](https://github.com/ok-very/autoart/issues/89) [Agent] Learning: Shared pure logic belongs in `@autoart/shared` (no `process.env`).

### AutoHelper (legacy tracker) (ok-very/autohelper)

> AutoHelper is now developed inside the AutoArt monorepo, but these issues remain open upstream and should be tracked here until closed or migrated.

- [autohelper#26](https://github.com/ok-very/autohelper/issues/26) Runner execution for AutoCollector + progress toasts + output refs + optional Gemini review/repair stage.
- [autohelper#25](https://github.com/ok-very/autohelper/issues/25) Import PDF artifact + register reference (browser/Electron export pipeline).
- [autohelper#12](https://github.com/ok-very/autohelper/issues/12) Generate report artifact (`POST /generate/report`).
- [autohelper#11](https://github.com/ok-very/autohelper/issues/11) Create intake manifest artifact (`POST /generate/intake-manifest`).
- [autohelper#10](https://github.com/ok-very/autohelper/issues/10) Snapshot export endpoint (`GET /snapshot`).
- [autohelper#9](https://github.com/ok-very/autohelper/issues/9) Fetch endpoints (`/file/preview`, `/file/text`) + extraction cache.

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

### 4. Header dropdown flicker
**Status:** UI polish

**Tracking:** (GitHub: [autoart#9](https://github.com/ok-very/autoart/issues/9))

---

## 🟢 DATA MODEL MAINTENANCE

### Monday field definitions alignment (timeline + reduce “custom”)
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

### Export Workbench / Gantt / Print
- Shared Gantt projection + print layout types (GitHub: [autoart#72](https://github.com/ok-very/autoart/issues/72)).
- Gantt surface + print route + PDF export flow (GitHub: [autoart#73](https://github.com/ok-very/autoart/issues/73)).
- PDF export module (Carlito) (GitHub: [autoart#16](https://github.com/ok-very/autoart/issues/16)).
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
- Inspector attachment: “Inspector doesn’t attach to field view”.
- Data migration/seed: re-migrate DB and validate useful seed data.

---

### ExportContextProvider / “aggregate” mode
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
- Architecture learning note (GitHub: [autoart#89](https://github.com/ok-very/autoart/issues/89)).
