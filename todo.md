# AutoArt Priorities

*Last Updated: 2026-02-09*
*Strategy: Foundation phases 0-6 complete (see [roadmap.md](roadmap.md) for architectural history). Phase 7 (Platform Polish & Integrations) active — parallel work streams, no dependency chain. This file drives active priorities.*

## Bug List

**Active — unphased:**
- **Project binding in workspaces is implementation theater:** Phase 1.2 wired WorkspaceContext consumption, but panels don't actually use the bound project ID. UI shows binding UI, backend may store it, but the connection between "user binds project to workspace" and "panels render that project's data" is broken or never existed. Trace the full path: workspace save → project binding persistence → panel mount → data fetch with bound ID.
- **Composer popout Phase 2/3 remaining:** Phase 1 infrastructure complete (PR #470) — portal overlay, extracted form hook, arrangement picker, schema fields, submit, keyboard shortcut. Phase 2: replace ProjectWorkflowView dialog, add CommandPalette command, wire workspace context. Phase 3: delete UnifiedComposerBar, ComposerView, ComposerPanel.
- **Intake form connections UX:** "Form connections to linked" vs "Make new entry" flow is confusing — needs UX review to clarify intent and behavior
- **Image form block link:** No image preview loads in the editor — can't verify via Preview button either (see Phase 0.3). Editor should show inline representation rather than relying on separate preview
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested

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
- AutoHelper sessions lost on backend restart (#340) — link key IS persisted in `connection_credentials` DB table. Issue is tray icon staleness — needs design decision, not a bugfix.

**UX polish:**
- "Import" tab hides in overflow menu despite ample space in tab bar
- Emoji/icon selector overlay — search doesn't work; consider switching to Phosphor Icons
- Placeholder themes: Compact, Minimal, Floating, and Default still essentially identical — differentiate per DESIGN.md theme variant guidance. Glass and neumorphic variants pending implementation (see Housekeeping).
- Project View: "New project" dropdown UI broken under "Your projects" section — formatting not clean

**Confirmed resolved (32+ items):** See Recently Closed section for PR references. Covers: import wizard stale plan regeneration (PR #434), ClassificationRow atom migration (PR #435), Phase 0 stack (React Compiler memo, Classification Panel partial save, preview servers, ExecutionControls API client, unused vars), Phase 1 stack (workspace foundation: context contract, panel consumption, Desk workspace, CenterView routing, store consolidation, workspace save, custom lifecycle, sidebar hints), Phase 2 stack (entity kind resolver, import/overlay migrations, seed through Composer — subprocess/stage projections now populate correctly, RecordDefinitionSchema phantom field removed), import hierarchy labels, connector sidebar escape hatch, intake record binding UUID, workspace save prompt timing, `[object Object]` field rendering, poll editor, poll public URLs, finance overlay contacts, 401 cascade, AutoHelper settings (now uses backend bridge), Google/Monday OAuth, and 18 earlier items (Monday null group_title, poll editor granularity, dropdown transparency, project spawn, Miller Columns, DOMPurify build, SelectionInspector close, panel spawner glassmorphism, AutoHelper tray pairing, applications dropdown bleed, panel spawn visibility, tab accent, action definitions seed, calendar link, header spacing, `/pair` async I/O, disconnect spinner).

---

## Phase 3: Import Pipeline Completion ✓

**Status: Complete** — All items merged via PRs #439-446 (Feb 8, 2026).

*Unblock production-quality imports. The wizard works end-to-end but lacks interpretation hooks for frontend consumers and degrades under volume.*

**Scope:**

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend | ✓ Done (PR #439) |
| — | Records/Fields/Actions registry browser UI unification: consistent layout and shared filter system | UX | ✓ Done (PR #440) |
| — | Action vocabulary: store classification verbs/nouns/adjectives from imports as heuristic JSONB tree; Composer and command toolbar use vocabulary to interpret action type construction | Classification | ✓ Done (PR #441, #443) |
| 79 | Enhance Workflow View Interactions — backend (migration + routes + auto-linking) | Backend | ✓ Done (PR #443) |
| 79 | Enhance Workflow View Interactions — frontend (badges + context menu + link dialog) | Frontend | ✓ Done (PR #444) |
| 237 | Performance Optimization & Caching — backend (indexes + classification cache) | Backend | ✓ Done (PR #445) |
| 237 | Performance Optimization & Caching — frontend (virtualization + prefetch) | Frontend | ✓ Done (PR #446) |

**Dependencies:** None — foundation phases cleared the path. #217 (interpretation routes) is the critical enabler; #237 (performance) and #79 (workflow interactions) build on top.

**Done when:** Frontend can call interpretation endpoints via TanStack Query hooks, imports complete in <2s for typical payloads, and workflow view supports direct interaction with imported actions.

**Key deliverables:**
- Interpretation HTTP routes + Zod schemas + TanStack Query hooks
- Registry browser UI unification (RegistryFilterBar, 280px sidebar consistency)
- Action vocabulary extraction (migration 004, vocabulary.service.ts, classification hooks)
- Composer vocabulary integration (useVocabularySuggestions, UnifiedComposerBar ranking)
- Import-action linking (migration 005, import_action_links table, auto-linking in ExecutionContext)
- ActionRegistryTable import badges + "Link to Import Item" context menu + ImportLinkDialog
- Performance: migration 006 indexes, in-memory classification cache with TTL
- ClassificationPanel virtualization (@tanstack/react-virtual) + query prefetch on session load

---

## Phase 4: BFA Reconciliation Pipeline Integration (#437) ✓

**Status: Complete** — All sub-phases merged via PRs #448-455 (Feb 8, 2026).

*Port BFA domain logic into the TypeScript backend, use the existing Monday.com connector for data sync, and build a reconciliation UI for field-level diff review. Google Docs injection via API.*

**Architecture (revised Feb 2026):** Instead of copying the BFA Python pipeline into AutoHelper, BFA's phase system, authority rules, and column semantics are ported as TypeScript code-as-config in `backend/src/modules/programs/bfa-program.config.ts`. Shared types live in `shared/src/schemas/bfa.ts`. The existing Monday.com connector + workspace/board/column config tables provide the data pipeline; the BFA program config provides the interpretation layer.

> **Abstraction flag:** When a second program needs phase/authority/column config, evaluate extracting `programs/` into database-driven config (JSON in a `program_configs` table). Current code-as-config approach is correct for single-program usage.

**Scope:**

| # | Issue | Sub-phase | Category | Status |
|---|-------|-----------|----------|--------|
| 437 | BFA program configuration: shared schemas, program config, Monday workspace seed | 4.1 | Shared + Backend | ✓ Done (PR #448) |
| 437 | Monday connector → BFA sync differ: field-level diff engine using program config + authority rules | 4.2 | Backend | ✓ Done (PR #449) |
| 437 | Backend reconciliation service: diff report storage, apply decisions routes, rollup handling | 4.3 | Backend | ✓ Done (PR #450) |
| 437 | Frontend reconciliation panel: diff review, accept/reject, summary stats | 4.4 | Frontend | ✓ Done (PR #451) |
| 437 | Google Docs injection: resolve placeholders, call Docs API, inject styled content | 4.5 | Backend + Frontend | ✓ Done (PRs #453-455) |

**Dependencies:** Phase 3 infrastructure stable. Google OAuth (#403) resolved for Phase 4.5.

**Internal order:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 (strict chain — each sub-phase depends on the prior)

**Done when:** User triggers Monday sync for BFA board, sees field-level diffs in a reconciliation panel, approves changes, and can optionally inject styled content into a Google Doc.

**Key deliverables:**
- BFA program config (shared Zod schemas, TypeScript code-as-config, phase canonicalization, authority rules)
- Sync differ (pure diff engine, LocalEntitySnapshot construction, HTTP routes)
- Reconciliation service (migration 007, sync decisions table, apply logic, rollup handling)
- Frontend panel (diff review UI, accept/reject controls, summary stats)
- Google Docs injection (Phase expansion transform, entity→project resolution, Docs API integration, contact uniqueName collision fix)

---

## Phase 4B: BFA Import to AutoArt Records (#438) ✓

**Status: Complete** — All sub-phases merged via PRs #452-455 (Feb 8, 2026).

*Depends on Phase 4. After reconciliation, optionally push approved changes back into AutoArt's hierarchy and records system via the Composer.*

**Scope:**

| # | Issue | Sub-phase | Category | Status |
|---|-------|-----------|----------|--------|
| 438 | Schema transformation layer: BFA -> AutoArt hierarchy/records mapping, dedup via BFA UID | 4B.1 | Backend | ✓ Done (PRs #452-453) |
| 438 | Composer integration: BFA import actions -> events, project lattice creation, projection updates | 4B.2 | Backend | ✓ Done (PRs #452-453) |
| 438 | Frontend import toggle: checkbox in ReconciliationPanel, preview, result modal with project links | 4B.3 | Frontend | ✓ Done (PRs #454-455) |

**Dependencies:** Phase 4 complete. Uses Composer service (stable since Phase 2.4).

**Internal order:** 4B.1 -> 4B.2 -> 4B.3 (strict chain)

**Done when:** User checks "Import to AutoArt records" in reconciliation panel, approved changes create hierarchy nodes (Project -> Process -> Stage), records (contacts, milestones, artists), and events via Composer. New projects appear in the workspace sidebar.

**Key deliverables:**
- Schema transformation (BFA → AutoArt hierarchy/records mapping, Phase expansion, UID-based deduplication)
- Composer integration (import service, actions → events, project lattice creation via Composer)
- Frontend controls (import toggle checkbox, preview modal, result modal with project links)

---

## Phase 5: Finance Foundation

*Stand up the data layer for the Finance epic (#173). Seed definitions first, then computed fields, then records. No UI surfaces yet -- this phase is backend + shared.*

**Previously Phase 4.** Renumbered to accommodate BFA integration. Independent of Phase 4/4B -- can run in parallel.

**Status: Complete** — Computed fields (PRs #456-458), finance surfaces, export templates all merged.

**Scope:**

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 171 | Seed: Finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense) | Finance | ✓ Done (#171 merged earlier) |
| 166 | Computed fields + relationship rollups (no-scripting, budgets/invoices/stage sums) | Finance | ✓ Done (PRs #456-458) |
| 165 | Invoice generation + tracking (records + PDF export + payments) | Finance | Partial (data layer done) |
| 168 | Vendor bills + expense tracking (invoice receipts, payments, stage reconciliation) | Finance | |
| 167 | Project Budgets surface (stage allocations + reconciliation rollups + spreadsheet export) | Finance | |

**Dependencies:** #171 (seed) and #166 (computed fields) landed. #165, #167, #168 can parallelize.

**Internal order:** #171 ✓ -> #166 ✓ -> (#165, #167, #168 can parallelize)

**Done when:** Finance record definitions seed correctly through Composer ✓, computed fields derive budget/invoice/expense totals ✓, and invoice/bill/budget records can be created and queried via API.

---

## Phase 6: Finance Surfaces & Integration ✓

**Status: Complete** — PRs #460-464 merged (Feb 8, 2026). Finance events in Composer, overlay views, Handlebars invoice template, preview endpoint, AutoHelper invoice watchdog.

*Wire finance data into the UI, Composer event log, and export pipeline. Depends on Phase 5 data layer being solid.*

**Previously Phase 5.** Renumbered.

**Scope:**

| # | Issue | Category |
|---|-------|----------|
| 169 | Finance surfaces + quick overlays (budgets/invoices/expenses hub) | Finance |
| 170 | Wire finance actions into Composer + Project Log (invoice/bill/payment events) | Finance |
| 172 | Finance export modules (Invoice PDF, Budget CSV, export presets) | Finance |
| 183 | Evolve export into live client reports system | Reports |
| 291 | Schema editor / Composer relationship-math builder | Feature |

**Dependencies:** Phase 5 complete. #170 (Composer wiring) should land before #169 (surfaces) so the UI can show real events. #172 (exports) depends on #165 (invoices) and #167 (budgets) from Phase 5.

**Done when:** Users can create invoices/budgets/expenses from the UI, see finance events in the Project Log, export Invoice PDFs and Budget CSVs, and the client reports system serves live data.

---

## Phase 7: Platform Polish & Integrations

*Independent improvements that do not gate each other. Work from this phase in any order as bandwidth allows.*

**Previously Phase 6.** Renumbered.

**Workspace polish:**

| # | Issue | Category |
|---|-------|----------|
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| -- | Composer bar as sleek dockview popout window (replace modal) | UX |
| -- | Consolidate Calendar/Gantt/future view expansions: link Application views to Project View segmented equivalents; cross-project filter/overlay | Feature |
| -- | Poll editor: support different/multiple time block selections per day | Polls |

**Intake & records:**

| # | Issue | Category |
|---|-------|----------|
| -- | Intake forms -> records verification: E2E test block mapping, record creation, completion flow | Intake |
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
| -- | **AutoHelper local-only config:** Roots, DB path, garbage collection settings should be stored locally with AutoHelper, not in global DB | AutoHelper |
| -- | **AutoHelper "Rebuild Index" is theater:** Carries stale DB path, hangs when triggered -- needs real backend handler or correct path | AutoHelper |

**Note:** AutoHelper settings bridge (was P2) is **resolved** -- frontend now correctly uses backend bridge endpoints. See [roadmap.md](roadmap.md#autohelper-status-resolved).

**Note:** Workspace issues #179-182 closed on GitHub -- absorbed into Phase 1 (PRs #421-429).

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
| `ExportMenu.tsx` | `invoiceNumber` sent to PDF/DOCX endpoints — backend should consume for Content-Disposition filenames |
| ~~`vocabulary.routes.ts`~~ | ~~Whitespace-only prefix~~ — `.trim()` added before `.min(1)` (Phase 7 Stream 1) |
| `vocabulary` migration 004 | Composite btree index on `(verb, noun)` won't be used for `ILIKE ... OR ILIKE` prefix queries — consider separate `text_pattern_ops` indexes per column (PR #441) |
| ~~`classification-cache.ts`~~ | ~~Hash truncated to 16 hex chars~~ — Already 32 chars (128-bit) and hashes `schema_config`. Resolved. |
| `todo.md` | Broken anchor `#autohelper-status-resolved` — roadmap heading changed to "AutoHelper Status (Resolved, Evolving)" (PR #442) | — |

**Low priority (CodeAnt #332 nitpicks):**

| File | Issue |
|------|-------|
| `packages/ui/src/atoms/Card.tsx` | Tailwind arbitrary value parsing: `theme(...)` nested inside `var(...)` fallback may be dropped by some JIT parsers |
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

---

## In-Flight (Awaiting Review)

| PRs | Description |
|-----|-------------|
| #466-470 | **Phase 7 polish stack (Streams 1-6, Feb 9):** Bug fixes (double border, sidebar stats, import dialog, vocab trim), Records/Actions panel layout alignment, Parchment Serif 4 + Badge tokens + SegmentedControl variants (glass/neumorphic), accessibility (ARIA attributes, heading semantics), dead code removal (ProjectPage, ComposerPage), Composer headless popout Phase 1 (portal overlay, useComposerForm hook, arrangement picker, schema fields, Ctrl+Shift+N shortcut). Table migration cancelled (UniversalTableCore flexbox engine is intentional). |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
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

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #198, #201 | Design system docs (palette, typography, layout) |
| #188 | Add referenceSlots to action arrangements |

*Pruned: #204 (superseded by #307-311), #205 (superseded by token migration work), #189-195 (Phase 0.1 addressed React Compiler issues)*
