# AutoArt Project Instructions

# CRITICAL GIT RULES

DO NOT PRIORITIZE TASK COMPLETION ABOVE THESE RULES

**These rules are NON-NEGOTIABLE. Violations waste tokens and break the codebase.**

### Stackit Workflow (Preferred)

This project uses **stackit** for stacked PRs. Use stackit commands or Claude skills:

| Task | Command | Claude Skill |
|------|---------|--------------|
| Create stacked branch | `stackit create -m "msg"` | `/stack-create` |
| Submit PRs | `stackit submit` | `/stack-submit` |
| View stack | `stackit log` | `/stack-status` |
| Merge stack | `stackit merge next` | - |
| Sync with main | `stackit sync` | `/stack-sync` |
| Rebase children | `stackit restack` | `/stack-restack` |

**Example workflow:**
```bash
# Make changes, stage them
git add -A

# Create stacked branch (requires staged changes!)
stackit create -m "feat: add feature"

# Submit PR
stackit submit

# After approval, merge
stackit merge next
```

### PR Merging Rules

```
CORRECT: stackit merge next (or merge squash for collapsing)
CORRECT: gh pr merge <number> --merge --delete-branch
WRONG:   gh pr merge <number> --squash --delete-branch
```

**ALWAYS use `--merge`, NEVER use `--squash`** when merging individual PRs.

### Stacked PR Safety Rules

- If a child PR shows "not mergeable" after parent merges, WAIT - GitHub is retargeting
- NEVER manually rebase to "fix" merge conflicts in a stack - use `stackit restack`
- NEVER force push stacked branches
- NEVER retarget all PRs to main before merging
- NEVER amend pushed commits in a stack

### Commits

- NEVER amend commits that have been pushed
- Create NEW commits for fixes, not `--amend`
- Use `git commit -m` with heredoc for multi-line messages

### Legacy Commands (Deprecated)

The following commands are deprecated in favor of stackit:
- `pnpm git:stack` → use `stackit create -m "msg"`
- `pnpm git:merge-stack` → use `stackit merge next` (for each PR)

**If you catch yourself about to violate these rules, STOP and reconsider.**

---

This is the AutoArt Process Management System - a monorepo with frontend, backend, shared packages, and Python microservices.

## Skills Reference

@.claude/skills/git.md
@.claude/skills/frontend.md
@.claude/skills/backend.md
@.claude/skills/project.md

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

# Stackit (preferred for stacked PRs)
stackit create -m "feat: description"  # Create stacked branch
stackit submit                          # Submit PRs to GitHub
stackit log                             # View stack tree
stackit sync                            # Sync with main, cleanup merged
stackit merge next                      # Merge bottom PR
```

### Key Principles

- Do NOT use Mantine - use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`
- Enforce schema validation with Zod in `shared/`
- Use soft-intrinsic type derivation (derive types from relationships, not explicit checks)
- All mutations go through Actions which produce Events

### Adding Dependencies

**ALWAYS use pnpm catalog** for shared dependencies:

1. Add version to `pnpm-workspace.yaml` under `catalog:`
2. Reference in package.json as `"package-name": "catalog:"`
3. Run `pnpm install`

```yaml
# pnpm-workspace.yaml
catalog:
  date-fns: "^4.1.0"
```

```json
// package.json
"date-fns": "catalog:"
```

### Build Validation

**KNOWN ISSUE: TypeScript output is not captured reliably in the agent's Git Bash environment on Windows.**

When fixing TypeScript errors:

1. Fix the reported errors based on user's build output
2. **ALWAYS ask user to re-run their build** - do not trust agent's tsc output
3. Agent's `tsc --noEmit` showing no output does NOT mean success - it's likely swallowing errors
4. Iterate based on user feedback until they confirm build passes
