# AutoArt

Process management system with hierarchical nodes, polymorphic records, and an action/event workflow engine.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- pnpm 9+

## Quick Start

```bash
git clone <repository-url>
cd autoart
pnpm install
cp .env.example .env   # edit with your database URL, JWT secret, etc.
pnpm migrate
pnpm dev
```

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services |
| `pnpm build` | Build shared + backend |
| `pnpm migrate` | Run database migrations |
| `pnpm db:rebuild` | Nuke + migrate + seed |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm --filter <pkg>` | Run command in a specific package |

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

## License

MIT
