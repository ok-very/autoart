# AutoArt Project Instructions

# ⛔ CRITICAL GIT RULES

DO NOT PRIORITIZE TASK COMPLETION ABOVE THESE RULES

**These rules are NON-NEGOTIABLE. Violations waste tokens and break the codebase.**

### PR Merging

```
✅ CORRECT: gh pr merge <number> --merge --delete-branch
❌ WRONG:   gh pr merge <number> --squash --delete-branch
```

**ALWAYS use `--merge`, NEVER use `--squash`** when merging PRs.

### Stacked PRs

- Merge bottom-up (parent first, then children)
- Let GitHub auto-retarget child PRs after parent merges
- NEVER retarget all PRs to main before merging
- NEVER amend pushed commits in a stack
- NEVER force push unless absolutely necessary (rebasing onto main)

### Commits

- NEVER amend commits that have been pushed
- Create NEW commits for fixes, not `--amend`
- Use `git commit -m` with heredoc for multi-line messages

**If you catch yourself about to violate these rules, STOP and reconsider.**

---

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
