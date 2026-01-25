# AutoArt Project Instructions

This is the AutoArt Process Management System - a monorepo with frontend, backend, shared packages, and Python microservices.

## Primary Reference

@.AGENT.md

## Rules

@.agent/rules/architecture.md
@.agent/rules/component-conventions.md
@.agent/rules/git-procedures.md
@.agent/rules/nomenclature.md
@.agent/rules/pnpm-catalog.md
@.agent/rules/shell-and-git.md

## Quick Reference

### Project Structure
- `frontend/` - React + Vite (Dashboard + Intake builds)
- `backend/` - Fastify + TypeScript API
- `shared/` - Shared schemas and utilities (@autoart/shared)
- `apps/autohelper/` - Python desktop app (web scraping, automation)
- `apps/mail/` - Email service (@autoart/mail)

### Common Commands
```bash
pnpm dev              # Start all services
pnpm build            # Build shared + backend
pnpm git:stack        # Create stacked PR
pnpm git:merge-stack  # Merge PR stack in order
```

### Key Principles
- Do NOT use Mantine - use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`
- Enforce schema validation with Zod in `shared/`
- Use soft-intrinsic type derivation (derive types from relationships, not explicit checks)
- All mutations go through Actions which produce Events
