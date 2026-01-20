---
description: Canonical terminology and naming standards for the project
---

# Nomenclature Standards

## Canonical Terminology

| ❌ Do NOT Use | ✅ Use Instead | Context |
|---------------|----------------|---------|
| Owner | Assignee | User assigned to a task/action |
| Completed | Done | Task/action status |
| History | Log | Event display panel |
| GLOBAL | CONTEXT | Event bucket scoping |

## Variable Naming
```typescript
// ❌ Wrong
const owner = user;
const history = events;

// ✅ Correct
const assignee = user;
const log = events;
```

## Action/Event Architecture
- All mutations go through **Actions** (user intent)
- Actions produce **Events** (observable outcomes)
- Events are scoped by `context_type` + `context_id`
- No direct "field update" events - use Actions instead
- Composer orchestrates Action → Event flow

## Database Naming
- **Tables**: snake_case plural (`hierarchy_nodes`, `task_references`)
- **Columns**: snake_case (`parent_id`, `source_record_id`)
- **Types/Enums**: snake_case (`node_type`, `ref_mode`)
- **UUIDs**: All primary keys use `gen_random_uuid()`

## API Conventions
- **Backend (Fastify)**: Request/Response use camelCase (`schemaConfig`, `definitionId`)
- **Frontend types**: Use database column names (snake_case) for data types
- **API input types**: Use camelCase to match backend expectations
