# AutoArt Roadmap

*Created: 2026-02-07*

Three architectural seams keep producing regressions faster than they get fixed. This roadmap replaces the flat priority list with a dependency-ordered plan that fixes the seams before building on top of them.

---

## Diagnosis: Why Regressions Recur

### Seam 1: The Workspace System Is Half-Built

Three layers that don't talk to each other:

| Layer | Status | Where |
|-------|--------|-------|
| Panel layout (Dockview grid) | Works | `workspaceStore.ts`, `MainLayout.tsx` |
| Content routing (CenterContentRouter) | Works | `uiStore.ts`, `CenterContentRouter.tsx` |
| Context binding (boundProjectId, panel params) | Wired but never consumed | `workspaceStore.ts:83-85` |

The Desk workspace references `project-panel` and `mail-panel` with binding, but neither panel reads `boundProjectId`. Workspace presets apply content types *once* on switch, but user changes aren't tracked. Six independent persisted stores with separate version numbers means any structural change risks desyncing the others.

**Consequence:** Desk is broken. CenterView routing is broken. Workspace save is a timing hack. These aren't separate bugs — they're the same incomplete feature.

### Seam 2: Two Type Systems Coexist

| Pattern | Where | How It Works |
|---------|-------|-------------|
| `entityType === 'project'` (old) | Import adapter, overlay types, seed data | Explicit string checks |
| `definition_kind` field (new) | Sidebars, registry panels | Database-driven |

CLAUDE.md says "soft-intrinsic type derivation — derive from relationships, not strings." But import wizard, overlay creation, and seed data all use explicit type strings. When a new entity kind appears, three different systems need updating.

### Seam 3: Dev/Prod Path Divergence

- **Seeds bypass Composer** — insert raw actions/events without the orchestration layer that real users hit. Composer bugs don't surface in dev.
- **Preview buttons open dead ports** — `pnpm dev` starts the dashboard (5173) but not intake (5174) or poll (5175). Preview buttons construct valid URLs to ports nobody's listening on.
- **Direct fetch in ExecutionControls** — one endpoint uses raw `fetch()` bypassing the API client, auth, and error handling.

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

## Phase 1: Workspace Foundation

**Status: In Progress** — Items 1.1-1.4 submitted as PRs #421-425, awaiting review.

Fix the workspace system so everything built on top of it stops regressing. This phase absorbs multiple items scattered across the old P1, P2, and bug list.

| # | Item | Absorbs | Depends On | Status |
|---|------|---------|-----------|--------|
| 1.1 | **Workspace context contract** — Define `WorkspaceContext` interface. Replace ad-hoc `boundProjectId` + `pendingPanelPositions` with a single context object passed via Dockview panel params. | — (new) | Phase 0 complete | 🔄 PR #421 |
| 1.2 | **Panel context consumption** — Update `project-panel`, `mail-panel`, `selection-inspector` to read from `WorkspaceContext`. Panels that don't need context ignore it. | Workspace binding (old P1) | 1.1 | 🔄 PR #422, #423 |
| 1.3 | **Desk workspace** — With context binding working, Desk becomes: project-panel (bound) + mail-panel (bound) + center showing project overview. First in workspace list, default on login. | Bug: "Desk workspace broken" | 1.1, 1.2 | 🔄 PR #425 |
| 1.4 | **CenterView routing ownership** — Each workspace preset declares which `CenterContentType` it owns. CenterContentRouter validates content matches active workspace. Mismatches redirect to workspace default. | P1: CenterView routing, Bug: CenterView conceptual breakage | 1.1 | 🔄 PR #424 |
| 1.5 | **Store consolidation** — Merge `uiStore` content/view state into `workspaceStore`. One store owns workspace identity, content type, view mode, and panel layout. Single version, single migration. | — (new, highest-impact change for regressions) | 1.4 | Not started |
| 1.6 | **Workspace save** — With unified store, "Save workspace" persists the full state snapshot. Replace `requestAnimationFrame` timing hack. | P2 #182: Workspace modification tracking | 1.5 | Not started |
| 1.7 | **Custom workspace lifecycle** — Create, rename, delete custom workspaces. Same `WorkspaceContext` shape as built-in presets. | — (new) | 1.5, 1.6 | Not started |
| 1.8 | **Workspace sidebar overrides** — Workspaces declare sidebar visibility rules. Intake workspace shows intake sidebar, Plan shows project sidebar, etc. | P1: Workspace sidebar overrides | 1.4 | Not started |

**Key files:**
- `frontend/src/stores/uiStore.ts` — will be partially absorbed into workspaceStore
- `frontend/src/stores/workspaceStore.ts` — becomes the single source of truth
- `frontend/src/ui/workspace/CenterContentRouter.tsx` — adds validation
- `frontend/src/workspace/workspacePresets.ts` — adds contentType ownership
- `frontend/src/workspace/panelRegistry.ts` — panels consume WorkspaceContext
- `frontend/src/ui/layout/MainLayout.tsx` — passes context to panels

**Delegation:** `/architect` for 1.1 data flow design, `/frontend-dev` for 1.2-1.8, `/integrator` for workspace switching E2E after 1.4.

---

## Phase 2: Type System Unification

Resolve the dual type system so new features don't update three places.

| # | Item | Absorbs | Depends On |
|---|------|---------|-----------|
| 2.1 | **Entity kind resolver** — Single function: `resolveEntityKind(item, definitions, parentChain) -> EntityKind`. Uses `definition_kind` when available, falls back to parent relationship derivation. Lives in `@autoart/shared`. | Housekeeping: `definition_kind` filtering items | — |
| 2.2 | **Import adapter migration** — Replace `entityType: container.type` with `resolveEntityKind()`. Remove all `entityType === 'project'` conditionals in import workflow. | — | 2.1 |
| 2.3 | **Overlay type migration** — Replace `entityType: 'record' | 'node'` discriminant with `entityKind` derived from context. | — | 2.1 |
| 2.4 | **Seed through Composer** — Rewrite seed to use Composer service. Validates seeded data follows the same path as real user actions. | Bug: seed projections deferred | 2.1, Phase 1 |

**Key files:**
- `shared/src/` — new `resolveEntityKind()` function
- `frontend/src/workflows/import/` — import adapter cleanup
- `frontend/src/types/` — overlay type definitions
- `backend/src/db/seeds/` — seed rewrite

**Delegation:** `/architect` for 2.1 API design, `/backend-dev` for 2.4, `/frontend-dev` for 2.2-2.3, `/reviewer` for post-merge audit.

---

## Dependency Graph

```
Phase 0  ████████  (stop bleeding — clean builds, unblock import, fix preview)
Phase 1           ████████████████████████  (workspace foundation)
Phase 2                       ████████████████  (type unification, overlaps 1.5+)
Features                                    ████████████  (unblocked items, any time)
```

Phase 0 can start now.
Phase 1 requires Phase 0 merged (clean builds needed for workspace refactor).
Phase 2 item 2.1 can start alongside Phase 1. Items 2.2-2.4 require Phase 1 workspace context.

---

## What Gets Promoted

These items weren't prioritized correctly in the old structure:

| Item | Was | Now | Why |
|------|-----|-----|-----|
| Desk workspace | Bug list | Phase 1.3 | Proves workspace context works. The deliverable. |
| CenterView routing | P1 architecture review | Phase 1.4 | Core of workspace ownership. Everything else depends on it. |
| Store consolidation | Not on todo | Phase 1.5 | Highest-impact change for reducing regressions. Six stores → one authority. |
| Workspace save | P2 #182 | Phase 1.6 | Trivial once store is consolidated. Blocked until then. |

## What Gets Deprioritized

These items are valid but building them on broken foundations guarantees regressions:

| Item | Was | Now | Blocked By |
|------|-----|-----|-----------|
| Calendar/Gantt consolidation | P1 | Features (Blocked) | Phase 1.4 — needs CenterView routing |
| Finances UI unification | P1 | Features (Blocked) | Phase 1.1 — needs workspace context binding |
| Formula/math module | P1 | Features (Blocked) | Phase 1.1 — needs workspace panel architecture |
| Composer bar popout | P2 | Features (Blocked) | Phase 1 — needs Dockview popout infrastructure |

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
