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
Phase 3                                       ████████████  (in progress)
Phase 4                                                   ████████████████████████  (#437)
Phase 4B                                                                  ████████████████  (#438, depends on 4)
Phase 5                                                   ████████████████████████  (independent of 4)
Phase 6                                                                   ████████████████████████
Phase 7                                                                                     ████████████
```

Phases 0-2 complete. Phase 3 in progress. Phases 4-4B (BFA integration) and Phase 5 (Finance) are independent tracks -- either can start after Phase 3. Phase 4B depends on Phase 4.

---

## Phase 4: BFA Reconciliation Pipeline Integration (#437)

**Status: Not started** -- depends on Phase 3 infrastructure being stable. Independent of Phase 5 (Finance).

*A user can upload a Monday.com Excel export, review field-level diffs against existing BFA project data in a reconciliation panel, approve or reject changes, and generate styled Google Docs injection JSON -- all from within AutoArt's web UI, with AutoHelper running the BFA Python pipeline.*

This integrates the standalone [BFA-todo Python pipeline](https://github.com/ok-very/BFA-todo) (at `~/dev/BFA-todo`) into AutoArt's export workflow. The BFA-todo pipeline is stable (only 2 open P3 quests, 137 projects managed, battle-tested reconciliation logic). The work is about integration, not rewriting.

### Architecture

```
User uploads Monday.com Excel
        |
        v
Frontend --POST /api/exports/bfa/upload--> Backend stores file
        |
        v
Backend --queue run_bfa_reconcile command--> AutoHelper polls
        |
        v
AutoHelper runs bfa_pipeline (matcher -> differ -> renderer)
        |
        v
AutoHelper --POST /autohelper/heartbeat with structured result--> Backend stores report
        |
        v
Frontend --GET /api/exports/bfa/report--> Reconciliation Panel renders diffs
        |
        v
User approves/rejects changes in ReconciliationPanel
        |
        v
Frontend --POST /api/exports/bfa/apply--> Backend queues apply command
        |
        v
AutoHelper runs merger -> renderer -> gdocs_export
        |
        v
Backend receives gdocs_inject.json
        |
        v
(Optional) Backend --Google Docs API--> injects styled content
```

### Identified Risks

1. **AutoHelper command payload size.** The current command system uses small JSON payloads (`payload` and `result` columns on `autohelper_commands`). BFA reconciliation reports (match_report + diff_report + rollup_diffs) can be 50-200KB. The `result` column is JSONB, so size is not a schema problem, but polling latency matters -- AutoHelper polls every 5s, and large result payloads should not block the heartbeat cycle. **Mitigation:** Store reconciliation reports in a separate table or the file system, not in the command result. Command result just holds a reference ID.

2. **Reconciliation UI replaces recon_server.py.** The BFA-todo pipeline uses a local HTTP server (`recon_server.py` on port 8099) for the reconciliation UI. In AutoArt, this is replaced by a React panel consuming data from the backend API. The `recon_server.py` module is NOT copied to AutoHelper -- its role is absorbed by the frontend ReconciliationPanel and the backend report storage. The Python pipeline still needs `auto_accept_all()` for headless operation.

3. **BFA config path overrides.** The BFA pipeline uses `config.py` with hardcoded paths (`BASE_DIR`, `PROJECTS_DIR`, etc.). When running inside AutoHelper, these must be overridden per-workspace. The `BFAPipelineRunner` wrapper (see Phase 4.1) handles this by monkey-patching `bfa_config` paths before pipeline invocation.

4. **Google Docs API credentials.** The `gdocs_inject.json` output contains placeholder offsets (`__COMPUTED__`, `__OFFSET__+N`). The injection step needs Google Docs API credentials. AutoArt already has Google OAuth (`/auth/google/status`) but only for Sheets/Slides connectors. The Docs scope must be added to the OAuth configuration. **Mitigation:** Google Docs injection is Phase 4.4 (last sub-phase), so credentials can be deferred.

5. **Cross-service data flow verification.** This feature touches four systems (BFA-todo Python code, AutoHelper Python service, Fastify backend, React frontend). The Pairing/Settings Gap lesson applies directly. Every sub-phase must include an end-to-end trace: "I uploaded this Excel, this command was queued, AutoHelper ran this pipeline step, this result was stored, the frontend rendered this data." No sub-phase is done without that trace.

### Sub-phases

| # | Sub-phase | Scope | Depends On | Agent |
|---|-----------|-------|-----------|-------|
| 4.1 | **AutoHelper BFA runner** -- Copy `bfa_pipeline/` modules to AutoHelper. Create `BFAPipelineRunner` wrapper that overrides config paths per workspace. Add `run_bfa_reconcile`, `run_bfa_render`, `get_bfa_report` to command handlers. Add Python dependencies (`openpyxl`, `pyyaml`). Do NOT copy `recon_server.py`. | AutoHelper (Python) | Phase 3 stable | backend-dev |
| 4.2 | **Backend reconciliation service** -- Extend `CommandType` union with BFA commands. Create `bfa-reconciliation.service.ts` to store/retrieve reconciliation reports (separate from command results). Add routes: `POST /api/exports/bfa/upload` (accept Excel file), `GET /api/exports/bfa/report/:id` (return stored report), `POST /api/exports/bfa/apply` (queue apply command with decisions). File upload stores Excel to a temp path and passes path to AutoHelper command. | Backend (Fastify) | 4.1 | backend-dev |
| 4.3 | **Frontend reconciliation panel** -- New `BFAReconciliationView` composite in `ui/composites/`. Register as center content type `bfa-reconciliation` in workspace system. Panel shows: summary stats, matched projects table, field-level diff rows (old/new with accept/reject buttons), new-in-Excel section, pipeline-only section, ambiguous matches. Uses `--ws-*` tokens throughout. TanStack Query hooks for report fetching and decision submission. | Frontend (React) | 4.2 | frontend-dev |
| 4.4 | **Google Docs injection** -- Add `documents` scope to Google OAuth config. Create `google-docs-injector.ts` in `backend/src/modules/exports/connectors/`. Resolves `__COMPUTED__`/`__OFFSET__+N` placeholders against live document content. Route: `POST /api/exports/bfa/inject-gdocs` accepts `reportId` + `documentId`. Frontend adds "Inject to Google Docs" button in ReconciliationPanel, gated on Google OAuth status. | Backend + Frontend | 4.3, Google OAuth (#403) | backend-dev + frontend-dev |

### Key Files Created/Modified

**AutoHelper (Python):**
- `apps/autohelper/autohelper/bfa_pipeline/` -- copied from `~/dev/BFA-todo/bfa_pipeline/` (all modules except `recon_server.py`)
- `apps/autohelper/autohelper/bfa_runner.py` -- `BFAPipelineRunner` wrapper class
- `apps/autohelper/pyproject.toml` -- add `openpyxl`, `pyyaml` dependencies

**Backend (TypeScript):**
- `backend/src/modules/exports/bfa-reconciliation.service.ts` -- report storage and retrieval
- `backend/src/modules/exports/connectors/google-docs-injector.ts` -- Google Docs API injection
- `backend/src/modules/exports/exports.routes.ts` -- BFA routes added
- `backend/src/modules/autohelper/autohelper.service.ts` -- `CommandType` extended

**Frontend (React):**
- `frontend/src/ui/composites/BFAReconciliationView.tsx` -- reconciliation panel composite
- `frontend/src/api/hooks/useBFAReconciliation.ts` -- TanStack Query hooks
- `frontend/src/workspace/panelRegistry.ts` -- register BFA panel
- `frontend/src/workspace/workspacePresets.ts` -- add BFA content type to relevant workspace

**Shared:**
- `shared/src/schemas/exports.ts` -- BFA reconciliation report types (match/diff/rollup)
- `shared/src/schemas/bfa.ts` -- BFA project schema (Zod) matching BFA-todo YAML structure

### Cross-System Verification (Required per sub-phase)

After each sub-phase, `/integrator` must trace:

- **4.1:** AutoHelper receives `run_bfa_reconcile` command via poll -> runs pipeline -> reports structured result via heartbeat. Verify by queuing command from backend test and checking result.
- **4.2:** Frontend uploads Excel -> backend stores file -> backend queues command -> verify command appears in AutoHelper poll response -> verify stored report is retrievable via GET endpoint.
- **4.3:** Frontend renders reconciliation panel -> displays diffs from stored report -> user approves -> POST decisions -> verify decisions reach backend -> verify apply command is queued.
- **4.4:** Frontend clicks "Inject" -> backend reads gdocs_inject.json -> resolves placeholders against live doc -> calls Google Docs API -> styled content appears in document. Verify with a test document.

---

## Phase 4B: BFA Import to AutoArt Records (#438)

**Status: Not started** -- depends on Phase 4 being complete.

*After BFA reconciliation, a user can optionally push approved changes back into AutoArt's hierarchy and records system, creating project lattices (Project -> Process -> Stage) and emitting events through the Composer, so AutoArt becomes the single source of truth.*

This extends the reconciliation panel from Phase 4 with an "Import to AutoArt records" toggle. When enabled, approved changes flow through the Composer to create hierarchy nodes, records (contacts, milestones, artists), and events.

### Architecture

```
ReconciliationPanel (Phase 4)
        |
        v  (user checks "Import to AutoArt records")
BFA Change Aggregator (transforms decisions -> AutoArt schema)
        |
        v
Composer (creates Actions -> Events atomically in transaction)
        |
        ├--> hierarchy_nodes (project -> process -> stage lattice)
        ├--> records (contacts, milestones, artists with definition_id)
        └--> events (ProjectCreated, FieldValueRecorded, ContactAdded, etc.)
        |
        v
workflow_surface_nodes projection updated
        |
        v
Frontend invalidates queries -> project appears in workspace
```

### Identified Risks

1. **Composer integration must use Action/Event pattern.** Direct DB inserts bypass the event log. All mutations must go through `composerService.compose()` so the Project Log reflects BFA imports. This means defining Action templates for BFA import operations (e.g., `BFA_PROJECT_IMPORT`, `BFA_FIELD_UPDATE`). These action types are derived from the parent action context, not from hardcoded `entityType` strings (soft-intrinsic type derivation).

2. **Record definition mapping.** BFA data (contacts_text, artists_text, milestones) must map to existing RecordDefinition IDs in the database. If a "Contact" RecordDefinition does not exist, the import fails. **Mitigation:** Phase 4B.1 includes a schema validation step that checks required RecordDefinitions exist before attempting import.

3. **Duplicate detection.** If a BFA project already exists in AutoArt (from a previous import), the importer must detect and skip it rather than creating duplicates. The BFA UID (UUID5 from fingerprint) provides a stable identifier for matching. Store the BFA UID in the hierarchy node `metadata` JSONB for cross-reference.

4. **Phase-to-workflow mapping.** BFA's 12-phase system (`1. Project Initiation` through `11. Photo`) does not map 1:1 to AutoArt's Action/Event workflow stages. The mapping must be explicit and documented, not inferred at runtime.

### Sub-phases

| # | Sub-phase | Scope | Depends On | Agent |
|---|-----------|-------|-----------|-------|
| 4B.1 | **Schema transformation layer** -- Create `bfa-importer.service.ts` in `backend/src/modules/imports/`. Maps BFA approved changes to AutoArt schema: new projects -> hierarchy node creation requests, field updates -> record update requests, phase changes -> workflow event requests. Validates required RecordDefinitions exist. Stores BFA UID in node metadata for dedup. | Backend | Phase 4 complete | backend-dev |
| 4B.2 | **Composer integration** -- Wire the BFA importer to `composerService.compose()`. Define BFA import Action templates. All mutations atomic in a single transaction. `projectWorkflowSurface()` called post-commit to update projections. Write integration tests: create project lattice -> verify hierarchy -> verify records -> verify events in log. | Backend | 4B.1 | backend-dev |
| 4B.3 | **Frontend import toggle** -- Add "Import to AutoArt records" checkbox to ReconciliationPanel. When checked, show import preview (dry-run via `POST /api/imports/bfa/preview`). On submit, POST to `/api/imports/bfa/apply`. Result modal shows created projects (with links to workspace), updated records, emitted events count. Invalidate project/record/event queries on success. | Frontend | 4B.2 | frontend-dev |

### Key Files Created/Modified

**Backend:**
- `backend/src/modules/imports/bfa-importer.service.ts` -- schema transformation + Composer calls
- `backend/src/modules/imports/bfa-change-aggregator.ts` -- decision -> importable change conversion
- `backend/src/modules/imports/import.routes.ts` -- BFA import routes added
- `shared/src/schemas/bfa.ts` -- extend with import request/response types

**Frontend:**
- `frontend/src/ui/composites/BFAReconciliationView.tsx` -- import toggle + preview + result modal
- `frontend/src/api/hooks/useBFAImport.ts` -- TanStack Query hooks for import operations

### Cross-System Verification

- **4B.1-4B.2:** Backend test creates BFA import request -> Composer produces events -> hierarchy nodes exist in DB -> records linked to correct context -> events appear in `events` table with `source: 'bfa_import'` metadata.
- **4B.3:** Frontend toggles import -> clicks apply -> new project appears in project sidebar -> clicking project opens ProjectView -> Project Log shows BFA import events. Full path verified.

---

## Phase 5: Finance Foundation

*Stand up the data layer for the Finance epic (#173). Seed definitions first, then computed fields, then records. No UI surfaces yet -- this phase is backend + shared.*

**Previously Phase 4.** Renumbered to accommodate BFA integration. No scope changes. Independent of Phase 4/4B -- can run in parallel if desired.

**Scope:**

| # | Issue | Category |
|---|-------|----------|
| 171 | Seed: Finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense) | Finance |
| 166 | Computed fields + relationship rollups (no-scripting, budgets/invoices/stage sums) | Finance |
| 165 | Invoice generation + tracking (records + PDF export + payments) | Finance |
| 168 | Vendor bills + expense tracking (invoice receipts, payments, stage reconciliation) | Finance |
| 167 | Project Budgets surface (stage allocations + reconciliation rollups + spreadsheet export) | Finance |

**Dependencies:** #171 (seed) must land first -- all other finance issues depend on the RecordDefinition schemas existing. #166 (computed fields) unblocks #165, #167, #168 by providing the rollup mechanism.

**Internal order:** #171 -> #166 -> (#165, #167, #168 can parallelize)

**Done when:** Finance record definitions seed correctly through Composer, computed fields derive budget/invoice/expense totals, and invoice/bill/budget records can be created and queried via API.

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

Foundation phases (0-2) complete. Phase 3 (Import Pipeline) in progress. Two new feature tracks now planned:

- **Phase 4 / 4B (BFA Integration):** Issues #437 and #438. Integrates the BFA-todo reconciliation pipeline into AutoArt. Four-system integration (BFA-todo Python, AutoHelper, Fastify backend, React frontend). Highest cross-service complexity in the roadmap.
- **Phase 5 / 6 (Finance):** Issues #165-172, #183, #291. Independent of BFA track. Can run in parallel.
- **Phase 7 (Polish):** Independent items, any order.

See `todo.md` for active day-to-day priorities.

---

## Agent Delegation Rules

The recurring problem is not bad agent work -- it is fixing one layer without checking the others.

1. **Every frontend PR must name the backend endpoint it calls.** If the endpoint does not exist or is not wired, the PR is incomplete. `/integrator` verifies.

2. **Every "fix" PR must include a regression note:** "This change could break X if Y." `/reviewer` checks for this in PR description.

3. **No workspace-touching PR merges without `/integrator` tracing** the full path: workspace switch -> content render -> panel load -> data fetch.

4. **Type derivation PRs require `/reviewer` audit** for remaining `entityType` string checks across the codebase.

5. **No new persisted store fields** without checking `partialize` whitelist and version number. Store changes must update version if shape changes.

6. **Phase 4/4B cross-service PRs require end-to-end trace.** Every sub-phase includes a verification section. The trace must show data flowing from Excel upload through AutoHelper pipeline execution through backend report storage through frontend rendering. No sub-phase closes without this trace documented in the PR description. The Pairing/Settings Gap happened because nobody checked the full path after each pivot.

---

## AutoHelper Status (Resolved, Evolving)

The CLAUDE.md "Pairing/Settings Gap" described in Feb 2026 has been **resolved**. The frontend now correctly uses backend bridge endpoints (`/api/autohelper/settings`, `/api/autohelper/status`, `/api/autohelper/commands`) for all AutoHelper communication. No direct localhost calls remain in production paths.

**Phase 4 evolution:** AutoHelper expands from file-operations-only to general Python task runner. The command system (`autohelper_commands` table) gains new command types (`run_bfa_reconcile`, `run_bfa_render`, `get_bfa_report`). The BFA pipeline modules are copied into AutoHelper and run within its Python environment. This is the first case of AutoHelper executing domain-specific business logic rather than filesystem operations. The architecture pattern established here (command -> execute -> structured result -> backend stores report -> frontend consumes) will be reusable for future Python-driven features (AI analysis, batch processing, etc.).
