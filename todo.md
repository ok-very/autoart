# AutoArt Priorities

*Last Updated: 2026-02-13*
*Strategy: Foundation phases 0–6 complete (see [roadmap.md](roadmap.md) for architectural history). Active work tracked by priority tier: P0 (blocking), P1 (next up), P2 (near-term), P3 (backlog). This file drives active priorities.*

## Bug List

**Active — unphased:**
- **Project binding in workspaces is implementation theater:** Phase 1.2 wired WorkspaceContext consumption, but panels don't actually use the bound project ID. UI shows binding UI, backend may store it, but the connection between "user binds project to workspace" and "panels render that project's data" is broken or never existed. Trace the full path: workspace save → project binding persistence → panel mount → data fetch with bound ID.
- **Composer popout Phase 3 remaining:** Phase 1 infrastructure complete (PR #470). Phase 2 done (in-flight): ProjectWorkflowView uses popout, CommandPalette "New Action" command, Header button opens popout, workspace context fallback wired. Phase 3 revised: delete UnifiedComposerBar (dead code), keep ComposerView as expanded composer panel (deep compose: reference slots, context selection, agent routing), re-wire `composer-workbench` in MainLayout COMPONENTS. Future: migrate ComposerView internals to `useComposerForm` + `@autoart/ui` components.
- **Intake form connections UX:** "Form connections to linked" vs "Make new entry" flow is confusing — needs UX review to clarify intent and behavior
- **Image form block link:** No image preview loads in the editor — can't verify via Preview button either (see Phase 0.3). Editor should show inline representation rather than relying on separate preview
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested
- **4 backend integration tests fail in CI:** auth.service, composer.service, events.service, hierarchy.service — `Database not initialized. Call initializeDatabase() first`. Tests need `initializeDatabase()` in setup. Marked `continue-on-error` in CI workflow as stopgap.
- ~~**`stage-entered-passive` regex anchor mismatch (PR #480):**~~ Fixed — `^` anchor removed from `extractStageFromText` `enteredMatch` regex. Verified: pattern now allows mid-string matches.

~~**PR #477 review findings (CodeAnt — lives on packages branch):**~~ Dead — PR #477 branch abandoned, package queue superseded by collection-driven export (PRs #495-496).

**Phase 3 review findings (PRs #439-447):**

*Confirmed resolved (PR #447):*
- ~~Missing auth on classifications route~~ — `GET /sessions/:id/classifications` now has `preHandler: [app.authenticate]`
- ~~Missing auth on action-links read route~~ — `GET /action-links/:actionId` now has `preHandler: [app.authenticate]`
- ~~`/link-action` 500 on duplicate~~ — Checks for existing link before insert, returns 200 with existing row
- ~~Vocabulary upsert NULL adjective duplicates~~ — `adjective: vocab.adjective ?? ''` normalizes before insert

*Resolved logic bugs (confirmed Feb 9):*
- ~~Classification cache hash ignores definition schema~~ — `deriveContentHash()` now hashes `def.schema_config` (line 81) and uses 128-bit hash (32 hex chars). Fixed in PR #458.
- ~~`useLinkAction` wrong response type~~ — Hook already uses `api.post<ImportActionLink>` (single object), matching backend response. Stale bug entry.
- ~~`entityType` cast bypasses validation~~ — Schema now uses `z.enum([...])`, validates at parse time. Resolved.

*Visual/UX (fixed in Phase 7 Stream 1):*
- ~~Double border in Fields panel~~ — Removed duplicate `border-r` from sidebar wrapper.
- ~~Actions sidebar shows record stats~~ — DefinitionListSidebar now hides counts for non-record definitions.
- ~~ImportLinkDialog available count mismatch~~ — Header now shows "X total, Y available" matching list contents.

**Deferred:**
- ~~AutoHelper sessions lost on backend restart (#340)~~ — Fixed: `ConnectionStateManager` singleton with 3-state tracking (unpaired/paired_connected/paired_disconnected). Tray icon reads state from manager, poller updates on 401/network errors. PR #475.

**UX polish:**
- "Import" tab hides in overflow menu despite ample space in tab bar
- ~~Emoji/icon selector overlay~~ — Search filtering added in Stream 20 (PR #472)
- ~~Placeholder themes~~ — Promoted to Phase 7 Workspace polish (theme alignment stage).
- Project View: "New project" dropdown UI broken under "Your projects" section — formatting not clean

**Confirmed resolved (32+ items):** See Recently Closed section for PR references. Covers: import wizard stale plan regeneration (PR #434), ClassificationRow atom migration (PR #435), Phase 0 stack (React Compiler memo, Classification Panel partial save, preview servers, ExecutionControls API client, unused vars), Phase 1 stack (workspace foundation: context contract, panel consumption, Desk workspace, CenterView routing, store consolidation, workspace save, custom lifecycle, sidebar hints), Phase 2 stack (entity kind resolver, import/overlay migrations, seed through Composer — subprocess/stage projections now populate correctly, RecordDefinitionSchema phantom field removed), import hierarchy labels, connector sidebar escape hatch, intake record binding UUID, workspace save prompt timing, `[object Object]` field rendering, poll editor, poll public URLs, finance overlay contacts, 401 cascade, AutoHelper settings (now uses backend bridge), Google/Monday OAuth, and 18 earlier items (Monday null group_title, poll editor granularity, dropdown transparency, project spawn, Miller Columns, DOMPurify build, SelectionInspector close, panel spawner glassmorphism, AutoHelper tray pairing, applications dropdown bleed, panel spawn visibility, tab accent, action definitions seed, calendar link, header spacing, `/pair` async I/O, disconnect spinner).

---

## P0: Blocking

| # | Issue | Category |
|---|-------|----------|
| — | ~~**Export Package Queue Architecture**~~ — Superseded by collection-driven export interface (PRs #495-496). Collection system serves as intake layer; backend only sees `projectIds[]`. Queue plan (`docs/plans/export-queue-architecture.md`) archived. PR #477 closed without merge. | Export |

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| — | **Composer dual-surface completion:** ComposerView as expanded panel — migrate to `useComposerForm`, agent selection/routing, `@autoart/ui` components, `--ws-*` tokens. UnifiedComposerBar deleted. | UX |

---

## P2: Near-term

| # | Issue | Category |
|---|-------|----------|
| — | **Filtering, sorting, column visibility:** Headless `@tanstack/react-table` as state machine for all table surfaces + `match-sorter` for sidebar lists. Phase 0 (foundation) done — `useTableState` hook, `FilterChip` atom, `FilterBar` molecule, `ColumnPicker` moved to `@autoart/ui`, filter function registry. 4 phases remain: (1) DataTableFlat migration, (2) sidebar list filtering, (3) remaining core tables, (4) standalone tables. Roadmap: [`docs/roadmap-filtering.md`](docs/roadmap-filtering.md) | Tables |
| — | **Export Workbench P4:** E2E verification — full flow per format: select → session → projection → preview → export → download. Verify finance exports unbroken. *(P5 target registry cleanup done — dead registry deleted, switch is canonical.)* | Export |
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 393 | File Detection & Alignment Service Phase 2: alignment logic, backend endpoints, UI (Phase 1 done, PR #475) | AutoHelper |
| — | Intake forms → records E2E verification: block mapping, record creation, completion flow | Intake |
| 177 | Integrate intake forms with records system | Intake |
| — | Consolidate Calendar/Gantt/future view expansions: link Application views to Project View segmented equivalents; cross-project filter/overlay | Feature |
| — | **Theme alignment stage:** Design review + development of all workspace themes per DESIGN.md variant guidance (solid, floating, minimal, glass, neumorphic). SegmentedControl variants landed (PR #468); full theme modules need registration. | Themes |
| 165 | Invoice generation + tracking (data layer done, UI remaining) | Finance |
| 167 | Project Budgets surface: stage allocations + reconciliation rollups + spreadsheet export | Finance |
| 168 | Vendor bills + expense tracking: invoice receipts, payments, stage reconciliation | Finance |

---

## Housekeeping

| File | Issue | Phase |
|------|-------|-------|
| ~~Records view~~ | ~~Align layout with Fields view~~ — Fixed in Phase 7 Stream 4 (PR #467) | — |
| ~~`SegmentedControl.tsx`~~ | ~~Glass + neumorphic variants~~ — Added in Phase 7 Stream 2 (PR #468) | — |
| ~~Parchment theme~~ | ~~Serif 4 + badge tokens~~ — Source Serif 4 headings + `--ws-badge-*` tokens in Phase 7 Stream 2 (PR #468) | — |
| Intake forms + poll deployments | Need verification: localhost vs production endpoint config | — |
| Future outbound subdomains | `polls.autoart.work`, `forms.autoart.work` endpoint routing not wired | — |
| SelectionInspector / Record view | Handle `definition_kind` system for filtering/classification — resolver exists but inspector doesn't use it yet | — |
| Record fields | Full RichTextEditor with combobox used where simpler field types are appropriate | — |
| Selection editor | "Plan" link badge system could just be a pointer to the active window name / binding group color | — |
| ~~`UniversalTableCore.tsx`~~ | ~~Table atom migration~~ — Cancelled: UniversalTableCore is a flexbox grid engine (resize, sort, features). Div-based layout is intentional, not a bug. Table atom is for simple semantic tables. | — |
| ~~`Badge.tsx`~~ | ~~Badge variant colors~~ — Migrated to `--ws-badge-*` CSS tokens in Phase 7 Stream 2 (PR #468) | — |
| `frontend/src/ui/sidebars/` + definition filtering | `definition_kind = 'container'` — type declared and filtered but no distinct UI treatment (icon, section, color) | — |
| ~~`frontend/src/ui/composites/MillerColumnsView.tsx`~~ | ~~Column header label "stage" → "phase"~~ — Renamed comment + `handleAddStage` → `handleAddPhase` | — |
| ~~`ExportMenu.tsx`~~ | ~~`invoiceNumber` prop~~ — Dead prop removed in Stream 20 (PR #472) |
| ~~`vocabulary.routes.ts`~~ | ~~Whitespace-only prefix~~ — `.trim()` added before `.min(1)` (Phase 7 Stream 1) |
| `vocabulary` migration 004 | Composite btree index on `(verb, noun)` won't be used for `ILIKE ... OR ILIKE` prefix queries — consider separate `text_pattern_ops` indexes per column (PR #441) |
| ~~`classification-cache.ts`~~ | ~~Hash truncated to 16 hex chars~~ — Already 32 chars (128-bit) and hashes `schema_config`. Resolved. |
| ~~`todo.md`~~ | ~~Broken anchor `#autohelper-status-resolved`~~ — Fixed in Stream 20 (PR #472) | — |
| ~~`.serena/memories/`~~ | ~~Session artifacts committed~~ — Added to `.gitignore` | — |
| ~~`packages.service.ts`~~ | ~~N+1 reorder~~ — Dead: PR #477 branch abandoned, package queue superseded by collection system | — |
| ~~`packages.routes.ts`~~ | ~~No user scoping~~ — Dead: PR #477 branch abandoned | — |
| ~~`PackageDetailView.tsx`~~ | ~~`window.open` bypasses auth~~ — Dead: PR #477 branch abandoned | — |
| ~~`frontend/src/workflows/export/views/ExportWorkbench.tsx`~~ | ~~Dead collection-based workbench~~ — Deleted (+ `ExportWorkbenchView.tsx`, `ExportPage.tsx`). Barrel export cleaned. | — |
| ~~`frontend/src/pages/ExportPage.tsx`~~ | ~~Orphaned page, no route~~ — Deleted (see above) | — |
| ~~`backend/src/modules/exports/targets/`~~ | ~~Dead target registry~~ — Deleted entire directory (5 files). `executeExport()` switch is the real dispatcher. | — |
| ~~`backend/src/` lint~~ | ~~39 lint errors~~ — Stale count. Only 1 unused import (`BfaFieldAuthority`) remained; removed. 0 errors, 1 informational warning (TanStack Virtual vs React Compiler). | — |

**Low priority (CodeAnt #332 nitpicks):**

| File | Issue |
|------|-------|
| ~~`packages/ui/src/atoms/Card.tsx`~~ | ~~Tailwind `theme(...)` parsing~~ — No `theme()` usage found in Card.tsx; uses `--ws-*` tokens directly |
| ~~`ProjectSidebar.tsx`~~ | ~~Section headings `<p>` → `<h3>`~~ — Fixed in Phase 7 Stream 5 (PR #469) |
| ~~`intake/blocks/*.tsx`~~ | ~~Missing ARIA attributes~~ — Added `aria-invalid`, `aria-describedby`, `aria-required` in Phase 7 Stream 5 (PR #469) |

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
| 178 | Manual file link support in intake forms | Intake |
| — | Poll editor: support different/multiple time block selections per day | Polls |
| 159 | Contacts quick-export overlay (vCard, recipient formats) | Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |

---

## In-Flight (Awaiting Review)

| PRs | Description |
|-----|-------------|
*(empty)*

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| — | **Export Interface + CLAUDE.md cockpit + CodeAnt fixes (Feb 13 2026):** (PR #495) Collection-driven export surface — 3-phase implementation: mount Collection System + rewire GenerationPanel to backend sessions, section toggles + drag-and-drop reorder + export config store, document preview + result screen + dead code removal (8 old files deleted, 4 new). JSON formatter, stateless preview endpoint, `resolveProjectIds` utility. Plan: `docs/plans/plan-export-interface.md`. (PR #496) CLAUDE.md distilled to ~140-line cockpit at `~/dev/CLAUDE.md` — agents load reference docs on-demand instead of preloading. Session commands (`/session-init`, `/session-save`) for Serena memory persistence. CI lint gate removed (GitHub Actions). CodeAnt review validation: ExportOptions schema fields given `.default()` values for backwards compat, drifted local schema in `exports.routes.ts` replaced with shared import, `formatCurrency` currency param guarded against undefined. PR #497 closed (stale — migration fix already on main via #498). | PRs #495-496 (merged), #497 (closed) |
| — | **GitHub Actions CI pipeline (Feb 13 2026):** CI workflow established — Postgres 15 service, pnpm frozen-lockfile, build chain (shared → ui → backend), lint, typecheck, unit tests. Fixes: idempotent migration 009 (conditional enum rename for fresh vs legacy DBs), stale lockfile (match-sorter catalog sync), JWT_SECRET env var, @autoart/ui build step for typecheck. 4 integration tests marked continue-on-error (see Bug List). | PRs #487, #498, #499, #500 |
| — | **Export Workbench P0-P3 (Feb 10 2026):** Interpreter coverage (#479), export UI reconciliation (#481), BFA projector fixes (#482), projector tests + ExportPreview cleanup (#483). Design review completed; collection-driven interface shipped in PRs #495-496. PR #477 (Package Queue Phase 1) closed without merge. | PRs #479-483 (merged), #477 (closed) |
| 340, 393 | **AutoHelper hardening + CodeAnt review fixes (Feb 9 2026):** (PR #473) Test infrastructure — `Settings.load_from_config_store` model_validator now checks `model_fields_set` before overwriting constructor kwargs (fixed 22 test failures); mail tests mock `_HAS_WIN32` directly instead of fighting `@functools.cache` (fixed 4 failures). Tests: 49/75 → 75/75. (PR #474) MyPy cleanup — 89 errors → 0 across 24 files: `types-requests` stubs, `dict[str, Any]` annotations, `cast()` for no-any-return, test function `-> None` + fixture types, async iterator overrides. (PR #475) Tray staleness (#340) — `ConnectionStateManager` thread-safe singleton with 3 states (unpaired/paired_connected/paired_disconnected), poller sets state on 401/network errors, tray reads from manager. File watch Phase 1 (#393) — watchdog-based `modules/file_watch/` (schemas, handler, service, router), 500ms debounce, ref matching, poller command handlers (watch_root/unwatch_root/drain_file_events). Tests: 75 → 98. **CodeAnt review fixes (commit 568b715):** Thread safety — double-checked locking on `get_service()` singleton, `ThreadSafeEventQueue` replaces bare list to prevent event loss between watchdog producer and drain consumer. Idempotency bug — audit_log stores Pydantic `model_dump()` for replay instead of `str(result)`, fixing wrong-type return on cache hit. Path safety — `path.absolute()` instead of `resolve()` for deletion events where file no longer exists. | PR #476 (stack merge #473-475) |

| # | Issue | Closed By |
|---|-------|-----------|
| — | **Phase 6: Finance Surfaces & Integration (Feb 8 2026):** Finance events in Composer, overlay views (budgets/invoices/expenses hub), Handlebars invoice template + preview endpoint, AutoHelper invoice watchdog, schema editor/relationship-math builder. | PRs #460-464 |
| 166 | **Phase 5: Finance Foundation — computed fields (Feb 8 2026):** (PR #456) Migrate formula engine from custom tokenizer/parser to `json-logic-js` — 452-line custom parser replaced with JsonLogic evaluation, new API `evaluateFormula(rule, data)` + `buildFormulaData()`, converted all 4 seed formulas (Invoice total, Line Item line_total/line_tax, Budget remaining) to JsonLogic objects, 37 unit tests (28 formula engine + 9 rollup engine). (PR #457) Invoice `paid_amount` rollup (sum of linked payment records) + `balance_due` computed field (total - paid_amount), full rollup chain: line items → subtotal/tax_total → total → paid_amount → balance_due. | PRs #456-458 |

| # | Issue | Closed By |
|---|-------|-----------|
| 438 | **Phase 4B: BFA Import to AutoArt Records (Feb 8 2026):** (4B.1) Schema transformation layer — BFA → AutoArt hierarchy/records mapping via `bfa-import.service.ts`, Phase expansion (Stage → Phase nodes), UID-based deduplication, contact uniqueName collision fix (include role in uniqueName). (4B.2) Composer integration — import service orchestrates actions → events flow, creates project lattice (Project → Process → Phase), links contacts/milestones/artists, entity→project resolution via recursive CTE. (4B.3) Frontend import toggle — checkbox in ReconciliationPanel, preview modal, result modal with project links. Review fixes: deduplicated entity resolution (consolidated three near-identical functions), batch ancestor walks (O(N*D) → single CTE with depth guard), return documentUrl in no-headers path, clear localStorage on empty doc ID. | PRs #452-455 |
| 437 | **Phase 4: BFA Reconciliation Pipeline Integration (Feb 8 2026):** (4.1) BFA program configuration — shared Zod schemas (`bfa.ts`: phases, authority, diff report, column mappings), TypeScript code-as-config (`bfa-program.config.ts`: phase canonicalization, budget normalization, regression detection, column mappings, state priority). (4.2) BFA sync differ — pure diff engine (`bfa-sync-differ.ts`) comparing Monday import plan items against local entity snapshots via `external_source_mappings`; orchestration service (`bfa-sync.service.ts`) fetching Monday data, building `LocalEntitySnapshot` from `actions.field_bindings` and `hierarchy_nodes.metadata`; HTTP routes (`bfa-sync.routes.ts`) at `/api/programs/bfa/sync`. (4.3) Backend reconciliation service — migration 007 adds `last_diff_report` JSONB to `monday_sync_states`, sync decisions table, apply logic, rollup handling. (4.4) Frontend reconciliation panel — diff review UI, accept/reject controls, summary stats. (4.5) Google Docs injection — Phase expansion import transformer, entity→project resolution, Docs API integration, styled content injection. | PRs #448-451, #453-455 |
| — | **Stackit merge workflow updates (Feb 8 2026):** Promoted `stackit merge squash` to primary merge method (consolidates stack into single PR, avoids retargeting race). Bottom-up `gh pr merge` loop demoted to fallback for preserving per-PR history. Updated pretooluse hook — all four gated operations (`stackit checkout`, `stackit restack`, `stackit merge`, `gh pr merge`) now use "ask" confirmation instead of hard deny. Clarified squash prohibition in CLAUDE.md targets `gh pr merge --squash` on individual PRs, not stackit's safe consolidation command. | Commits b78e9d1, 860a289, 905ec07 |
| 437 | **Phase 4.1-4.2: BFA Reconciliation Pipeline (Feb 8 2026):** (4.1) BFA program configuration — shared Zod schemas (`bfa.ts`: phases, authority, diff report, column mappings), TypeScript code-as-config (`bfa-program.config.ts`: phase canonicalization, budget normalization, regression detection, column mappings, state priority). (4.2) BFA sync differ — pure diff engine (`bfa-sync-differ.ts`) comparing Monday import plan items against local entity snapshots via `external_source_mappings`; orchestration service (`bfa-sync.service.ts`) fetching Monday data, building `LocalEntitySnapshot` from `actions.field_bindings` and `hierarchy_nodes.metadata`; HTTP routes (`bfa-sync.routes.ts`) at `/api/programs/bfa/sync`; migration 007 adds `last_diff_report` JSONB to `monday_sync_states` (rejected `export_sessions` misuse). | Commit 981d6b0 (4.1), uncommitted (4.2) |
| — | **Phase 3: Import Pipeline Completion (Feb 8 2026):** (3.1) Interpretation HTTP routes + Zod schemas (3.2) TanStack Query hooks (3.3) Registry browser UI unification (RegistryFilterBar, 280px sidebar) (3.4) Workflow view backend (migration 005, import_action_links table, auto-linking) + frontend (ActionRegistryTable badges, "Link to Import Item" menu, ImportLinkDialog) (3.5) Action vocabulary extraction (migration 004, vocabulary.service.ts, classification hooks) (3.6) Composer vocabulary integration (useVocabularySuggestions hook, UnifiedComposerBar ranking) (3.7) Performance optimization (migration 006 indexes, in-memory classification cache, ClassificationPanel virtualization, query prefetch). Verified: RegistryFilterBar renders across Actions/Fields/Records panels. Unverified (require import data): vocabulary suggestions, import linking badges, classification virtualization. | PRs #439-446 |
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

*Phases 3–6 cleared from active tracking (Feb 9 2026). All were complete; see entries above for PR references. Remaining Phase 5 finance items (#165, #167, #168) re-slotted to P2. Phase 7 dissolved — items re-slotted to P1/P2/P3 by priority.*

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #198, #201 | Design system docs (palette, typography, layout) |
| #188 | Add referenceSlots to action arrangements |

*Pruned: #204 (superseded by #307-311), #205 (superseded by token migration work), #189-195 (Phase 0.1 addressed React Compiler issues)*
