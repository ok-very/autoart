# AutoArt Project Reference

## Monorepo Structure

```
autoart/
├── frontend/       # React + Vite (Dashboard + Intake)
├── backend/        # Fastify + TypeScript API
├── shared/         # @autoart/shared (schemas, types)
├── packages/ui/    # @autoart/ui
├── apps/
│   ├── autohelper/ # Python desktop app (automation)
│   └── mail/       # @autoart/mail-client
```

---

## Common Commands

```bash
pnpm dev              # Start all services
pnpm build            # Build shared + backend
pnpm migrate          # Run DB migrations
pnpm db:rebuild       # Nuke + migrate + seed
pnpm --filter <pkg>   # Run in specific package
```

---

## Nomenclature

| Don't Use | Use Instead |
|-----------|-------------|
| Owner | Assignee |
| Completed | Done |
| History | Log |
| GLOBAL | CONTEXT |
| action_recipe | action_arrangement |

---

## pnpm Catalog

Use `catalog:` reference instead of hardcoded versions:

```json
// WRONG
{ "typescript": "~5.9.3" }

// CORRECT
{ "typescript": "catalog:" }
```

Key versions (defined in `pnpm-workspace.yaml`):
- TypeScript: ~5.9.3
- React: ^19.0.0
- Tailwind: ^4.1.18
- Zod: ^4.3.5
- Vite: ^7.3.0

---

## Tailwind v4

No config file needed. Uses Vite plugin:

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
plugins: [react(), tailwindcss()]
```

```css
/* index.css */
@import "tailwindcss";
```

---

## Key Coding Principles

- **No Mantine** - use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`
- **Enforce schema** - Zod validation in `shared/`
- **Soft-intrinsic types** - derive types from relationships, not explicit checks
- **Action/Event flow** - all mutations go through Actions which produce Events

---

## User Behavior Protocol

- User updates todo with entry number
- Respond with 2-3 sentence summary of how task was accomplished
- Reorder tasks, carry forward deferred items
- Don't repeat completed work
- Request pruning when old tasks lose context relevance

---

## Multi-Phase Plans

**Require stacked PRs.** Each phase = one PR.

```bash
git add -A
stackit create -m "phase N: description"
stackit submit
```

Link PRs to issues: `Closes #N` or `Refs #N`
