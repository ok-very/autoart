# Projection Invariants

**Date:** 2026-01-03
**Status:** Canonical Reference

---

## Overview

This document defines the architectural invariants for the projection layer. Projections materialize interpreted views of Actions + Events into queryable surfaces for UI consumption.

---

## Core Invariants

### 1. Projector Responsibilities

The projector:
- **Reads** Actions and Events
- **Calls** the interpreter (pure, deterministic functions)
- **Writes** only UI-facing cached/ordering fields
- **Never** defines semantics (status, lifecycle rules live in interpreter)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Actions   │────▶│ Interpreter │────▶│  Surface Table  │
│   Events    │     │   (pure)    │     │ (cached + order)│
└─────────────┘     └─────────────┘     └─────────────────┘
```

### 2. Semantic Ownership

| Component | Owns |
|-----------|------|
| **Interpreter** | Status derivation, field extraction, lifecycle rules |
| **Projector** | Materialization, ordering, parent-child relationships |
| **Surface Table** | Cached payloads, positions, tree structure |

The projector is a **dumb pipe** that transforms interpreter output into stored rows. It contains zero business logic.

### 3. Single Write Path

All events flow through `emitEvent()`. This is the **only** mutation point for the event log.

Projection refresh hooks into this path:
```typescript
// In events.service.ts
const event = await insertEvent(...);

// Trigger projection refresh synchronously
if (event.action_id) {
  await refreshWorkflowSurface(event.context_id, event.context_type);
}

return event;
```

### 4. Idempotency

Projections are **fully idempotent**. Running `projectWorkflowSurface(contextId, contextType)` multiple times produces identical results.

This enables:
- Safe retries on failure
- Manual refresh for debugging
- Background recomputation if needed

---

## Naming Conventions

| Concept | Name | Rationale |
|---------|------|-----------|
| Surface type | `workflow_table` | Describes the UI affordance |
| Storage table | `workflow_surface_nodes` | Avoids "task" terminology |
| API namespace | `/workflow/surfaces/*` | Clear separation from actions/events |

**Avoid** the word "task" in backend naming. Actions are not tasks; they declare intent.

---

## Context Scoping

Surfaces are scoped by `(context_id, context_type)`:

```typescript
type ContextType = 'subprocess' | 'stage' | 'process' | 'project' | 'record';
```

Initial implementation focuses on `subprocess` context, matching existing action patterns.

---

## Dependency Semantics

Dependencies are recorded via events, not stored fields:

```
DEPENDENCY_ADDED on Action A with { dependsOnActionId: B }
  → Means: "A is blocked by B" / "B must complete before A"
  → Tree representation: A is parent, B is child (B shown nested under A)
```

The interpreter derives the current dependency set by replaying events chronologically.

---

## Failure Conditions

If any of these occur, **STOP** and re-evaluate:

| Violation | Why It's Wrong |
|-----------|----------------|
| Projector computes status | Status derivation belongs in interpreter |
| Surface node gains a writable ID | Surfaces are cached, not addressable |
| Direct mutation of surface table | All changes flow through events |
| Semantic logic in projector | Projector is a dumb materializer |

---

## Refresh Strategy

**Current: Synchronous**
- Projection refresh awaits in `emitEvent()` before returning
- Guarantees consistency: read-after-write always sees updated surface
- Simpler debugging and reasoning

**Future: Async (if needed)**
- Move to background worker with event queue
- Accept eventual consistency for better latency
- Only if synchronous becomes a bottleneck

---

## Surface Node Structure

```typescript
interface WorkflowSurfaceNode {
  actionId: string;
  parentActionId: string | null;  // The action this blocks (null = root)
  depth: number;                   // For indent calculation
  position: number;                // Sibling order
  payload: TaskLikeViewPayload;    // Pre-computed view data from interpreter
  flags?: {
    cycleDetected?: boolean;       // Dependency cycle found
    hasChildren?: boolean;         // For chevron display
  };
  renderedAt: Date;
  lastEventOccurredAt: Date;
}
```

The `payload` contains interpreted data (title, status, assignee, etc.). The projector calls the interpreter to produce this; it never computes it directly.

---

## Testing Invariants

Every projection test should verify:

1. **Idempotency**: Multiple runs produce identical output
2. **Semantic-free projector**: Projector code contains no if-statements about status/lifecycle
3. **Event-driven**: Surface changes only after events are emitted
4. **Consistency**: Read immediately after emitEvent() returns updated surface
