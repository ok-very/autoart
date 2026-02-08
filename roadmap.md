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
Features                                    ████████████  (unblocked, any time)
```

All three foundation phases complete. Features section is fully unblocked.

---

## Current State

All three foundation phases are complete. The architectural seams that caused recurring regressions are resolved. `todo.md` drives day-to-day priorities. Top feature areas now unblocked:

- **Calendar/Gantt consolidation** — CenterView routing now supports it
- **Finances UI unification** — workspace context binding available
- **Formula/math module** — workspace panel architecture in place
- **Composer bar popout** — Dockview infrastructure ready
- **Interpretation HTTP routes** — independent, can start any time
- **Record inspector / assignee chip** — independent

See `todo.md` Features sections for the full list.

---

## Agent Delegation Rules

The recurring problem isn't bad agent work — it's fixing one layer without checking the others.

1. **Every frontend PR must name the backend endpoint it calls.** If the endpoint doesn't exist or isn't wired, the PR is incomplete. `/integrator` verifies.

2. **Every "fix" PR must include a regression note:** "This change could break X if Y." `/reviewer` checks for this in PR description.

3. **No workspace-touching PR merges without `/integrator` tracing** the full path: workspace switch -> content render -> panel load -> data fetch.

4. **Type derivation PRs require `/reviewer` audit** for remaining `entityType` string checks across the codebase.

5. **No new persisted store fields** without checking `partialize` whitelist and version number. Store changes must update version if shape changes.

---

## AutoHelper Status (Resolved)

The CLAUDE.md "Pairing/Settings Gap" described in Feb 2026 has been **resolved**. The frontend now correctly uses backend bridge endpoints (`/api/autohelper/settings`, `/api/autohelper/status`, `/api/autohelper/commands`) for all AutoHelper communication. No direct localhost calls remain in production paths. Remaining AutoHelper items (local-only config, rebuild index, watchdog) are independent P2 work.
