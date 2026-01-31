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

### Merging a Stack — Step by Step

**Always merge from the bottom up, one PR at a time.**

#### Pre-merge checklist

```bash
stackit sync                 # Pull main, cleanup any already-merged branches
stackit log                  # Confirm stack order and PR numbers
```

Verify all PRs are approved and CI is passing before starting.

#### The merge loop

```bash
# 1. Merge the bottom-most unmerged PR
stackit merge next --no-interactive

# 2. Sync to pull the merge, cleanup the merged branch, restack remaining
stackit sync --no-interactive

# 3. Check what remains
stackit log --no-interactive

# 4. Repeat steps 1-3 until all PRs are merged
```

#### When `stackit merge next` errors

If stackit errors (e.g., "Pull request is in clean status", automerge failures):

1. **STOP.** Do not manually rebase, force push, or recreate PRs.
2. Try with `--force` flag: `stackit merge next --force --no-interactive`
3. If that still fails, merge that single PR manually:
   ```bash
   gh pr merge <PR-NUMBER> --merge
   ```
   **Never pass `--delete-branch`** — the repo's "Automatically delete head branches"
   setting handles cleanup after child PRs are retargeted. Forcing early deletion
   races against retargeting and can cascade-close child PRs.

> **Do NOT run `stackit sync` between sequential manual merges.**
> GitHub retargets child PRs automatically after a base branch merges.
> Wait until the next PR's base branch has updated, then merge it the same way.
> Run `stackit sync` once after all PRs are merged.

4. **After all PRs are merged, return to stackit** for cleanup:
   ```bash
   stackit sync --no-interactive     # Pull main, cleanup merged branches
   ```

**NEVER** do any of the following as "recovery":
- `git rebase --onto` to manually rebase branches
- `git push --force` or `--force-with-lease` on stacked branches
- `gh pr edit --base` to retarget PRs to main
- `gh pr merge --delete-branch` — forces early branch deletion, races against retarget
- Close and recreate PRs

These destroy stackit's internal tracking and cascade into more breakage.

#### Other merge modes

```bash
stackit merge squash     # Consolidate stack into single PR and merge
stackit merge            # Interactive wizard
```

#### Useful flags

| Flag | Purpose |
|------|---------|
| `--dry-run` | Show merge plan without executing |
| `--force` | Skip validation (draft PRs, failing CI) |
| `--wait` | Wait for merge to complete (vs fire-and-forget) |
| `--no-interactive` | Non-interactive mode (required for Claude) |

### Syncing and Restacking

```bash
stackit sync             # Pull main, cleanup merged branches, restack
stackit restack          # Rebase all branches in stack
```

---

## CRITICAL MERGE RULES

```bash
# Via stackit (preferred)
stackit merge next --no-interactive

# Manual fallback for a SINGLE PR only (then immediately `stackit sync`)
gh pr merge <number> --merge
```

**NEVER use `--squash`** — it breaks stacked PRs and orphans child branch commits.

---

## Stack Safety Rules

- If child PR shows "not mergeable" after parent merges, WAIT — GitHub is retargeting
- NEVER manually rebase to "fix" merge conflicts — use `stackit restack`
- NEVER force push stacked branches
- NEVER retarget PRs to main before merging
- NEVER amend pushed commits in a stack
- NEVER close and recreate PRs to "fix" stack state — use `stackit sync`

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
