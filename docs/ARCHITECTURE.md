# Backend Architecture

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
├── actions/         # Action & event management
├── auth/            # Authentication & sessions
├── composer/        # Action composition (creates actions + events)
├── events/          # Event querying & workflow surfaces
├── exports/         # BFA export functionality
├── hierarchy/       # Project hierarchy (nodes)
├── imports/         # CSV/Monday import & classification
├── interpreter/     # Data interpretation & mapping rules
├── links/           # Record-to-record links
├── projections/     # Projection presets & views
├── records/         # Record definitions & instances
├── references/      # Action/task references
└── search/          # Full-text search
```

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
    C[composer] --> S
    C --> A
    E[events] --> S
    E --> A
    I[imports] --> S
    I --> INT[interpreter]
    EX[exports] --> S
    H[hierarchy] --> S
    R[records] --> S
    REF[references] --> S
    L[links] --> S
    P[projections] --> S
    SE[search] --> S
```

**Key Principle:** Modules communicate through the shared package, not direct imports.
