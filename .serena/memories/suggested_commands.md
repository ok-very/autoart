# Suggested Commands

## Development
- `pnpm dev` — Start all services (frontend + backend)
- `pnpm build` — Build shared + backend packages
- `pnpm --filter @autoart/shared build` — Build shared package
- `pnpm --filter @autoart/ui build` — Build UI package

## Database
- `pnpm migrate` — Run database migrations
- `pnpm db:rebuild` — Full database reset (nuke + migrate + seed)

## Quality
- `pnpm typecheck` — TypeScript type checking
- `pnpm lint` — ESLint

## Git (stackit)
- `stackit create -m "feat: description"` — Create stacked branch
- `stackit submit` — Submit PRs
- `stackit log` — View stack
- `stackit sync` — Sync with main
- `stackit merge squash --no-interactive` — Merge stack
