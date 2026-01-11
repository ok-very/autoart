# @autoart/shared Architecture

## Module Structure

```
shared/src/
├── index.ts              # Main barrel export (~70 lines)
├── projections.ts        # Pure TypeScript types for projections
├── schemas/
│   ├── index.ts          # Schema barrel export
│   ├── actions.ts        # Actions & Events schemas
│   ├── auth.ts           # Authentication schemas
│   ├── classification.ts # Import classification schemas
│   ├── composer.ts       # Composer input/output schemas
│   ├── domain-events.ts  # Fact recording schemas
│   ├── enums.ts          # Shared enums (FieldType, NodeType, etc.)
│   ├── exports.ts        # Export session/result schemas
│   ├── fields.ts         # Field descriptors
│   ├── hierarchy.ts      # Hierarchy node schemas
│   ├── links.ts          # Record link schemas
│   ├── records.ts        # Record/definition schemas
│   ├── references.ts     # Action/task reference schemas
│   ├── search.ts         # Search schemas
│   └── tasks.ts          # Task metadata schemas
├── types/
│   └── index.ts          # Pure TypeScript types barrel
└── domain/
    ├── index.ts          # Domain logic barrel
    ├── types.ts          # Domain-specific types
    ├── fieldVisibility.ts
    ├── completeness.ts
    ├── referenceResolution.ts
    ├── phaseProgression.ts
    └── fieldViewModel.ts
```

## Import Pattern

Always import from the package root:

```typescript
// ✅ Correct
import { ActionSchema, FieldDef, getFieldState } from '@autoart/shared';

// ❌ Avoid deep imports
import { ActionSchema } from '@autoart/shared/schemas/actions';
```

## Dependency Graph

```
enums.ts
    ↑
    ├── records.ts
    ├── references.ts
    │       ↑
    └───────┴── composer.ts
                    ↑
                actions.ts (no imports from other schemas)
```

**No circular dependencies.**

## Type Conflicts

The `domain/types.ts` defines `ReferenceStatus` and `ResolvedReference` interfaces that parallel the Zod schemas. The schema exports are authoritative; domain types document invariants.
