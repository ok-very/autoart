# AutoArt Foundational Model

**Part of:** [Architecture Documentation Series](./ARCHITECTURE-00-INDEX.md)  
**Last Updated:** 2026-01-17

## Purpose

This document formalizes AutoArt's **final architectural reduction** and defines the **maximum allowable complexity layer** of the system. It replaces task-centric and workflow-centric models with an interpretive system built on four irreducible primitives.

This is not a stylistic preference. It is a **hard constraint** intended to prevent semantic drift, state corruption, and ontology sprawl.

---

## The Four First-Class Objects (Final)

AutoArt recognizes exactly **four first-class objects**. Only these may store independent truth.

### 1. Record
**Context container**

- Owns identity, scope, permissions
- Anchors meaning
- Contains no behavior, progress, or state
- Examples: project, case, artifact, dossier

Records answer:
> *What is this about?*

---

### 2. Field
**Declarative data surface**

- Typed, named, reusable
- May be user-entered, computed, or derived
- May attach to Records, Actions, or projections
- May be empty without semantic failure

Fields answer:
> *What information exists or is required?*

---

### 3. Action
**Intent declaration**

- Declares that something *should / could* happen
- Receives Fields as parameters
- Has stable identity
- Does **not** track completion or success

Actions answer:
> *What is meant to occur?*

---

### 4. Event
**Historical fact**

- Append-only
- Time-bound and actor-bound
- Irreversible
- Sole source of truth about what happened

Events answer:
> *What actually occurred?*

---

## Interpretive Model (No Stored State)

AutoArt does **not** store state.

All meaning is computed by interpretation:

```
Meaning = interpret(
  Records × Fields × Actions × Events
)
```

Statuses, progress, timelines, readiness, and completion are **derived views**, never persisted facts.

---

## Elimination of Tasks and Subtasks

Tasks and Subtasks are **not real objects**.

They exist only as **symbolic projections**:

```
Task = Action
     + subset(Field)
     + interpreted(Event)
```

- They store no truth
- They mutate nothing
- They forward information without ownership

Their UI behavior may remain identical, but their payload is **procedural**, not ontological.

---

## Technical Design: Actions

### Action Entity (Logical)

Actions are first-class, but intentionally thin.

```typescript
Action {
  id: UUID
  recordId: UUID
  type: string
  fieldBindings: FieldRef[]
  createdAt: timestamp
}
```

**Key properties**:
- No status
- No completion flag
- No timestamps beyond creation
- No ownership of outcomes

Actions define *intent*, not execution.

---

## Technical Design: Events

### Event Entity

```typescript
Event {
  id: UUID
  recordId: UUID
  actionId?: UUID
  type: string
  payload: JSONB
  actorId: UUID
  occurredAt: timestamp
}
```

**Rules**:
- Events are append-only
- Events may reference Actions, but Actions do not reference Events
- Deleting or editing Events is forbidden

Events are the **only historical truth** in the system.

---

## Downstream Objects: Items, Tasks, Subtasks

Downstream objects are **interpretations**, not entities.

### Item (Projection)

An Item is a UI-level construct derived from interpretation logic:

```
Item := interpret(Action, Fields, Events)
```

Items may:
- Appear ordered
- Appear completed or blocked
- Appear assigned

But none of these properties are stored.

---

### Subtasks

Subtasks are **logical decompositions**, not stored records.

They are produced by:
- Action + structured Field schemas
- Event sequences
- Process interpreters

Subtasks:
- Have identical UI affordances to legacy subtasks
- Share no persistence model
- Can disappear without data loss

---

## Processes and Workflows (Downstream)

Processes are **compositions of Actions and Events**.

They are not first-class.

A workflow is an *interpretation over time*, not a stored object.

This allows:
- Reinterpretation without migration
- Multiple concurrent workflow views
- Disagreement without corruption

---

## System Invariants (Non-Negotiable)

1. No stored status fields
2. No mutable truth
3. No implicit transitions
4. No fifth first-class object
5. No UI construct may own data

Violating any invariant is a regression.

---

## Examples: What's Allowed vs Prohibited

### ✅ Allowed

- Computing "task completion" by interpreting events for an action
- Storing a "priority" field on an action (it's declarative data)
- Caching derived views in a projection table (as long as it's rebuildable)
- Multiple UI surfaces showing different interpretations of the same events

### ❌ Prohibited

- Adding a `status` column to the `actions` table
- Storing `completedAt` timestamp on an action
- Creating a `workflows` table that tracks state transitions
- Adding a `tasks` table that owns completion data
- Updating an event after it's created

---

## Migration Strategy

When refactoring legacy code:

1. Identify stored state (status fields, completion flags, etc.)
2. Determine which events would produce that state
3. Create event types if needed
4. Build interpreter logic to derive the state
5. Remove the stored state column
6. Update UI to use interpreted state

---

## Final Complexity Boundary

This is the **maximum allowed complexity** of AutoArt.

Anything not expressible as:
- Record
- Field
- Action
- Event

…must be derived, projected, or rejected.

---

## North-Star Constraint

> Records hold context.  
> Fields hold data.  
> Actions hold intent.  
> Events hold truth.  
> Everything else is interpretation.

This sentence defines the architecture.

---

## Related Reading

- [Backend Architecture](./ARCHITECTURE-01-BACKEND.md) - Module structure and communication patterns
- [Composer Documentation](./Composer-Docs.md) - How to create actions and emit events
- [Execution Log Implementation](./plan-project-log-implementation.md) - Event stream views
