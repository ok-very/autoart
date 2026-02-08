# AutoArt Roadmap

*Created: 2026-02-07*

Three architectural seams were producing regressions faster than they got fixed. This roadmap replaced the flat priority list with a dependency-ordered plan that fixed the seams before building on top of them. **All three foundation phases are now complete** (Feb 8, 2026). See `todo.md` for active priorities.

---

## Diagnosis: What Was Wrong (Resolved)

Three seams identified Feb 7, 2026. All resolved by Phases 0-2.

### Seam 1: The Workspace System Was Half-Built → Resolved by Phase 1

Panel layout, content routing, and context binding were three disconnected layers. Desk was broken, CenterView routing was broken, workspace save was a timing hack. Phase 1 unified everything: single `WorkspaceContext` interface, panels consume context via params, one store owns workspace identity + content type + view mode + layout, dirty tracking and save with confirmation dialog.

### Seam 2: Two Type Systems Coexisted → Resolved by Phase 2

Import wizard, overlay creation, and seed data used explicit `entityType` string checks while sidebars used `definition_kind`. Phase 2 introduced `resolveEntityKind()` in `@autoart/shared`, migrated import adapters and overlay types, and fixed a phantom `kind` field in `RecordDefinitionSchema` that broke Composer filters.

### Seam 3: Dev/Prod Path Divergence → Resolved by Phases 0 + 2

Seeds bypassed Composer (fixed by Phase 2.4 — seed through Composer). Preview buttons opened dead ports (fixed by Phase 0.3 — dev server startup). Direct fetch in ExecutionControls (fixed by Phase 0.4 — API client migration).

---

## Phase 0: Stop the Bleeding ✓

**Status: Complete** — All items merged via PRs #416-420.

Fix bugs that block current functionality. No new features.

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 0.1 | **React Compiler memoization fix** — `useMemo` deps don't match React Compiler inference. Fix deps or suppress directive. | `frontend/src/workflows/intake/components/BlockRecordBindingEditor.tsx:39` | ✓ Merged |
| 0.2 | **Classification Panel deadlock** — Save button disabled when items are unresolved (inverted logic). Should enable save when user has *pending* resolutions. | `frontend/src/workflows/import/panels/ClassificationPanel.tsx:410` | ✓ Merged |
| 0.3 | **Preview dev server startup** — Add intake (5174) and poll (5175) to `pnpm dev`. Or: embed preview route in dashboard. | `scripts/dev.sh`, `frontend/.env.development` | ✓ Merged |
| 0.4 | **ExecutionControls API client** — Replace raw `fetch()` with proper TanStack Query mutation hook. | `frontend/src/workflows/import/panels/ExecutionControls.tsx:166` | ✓ Merged |
| 0.5 | **Unused var cleanup** — Prefix `isDev` and `db` with `_`. | `backend/src/db/client.ts:29`, `backend/src/modules/intake/intake.composer.ts:16` | ✓ Merged |

Clean builds, unblocked import wizard, working preview buttons. Phase 1 now unblocked.

---

## Phase 1: Workspace Foundation ✓

**Status: Complete** — All items merged via PRs #421-429 (Feb 7-8, 2026).

Fixed the workspace system so everything built on top of it stops regressing. This phase absorbed multiple items scattered across the old P1, P2, and bug list.

| # | Item | Absorbs | Depends On | Status |
|---|------|---------|-----------|--------|
| 1.1 | **Workspace context contract** — Define `WorkspaceContext` interface. Replace ad-hoc `boundProjectId` + `pendingPanelPositions` with a single context object passed via Dockview panel params. | — (new) | Phase 0 complete | ✓ Merged PR #421 |
| 1.2 | **Panel context consumption** — Update `project-panel`, `mail-panel`, `selection-inspector` to read from `WorkspaceContext`. Panels that don't need context ignore it. | Workspace binding (old P1) | 1.1 | ✓ Merged PR #422, #423 |
| 1.3 | **Desk workspace** — With context binding working, Desk becomes: project-panel (bound) + mail-panel (bound) + center showing project overview. First in workspace list, default on login. | Bug: "Desk workspace broken" | 1.1, 1.2 | ✓ Merged PR #425 |
| 1.4 | **CenterView routing ownership** — Each workspace preset declares which `CenterContentType` it owns. CenterContentRouter validates content matches active workspace. Mismatches redirect to workspace default. | P1: CenterView routing, Bug: CenterView conceptual breakage | 1.1 | ✓ Merged PR #424 |
| 1.5 | **Store consolidation** — Merge `uiStore` content/view state into `workspaceStore`. One store owns workspace identity, content type, view mode, and panel layout. Single version, single migration. Eliminated cross-store calls in `applyWorkspace()`. | — (new, highest-impact change for regressions) | 1.4 | ✓ Merged PR #426 |
| 1.6 | **Workspace save** — With unified store, "Save workspace" persists the full state snapshot. `_applyingWorkspace` flag suppresses false dirty marks during preset application. Confirmation dialog on switch with Update/Discard/Save-as-new options. | P2 #182: Workspace modification tracking | 1.5 | ✓ Merged PR #427 |
| 1.7 | **Custom workspace lifecycle** — Create, rename, delete custom workspaces. `renameCustomWorkspace()` with uniqueness validation. Context menu (Pencil/Copy/Trash) on custom workspace items. Rename dialog with inline editing. | — (new) | 1.5, 1.6 | ✓ Merged PR #428 |
| 1.8 | **Workspace sidebar overrides** — Workspaces declare sidebar visibility rules via `sidebarHint` on subviews. ProjectWorkflowView auto-collapses sidebar when hint is 'none', auto-expands when 'project'. | P1: Workspace sidebar overrides | 1.4 | ✓ Merged PR #429 |

**Key files:**
- `frontend/src/stores/uiStore.ts` — partially absorbed into workspaceStore
- `frontend/src/stores/workspaceStore.ts` — single source of truth for workspace state
- `frontend/src/ui/workspace/CenterContentRouter.tsx` — validates content vs active workspace
- `frontend/src/workspace/workspacePresets.ts` — declares contentType ownership
- `frontend/src/workspace/panelRegistry.ts` — panels consume WorkspaceContext
- `frontend/src/ui/layout/MainLayout.tsx` — passes context to panels

---

## Phase 2: Type System Unification ✓

**Status: Complete** — All items merged via PRs #430-431 (Feb 8, 2026).

Resolved the dual type system. Single `resolveEntityKind()` function in `@autoart/shared` replaces all scattered `entityType` string checks. Import adapter and overlay types migrated. Seed runs through Composer service. Critical fix: removed phantom `kind` field from `RecordDefinitionSchema` — Zod default always set `kind='record'`, breaking Composer filters that checked `d.kind === 'action_arrangement'`. Backend sends `definition_kind` only; schema now uses `definition_kind` as canonical field.

| # | Item | Absorbs | Depends On | Status |
|---|------|---------|-----------|--------|
| 2.1 | **Entity kind resolver** — `resolveEntityKind()` in `@autoart/shared`. Derives kind from hierarchy type, definition_kind, definition lookup, or import plan item. | Housekeeping: `definition_kind` filtering items | — | ✓ Merged PR #430 |
| 2.2 | **Import adapter migration** — Replaced `entityType` string checks with `resolveEntityKind()` calls. | — | 2.1 | ✓ Merged PR #430 |
| 2.3 | **Overlay type migration** — Replaced `entityType` discriminant with `entityKind` derived from context. | — | 2.1 | ✓ Merged PR #431 |
| 2.4 | **Seed through Composer** — Seed uses `composerService.compose()`. Validates seeded data follows real user path. `projectWorkflowSurface()` called post-transaction. | Bug: seed projections deferred | 2.1, Phase 1 | ✓ Merged PR #431 |

**Key files:**
- `shared/src/domain/entity-kind.ts` — `resolveEntityKind()`, `definitionKindToEntityKind()`, `EntityKind` type
- `shared/src/schemas/records.ts` — `definition_kind` canonical (removed phantom `kind`)
- `frontend/src/workflows/import/` — import adapter cleanup
- `frontend/src/types/` — overlay type definitions
- `frontend/src/ui/composer/` + `frontend/src/ui/inspector/` — Composer filters fixed
- `backend/src/db/seeds/` — seed rewrite through Composer

---

## Dependency Graph

```
Phase 0  ████████  ✓ complete
Phase 1           ████████████████████████  ✓ complete
Phase 2                       ████████████████  ✓ complete
Phase 3                                       ████████████  ✓ complete
Phase 4                                                   ████████████████████████  ✓ complete (#437)
Phase 4B                                                                  ████████████████  ✓ complete (#438)
Phase 5                                                   ████████████████████████  partial (computed fields done)
Phase 6                                                                   ████████████████████████
Phase 7                                                                                     ████████████
```

Phases 0-4B complete. Phase 5 (Finance Foundation) partial — computed fields and rollup engine merged (PRs #456-458), remaining items (#165, #167, #168) can parallelize. Phase 6 (Finance Surfaces) next.

---

## Phase 4: BFA Reconciliation Pipeline Integration (#437) ✓

**Status: Complete** — All sub-phases merged via PRs #448-451, #453-455 (Feb 8, 2026).

*A user triggers a Monday.com sync for a BFA board, reviews field-level diffs in a reconciliation panel, approves or rejects changes, and optionally injects styled content into a Google Doc — all running as TypeScript in the Fastify backend.*

### Architecture Pivot

The original plan routed BFA reconciliation through AutoHelper's Python command system (upload Excel → queue command → AutoHelper runs `bfa_pipeline` → reports result via heartbeat). During implementation, this was replaced with a TypeScript-native port running directly in the Fastify backend. The BFA-todo pipeline's domain logic (phase canonicalization, authority rules, column semantics, diff engine) was ported as TypeScript code-as-config in `backend/src/modules/programs/`.

**Why the pivot was correct:** It eliminated 3 of the 5 identified risks:
- ~~AutoHelper command payload size~~ — No cross-service payloads; diff reports live in backend memory/DB
- ~~BFA config path overrides~~ — No Python config monkey-patching; TypeScript config is self-contained
- ~~Cross-service data flow verification~~ — Reduced from 4-system integration (Python + AutoHelper + Fastify + React) to 2-system (Fastify + React)

**Remaining risks addressed:**
- Reconciliation UI absorbed `recon_server.py`'s role — React panel (`BfaSyncView.tsx`) replaces the local HTTP server
- Google Docs API credentials — Uses existing Google OAuth with `documents` scope added

### Sub-phases (as shipped)

| # | Sub-phase | Status |
|---|-----------|--------|
| 4.1 | BFA program configuration: shared Zod schemas, TypeScript code-as-config, phase canonicalization, authority rules | ✓ Done (PR #448) |
| 4.2 | BFA sync differ: pure diff engine, `LocalEntitySnapshot` construction, HTTP routes | ✓ Done (PR #449) |
| 4.3 | Backend reconciliation service: migration 007, sync decisions, apply logic, rollup handling | ✓ Done (PR #450) |
| 4.4 | Frontend reconciliation panel: diff review UI, accept/reject controls, summary stats | ✓ Done (PR #451) |
| 4.5 | Google Docs injection: Phase expansion transform, entity→project resolution, Docs API integration | ✓ Done (PRs #453-455) |

### Key Files (actual)

**Backend (TypeScript) — `backend/src/modules/programs/`:**
- `bfa-program.config.ts` — Phase system, authority rules, column mappings, budget normalization
- `bfa-sync-differ.ts` — Pure diff engine comparing Monday data against local entity snapshots
- `bfa-sync.service.ts` — Orchestration: fetch Monday data, build snapshots, run differ
- `bfa-sync.routes.ts` — HTTP routes at `/api/programs/bfa/sync`
- `bfa-sync-applier.ts` — Apply approved decisions
- `bfa-import-transformer.ts` — Phase expansion transform for import
- `bfa-import.service.ts` — Import to AutoArt records via Composer
- `bfa-gdocs-injector.ts` — Google Docs API injection

**Frontend (React):**
- `frontend/src/workflows/bfa/BfaSyncView.tsx` — Reconciliation panel
- `frontend/src/api/hooks/bfaSync.ts` — TanStack Query hooks

**Shared:**
- `shared/src/schemas/bfa.ts` — BFA Zod schemas (phases, authority, diff report, column mappings)

---

## Phase 4B: BFA Import to AutoArt Records (#438) ✓

**Status: Complete** — All sub-phases merged via PRs #452-455 (Feb 8, 2026).

*After BFA reconciliation, a user can optionally push approved changes back into AutoArt's hierarchy and records system, creating project lattices (Project → Process → Phase) and emitting events through the Composer.*

### Sub-phases (as shipped)

| # | Sub-phase | Status |
|---|-----------|--------|
| 4B.1 | Schema transformation layer: BFA → AutoArt hierarchy/records mapping, Phase expansion, UID-based deduplication | ✓ Done (PRs #452-453) |
| 4B.2 | Composer integration: import service orchestrates actions → events, project lattice creation | ✓ Done (PRs #452-453) |
| 4B.3 | Frontend import toggle: checkbox in BfaSyncView, preview modal, result modal with project links | ✓ Done (PRs #454-455) |

### Key Files (actual)

**Backend — `backend/src/modules/programs/`:**
- `bfa-import.service.ts` — Schema transformation + Composer calls
- `bfa-import-transformer.ts` — Phase expansion transform (Stage → Phase nodes)

**Frontend:**
- `frontend/src/workflows/bfa/BfaSyncView.tsx` — Import toggle + preview + result modal (same component as Phase 4 reconciliation panel)

---

## Phase 5: Finance Foundation (partial)

*Stand up the data layer for the Finance epic (#173). Seed definitions first, then computed fields, then records. No UI surfaces yet -- this phase is backend + shared.*

**Scope:**

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 171 | Seed: Finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense) | Finance | ✓ Done |
| 166 | Computed fields + relationship rollups (no-scripting, budgets/invoices/stage sums) | Finance | ✓ Done (PRs #456-458) |
| 165 | Invoice generation + tracking (records + PDF export + payments) | Finance | Partial (data layer done) |
| 168 | Vendor bills + expense tracking (invoice receipts, payments, stage reconciliation) | Finance | |
| 167 | Project Budgets surface (stage allocations + reconciliation rollups + spreadsheet export) | Finance | |

**Key deliverables landed:** JsonLogic formula engine (replaced 452-line custom parser), rollup engine, full rollup chain (line items → subtotal/tax_total → total → paid_amount → balance_due), 37 unit tests.

**Dependencies:** #171 and #166 landed. #165, #167, #168 can parallelize.

**Done when:** Invoice/bill/budget records can be created and queried via API.

---

## Phase 6: Finance Surfaces & Integration

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

---

## Current State

Phases 0-4B complete. Phase 5 (Finance Foundation) partial — computed fields and rollup engine landed, remaining finance items (#165, #167, #168) can parallelize. Phase 6 (Finance Surfaces) is the natural next phase.

- **Phase 3 (Import Pipeline):** ✓ Complete (PRs #439-447)
- **Phase 4 / 4B (BFA Integration):** ✓ Complete (PRs #448-455). Pivoted from AutoHelper Python to TypeScript-native in backend — simplified from 4-system to 2-system integration.
- **Phase 5 (Finance Foundation):** Partial — #171 (seed) and #166 (computed fields) done. #165, #167, #168 remain.
- **Phase 6 (Finance Surfaces):** Next. Depends on Phase 5 remaining items.
- **Phase 7 (Polish):** Independent items, any order. Good palette cleansers between finance features.

See `todo.md` for active day-to-day priorities.

---

## Agent Delegation Rules

The recurring problem is not bad agent work -- it is fixing one layer without checking the others.

1. **Every frontend PR must name the backend endpoint it calls.** If the endpoint does not exist or is not wired, the PR is incomplete. `/integrator` verifies.

2. **Every "fix" PR must include a regression note:** "This change could break X if Y." `/reviewer` checks for this in PR description.

3. **No workspace-touching PR merges without `/integrator` tracing** the full path: workspace switch -> content render -> panel load -> data fetch.

4. **Type derivation PRs require `/reviewer` audit** for remaining `entityType` string checks across the codebase.

5. **No new persisted store fields** without checking `partialize` whitelist and version number. Store changes must update version if shape changes.

6. **Cross-service PRs require end-to-end trace.** The Pairing/Settings Gap happened because nobody checked the full path after each pivot. Every PR that touches multiple systems must include a verification trace in its description.

---

## AutoHelper Status (Resolved)

The CLAUDE.md "Pairing/Settings Gap" described in Feb 2026 has been **resolved**. The frontend now correctly uses backend bridge endpoints (`/api/autohelper/settings`, `/api/autohelper/status`, `/api/autohelper/commands`) for all AutoHelper communication. No direct localhost calls remain in production paths.

**BFA pivot note:** The original Phase 4 plan routed BFA reconciliation through AutoHelper's Python command system. During implementation, BFA's domain logic was ported to TypeScript and runs directly in the Fastify backend (`backend/src/modules/programs/`). AutoHelper was not expanded — it remains scoped to local filesystem operations (indexing, file detection, system tray). This was the right call: it eliminated AutoHelper as an unnecessary middleman for what turned out to be pure API work.
