---
description: Soft-intrinsic type derivation and core architectural patterns
---

# Architecture Patterns

## Soft-Intrinsic Type Derivation (CRITICAL)

Action types like Task, Subtask, etc. must be **derived from context and parent relationships**, NOT explicitly checked via conditionals.

```typescript
// ❌ WRONG - Explicit type checks violate soft-intrinsic architecture
if (item.entityType === 'subtask') {
    actionType = 'Subtask';
} else {
    actionType = 'Task';
}

// ✅ CORRECT - Derive from parent relationship
const parentIsItem = item.parentTempId && itemsByTempId.has(item.parentTempId);
// parentActionId signals child relationship
// Projection system derives actual type from context + parent_action_id
```

**Red flags** that indicate architecture violation:
- Variables named `task`, `subtask`, `actionType` with explicit string values
- Conditionals on `entityType === 'subtask'` or `entityType === 'task'`
- Hardcoded type values like `type: 'Subtask'`

**Correct approach**:
- Set `parent_action_id` based on whether parent is another action
- Set `context_id` and `context_type` properly
- Use base type `'Task'` - projection derives actual type from relationships

## Coding Principles
- Enforce schema
- Enforce semantics
- Add new UI elements to component library
- Use `shared` for registering Zod schemas
- Reuse existing elements whenever possible
- Code within bounding canonical datatypes and use cases
- Do NOT code new styles or components or modules inline

## Migration Requirements

When adding new features that require database changes:
1. Check if migration exists for the table/column
2. Create new migration if schema change is needed
3. Add seed data for required default records
4. Run migrations to verify: `npm run migrate`
5. Update `schema.ts` if types change

## Do NOT Use Mantine

All UI must use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`.
