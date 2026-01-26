# Composer Module Guide

**Status:** Active
**Last Updated:** 2026-01-25

## Overview

The Composer is the single entry point for creating "task-like" work items on top of the **Action + Event** architecture. It replaces legacy task creation while maintaining clean, validated APIs.

### What the Composer Does

1. **Creates an Action** (intent declaration)
2. **Emits Events** (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
3. **Creates ActionReferences** (links to records)
4. **Returns a View** (computed by interpreter)

```
ComposerInput → Composer Service → ComposerResponse
                     ↓
              Create Action
                     ↓
              Emit Events
                     ↓
           Create References
                     ↓
             Return ActionView
```

---

## Core Architecture

### Action = Intent; Event = Fact; References = Inputs

- **Action** is the declared intent (immutable)
- **Events** capture immutable facts (field values set, work started/blocked, assigned, etc.)
- **Action References** represent semantic inputs: "this action operates against these records"

### Action Arrangements (Schema-First)

Action types are stored as **Action Arrangements** in the definitions system (`record_definitions` table).

To distinguish from record definitions, we use a discriminator:
- `definition.definition_kind = 'record' | 'action_arrangement' | 'container'`

**Composer UI rule:** The Action Type picker MUST list only definitions where `definition_kind === 'action_arrangement'`.

**Arrangement definition shape:**
- `id` / `name` (used as `action.type`)
- `description` (human meaning)
- `schemaConfig.fields[]` (input field configs: key, type, label, required)
- `referenceSlots[]` (named slots like `developer`, `site`, `client`)
- `applicability` (context filter rules/tags)

---

## API Reference

### Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/composer` | Create work item with fieldBindings, references, extra events |

### Request Schema

```typescript
interface ComposerInput {
  action: {
    contextId: string;      // UUID of the subprocess/context
    contextType: ContextType; // 'subprocess', 'project', etc.
    type: string;           // Action type (e.g., 'TASK', 'BUG')
    parentActionId?: string; // For subtasks
    fieldBindings?: Array<{ fieldKey: string }>;
  };
  fieldValues?: Array<{
    fieldName: string;
    value: unknown;
  }>;
  references?: Array<{
    sourceRecordId: string;
    targetFieldKey?: string;
    mode?: 'static' | 'dynamic';
  }>;
  emitExtraEvents?: Array<{
    type: string;
    payload?: Record<string, unknown>;
  }>;
}
```

### Response Schema

```typescript
interface ComposerResponse {
  action: Action;
  events: Event[];
  references?: ActionReference[];
  view?: ActionView;
}
```

### Example Request

```json
{
  "action": {
    "contextId": "subprocess-uuid",
    "contextType": "subprocess",
    "type": "TASK",
    "fieldBindings": [
      { "fieldKey": "title" },
      { "fieldKey": "description" },
      { "fieldKey": "dueDate" }
    ]
  },
  "fieldValues": [
    { "fieldName": "title", "value": "Write Composer docs" },
    { "fieldName": "description", "value": "Add API reference" }
  ],
  "references": [
    { "sourceRecordId": "project-uuid", "mode": "dynamic" }
  ]
}
```

---

## Frontend Usage

### Using the Compose Hook

```tsx
import { useCompose } from '@/api/hooks';

function CreateWorkItem({ subprocessId }: { subprocessId: string }) {
  const compose = useCompose();

  const handleCreate = () => {
    compose.mutate({
      action: {
        contextId: subprocessId,
        contextType: 'subprocess',
        type: 'TASK',
        fieldBindings: [
          { fieldKey: 'title' },
          { fieldKey: 'description' },
        ],
      },
      fieldValues: [
        { fieldName: 'title', value: 'My new task' },
        { fieldName: 'description', value: 'Task description' },
      ],
      references: [
        { sourceRecordId: projectRecordId, mode: 'dynamic' },
      ],
    });
  };

  return <button onClick={handleCreate}>Create Task</button>;
}
```

---

## Backend Implementation

### Files

| File | Purpose |
|------|---------|
| `composer.service.ts` | Core service with `compose()` function |
| `composer.routes.ts` | HTTP routes at `/api/composer` |
| `event-factory.ts` | Utility for building typed events |

### Event Factory

```typescript
EventFactory.actionDeclared(contextId, contextType, actionId, payload, actorId);
EventFactory.fieldValueRecorded(contextId, contextType, actionId, payload, actorId);
EventFactory.generic(contextId, contextType, actionId, type, payload, actorId);
```

---

## Guardrails

| Layer | Guard |
|-------|-------|
| Schema | No legacy task fields in ComposerInputSchema |
| Service | Rejects `legacy_task`, `LEGACY_TASK`, `task_node` types |
| Hierarchy | Read-only guardrails block task node mutations |

---

## Submission Pipeline

### Canonical 3-Step Write Model

1. **Create Action (intent)**
   - Create action with `contextId`, `contextType`, `type`, and `fieldBindings`

2. **Emit Events (facts)**
   - Emit field value events for filled inputs
   - Emit workflow events (started/blocked) if needed
   - Emit assignment events if applicable

3. **Set References (inputs)**
   - Bulk replace references in one call
   - References use named slots from the arrangement definition

### Transaction Atomicity

All operations happen within a single database transaction. If any step fails, the entire operation rolls back.

---

## What Happens When You Call the Composer

1. **Validation** - Request parsed against ComposerInputSchema
2. **Guardrail Check** - Rejects legacy action types
3. **Transaction Start** - All operations atomic
4. **Create Action** - Insert into `actions` table
5. **Emit Events** - ACTION_DECLARED, FIELD_VALUE_RECORDED for each field
6. **Create References** - Insert into `action_references` table
7. **Compute View** - Interpreter derives ActionView
8. **Return Response** - Action + Events + References + View
