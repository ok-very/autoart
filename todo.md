# AutoArt Priorities

*Last Updated: 2026-02-04 19:35*

## Bug List

**Active blocking:**
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested
- "Save current" in menu doesn't activate save workspace prompt — handler chain exists, not confirmed working
- Fields from seed data rendering as `[object Object]` in tables
- Subprocesses and stages not populating from seed projections
- Poll editor missing — "New poll" has no editor attached; clicking existing spawned poll yields full page roundtrip (polls editor shipped in PRs #271-273, possible regression)
- Finance overlay "client" field breaks when querying contacts — placeholder query not wired

**UX polish:**
- "Select project" dropdown in header: conditional on `hasBoundPanels` (intentional), but position between nav links feels wrong
     remove the feature 
- Emoji/icon selector overlay — search doesn't work; consider switching to Phosphor Icons
- Glassmorphism missing from tab strip where it was implemented — should be doable now with first-class theme variables

**Confirmed resolved (PRs #337-339, #353, #355, #357-359):**
- ~~Dropdowns rendering transparent backgrounds~~ — arbitrary-value `var()` colors broke under Tailwind v4 oklch pipeline, migrated to theme classes (PR #357)
- ~~Projects button doesn't spawn panel~~ — routed to center content instead of dockview, now uses `handleOpenPanel` (PR #358)
- ~~Miller Columns project selection broken~~ — clicked project but never called `setActiveProject`, child columns stayed empty (PR #359)
- ~~dompurify throws blocking Vite build errors~~ — DOMPurify restored for email HTML rendering with proper ES module import (PR #355)

**Confirmed resolved (PRs #337-339, #353):**
- ~~Selection Inspector stuck open~~ — close button added with `onClose` prop, wired through dockview panel (PR #338)
- ~~Panel spawner menu opaque background~~ — glassmorphism (`backdrop-blur-sm` + translucent bg) on Menu + Dropdown atoms (PR #337)
- ~~AutoHelper tray menu shows "Paired" on launch without pairing~~ — poll-loop validation caches backend session check, menu reads cached bool (PR #353)
- ~~Applications dropdown bleeds into workspace tabs~~ — header divider added between project selector and nav links (PR #339)
- ~~Panel spawn visibility issue~~ — `setActive()` called on newly spawned panels via `requestAnimationFrame` (PR #339)
- ~~Workspace/Fields subtabs have no active accent~~ — tab active state migrated from `text-blue-600` to `--ws-accent` token (PR #338)

**Confirmed resolved:**
- ~~Action definitions empty after migration~~ — definitions seeded in new `record_definitions` system with `definition_kind`
- ~~Calendar link in header menu not wired up~~ — fully implemented (PR #271)
- ~~Header spacing too tight~~ — widened nav gap and margin in Header.tsx (PR #335)
- ~~`/pair` async blocking I/O~~ — handlers converted to sync `def` for threadpool execution (PR #334, commit b4c1259)
- ~~Disconnect spinner bleeds to all rows~~ — per-row `disconnectingId` tracking added (PR #335, commit b4c1259)

---

## P0: Blocking

*(none)*

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend |
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 237 | Performance Optimization & Caching | Backend + Frontend |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |
| — | Classification Panel: proper bindings on import | Import |

---

## P2: Near-term

| # | Issue | Category |
|---|-------|----------|
| — | Intake forms → records verification: E2E test block mapping, record creation, completion flow | Intake |
| 173 | Epic: Finance Management System — rename "client" to "contact"; support progressive billing, budget allocation, developer record emulation | Epic |
| 182 | Workspace modification tracking and save workflow | Workspace |
| 180 | Add route/project context to workspace system | Workspace |
| 179 | Context-driven automatic panel reconciliation | Workspace |
| 183 | Evolve export into live client reports system | Reports |
| 178 | Manual file link support in intake forms | Intake |
| 177 | Integrate intake forms with records system | Intake |
| 159 | Contacts quick-export overlay (vCard, recipient formats) | Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| 291 | Schema editor / Composer relationship-math builder | Feature |
| — | Composer bar as sleek dockview popout window (replace modal) | UX |
| — | Action vocabulary: store classification verbs/nouns/adjectives from imports as a heuristic JSONB tree; Composer and command toolbar use vocabulary to interpret what action type is being constructed or referenced | Classification |

---

## Housekeeping

| File | Issue |
|------|-------|
| Project Log view | Missing project sidebar (inconsistent with other project-scoped views) |
| Records view | Align layout with Fields view: definitions filter + search bar, no redundant dropdown title |
| `packages/ui/src/molecules/SegmentedControl.tsx` | Still using glassmorphism (`bg-[var(--ws-tabstrip-bg,#f1f5f9)]` with translucent styling) — not in DESIGN.md, should be solid background |
| Intake forms + poll deployments | Need verification: localhost vs production endpoint config (forms and poll submit endpoints may be hardcoded or misconfigured for dev vs prod) |
| Future outbound subdomains | `polls.autoart.work`, `forms.autoart.work` endpoint routing not wired — debug and configure for dev vs prod |
| SelectionInspector / Record view | Handle `definition_kind` system for filtering/classification — arrangement vs container vs record kinds should drive what's shown and how |
| ~~Selection editor / Schema editor~~ | ~~"Quick create" pin toggle removed (PR #339)~~ |
| Record fields | Full RichTextEditor with combobox used where simpler field types are appropriate — shared field component needs expanded options for where/how combobox is invoked |
| Selection editor | "Plan" link badge system could just be a pointer to the active window name / binding group color instead of its own concept |
| ~~Workspace naming~~ | ~~Panel renamed to "Project View" (PR #339); blank area with spawn buttons already works~~ |
| `frontend/src/ui/table-core/UniversalTableCore.tsx` + composites | All tables are div-based with `role` attributes — migrate to new Table atom primitives from PR #350 for semantic HTML, browser print styles, native keyboard nav |
| `packages/ui/src/atoms/Badge.tsx` | Badge variant colors (project, process, task, etc.) use domain-semantic Tailwind colors — needs separate approach since they're not chrome tokens |
| `frontend/src/ui/sidebars/` + definition filtering | `definition_kind = 'container'` has no explicit UI/behavior mapping — containers render as actions (icon, labels, create flow). Needs dedicated UX treatment (CodeAnt #324 review) |
| `frontend/src/ui/sidebars/` + definition filtering | Definitions without `definition_kind` (legacy/manual rows) excluded entirely by new filter — add fallback or migration to backfill (CodeAnt #324 review) |
| `ExportMenu.tsx` | `invoiceNumber` now sent to PDF/DOCX export endpoints — backend handlers should consume it for Content-Disposition filenames |
| `apps/autohelper/autohelper/modules/mail/router.py` | Triage status "pending" in `VALID_TRIAGE_STATUSES` conflicts with implicit "pending" default — callers can't distinguish never-triaged from explicitly-triaged (CodeAnt #346) |
| `apps/autohelper/autohelper/modules/mail/router.py` | `_update_triage` shorthand endpoints (`archive`, `mark-action-required`, `mark-informational`) silently erase existing `triage_notes` when passing `None` — preserve existing notes (CodeAnt #346) |
| `apps/autohelper/autohelper/modules/mail/schemas.py` | `TriageResponse.triaged_at` typed as `str | None` but `TransientEmail.triaged_at` is `datetime | None` — inconsistent API contract (CodeAnt #346) |
| `frontend/src/api/types/mail.ts` | Frontend `triage_status` typed as `TriageStatus` union but backend schema is plain `str | None` — type mismatch if backend sends unexpected value (CodeAnt #346) |
| ~~`frontend/src/api/hooks/mailMessages.ts`~~ | ~~`usePromoteEmail` cache invalidation~~ — fixed to invalidate `['mailMessages', 'list']` prefix |
| ~~`frontend/src/api/hooks/mailMessages.ts`~~ | ~~`useUnlinkEmail` cache invalidation~~ — fixed to also invalidate links queries |
| `frontend/src/api/types/mail.ts` | `MailMessage.metadata` typed as `Record<string, unknown>` but backend stores via `JSON.stringify` — could be any JSON value, use `unknown` (CodeAnt #347) |
| `backend/src/db/migrations/052_mail_messages.ts` | Explicit index on `external_id` redundant (UNIQUE already creates one) — extra write overhead (CodeAnt #348) |
| `backend/src/db/migrations/052_mail_messages.ts` | Explicit index on `mail_message_id` redundant (composite unique constraint already covers it as leading column) — extra write overhead (CodeAnt #348) |
| ~~`frontend/src/api/hooks/search.ts`~~ | ~~`useSearch` projectId param~~ — fixed to properly pass projectId to backend |
| ~~`frontend/src/ui/admin/AdminUsersPanel.tsx`~~ | ~~Create-user `isPending` guard~~ — fixed |
| ~~`frontend/src/ui/admin/AdminUsersPanel.tsx`~~ | ~~Role-change catch reopen~~ — fixed to call `setEditingRole(true)` |
| `packages/ui/src/atoms/Button.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes like `bg-ws-panel-bg` (same issue fixed in Menu/Dropdown via PR #357) |
| `packages/ui/src/atoms/Card.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/Toggle.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/Select.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/TextInput.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/Modal.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/Checkbox.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/Label.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/molecules/PortalMenu.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/IconButton.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/RadioGroup.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/molecules/PortalSelect.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/atoms/CurrencyInput.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `backend/src/modules/imports/connections.routes.ts` | `/connections/autohelper/credentials` endpoint returns Monday token but nothing calls it — dead code, remove |
| `apps/autohelper/autohelper/modules/context/autoart.py` | `get_monday_token()` method defined but never called — dead code, remove |
| `apps/autohelper/autohelper/modules/context/service.py` | Direct Monday client init (lines 112-122) for backward compat token nobody stores — dead code, remove |
| `packages/ui/src/atoms/ProgressBar.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |
| `packages/ui/src/molecules/SegmentedControl.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes; also using glassmorphism (not in DESIGN.md) |
| `packages/ui/src/atoms/Table.tsx` | Arbitrary-value `bg-[var(--ws-*)]` classes break under Tailwind v4 oklch pipeline — migrate to theme classes |

**Low priority (CodeAnt #332 nitpicks):**

| File | Issue |
|------|-------|
| `packages/ui/src/atoms/Card.tsx` | Tailwind arbitrary value parsing: `theme(...)` nested inside `var(...)` fallback may be dropped by some JIT parsers — verify CI builds the stylesheet correctly |
| `frontend/src/ui/sidebars/ProjectSidebar.tsx` | Section headings (`<p>` at lines 78, 138) lack proper heading semantics for assistive tech — use `<h2>` or add `role="heading"` + `aria-level` |
| `frontend/src/intake/components/blocks/*.tsx` | Email, Phone, Time inputs missing ARIA attributes (`aria-invalid`, `aria-describedby`, `aria-required`); error paragraphs not programmatically linked to inputs |

---

## P3: Long-term / Backlog

| # | Issue | Category |
|---|-------|----------|
| 184 | Q1 2026 Roadmap: Workspace System & Client Reports | Roadmap |
| 118 | Gemini AI: drafts, filenames, contacts | AI |
| 117 | Gemini Vision: deep crawl fallback | AI |
| 74 | Import Workbench: Runner + Gemini | Import |
| 66 | Mail surface + popout + mappings | Workspace |
| 64 | Electron SPA shell | Desktop |
| 62 | Multi-window popouts + IPC | Desktop |
| 55 | Automail Phase 4: Testing | Testing |
| 17 | InDesign data merge CSV export | Export |
| 8 | Documentation + Automation tooling | Tooling |

---

## In-Flight (Awaiting Review)

| PRs | Description |
|-----|-------------|
| #369-372, #381-386 | **Intake forms → records pipeline:** Block connector architecture (RecordMapping schemas, SubmissionsTable with CSV export + record badges, RecordMappingPanel for staff config, Responses tab integration, Records editor tab, backend handler processes mappings) |
| #318 | Fix theme registry infinite re-render (React error #185 in AppearanceSection) |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| 387 | **Unified OAuth under /api/auth:** Shared HMAC-signed state utility (stateless, 10-min expiry), Google/Microsoft/Monday all support login mode (create/find user) + link mode (connect to existing user), Monday moved from `/connections/monday/oauth/*` to `/auth/monday` with consistent callback format (JSON for login, HTML popup-close for link), deprecated old routes return 410 Gone | PRs #388-392 |
| — | **AutoHelper Pairing Odyssey + Bug Fixes:** Replaced push-to-localhost pattern with claim-token flow (in-memory sessions → persistent link keys, 6-char codes w/ TTL); tray menu pairing dialog; port alignment to 8100 + Vite proxy; fixed `is_running()` AttributeError, routed mail/folder controls through backend bridge, explicit Web Collector dependency checks; AdaptersCard showing real capability status | PRs #354-368 (14 PRs) |
| 83 | Email Section Redesign + Email Logging System: Table atom primitives, body_html capture, MappingsPanel expand/collapse HTML rendering, triage endpoints, mail_messages/mail_links persistence, frontend linking, promoted badges, CodeAnt review fixes | PRs #346-353 |
| 82a-82e | User Profiles System: schema + role middleware, avatar upload + password change + admin CRUD, account settings UI + admin panel + header avatar, UserChip photo support, project assignment + deactivation reassignment | PRs #341-345 |
| — | UX polish: Menu/Dropdown `--ws-*` token migration + glassmorphism | PR #337 |
| — | UX polish: SelectionInspector close button + tab accent migration to `--ws-accent` | PR #338 |
| — | Header divider, panel spawn activation (`requestAnimationFrame`), "Project View" rename, SchemaEditor pin toggle removal | PR #339 |
| — | AutoHelper frontend-initiated pairing: `/pair` endpoint + one-click Pair button, remove tkinter dialog | PRs #334-335 |
| — | Migration 036 stub restoration + seed transaction wrapping (housekeeping) | PR #331 |
| — | Accessibility: form label/input associations (Email, Phone, Time); sidebar section headings; SettingsPage + Card.tsx design tokens (housekeeping) | PR #332 |
| — | Atom token migration: 13 atom files migrated to `--ws-*` tokens; Toggle atom extraction from AutoHelperSection (housekeeping) | PR #333 |
| — | Intake `--pub-*` token boundary fix (housekeeping); `definition_kind` system: seed containers + sidebar heuristics removal + idempotency fix (housekeeping) | PRs #323-324 |
| 235 | Context breadcrumb to events (P1) | PR #325 |
| — | Loading screen refactoring: rounded corners + wrapper, AutoArt text + pre-spinner, design tokens in React fallback; AutoHelper pairing: tray menu + TclError fallback; Review feedback fixes: `_check_paired()` settings fallback, container seed upsert `is_system` | PRs #326-330 |
| — | Add /logkeeper skill: dedicated todo.md maintenance agent with personality | PR (commit 4b6e228) |
| — | Refactor: rename recipe → arrangement, drop orphaned action_type_definitions, seed arrangement definitions | PRs #320-322 |
| — | UI Consistency Audit: dead code removal, font-bold→semibold, header heights h-10/h-8, `--ws-font-size-*` typography tokens, 2744 hardcoded slate/white→`--ws-*` color tokens, stale TODOs purged | PRs #313-317 |
| — | Bugfixes: Methodology→Process rename, fieldBindings crash, Bound→Linked, LoginPage tokens, Chladni badge/loader tile | PR #312 |
| — | Dockview v4 theme, swoopy tab corners, unified ThemedTab, tab strip + button | PRs #307-311 |
| 275 | Epic: Export Workbench — preview-first outputs + finance via sessions | PRs #286-290, #292 |
| 218 | Phase 6: Remove task_references system + hierarchy nodes | PRs #282-285 |
| — | Polls editor/management surface in dashboard | PRs #271-273 |
| — | Style token infrastructure + formatter consumption | PRs #279-280 |
| — | Chladni-pattern cymatic loading screen | PR #281 |
| — | In-flight doc PRs (git.md merge rules) | PRs #266, #270 |
| — | Font refactor: shared base.css + CSS variable font-family | PRs #260, #262 |
| — | Dockview panels not rendering + Composer defaults to "Task" | PRs #263-265 |
| — | Header reorder, Applications dropdown, Intake cleanup | PRs #267, #269 |
| — | Restore Windows venv scripts | PR #259 |
| 238 | Epic: Invoicerr Integration (invoice management system) | PRs #239-249 |
| 227-234 | Events Module + Project Log (Phases 1-4) | PRs #227-234 |
| 185 | Fork and modernize crab-meet scheduling polls | PRs #186, #206-213 |
| 87 | Global Command Palette | PRs #174, #176 |

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #205 | Wire theme variables to global styles |
| #204 | Modernize tabs, remove Bound labels (superseded by PRs #307-311) |
| #198, #201 | Design system docs (palette, typography, layout) |
| #189-195 | React Compiler fixes (Tier 1-3) |
| #188 | Add referenceSlots to action arrangements |
