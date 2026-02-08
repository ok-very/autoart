# AutoArt Priorities

*Last Updated: 2026-02-08*
*Strategy: Foundation phases 0-2 complete (see [roadmap.md](roadmap.md) for architectural history). Forward phases organize remaining work by dependency chain and domain scope. This file drives active priorities.*

## Bug List

**Active — unphased:**
- **Intake form connections UX:** "Form connections to linked" vs "Make new entry" flow is confusing — needs UX review to clarify intent and behavior
- **Image form block link:** No image preview loads in the editor — can't verify via Preview button either (see Phase 0.3). Editor should show inline representation rather than relying on separate preview
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested

**Deferred:**
- AutoHelper sessions lost on backend restart (#340) — link key IS persisted in `connection_credentials` DB table. Issue is tray icon staleness — needs design decision, not a bugfix.

**UX polish:**
- "Import" tab hides in overflow menu despite ample space in tab bar
- "Select project" dropdown in header: conditional on `hasBoundPanels` (intentional), but position between nav links feels wrong — remove the feature
- Emoji/icon selector overlay — search doesn't work; consider switching to Phosphor Icons
- Placeholder themes: Compact, Minimal, Floating, and Default still essentially identical — differentiate per DESIGN.md theme variant guidance. Glass and neumorphic variants pending implementation (see Housekeeping).
- Project View: "New project" dropdown UI broken under "Your projects" section — formatting not clean

**Confirmed resolved (32+ items):** See Recently Closed section for PR references. Covers: import wizard stale plan regeneration (PR #434), ClassificationRow atom migration (PR #435), Phase 0 stack (React Compiler memo, Classification Panel partial save, preview servers, ExecutionControls API client, unused vars), Phase 1 stack (workspace foundation: context contract, panel consumption, Desk workspace, CenterView routing, store consolidation, workspace save, custom lifecycle, sidebar hints), Phase 2 stack (entity kind resolver, import/overlay migrations, seed through Composer — subprocess/stage projections now populate correctly, RecordDefinitionSchema phantom field removed), import hierarchy labels, connector sidebar escape hatch, intake record binding UUID, workspace save prompt timing, `[object Object]` field rendering, poll editor, poll public URLs, finance overlay contacts, 401 cascade, AutoHelper settings (now uses backend bridge), Google/Monday OAuth, and 18 earlier items (Monday null group_title, poll editor granularity, dropdown transparency, project spawn, Miller Columns, DOMPurify build, SelectionInspector close, panel spawner glassmorphism, AutoHelper tray pairing, applications dropdown bleed, panel spawn visibility, tab accent, action definitions seed, calendar link, header spacing, `/pair` async I/O, disconnect spinner).

---

## Phase 3: Import Pipeline Completion

*Unblock production-quality imports. The wizard works end-to-end but lacks interpretation hooks for frontend consumers and degrades under volume.*

**Scope:**

| # | Issue | Category |
|---|-------|----------|
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend |
| 237 | Performance Optimization & Caching | Backend + Frontend |
| 79 | Enhance Workflow View Interactions | Feature |
| — | Records/Fields/Actions registry browser UI unification: consistent layout and shared filter system | UX |
| — | Action vocabulary: store classification verbs/nouns/adjectives from imports as heuristic JSONB tree; Composer and command toolbar use vocabulary to interpret action type construction | Classification |

**Dependencies:** None — foundation phases cleared the path. #217 (interpretation routes) is the critical enabler; #237 (performance) and #79 (workflow interactions) build on top.

**Done when:** Frontend can call interpretation endpoints via TanStack Query hooks, imports complete in <2s for typical payloads, and workflow view supports direct interaction with imported actions.

---

## Phase 4: Finance Foundation

*Stand up the data layer for the Finance epic (#173). Seed definitions first, then computed fields, then records. No UI surfaces yet — this phase is backend + shared.*

**Scope:**

| # | Issue | Category |
|---|-------|----------|
| 171 | Seed: Finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense) | Finance |
| 166 | Computed fields + relationship rollups (no-scripting, budgets/invoices/stage sums) | Finance |
| 165 | Invoice generation + tracking (records + PDF export + payments) | Finance |
| 168 | Vendor bills + expense tracking (invoice receipts, payments, stage reconciliation) | Finance |
| 167 | Project Budgets surface (stage allocations + reconciliation rollups + spreadsheet export) | Finance |

**Dependencies:** #171 (seed) must land first — all other finance issues depend on the RecordDefinition schemas existing. #166 (computed fields) unblocks #165, #167, #168 by providing the rollup mechanism.

**Internal order:** #171 -> #166 -> (#165, #167, #168 can parallelize)

**Done when:** Finance record definitions seed correctly through Composer, computed fields derive budget/invoice/expense totals, and invoice/bill/budget records can be created and queried via API.

---

## Phase 5: Finance Surfaces & Integration

*Wire finance data into the UI, Composer event log, and export pipeline. Depends on Phase 4 data layer being solid.*

**Scope:**

| # | Issue | Category |
|---|-------|----------|
| 169 | Finance surfaces + quick overlays (budgets/invoices/expenses hub) | Finance |
| 170 | Wire finance actions into Composer + Project Log (invoice/bill/payment events) | Finance |
| 172 | Finance export modules (Invoice PDF, Budget CSV, export presets) | Finance |
| 183 | Evolve export into live client reports system | Reports |
| 291 | Schema editor / Composer relationship-math builder | Feature |

**Dependencies:** Phase 4 complete. #170 (Composer wiring) should land before #169 (surfaces) so the UI can show real events. #172 (exports) depends on #165 (invoices) and #167 (budgets) from Phase 4.

**Done when:** Users can create invoices/budgets/expenses from the UI, see finance events in the Project Log, export Invoice PDFs and Budget CSVs, and the client reports system serves live data.

---

## Phase 6: Platform Polish & Integrations

*Independent improvements that don't gate each other. Work from this phase in any order as bandwidth allows.*

**Workspace polish:**

| # | Issue | Category |
|---|-------|----------|
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| — | Composer bar as sleek dockview popout window (replace modal) | UX |
| — | Consolidate Calendar/Gantt/future view expansions: link Application views to Project View segmented equivalents; cross-project filter/overlay | Feature |
| — | Poll editor: support different/multiple time block selections per day | Polls |

**Intake & records:**

| # | Issue | Category |
|---|-------|----------|
| — | Intake forms -> records verification: E2E test block mapping, record creation, completion flow | Intake |
| 178 | Manual file link support in intake forms | Intake |
| 177 | Integrate intake forms with records system | Intake |

**Integrations & services:**

| # | Issue | Category |
|---|-------|----------|
| 159 | Contacts quick-export overlay (vCard, recipient formats) | Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| 393 | File Detection & Alignment Service with watchdog | AutoHelper |
| — | **AutoHelper local-only config:** Roots, DB path, garbage collection settings should be stored locally with AutoHelper, not in global DB | AutoHelper |
| — | **AutoHelper "Rebuild Index" is theater:** Carries stale DB path, hangs when triggered — needs real backend handler or correct path | AutoHelper |

**Note:** AutoHelper settings bridge (was P2) is **resolved** — frontend now correctly uses backend bridge endpoints. See [roadmap.md](roadmap.md#autohelper-status-resolved).

**Note:** Workspace issues #179-182 closed on GitHub — absorbed into Phase 1 (PRs #421-429).

---

## Housekeeping

| File | Issue | Phase |
|------|-------|-------|
| Records view | Align layout with Fields view: definitions filter + search bar, no redundant dropdown title | — |
| `packages/ui/src/molecules/SegmentedControl.tsx` | Implement glass theme (plus remove it from the non-glass theme); also add neumorphic theme for funsies | — |
| Parchment theme | Text color bleeding into forms (`--pub-*` inheriting `--ws-*` parchment colors); Serif 4 not applied to workspace at all yet — only shows up in forms (ironic). Add moderate Serif 4 usage to parchment theme per DESIGN.md | — |
| Intake forms + poll deployments | Need verification: localhost vs production endpoint config | — |
| Future outbound subdomains | `polls.autoart.work`, `forms.autoart.work` endpoint routing not wired | — |
| SelectionInspector / Record view | Handle `definition_kind` system for filtering/classification — resolver exists but inspector doesn't use it yet | — |
| Record fields | Full RichTextEditor with combobox used where simpler field types are appropriate | — |
| Selection editor | "Plan" link badge system could just be a pointer to the active window name / binding group color | — |
| `UniversalTableCore.tsx` + composites | All tables div-based with `role` attributes — migrate to Table atom primitives from PR #350 | — |
| `packages/ui/src/atoms/Badge.tsx` | Badge variant colors use domain-semantic Tailwind colors — needs separate approach (not chrome tokens) | — |
| `frontend/src/ui/sidebars/` + definition filtering | `definition_kind = 'container'` — type declared and filtered but no distinct UI treatment (icon, section, color) | — |
| `ExportMenu.tsx` | `invoiceNumber` sent to PDF/DOCX endpoints — backend should consume for Content-Disposition filenames | — |

**Low priority (CodeAnt #332 nitpicks):**

| File | Issue |
|------|-------|
| `packages/ui/src/atoms/Card.tsx` | Tailwind arbitrary value parsing: `theme(...)` nested inside `var(...)` fallback may be dropped by some JIT parsers |
| `frontend/src/ui/sidebars/ProjectSidebar.tsx` | Section headings (`<p>` at lines 78, 138) lack proper heading semantics for assistive tech |
| `frontend/src/intake/components/blocks/*.tsx` | Email, Phone, Time inputs missing ARIA attributes (`aria-invalid`, `aria-describedby`, `aria-required`) |

---

## P3: Long-term / Backlog

| # | Issue | Category |
|---|-------|----------|
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

*(none)*

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| — | **Stale plan regen fix + ClassificationRow atom migration (Feb 8 2026):** (1) Import wizard optimistic cache update + inflight mutation counter fixes stale plan regeneration. (2) ClassificationRow raw HTML replaced with Stack/Inline/Text/Badge/Button/Card/Label/TextInput atoms from @autoart/ui. | PRs #434-435 |
| — | **Import wizard escape hatches (Feb 8 2026):** (1) Wire `onReset`, Cancel Import in wizard header, Back at step 1 exits wizard, Cancel in Step1 footer. (2) Sidebar "New Import" button shows for all source types (removed Monday exclusion). Review fixes: disabled Cancel during in-flight session creation (race condition), updated stale comment. | PRs #432-433 |
| — | **Phase 2.2-2.3: Entity kind resolver migration (Feb 8 2026):** (2.2) Replace entityType string checks with resolveEntityKind helper. (2.3) Rename entityType to entityKind in overlay side effects. (2.4) Seed through Composer. **Critical fix:** Remove phantom `kind` field from RecordDefinitionSchema — was always 'record', broke Composer filters for action_arrangement definitions. Backend sends `definition_kind` only; Zod default now canonical. | PRs #430-431 |
| — | **Orphan PR cleanup (Feb 8 2026):** Closed PR #336 (invoice creator — all 4 review findings were branch-only code, not on main). Closed orphan stack PRs #406-408, #410 (import wizard fixes — diverged 80 files from main after workspace rewrite). Cherry-picked content (column humanization, ClassificationRow null guard) already on main; remaining fixes tracked in Bug List. | PRs #336, #406-408, #410 |
| #394 | **MiniCalendar molecule for polls:** Compact month-grid date selector with multi-select toggle for poll configuration | Merged |
| #369-372, #381-386 | **Intake forms -> records pipeline:** Block connector architecture, SubmissionsTable, RecordMappingPanel, Responses tab, Records editor tab, backend handler | Merged |
| #318 | Fix theme registry infinite re-render (React error #185 in AppearanceSection) | Merged |
| — | **Phase 1.5-1.8: Workspace Foundation completion (Feb 8 2026):** (1.5) Store consolidation (centerContentType + view modes -> workspaceStore), (1.6) Workspace save with modification tracking + confirmation dialog, (1.7) Custom workspace rename + context menu, (1.8) Sidebar hints with auto-collapse support | PRs #426-429 |
| — | **Phase 1.1-1.4: Workspace Foundation (Feb 7 2026):** (1.1) WorkspaceContext contract + provider, (1.2) Panel context consumption (project-panel, mail-panel bind to workspace project), (1.3) CenterView routing ownership (workspace declares owned content types), (1.4) Desk workspace default and first in list | PRs #421-425 |
| — | **Phase 0: Stop the Bleeding (Feb 7 2026):** (0.1) React Compiler memo fix, (0.2) Classification Panel partial save (unblocked import wizard), (0.3) Preview dev servers (intake 5174 + poll 5175), (0.4) ExecutionControls API client (replaced raw fetch), (0.5) Unused var cleanup | PRs #416-420 |
| — | **Bug fix stack (Feb 7 2026):** (1) Guard ClassificationRow outcome render against null (2) `build:all:clean` resilient to Windows EBUSY file locks (3) Hook to block stackit checkout/restack during sessions (4) Restore ExternalLink alongside Preview button in poll editor (5) Filter incomplete record bindings from intake auto-save (6) Workspace save dialog timing fix (rAF after Radix close) (7) DataFieldWidget object rendering (8) Poll public URLs via env vars (9) Polls panel + registry entry for workspace presets | PRs #411-415 |
| 403 | **OAuth graceful status checks:** Added `/auth/google/status`, `/auth/microsoft/status`, `/auth/monday/status` endpoints; changed 500->501 for unconfigured providers; frontend disables Connect buttons when server reports unavailable; fixed OAuth availability prop defaults (false->true) to prevent dead buttons in overlay contexts; resolved stale redirect URI concerns (intentional localhost dev defaults, overrideable via env) | PR #403 |
| — | **Session: P0 Import Wizard Recovery + 401 Cascade + Mail Module (Feb 2026):** (1) Classification Panel regression: restored gating from unmerged commits `efc939f`+`9fa1268` (2) Column headers: `humanizeFieldName()` + `getOutcomeLabel()` (3) 401 cascade: `ApiError` class, `sessionDead` flag, `setSessionExpiredHandler` (4) Mail module: triage `None` vs `"pending"`, `_UNSET` sentinel, type unification (5) Dead code removal (6) Tailwind v4 migration | Commit 0e479c7 |
| — | **Plugin integration upgrade:** Plugin Delegation sections added to 5 agent skills, Loaded Plugins documentation + install checklist, improve skill prompts rewritten, frontend-design plugin restricted to --pub-* | PR #405 |
| — | **Stackit skills recovery:** 26 orphaned command/skill files restored from git object store; post-merge verification rule added | Commits 73d7106, eaea487 |
| 387 | **Unified OAuth under /api/auth:** Shared HMAC-signed state utility, Google/Microsoft/Monday login + link modes, consistent callback format, deprecated old routes return 410 Gone | PRs #388-392 |
| — | **AutoHelper Pairing Odyssey + Bug Fixes:** Claim-token flow, tray menu pairing, port alignment, mail/folder controls through backend bridge | PRs #354-368 (14 PRs) |
| 83 | Email Section Redesign + Email Logging System | PRs #346-353 |
| 82a-82e | User Profiles System | PRs #341-345 |
| — | UX polish: Menu/Dropdown `--ws-*` token migration + glassmorphism | PR #337 |
| — | UX polish: SelectionInspector close button + tab accent migration | PR #338 |
| — | Header divider, panel spawn activation, "Project View" rename, SchemaEditor pin toggle removal | PR #339 |
| — | AutoHelper frontend-initiated pairing | PRs #334-335 |
| — | Migration 036 stub restoration + seed transaction wrapping | PR #331 |
| — | Accessibility: form label/input associations, sidebar headings, design tokens | PR #332 |
| — | Atom token migration: 13 atom files to `--ws-*` tokens, Toggle atom extraction | PR #333 |
| — | Intake `--pub-*` token boundary fix, `definition_kind` system seeds + sidebar heuristics | PRs #323-324 |
| 235 | Context breadcrumb to events | PR #325 |
| — | Loading screen refactoring, AutoHelper tray menu, review feedback fixes | PRs #326-330 |
| — | Add /logkeeper skill | PR (commit 4b6e228) |
| — | Refactor: rename recipe -> arrangement, drop orphaned action_type_definitions, seed arrangement definitions | PRs #320-322 |
| — | UI Consistency Audit: dead code removal, font-bold->semibold, header heights, typography tokens, 2744 color tokens | PRs #313-317 |
| — | Bugfixes: Methodology->Process rename, fieldBindings crash, Bound->Linked, LoginPage tokens, Chladni badge/loader tile | PR #312 |
| — | Dockview v4 theme, swoopy tab corners, unified ThemedTab, tab strip + button | PRs #307-311 |
| *(older entries pruned — see git log for PRs #174-306)* | | |

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #198, #201 | Design system docs (palette, typography, layout) |
| #188 | Add referenceSlots to action arrangements |

*Pruned: #204 (superseded by #307-311), #205 (superseded by token migration work), #189-195 (Phase 0.1 addressed React Compiler issues)*
