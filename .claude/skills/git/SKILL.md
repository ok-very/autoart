---
name: git
description: Project-specific git conventions including commit format, Co-Authored-By requirements, branch naming, and legacy command deprecations. For stackit usage, see the stackit skill.
user-invocable: false
---

# Project Git Conventions

For stackit commands and workflows, see the **stackit** skill. This covers project-specific conventions only.

## Commit Message Format

```bash
# Simple
git commit -m 'feat: add feature'

# Multi-line with heredoc
git commit -m "$(cat <<'EOF'
feat: descriptive title

- Detail one
- Detail two

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Prefixes:** `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

Always include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` when Claude authors the commit.

## Fixing Review Comments

Commit and push normally. Do NOT rebase or force push.

```bash
stackit checkout <branch>
# make fixes
git add -A
git commit -m "fix: address review feedback"
git push
stackit submit
```

## Manual Branch Naming

Stackit auto-generates branch names, but manual branches use:

- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code restructuring
- `docs/` - Documentation

## Legacy Commands (Deprecated)

| Deprecated | Use Instead |
|------------|-------------|
| `pnpm git:stack` | `stackit create -m "msg"` |
| `pnpm git:merge-stack 100 101` | `stackit merge next` (repeat for each) |
