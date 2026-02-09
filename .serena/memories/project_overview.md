# AutoArt Project Overview

## Purpose
Process management system for art projects. Hierarchical nodes (programs > projects > stages > subprocesses), polymorphic records, action/event workflow engine. Export pipeline for BFA (Ballard Fine Art) reports.

## Tech Stack
- Frontend: React 19, Vite 7, TypeScript 5.9, TanStack Query, Zustand, Dockview, Tailwind v4
- Backend: Fastify, TypeScript, Kysely (PostgreSQL)
- Shared: Zod schemas + derived types
- Desktop: Python (AutoHelper)
- Package manager: pnpm with catalog

## Key Modules
- **exports**: Session-based export pipeline (projectors -> formatters -> targets)
- **imports**: CSV/connector import with classification + resolution
- **hierarchy**: Node tree (programs, projects, stages, etc.)
- **actions/events**: Action/Event workflow pattern
- **composer**: Orchestrates Action -> Event flow
- **records**: Polymorphic record storage

## Commands
- `pnpm dev` - start all services
- `pnpm build` - build shared + backend
- `pnpm migrate` - run DB migrations
- `pnpm db:rebuild` - nuke + migrate + seed
- `pnpm typecheck` - type checking
- `pnpm lint` - linting

## Git
- Uses `stackit` for stacked PR management
- Never use raw git for branch operations
