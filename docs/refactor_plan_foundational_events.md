# Refactor Plan: Actions, Events, and Non‑Reified Views

**Date:** 2026‑01‑03
**Status:** DRAFT (Ontology‑Safe Rewrite)
**Based on:** `foundational_model_actions_events_and_downstream_interpretation.md`

---

## Executive Summary

This refactor migrates AutoArt from a **stored task/state model** to a **strict interpretive model** built on four first‑class primitives: **Records, Fields, Actions, and Events**.

The objective is **not** to recreate Tasks with a different backing store. The objective is to **eliminate Tasks entirely as domain objects**.

Any task‑like structure that appears after this refactor is:

* a *view*
* disposable
* non‑addressable
* non‑authoritative

**North Star Constraint:**

> Records hold context. Fields hold data. Actions hold intent. Events hold truth. Everything else is interpretation.

---

## Core Rule (Non‑Negotiable)

> **Actions and Events are the only writable units of meaning.**
> Views are never written, addressed, or mutated.

No API, UI, or service may:

* “update a task”
* “change task state”
* store derived status

---

## Phase 1: Foundation (Subprocess Scope Only)

**Objective:** Introduce Actions and Events as first‑class primitives scoped to a `subprocess`, without reifying Tasks.

### 1.1 Create `events` Table (Immutable Fact Log)

**Purpose:** Record what *occurred*, never what *is*.

**Schema:**

* `id` (UUID, PK)
* `context_id` (UUID) — owning scope (subprocess, stage, process, record)
* `context_type` (ENUM)
* `action_id` (UUID, nullable)
* `type` (STRING)
* `payload` (JSONB)
* `actor_id` (UUID, nullable)
* `occurred_at` (TIMESTAMPTZ, default NOW())

**Rules:**

* Append‑only
* No UPDATE
* No DELETE

---

### 1.2 Create `actions` Table (Intent Declarations)

**Purpose:** Declare that something *should or could* happen.

**Schema:**

* `id` (UUID, PK)
* `context_id` (UUID)
* `context_type` (ENUM)
* `type` (STRING)
* `field_bindings` (JSONB)
* `created_at` (TIMESTAMPTZ)

**Explicitly Forbidden Columns:**

* `status`
* `progress`
* `completed_at`
* `assignee`

Actions do **not** know outcomes.

---

## Phase 2: Event Emission Services (Not State Changes)

**Objective:** Ensure all mutation occurs via fact emission, not state transitions.

### 2.1 Event Emission API

**Allowed:**

```
POST /events
```

Payload:

```ts
{
  contextId,
  contextType,
  actionId?,
  type,
  payload
}
```

**Forbidden:**

* `POST /actions/:id/complete`
* `PATCH /tasks/:id`
* any endpoint that implies state mutation

---

### 2.2 Event Catalog (Initial, Minimal)

Events describe *facts*, not lifecycle stages.

Required:

* `ACTION_DECLARED`
* `WORK_STARTED`
* `WORK_STOPPED`
* `WORK_FINISHED`
* `WORK_BLOCKED`
* `WORK_UNBLOCKED`
* `FIELD_VALUE_RECORDED`
* `ASSIGNMENT_OCCURRED`

Event names intentionally avoid state semantics.

---

## Phase 3: Interpretation Layer (Views, Not Objects)

**Objective:** Produce task‑like UI affordances **without creating task entities**.

### 3.1 Action View Interpreter

**Pure Function:**

```ts
interpretActionView(
  action: Action,
  events: Event[],
  viewSchema: ViewSchema
): ActionView
```

Properties:

* deterministic
* idempotent
* side‑effect free

---

### 3.2 ActionView (Non‑Reified)

```ts
interface ActionView {
  actionId: UUID;
  viewType: 'task-like' | 'kanban-card' | 'timeline-row';
  renderedAt: Timestamp;
  data: ViewPayload;
}
```

**Rules:**

* No primary key
* No persistence
* No external references
* Safe to discard

---

### 3.3 No Recursive Subtasks

Subtasks are **procedural decompositions**, not nested entities.

They are derived from:

* structured Field schemas
* domain‑specific view logic

No Action produces child Actions automatically.

---

## Phase 4: API Surface (Ontology‑Safe)

**Objective:** Ensure transport layer does not lie.

### 4.1 Read Endpoints

**Allowed:**

```
GET /subprocess/:id/actions
GET /subprocess/:id/action-views?view=task-like
```

**Disallowed:**

* `GET /tasks`
* `GET /subprocess/:id/tasks`

The word *task* may appear **only** as a view modifier.

---

### 4.2 Write Endpoints

Only Events may be written.

```
POST /events
POST /actions
```

No endpoint may accept a view payload.

---

## Phase 5: Migration (One‑Way, Ontology‑Preserving)

**Objective:** Migrate legacy task rows into Actions + Events *without preserving Tasks*.

### 5.1 Migration Script

For each legacy `task` / `subtask` row:

1. Create Action (context = parent subprocess)
2. Emit synthetic Events:

   * `ACTION_DECLARED`
   * `WORK_FINISHED` (if applicable)
   * `FIELD_VALUE_RECORDED` (title, description)

Legacy IDs are **not preserved**.

---

### 5.2 Dual Read (Temporary)

* Legacy task reads allowed behind feature flag
* New views rendered in parallel
* Comparison only

No dual write paths.

---

## Phase 6: Deletion of Task Ontology

**Objective:** Make it impossible to recreate Tasks.

Actions:

* Remove `task` and `subtask` from enums
* Delete write paths to legacy tables
* Rename frontend types (`Task` → `ActionView`)
* Delete stored status logic

---

## Verification Checklist

* [ ] No persisted task or subtask rows
* [ ] No API refers to “task” as a noun
* [ ] All writes occur via `POST /events`
* [ ] Views are generated on demand
* [ ] Deleting all views does not affect truth

---

## Failure Conditions (Stop the Refactor If Any Occur)

* A view gains an ID
* A view is persisted
* A state field is added
* An endpoint mutates derived data

---

## Final Assertion

After this refactor:

* AutoArt does not manage work
* AutoArt records intent and facts
* Meaning is always computed
* No abstraction lies about reality

If the system feels quieter, this refactor succeeded.
