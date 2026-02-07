# AutoArt Priorities

*Last Updated: 2026-02-06*

## Bug List

**Active blocking:**
- ~~**Step 2: Configure Mapping broken:** Classification Panel missing old functionality~~ — fixed: restored classification gating from unmerged commit `efc939f` + mutation drain from `9fa1268`. `handleNext()` now checks for unresolved AMBIGUOUS/UNCLASSIFIED items, stays on Step 2 with warning alert + disabled button until resolved. Also added `awaitMutation()` to drain in-flight config mutations before plan regeneration. Fixed duplicate WHERE clause in `monday-workspace.service.ts`.
- ~~**Import hierarchy:** Column headers use internal jargon~~ — fixed: `humanizeFieldName()` in table headers, `getOutcomeLabel()` in classification rows
- ~~**Import wizard (Monday):** Connector sidebar action creates "active session" with no escape route~~ — fixed in commit 9dd1cff ("New Import" button added to sidebar)
- **Intake record binding:** Adding record binding to block throws "Invalid UUID" error at `body/blocks_config/blocks/0/recordBinding/definitionId`
- **Preview buttons (intake forms + polls):** Implementation theater — buttons exist but lead to no endpoint
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested
- "Save current" in menu doesn't activate save workspace prompt — handler chain exists, not confirmed working
- Fields from seed data rendering as `[object Object]` in tables
- Subprocesses and stages not populating from seed projections
- Poll editor missing — "New poll" has no editor attached; clicking existing spawned poll yields full page roundtrip (polls editor shipped in PRs #271-273, possible regression)
- Poll "Open public poll" link is dead — navigates to `/public/poll/:id` which has no route, falls back to workspace. No way to preview poll output.
- Finance overlay "client" field breaks when querying contacts — placeholder query not wired
- ~~Expired session causes 401 cascade~~ — fixed: `ApiError` class preserves status/code, `isAuthError()` detects 401s, `sessionDead` flag + refresh dedup prevents cascade, `setSessionExpiredHandler` clears queries + auth store
- AutoHelper sessions lost on backend restart (#340) — in-memory session store dies on restart, AutoHelper tray still shows "Paired" but backend has no session. Need to persist sessions to DB.
- Workspace preset timing (#181) — `pendingPanelPositions` workaround for dockview panel positioning race condition
- **AutoHelper settings:** Module detection failing (available modules not showing in settings), file root selection broken (browser), settings page needs comprehensive review

**UX polish:**
- "Select project" dropdown in header: conditional on `hasBoundPanels` (intentional), but position between nav links feels wrong
     remove the feature
- Emoji/icon selector overlay — search doesn't work; consider switching to Phosphor Icons
- Glassmorphism missing from tab strip where it was implemented — should be doable now with first-class theme variables
- Placeholder themes: Compact, Minimal, Floating, and Default are all essentially identical — four names, one skin. Either differentiate them or cull to one honest default.
- ~~"Import" tab hiding in overflow menu despite ample space in tab bar~~ — promoted to P0 stack
- Project View: "New project" dropdown UI broken under "Your projects" section — formatting not clean

**Confirmed resolved (PR #403):**
- ~~Google OAuth returns 500 when not configured~~ — added `/auth/google/status` + `/auth/microsoft/status` endpoints, changed 500 → 501, frontend disables buttons when unconfigured (PR #403)
- ~~Monday OAuth unreachable from UI~~ — already fixed in PRs #388-392; UI conditionally shows OAuth button based on status endpoint. Bug entry was stale.

**Confirmed resolved (18 items):** See Recently Closed section for PR references. Covers: Monday null group_title, poll editor granularity/missing, dropdown transparency, project spawn, Miller Columns, DOMPurify build, SelectionInspector close, panel spawner glassmorphism, AutoHelper tray pairing, applications dropdown bleed, panel spawn visibility, tab accent, action definitions seed, calendar link, header spacing, `/pair` async I/O, disconnect spinner.

---

## P0: Next Stack — Import Wizard Recovery

Three related bugs, one stack. Classification panel regression broke the configure-mapping step; column headers speak database jargon instead of human; connector sidebar traps users with no escape route.

| # | Issue | Bug Ref |
|---|-------|---------|
| 1 | ~~**Classification Panel regression:**~~ Fixed — restored classification gating + mutation drain from unmerged stacked branches. `handleNext()` gates on unresolved classifications, shows warning, disables advancement until resolved via ClassificationPanel in ImportWorkflowLayout's bottom region. Also fixed duplicate WHERE clause in `monday-workspace.service.ts`. | Bug list: "Step 2: Configure Mapping broken" |
| 2 | ~~**Import hierarchy labels:** Column headers use internal jargon~~ — fixed: `humanizeFieldName()` converts snake_case/camelCase to Title Case in table headers; `getOutcomeLabel()` replaces raw SCREAMING_CASE outcomes in ClassificationRow | Bug list: "Import hierarchy" |
| 3 | ~~**Connector sidebar escape hatch:**~~ Fixed in commit 9dd1cff — "New Import" button + back button added | Bug list: "Import wizard (Monday)" |
| 4 | **"Import" tab visibility:** Tab hides in overflow menu despite ample space in tab bar | UX polish |

Stack order: bottom → top. PR 1 is the archaeology + fix. PR 2 is label cleanup (may touch same files). PR 3 is the escape-hatch UX. PR 4 is the tab visibility fix (small, independent).

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend |
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 237 | Performance Optimization & Caching | Backend + Frontend |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |
| — | Poll editor: support different/multiple time block selections per day | Polls |
| — | Consolidate Calendar/Gantt/future view expansions: Applications views not linked to Project View segmented equivalents; no project/process selection for these views outside single-project setting; Application view should perform general-purpose filter/overlay across projects (separate feature expansion) | Feature |
| — | Finances UI unification: Finances call gets pulled into Project View rather than spawning its own panel; needs formalization and dedicated panel architecture; institute math/formula ESM to design and handle logic; missing project bindings and unclear how it interacts with records system | Finance |
| — | Records/Fields/Actions registry browser UI unification: needs consistent layout and shared filter system across all three panels | UX |
| — | Workspace project binding + conditional sidebars: project binding only appears under "4. Review" tab; conditional sidebar appearance not implemented; complex feature requiring focused design and implementation plan | Workspace |

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
| 393 | File Detection & Alignment Service with watchdog — replace polling with filesystem watchdog in AutoHelper, convention enforcement, violation surfacing in UI | AutoHelper |
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
| Record fields | Full RichTextEditor with combobox used where simpler field types are appropriate — shared field component needs expanded options for where/how combobox is invoked |
| Selection editor | "Plan" link badge system could just be a pointer to the active window name / binding group color instead of its own concept |
| `frontend/src/ui/table-core/UniversalTableCore.tsx` + composites | All tables are div-based with `role` attributes — migrate to new Table atom primitives from PR #350 for semantic HTML, browser print styles, native keyboard nav |
| `packages/ui/src/atoms/Badge.tsx` | Badge variant colors (project, process, task, etc.) use domain-semantic Tailwind colors — needs separate approach since they're not chrome tokens |
| `frontend/src/ui/sidebars/` + definition filtering | `definition_kind = 'container'` has no explicit UI/behavior mapping — containers render as actions (icon, labels, create flow). Needs dedicated UX treatment (CodeAnt #324 review) |
| `frontend/src/ui/sidebars/` + definition filtering | Definitions without `definition_kind` (legacy/manual rows) excluded entirely by new filter — add fallback or migration to backfill (CodeAnt #324 review) |
| `ExportMenu.tsx` | `invoiceNumber` now sent to PDF/DOCX export endpoints — backend handlers should consume it for Content-Disposition filenames |
| ~~`apps/autohelper/.../mail/router.py`~~ | ~~Triage status "pending" ambiguity (CodeAnt #346)~~ — **Fixed:** default changed to `None`, sentinel pattern preserves notes |
| ~~`apps/autohelper/.../mail/schemas.py`~~ | ~~`triaged_at` type mismatch (CodeAnt #346)~~ — **Fixed:** unified to `str \| None` |
| ~~`frontend/src/api/types/mail.ts`~~ | ~~`triage_status` + `metadata` type mismatches (CodeAnt #346-347)~~ — **Fixed:** `TriageStatus \| string \| null`, `metadata: unknown` |
| ~~`backend/src/db/migrations/`~~ | ~~Redundant indexes (CodeAnt #348)~~ — **Fixed:** `idx_mail_links_message` removed from 001_baseline |
| ~~`packages/ui/src/` (all atoms + molecules)~~ | ~~Tailwind v4 `bg-[var(--ws-*)]` migration~~ — **Done:** 0 remaining arbitrary `var(--ws-*)` patterns in packages/ui/ (PortalMenu, PortalSelect, MiniCalendar fixed this session; rest done in prior PRs #333, #357) |
| ~~`connections.routes.ts`~~ | ~~Dead `/connections/autohelper/credentials` endpoint~~ — **Removed** |
| ~~`autoart.py`~~ | ~~Dead `get_monday_token()` method~~ — **Removed** |
| ~~`service.py`~~ | ~~Dead Monday client init~~ — **Removed** |

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
| #394 | **MiniCalendar molecule for polls:** Compact month-grid date selector with multi-select toggle for poll configuration |
| #369-372, #381-386 | **Intake forms → records pipeline:** Block connector architecture (RecordMapping schemas, SubmissionsTable with CSV export + record badges, RecordMappingPanel for staff config, Responses tab integration, Records editor tab, backend handler processes mappings) |
| #318 | Fix theme registry infinite re-render (React error #185 in AppearanceSection) |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| 403 | **OAuth graceful status checks:** Added `/auth/google/status`, `/auth/microsoft/status`, `/auth/monday/status` endpoints; changed 500→501 for unconfigured providers; frontend disables Connect buttons when server reports unavailable; fixed OAuth availability prop defaults (false→true) to prevent dead buttons in overlay contexts; resolved stale redirect URI concerns (intentional localhost dev defaults, overrideable via env) | PR #403 |
| — | **Session: P0 Import Wizard Recovery + 401 Cascade + Mail Module (Feb 2026):** (1) Classification Panel regression: restored gating from unmerged commits `efc939f`+`9fa1268` — `handleNext()` gates on unresolved classifications, shows warning, disables Next button until resolved; mutation drain prevents stale config reads; fixed duplicate WHERE clause in monday-workspace.service.ts (2) Column headers: `humanizeFieldName()` for snake_case/camelCase → Title Case, `getOutcomeLabel()` for SCREAMING_CASE outcomes → readable labels (3) 401 cascade: `ApiError` class preserves status/code, `sessionDead` flag + refresh dedup prevents cascade, `setSessionExpiredHandler` wired in main.tsx (4) Mail module: triage `None` vs `"pending"` disambiguation, `_UNSET` sentinel preserving notes, `triaged_at` type unified to `str \| None`, frontend type guards, `metadata: unknown` (5) Dead code: Monday token endpoints, redundant indexes (6) Tailwind v4: PortalMenu, PortalSelect, MiniCalendar migrated; packages/ui/ clean | Commit 0e479c7 |
| — | **Plugin integration upgrade:** Plugin Delegation sections added to 5 agent skills (architect, frontend-dev, backend-dev, integrator, reviewer), Loaded Plugins documentation + install checklist in CLAUDE.md, improve skill agent prompts rewritten from Go to TypeScript/React/Fastify, frontend-design plugin restricted to --pub-* surfaces only | PR #405 |
| — | **Stackit skills recovery:** 26 orphaned command/skill files restored from git object store (f8814d8 tree); post-merge verification rule added to prevent future orphaned stack content (rapid-fire merges outran GitHub retargeting in Jan 29 incident) | Commits 73d7106, eaea487 |
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
| *(older entries pruned — see git log for PRs #174-306)* | | |

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
