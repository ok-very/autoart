# Plan: Nested Workflow Surface (Recursive Prerequisites)

**Date:** 2026-01-03
**Status:** Ready for Implementation

---

## Overview

Implement a projection layer that materializes ActionViews into a queryable surface table with recursive prerequisite/dependency nesting. This replaces direct ActionView queries with a cached, ordered, tree-structured surface.

**Key architectural principle:**
- Projector reads Actions + Events
- Calls interpreter (pure, deterministic)
- Writes only UI-facing cached/ordering fields
- Never defines semantics (status/lifecycle rules live in interpreter)

**Existing patterns to follow:**
- `emitEvent()` is the single write path for events (hook projection refresh here)
- `getEventsByActions()` provides O(1) batch loading via `WHERE action_id IN (...)`
- `interpretActionView()` is pure and deterministic
- `DataTableHierarchy` uses `getChildren()` pattern with `expandedIds: Set<string>`

---

## Implementation Order (Recommended)

| Step | Phase | What | Est. Files |
|------|-------|------|------------|
| 1 | A | Write projection invariants doc | 1 |
| 2 | B | Add event types to shared schema | 1 |
| 3 | B | Add workflow service helpers + routes | 2 |
| 4 | C | Add pure interpreter functions | 1 |
| 5 | D | DB migration for workflow_surface_nodes | 1 |
| 6 | D | Create projector module | 1 |
| 7 | D | Hook projection trigger in emitEvent | 1 |
| 8 | E | Add surface read API routes | 1 |
| 9 | F | Add frontend hooks | 1 |
| 10 | G | Create WorkflowSurfaceTable component | 1 |
| 11 | G | Integrate into ProjectWorkflowView | 1 |

**Total new files:** ~6
**Total modified files:** ~6

---

## Implementation Phases

### Phase A: Model + Invariants

1. **Create docs/projection-invariants.md**
   - Projector reads actions + events
   - Calls interpreter (pure)
   - Writes only UI-facing cached/ordering fields
   - Never defines semantics

2. **Naming decisions:**
   - Surface type: `workflow_table`
   - Storage table: `workflow_surface_nodes`
   - Avoid "task" in backend naming

3. **Initial context:** `context_type='subprocess'`

---

### Phase B: Event Facts (Dependencies + Ordering)

**Files to modify:**
- `shared/src/schemas/actions.ts` - Add event types
- `backend/src/modules/events/workflow.service.ts` - Add helpers
- `backend/src/modules/events/workflow.routes.ts` - Add endpoints

**New event types:**
```typescript
'DEPENDENCY_ADDED',    // payload: { dependsOnActionId: string }
'DEPENDENCY_REMOVED',  // payload: { dependsOnActionId: string }
'WORKFLOW_ROW_MOVED',  // payload: { surfaceType: string, actionId: string, afterActionId: string | null }
```

**New endpoints:**
```
POST /workflow/actions/:actionId/dependencies/add    { dependsOnActionId }
POST /workflow/actions/:actionId/dependencies/remove { dependsOnActionId }
POST /workflow/actions/:actionId/move                { surfaceType, afterActionId }
```

**Service helpers:**
- `addDependency({ actionId, dependsOnActionId, actorId })`
- `removeDependency({ actionId, dependsOnActionId, actorId })`
- `moveWorkflowRow({ actionId, surfaceType, afterActionId, actorId })`

---

### Phase C: Interpreter Extensions (Pure, Deterministic)

**Files to modify:**
- `backend/src/modules/interpreter/interpreter.service.ts` (or new sibling file `workflow-surface.interpreter.ts`)

**New pure functions (follow existing pattern of pure + service separation):**

1. **extractDependencies(events: Event[]): Set<string>**
   - Derive current prerequisite set from DEPENDENCY_ADDED/REMOVED
   - Treat REMOVED as tombstone; last event wins per edge
   - Pattern: similar to `deriveStatus()` but builds edge set

2. **extractRowOrder(events: Event[], surfaceType: string): Map<string, number>**
   - Process WORKFLOW_ROW_MOVED events to derive display order
   - Returns `actionId → position` map

3. **buildWorkflowSurfaceTree(actions: Action[], eventsByAction: Map<string, Event[]>): WorkflowSurfaceNode[]**
   - Input mirrors existing `getActionViews()` pattern (batch-loaded data)
   - For each action, compute ActionView via `interpretActionView(action, events)`
   - Build dependency graph: `blockedBy: Map<actionId, Set<prerequisiteId>>`
   - Build reverse nesting: parent = blocked action, children = prerequisites ("blocked by")
   - Recursive DFS with cycle detection (visited set per path)
   - If cycle detected: set `node.flags.cycleDetected = true`, stop descending
   - Stable sibling order: `created_at` default, then apply WORKFLOW_ROW_MOVED

**Surface node DTO (matches UI needs):**
```typescript
interface WorkflowSurfaceNode {
  actionId: string;
  parentActionId: string | null;  // The action this blocks (null = root)
  depth: number;                   // For indent calculation
  position: number;                // Sibling order
  payload: TaskLikeViewPayload;    // Pre-computed view data
  flags?: {
    cycleDetected?: boolean;
    hasChildren?: boolean;         // For chevron display
  };
  renderedAt: Date;
  lastEventOccurredAt: Date;
}
```

**Dependency graph semantics:**
```
DEPENDENCY_ADDED on Action A with { dependsOnActionId: B }
  → Means: "A is blocked by B" / "B must complete before A"
  → Tree representation: A is parent, B is child (B shown nested under A)
```

---

### Phase D: Persisted Projection Storage

**New migration:** `backend/src/db/migrations/0XX_workflow_surface_nodes.ts`

```sql
CREATE TABLE workflow_surface_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  context_type TEXT NOT NULL,
  action_id UUID NOT NULL,
  parent_action_id UUID,
  position INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL,
  last_event_occurred_at TIMESTAMPTZ NOT NULL,

  UNIQUE(surface_type, context_id, action_id)
);

CREATE INDEX idx_workflow_surface_tree
  ON workflow_surface_nodes(surface_type, context_id, parent_action_id, position);
```

**New module:** `backend/src/modules/projections/workflow-surface.projector.ts`

```typescript
async function projectWorkflowSurface(
  contextId: string,
  contextType: ContextType,
  surfaceType: string = 'workflow_table'
): Promise<void> {
  // 1. Load actions by context
  // 2. Load events in batch
  // 3. Call interpreter's buildWorkflowSurfaceTree (no semantics here)
  // 4. Upsert rows for every node
  // 5. Delete stale rows
}
```

**Projection trigger (hook in emitEvent):**

In `backend/src/modules/events/events.service.ts`, after the INSERT:

```typescript
const event = await db.insertInto('events').values(newEvent).returningAll().executeTakeFirstOrThrow();

// Synchronous projection refresh - await for consistency
if (event.action_id) {
  await refreshWorkflowSurface(event.context_id, event.context_type);
}

return event;
```

- **Decision: Synchronous** - simpler debugging, guaranteed consistency
- Can move to async queue later if performance requires

---

### Phase E: Backend Read API

**File:** `backend/src/modules/projections/workflow-surface.routes.ts`

**Endpoints:**
```
GET /workflow/surfaces/workflow_table?contextId=X&contextType=subprocess
  → Returns workflow_surface_nodes ordered by (parent_action_id, position)

POST /workflow/surfaces/workflow_table/refresh?contextId=X&contextType=subprocess
  → Debug: force re-run projection
```

---

### Phase F: Frontend Data Layer

**New file:** `frontend/src/api/hooks/workflowSurface.ts`

```typescript
// Fetch surface nodes
export function useWorkflowSurfaceNodes(contextId: string | null, contextType: ContextType) {
  return useQuery({
    queryKey: ['workflowSurface', contextType, contextId],
    queryFn: () => api.get(`/workflow/surfaces/workflow_table`, {
      params: { contextId, contextType }
    }),
    enabled: !!contextId,
  });
}

// Dependency mutations
export function useAddDependency() { ... }
export function useRemoveDependency() { ... }
export function useMoveWorkflowRow() { ... }
```

**Refresh behavior:** Refetch surface nodes after dependency event POST returns.

---

### Phase G: Frontend UI

**New file:** `frontend/src/ui/composites/WorkflowSurfaceTable.tsx`

**Implementation:**
1. Input: `surfaceNodes` from API
2. Build O(1) lookup: `parentId → children[]` map via `useMemo`:
   ```typescript
   const childrenMap = useMemo(() => {
     const map = new Map<string | null, WorkflowSurfaceNode[]>();
     for (const node of surfaceNodes) {
       const siblings = map.get(node.parentActionId) || [];
       siblings.push(node);
       map.set(node.parentActionId, siblings);
     }
     // Sort each group by position
     for (const [, siblings] of map) {
       siblings.sort((a, b) => a.position - b.position);
     }
     return map;
   }, [surfaceNodes]);

   const getChildren = useCallback((actionId: string | null) =>
     childrenMap.get(actionId) || [], [childrenMap]);
   ```
3. Maintain `expandedIds: Set<string>` for collapse/expand (same pattern as DataTableHierarchy)
4. Flatten tree for rendering using recursive `getChildren`

**Column rendering:**
- Title: chevron when `flags.hasChildren`, indent by `depth * 24`
- Editable fields → `POST /workflow/actions/:actionId/field` (existing endpoint)
- Status → emit work events via existing routes (`/start`, `/stop`, `/finish`, `/block`, `/unblock`)

**Decision:** Create wrapper that adapts `WorkflowSurfaceNode` to `DataTableHierarchy`'s expected shape, OR create lightweight clone. DataTableHierarchy expects `HierarchyNode` with `metadata` parsing - adapting may be cleaner than generalizing.

**Integration in ProjectWorkflowView:**
```typescript
// Before:
const tasks = getChildren(subprocessId).filter(n => n.type === 'task');

// After:
const { data: surfaceNodes } = useWorkflowSurfaceNodes(subprocessId, 'subprocess');
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `docs/projection-invariants.md` | Architectural doc |
| `backend/src/db/migrations/0XX_workflow_surface_nodes.ts` | Table migration |
| `backend/src/modules/projections/workflow-surface.projector.ts` | Projection logic |
| `backend/src/modules/projections/workflow-surface.routes.ts` | Read API |
| `frontend/src/api/hooks/workflowSurface.ts` | Query hooks |
| `frontend/src/ui/composites/WorkflowSurfaceTable.tsx` | UI component |

## Files to Modify

| File | Change |
|------|--------|
| `shared/src/schemas/actions.ts` | Add DEPENDENCY_ADDED, DEPENDENCY_REMOVED, WORKFLOW_ROW_MOVED |
| `backend/src/modules/events/workflow.service.ts` | Add dependency/move helpers |
| `backend/src/modules/events/workflow.routes.ts` | Add dependency/move endpoints |
| `backend/src/modules/interpreter/interpreter.service.ts` | Add buildWorkflowSurfaceTree |
| `backend/src/modules/events/events.service.ts` | Hook projection trigger after emitEvent |
| `backend/src/app.ts` | Register projection routes |
| `frontend/src/api/hooks/index.ts` | Export new hooks |
| `frontend/src/components/layout/ProjectWorkflowView.tsx` | Use WorkflowSurfaceTable |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Projection trigger | **Synchronous** | Simpler debugging, guaranteed consistency |
| Manual row ordering | **Include now** | Full WORKFLOW_ROW_MOVED support from start |
| Table component | **Adapter/wrapper** | Adapt surface nodes to existing table patterns |
| Context scope | **subprocess first** | Match existing action context patterns |

---

## Success Criteria

1. Actions with dependencies nest correctly (parent = blocked, children = blockers)
2. Recursive nesting works (A blocks B blocks C → 3-level tree)
3. Cycle detection flags cycles without infinite loops
4. Surface updates automatically when events are emitted (synchronous)
5. UI expands/collapses nested rows
6. Inline edits emit events and reflect after projection refresh
7. O(1) getChildren via precomputed map
8. Manual row reordering via WORKFLOW_ROW_MOVED events

---

## Test Plan

**Unit tests:**
- Multi-level nesting
- Add/remove dependency yields correct children
- Cycle detection prevents infinite loops

**Integration tests:**
- After createAction → surface row exists
- After dependency/work/field events → surface updates idempotently

**Manual UX:**
- Parent rows expand/collapse
- Prerequisites show as children
- Recursive prerequisites indent correctly
- Inline edits reflect after refresh
