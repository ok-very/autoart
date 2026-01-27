# Backend & Database

## Project Structure

```
backend/
├── src/
│   ├── modules/    # Feature modules (routes, handlers)
│   └── db/         # Database (migrations, schema, queries)
shared/
├── schemas/        # Zod schemas
└── types/          # TypeScript types
```

---

## Architecture Principles

### Action/Event Pattern

All mutations go through **Actions** (user intent) which produce **Events** (observable outcomes):
- Events are scoped by `context_type` + `context_id`
- No direct "field update" events - use Actions instead
- Composer orchestrates Action → Event flow

### Soft-Intrinsic Type Derivation (CRITICAL)

Action types are **derived from relationships**, not explicit checks:

```typescript
// WRONG
if (item.entityType === 'subtask') { actionType = 'Subtask'; }

// CORRECT - derive from parent relationship
const hasParent = item.parentTempId && itemsByTempId.has(item.parentTempId);
// Projection system derives type from context + parent_action_id
```

**Red flags:**
- Conditionals on `entityType === 'subtask'`
- Hardcoded `type: 'Subtask'` values
- Variables named `task`, `subtask` with explicit strings

---

## Database Naming

- **Tables:** snake_case plural (`hierarchy_nodes`, `task_references`)
- **Columns:** snake_case (`parent_id`, `source_record_id`)
- **Types/Enums:** snake_case (`node_type`, `ref_mode`)
- **UUIDs:** All primary keys use `gen_random_uuid()`

---

## API Conventions

- **Backend (Fastify):** Request/Response use camelCase (`schemaConfig`, `definitionId`)
- **Frontend types:** Use database column names (snake_case) for data types
- **API input types:** Use camelCase to match backend expectations

---

## Database Changes Workflow

1. Check if migration exists
2. Create migration if needed
3. Add seed data for defaults
4. Run `pnpm migrate`
5. Update `schema.ts`

---

## Schema Validation

- Enforce schema with Zod in `shared/`
- Derive TypeScript types from Zod schemas where possible

---

## Common Commands

```bash
pnpm migrate          # Run DB migrations
pnpm db:rebuild       # Nuke + migrate + seed
pnpm --filter backend # Run in backend package
```
