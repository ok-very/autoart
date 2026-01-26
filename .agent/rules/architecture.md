# Architecture Patterns

## Soft-Intrinsic Type Derivation (CRITICAL)

Action types are **derived from relationships**, not explicit checks:

```typescript
// ❌ WRONG
if (item.entityType === 'subtask') { actionType = 'Subtask'; }

// ✅ CORRECT - derive from parent relationship
const hasParent = item.parentTempId && itemsByTempId.has(item.parentTempId);
// Projection system derives type from context + parent_action_id
```

**Red flags:**
- Conditionals on `entityType === 'subtask'`
- Hardcoded `type: 'Subtask'` values
- Variables named `task`, `subtask` with explicit strings

## Workspace System

```
Workspace (type: 'collect' | 'plan' | 'mail')
    ↓
CenterContentRouter → Content Adapter → Composite View
```

- `panelRegistry.ts` maps panel types to components
- `workspaceColors.ts` provides per-workspace theming

## Coding Principles

- Enforce schema (Zod in `shared/`)
- No Mantine - use `ui/atoms/` and `ui/molecules/`
- No inline styles/components - add to library
- Reuse existing elements

## Database Changes

1. Check if migration exists
2. Create migration if needed
3. Add seed data for defaults
4. Run `pnpm migrate`
5. Update `schema.ts`
