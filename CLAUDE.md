# AutoArt Project Instructions

This is the AutoArt Process Management System - a monorepo with frontend, backend, shared packages, and Python microservices.

## Project Structure

- `frontend/` - React + Vite frontend
- `backend/` - Fastify + TypeScript backend
- `shared/` - Shared TypeScript schemas and utilities
- `apps/autohelper/` - Python desktop app with web scraping and automation
- `apps/mail/` - Email service

## Rules

@.agent/rules/architecture.md
@.agent/rules/component-conventions.md
@.agent/rules/git-procedures.md
@.agent/rules/nomenclature.md
@.agent/rules/pnpm-catalog.md
@.agent/rules/shell-and-git.md

## Common Commands

```bash
pnpm dev              # Start all services
pnpm build            # Build shared + backend
pnpm git:stack        # Create stacked PR
pnpm git:merge-stack  # Merge PR stack in order
```
