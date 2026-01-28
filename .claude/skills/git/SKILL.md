---
name: git
description: Git and PR procedures using stackit workflow for stacked branches. Use when working with commits, branches, PRs, merging, or stack management.
user-invocable: false
---

# Git & PR Procedures

## Stackit (Primary Tool)

This project uses **stackit** for stacked PR management. Always prefer stackit commands.

### Quick Reference

| Task | Command |
|------|---------|
| Create stacked branch | `stackit create -m "feat: description"` |
| View stack | `stackit log` |
| Submit PRs | `stackit submit` |
| Sync with main | `stackit sync` |
| Rebase children | `stackit restack` |
| Merge bottom PR | `stackit merge next` |
| Navigate up/down | `stackit up` / `stackit down` |

### Creating a Stack

```bash
# Stage your changes first (required!)
git add -A

# Create stacked branch with commit message
stackit create -m "feat: add feature"

# Continue working, stage more changes
git add -A
stackit create -m "feat: add tests"

# View the stack
stackit log
```

Result:
```
● feat/add-tests ← you are here
│
◯ feat/add-feature
│
main
```

### Submitting PRs

```bash
stackit submit           # Submit current branch
stackit submit --stack   # Submit entire stack (alias: ss)
```

### Merging a Stack

```bash
stackit merge next       # Merge bottom unmerged PR, then restack
stackit merge squash     # Consolidate stack into single PR and merge
stackit merge            # Interactive wizard
```

### Syncing and Restacking

```bash
stackit sync             # Pull main, cleanup merged branches, restack
stackit restack          # Rebase all branches in stack
```

---

## CRITICAL MERGE RULES

```bash
# Via stackit (preferred)
stackit merge next

# Manual (if needed)
gh pr merge <number> --merge --delete-branch
```

**NEVER use `--squash`** - it breaks stacked PRs and orphans child branch commits.

---

## Stack Safety Rules

- If child PR shows "not mergeable" after parent merges, WAIT - GitHub is retargeting
- NEVER manually rebase to "fix" merge conflicts - use `stackit restack`
- NEVER force push stacked branches
- NEVER retarget all PRs to main before merging
- NEVER amend pushed commits in a stack

### Fixing Review Comments

**Just commit and push normally. Do NOT rebase or force push.**

```bash
stackit checkout <branch>
# make fixes
git add -A
git commit -m "fix: address review feedback"
git push  # normal push, not --force
stackit submit  # update PR
```

---

## Commits

### Message Format

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

### Rules

- NEVER amend commits that have been pushed
- Create NEW commits for fixes, not `--amend`

---

## Branch Naming

Stackit auto-generates branch names, but manual branches use:

- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code restructuring
- `docs/` - Documentation

---

## Legacy Commands (Deprecated)

These are deprecated in favor of stackit:

| Deprecated | Use Instead |
|------------|-------------|
| `pnpm git:stack` | `stackit create -m "msg"` |
| `pnpm git:merge-stack 100 101` | `stackit merge next` (repeat for each) |

---

## Branch Hygiene

```bash
# Cleanup merged branches
stackit sync

# Manual cleanup if needed
git status           # Check for stale untracked files
git clean -fd        # Remove if needed
```
