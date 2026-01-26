# ADR: Action Arrangements and Projection-First Workflow

**Status:** Accepted
**Date:** 2026-01-25
**Parent Tracker:** #126
**Related:** #134, #135

## Context

AutoArt's architecture evolved from a task-centric model (with explicit Task/Subtask types) to a projection-first model built on four irreducible primitives: Record, Field, Action, and Event. This ADR documents why we removed Task/Subtask as core concepts and why Arrangements are now the "action type" layer.

### Previous Architecture (Deprecated)

```
record_definitions.kind = 'action_recipe'
├── Task (hardcoded type)
├── Subtask (hardcoded type, parent_action_id → Task)
└── Custom action types
```

Problems:
- "Task" and "Subtask" were baked into the system as if they were ontologically distinct
- UI logic checked `entityType === 'subtask'` to apply different behavior
- The parent/child relationship was conflated with type identity
- Adding new hierarchical patterns required schema changes

### New Architecture

```
record_definitions.kind = 'action_arrangement'
├── Any named arrangement (Task, Bug, Story, Deliverable...)
└── Relationships derived from context + parent_action_id
```

An **Arrangement** is a named schema for Actions. It defines what fields are available and how the Action should be displayed, but it does NOT define "task-ness" or hierarchy.

## Decision

### 1. Remove Task/Subtask as Core Concepts

Task and Subtask are **not real objects**. They are **projections** derived from:

```typescript
ProjectedItem = interpret(Action, Fields, Events, Context)
```

A "Subtask" is simply an Action where:
- `parent_action_id` is set (it's a child of another Action)
- The projection layer renders it nested under its parent

The same Action can appear as:
- A "Task" when viewed standalone
- A "Subtask" when viewed under its parent
- A "Checklist item" in a different projection

### 2. Arrangements Replace action_recipe

The `kind` discriminator in `record_definitions` changes from `action_recipe` to `action_arrangement`:

| Old Value | New Value | Meaning |
|-----------|-----------|---------|
| `action_recipe` | `action_arrangement` | Schema for declaring Actions |

This rename clarifies that:
- Arrangements are not "recipes" that produce something else
- Arrangements define the **structure** of declared intent
- Multiple Arrangements can coexist for different contexts

### 3. Projection-First Workflow

All meaningful state is computed, not stored:

| What Users See | How It's Computed |
|----------------|-------------------|
| Task completion | Event stream interpreted (TASK_DONE event exists?) |
| Task status | Field value or interpreted from events |
| Subtask nesting | `parent_action_id` relationship |
| Assignee | Field binding or event actor |
| Timeline position | Interpreted from date fields + events |

The database stores:
- Actions (declared intent)
- Events (immutable facts)
- Field values (declarative data)

The UI computes:
- Progress percentages
- Completion states
- Blocked/ready indicators
- Hierarchy views

## Consequences

### Positive

1. **Flexibility**: New action types (Bug, Story, Milestone) require only a new Arrangement, not schema changes
2. **Consistency**: All actions follow the same primitive pattern
3. **Auditability**: Event stream provides complete history
4. **Multiple views**: Same data can project as Kanban, Timeline, List without denormalization

### Negative

1. **Query complexity**: Some views require event aggregation
2. **Migration effort**: Existing `action_recipe` references needed renaming
3. **Learning curve**: Developers must understand projection vs storage

### Neutral

1. **UI unchanged**: Users still see "Tasks" - the abstraction is internal
2. **API compatibility**: Frontend filters by arrangement name, not by stored type

## Future Directions

Per #134 roadmap:

1. **Standard projections**: Define canonical work views (Inbox, Board, Timeline) that interpret events
2. **Arrangement applicability**: Context-scoped action types (which arrangements are valid in which subprocesses)
3. **Kind stability**: Keep `record_definitions.kind` as stable discriminator: `record | action_arrangement | container`
4. **Legacy deprecation**: Define timeline for removing v0 wrapper endpoints

## What Is Projected vs Stored

| Concept | Storage | Projection |
|---------|---------|------------|
| Action identity | `actions.id` | - |
| Action type | `actions.type` (Arrangement name) | - |
| Field values | `events` (FIELD_VALUE_RECORDED) | Current value extracted |
| Completion | - | Interpreted from events |
| Status | Field value OR events | Rendered badge/indicator |
| Parent/child | `actions.parent_action_id` | Hierarchy tree |
| Subtask-ness | - | Derived from parent relationship |

## References

- [ARCHITECTURE-02-FOUNDATIONAL-MODEL.md](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) - Four primitives
- [Composer documentation](./1-3-2026_composer-creation-guide.md) - Creating Actions with Arrangements
- #135 - QA checklist for action_recipe → action_arrangement rename
- #126 - Parent tracker for architecture alignment
