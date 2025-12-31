# Claude Code Settings for AutoArt Process Management System

## Project Overview

AutoArt is a **Hybrid Relational-Graph Process Management System** that combines a strict 5-level hierarchy with a flexible polymorphic data mesh. The system supports:

- **5-Level Hierarchy**: Project → Process → Stage → Subprocess → Task
- **Polymorphic Records**: User-defined data types with JSONB storage
- **Reference Layer**: Static/Dynamic links between tasks and records with Copy-on-Write semantics
- **Hypertext System**: `#recordname:field` syntax for inline database references

---

## Architectural Principles

### 1. Hierarchical Substrate (Adjacency List Pattern)

The hierarchy uses **Single Table Inheritance** with an adjacency list (`parent_id`) pattern. This was chosen over Closure Tables or Nested Sets specifically for **O(N) deep cloning performance**.

```
hierarchy_nodes table:
- id, parent_id, root_project_id
- type: ENUM('project', 'process', 'stage', 'subprocess', 'task')
- description: JSONB (TipTap/ProseMirror rich text with mentions)
- metadata: JSONB (flexible node-specific data)
```

**Key Operations:**
- Tree traversal uses PostgreSQL Recursive CTEs
- Deep cloning creates ID maps and remaps parent_id in a single transaction
- `root_project_id` is an optimization for "get all nodes in project" queries

### 2. Polymorphic Data Mesh (JSONB Pattern)

Instead of separate tables per entity type (contacts, artworks, etc.), we use a flexible record system:

```
record_definitions table:
- id, name, derived_from_id (inheritance)
- schema_config: JSONB (field definitions with types, labels, validation)
- styling: JSONB (colors, icons for visual differentiation)

records table:
- id, definition_id, unique_name
- data: JSONB (actual field values)
- classification_node_id (optional: link to project/subprocess for "tagging")
```

**Design Rationale:**
- Adding fields requires NO schema migrations
- GIN indexes on JSONB enable efficient querying
- Schema evolution is handled gracefully (missing keys return null)

### 3. Reference Layer (Copy-on-Write Pattern)

Tasks never link directly to records. They link via a **Reference Entity** that implements Static/Dynamic behavior:

```
task_references table:
- id (the "new UUID" for safe modification)
- task_id, source_record_id, target_field_key
- mode: ENUM('static', 'dynamic')
- snapshot_value: JSONB (frozen value for static mode)
```

**Lifecycle:**
1. **Dynamic**: Reference acts as a pointer; value resolved at read time
2. **Static**: Value captured as snapshot; can be modified independently
3. **Drift Detection**: Compare snapshot_value to current record value
4. **Re-link**: Switch back to dynamic, discarding snapshot

### 4. The Hypertext Engine (TipTap/ProseMirror)

The `#recordname:field` syntax is parsed into structured mention nodes:

```json
{
  "type": "mention",
  "attrs": {
    "referenceId": "uuid-of-task-reference",
    "label": "#recordname:field",
    "mode": "dynamic",
    "recordId": "uuid-of-source-record",
    "fieldKey": "field_name"
  }
}
```

This ensures:
- Links survive record renames (stored by UUID, not text)
- Backlinks are queryable via task_references
- Rich text remains structured, not plain strings

---

## Database Conventions

### Naming
- Tables: `snake_case` plural (e.g., `hierarchy_nodes`, `task_references`)
- Columns: `snake_case` (e.g., `parent_id`, `source_record_id`)
- Types/Enums: `snake_case` (e.g., `node_type`, `ref_mode`)

### UUIDs
- All primary keys use `gen_random_uuid()`
- Enables collision-free cloning and distributed systems

### JSONB Patterns
- `schema_config.fields[]`: Array of field definitions
- `data`: Key-value pairs matching schema field keys
- `metadata`: Flexible node-specific configuration

---

## API Conventions

### Backend (Fastify)
- Request/Response: **camelCase** (e.g., `schemaConfig`, `definitionId`)
- Zod schemas for validation
- Standard response wrappers: `{ node }`, `{ records }`, `{ reference }`

### Frontend (React + TanStack Query)
- Types use database column names (snake_case) for data types
- API input types use camelCase to match backend expectations
- Mutations invalidate relevant query keys

---

## Migration Requirements

### CRITICAL: Always Keep Migrations Updated

When adding new features that require database changes:

1. **Check if migration exists** for the table/column
2. **Create new migration** if schema change is needed
3. **Add seed data** for required default records (e.g., node type definitions)
4. **Run migrations** to verify: `npm run migrate`
5. **Update schema.ts** if types change

### Current Migrations
```
001_extensions.ts   - PostgreSQL extensions (uuid-ossp, etc.)
002_enums.ts        - node_type, ref_mode enums
003_users.ts        - Authentication tables
004_record_definitions.ts - Schema registry
005_hierarchy.ts    - Hierarchy nodes table
006_records.ts      - Records table
007_references.ts   - Task references table
008_functions.ts    - Helper SQL functions
009_seed_definitions.ts - Default record definitions for node types
```

### Adding New Migrations
```bash
# Create new migration file
touch backend/src/db/migrations/XXX_description.ts

# Follow the pattern:
export async function up(db: Kysely<unknown>): Promise<void> { ... }
export async function down(db: Kysely<unknown>): Promise<void> { ... }
```

---

## Common Implementation Patterns

### Creating References from Mentions
```typescript
// In RichTextEditor, when user selects a record:field
const result = await createReference.mutateAsync({
  taskId,
  sourceRecordId: item.id,
  targetFieldKey: fieldKey,
  mode: 'dynamic',
});
// Insert mention node with referenceId into editor
```

### Resolving References
```typescript
// Backend resolves reference to current value
const resolved = await resolveReference(referenceId);
// Returns: { value, drift, liveValue, mode, label }
```

### Schema Editor Flow
```typescript
// Get definition, update schema
await updateDefinition.mutateAsync({
  id: definition.id,
  schemaConfig: { fields: [...fields, newField] },
});
```

---

## Testing Checklist

Before completing any feature:

1. [ ] Backend TypeScript compiles: `cd backend && npm run typecheck`
2. [ ] Frontend TypeScript compiles: `cd frontend && npm run typecheck`
3. [ ] Migrations run successfully: `npm run migrate`
4. [ ] API endpoints tested with actual requests
5. [ ] UI components render and function correctly

---

## File Structure Reference

```
autoart_v02/
├── backend/
│   └── src/
│       ├── db/
│       │   ├── client.ts          # Kysely database client
│       │   ├── schema.ts          # TypeScript type definitions
│       │   └── migrations/        # Database migrations
│       ├── modules/
│       │   ├── auth/              # Authentication
│       │   ├── hierarchy/         # Node CRUD, cloning
│       │   ├── records/           # Record definitions & records
│       │   ├── references/        # Task references (static/dynamic)
│       │   └── search/            # Resolution service
│       └── utils/
│           └── errors.ts          # Custom error classes
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── client.ts          # API client wrapper
│       │   └── hooks.ts           # TanStack Query hooks
│       ├── components/
│       │   ├── editor/            # TipTap rich text components
│       │   ├── inspector/         # Right panel (record/schema/references)
│       │   ├── layout/            # Main layout components
│       │   └── modals/            # Modal dialogs
│       ├── stores/                # Zustand stores
│       └── types/                 # TypeScript interfaces
└── CLAUDE.md                      # This file
```

---

## Key Implementation Documents

- `Implementation_Plan.md` - High-level architecture and roadmap
- `AutoArt Refactor Implementation.md` - Detailed technical specification

When in doubt about architectural decisions, refer to these documents for the rationale behind the patterns used.
