# Backend Architecture

**Part of:** [Architecture Documentation Series](./ARCHITECTURE-00-INDEX.md)  
**Last Updated:** 2026-01-29

## Module Structure

All backend modules follow a standard structure:

```
module/
├── index.ts         # Public API barrel exports
├── routes.ts        # Fastify route handlers
├── service.ts       # Business logic
├── schemas.ts       # Module-specific Zod schemas (optional)
└── types.ts         # Module-specific TypeScript types (optional)
```

## Modules Overview

```
backend/src/modules/
├── actions/         # Action management (Intent declarations)
├── auth/            # Authentication & sessions
├── composer/        # Action composition (creates actions + events)
├── definitions/     # Record definition CRUD
├── events/          # Event querying & workflow surfaces (Historical facts)
├── exports/         # Export session orchestration
│   ├── projectors/  #   Data projection (e.g., bfa-project.projector)
│   ├── targets/     #   Output targets (Google Docs, PDF, RTF)
│   ├── formatters/  #   Content formatting (markdown, plaintext, RTF)
│   └── connectors/  #   External service connectors (Google Sheets/Docs/Slides)
├── gc/              # Garbage collection
├── hierarchy/       # Project hierarchy (nodes)
├── imports/         # CSV/Monday import, classification, webhooks
├── intake/          # Public intake forms
├── interpreter/     # Data interpretation & mapping rules
│   └── mappings/    #   11 domain-specific rule files (artwork, budget, communication,
│                    #   decision, document, intent-mapping, invoice, meeting, permit,
│                    #   process, stage)
├── links/           # Record-to-record links
├── polls/           # Scheduling polls
├── projections/     # Projection presets & views (Derived state)
├── records/         # Records + fact-kinds (Context containers)
├── references/      # Action/task references
├── runner/          # AutoHelper runner connector
└── search/          # Full-text search
```

### Key Modules in the Action-Event Model

#### Composer
Single entry point for creating work items. All mutations flow through Composer to ensure proper Action+Event generation.

**Responsibility**: Orchestrate action creation + emit events + update projections.

#### Actions
Store **intent declarations**. Actions are immutable and never track execution outcomes.

**Responsibility**: Persist what *should happen*, not what *did happen*.

#### Events
Append-only event log. Events are the **sole source of historical truth**.

**Responsibility**: Record what *actually occurred* with timestamp and actor.

#### Records
Context containers that anchor meaning. Records own identity, scope, and permissions but contain no behavior or state.

**Responsibility**: Answer "What is this about?"

#### Projections
Derived views computed from Records × Fields × Actions × Events. Projections may cache computed state but are always rebuildable.

**Responsibility**: Provide materialized views for performance without storing authoritative state.

## Import Rules

### ✅ Allowed Imports

- **From shared package:** `import { ActionSchema } from '@autoart/shared';`
- **From utils:** `import { formatDate } from '@utils/formatting.js';`
- **From db:** `import { db } from '@db/client.js';`
- **Within module:** `import { createAction } from './service.js';`

### ❌ Prohibited Imports

- **Cross-module imports:** `import { createRecord } from '../records/service.js';`
  - Use service layer or shared package instead
- **Deep relative imports:** `import { db } from '../../../db/client.js';`
  - Use path aliases: `@db/`, `@modules/`, `@utils/`
- **Subpath imports from shared:** `import { ActionSchema } from '@autoart/shared/schemas/actions';`
  - Use package root: `import { ActionSchema } from '@autoart/shared';`

## Path Aliases

Configured in `tsconfig.json`:

- `@/*` → `src/*`
- `@config/*` → `src/config/*`
- `@db/*` → `src/db/*`
- `@modules/*` → `src/modules/*`
- `@plugins/*` → `src/plugins/*`
- `@utils/*` → `src/utils/*`

## Module Dependencies

```mermaid
graph TD
    A[actions] --> S[@autoart/shared]
    AU[auth] --> S
    C[composer] --> S
    C --> A
    D[definitions] --> S
    E[events] --> S
    E --> A
    EX[exports] --> S
    GC[gc] --> S
    H[hierarchy] --> S
    I[imports] --> S
    I --> INT[interpreter]
    IN[intake] --> S
    IN --> D
    INT --> S
    L[links] --> S
    PO[polls] --> S
    P[projections] --> S
    R[records] --> S
    R --> D
    REF[references] --> S
    RU[runner] --> S
    SE[search] --> S
```

**Key Principle:** Modules communicate through the shared package (`@autoart/shared`), not direct imports.

## Shared Package (`@autoart/shared`)

The `@autoart/shared` package provides:
- Zod schemas for end-to-end type safety
- Shared TypeScript types
- Validation logic used by both frontend and backend

### Benefits
- Single source of truth for data contracts
- Automatic type inference from Zod schemas
- Runtime validation in both environments
- No duplication of type definitions

### Usage Pattern

```typescript
// In @autoart/shared
export const ActionSchema = z.object({
  id: z.string().uuid(),
  recordId: z.string().uuid(),
  type: z.string(),
  // ...
});

export type Action = z.infer<typeof ActionSchema>;

// In backend service
import { ActionSchema, type Action } from '@autoart/shared';

const validated = ActionSchema.parse(input);
```

## Database Access

All database operations use **Kysely** for type-safe query building.

```typescript
import { db } from '@db/client.js';

const records = await db
  .selectFrom('records')
  .where('project_id', '=', projectId)
  .selectAll()
  .execute();
```

### Transaction Pattern

```typescript
import { db } from '@db/client.js';

await db.transaction().execute(async (trx) => {
  const action = await trx
    .insertInto('actions')
    .values(actionData)
    .returningAll()
    .executeTakeFirstOrThrow();

  await trx
    .insertInto('events')
    .values(eventData)
    .execute();
});
```

## Service Layer Pattern

Services contain business logic and coordinate between modules via the shared package.

### Service Responsibilities
- Validate input (using shared Zod schemas)
- Coordinate cross-module operations
- Enforce business rules
- Return typed results

### Route Responsibilities
- HTTP concerns (request parsing, response formatting)
- Authentication/authorization checks
- Delegate to service layer

```typescript
// routes.ts
export async function createActionRoute(
  request: FastifyRequest<{ Body: CreateActionInput }>,
  reply: FastifyReply
) {
  const action = await createAction(request.body);
  return reply.code(201).send(action);
}

// service.ts
export async function createAction(
  input: CreateActionInput
): Promise<Action> {
  const validated = CreateActionSchema.parse(input);
  // Business logic...
  return action;
}
```

## Error Handling

Use structured errors with appropriate HTTP status codes:

```typescript
import { NotFoundError, ValidationError } from '@utils/errors.js';

if (!record) {
  throw new NotFoundError('Record not found');
}

if (!isValid) {
  throw new ValidationError('Invalid input');
}
```

## Next Steps

- Read [Foundational Model](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) to understand the four first-class objects
- Review [Composer Documentation](./composer/composer-guide.md) for action creation patterns
- See [Architecture Inventory](./architecture-inventory.md) for deprecation status
