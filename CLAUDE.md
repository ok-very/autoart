# AutoArt

Process management system — monorepo with frontend (React+Vite), backend (Fastify), shared packages, and Python microservices.

## Commands

- `pnpm dev` — start all services
- `pnpm build` — build shared + backend
- `pnpm migrate` — run DB migrations
- `pnpm db:rebuild` — nuke + migrate + seed
- `stackit create -m "feat: description"` — create stacked branch
- `stackit submit` — submit PRs
- `stackit merge next` — merge bottom PR

## Key Rules

- NO Mantine — use atoms/molecules from `ui/atoms/` and `ui/molecules/`
- ALWAYS use `pnpm catalog` for shared dependencies (add to `pnpm-workspace.yaml` catalog, reference as `"catalog:"`)
- All mutations go through Actions which produce Events
- Derive types from relationships, not explicit checks (soft-intrinsic type derivation)
- Enforce Zod schema validation in `shared/`

## Build Validation

KNOWN ISSUE: TypeScript output is not captured reliably in the agent's environment.

1. Fix errors based on user's build output
2. ALWAYS ask user to re-run their build — do not trust agent's tsc output
3. Iterate based on user feedback
