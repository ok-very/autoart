# Code Style & Conventions

## Naming
- DB tables: snake_case plural (hierarchy_nodes, export_sessions)
- DB columns: snake_case (parent_id, source_record_id)
- API routes: camelCase request/response
- Frontend types: snake_case for data types matching DB
- TypeScript: strict mode, Zod schemas derive types

## Patterns
- Action/Event pattern for all mutations
- Soft-intrinsic type derivation (derive from relationships, not explicit checks)
- Zustand stores with persist middleware for client state
- TanStack Query for server state
- pnpm catalog for dependency versions
- --ws-* CSS tokens for workspace, --pub-* for public surfaces

## Post-Task
- Run `pnpm typecheck` and `pnpm lint` before committing
- Build workspace deps first: `pnpm --filter @autoart/shared --filter @autoart/ui build`
