# Git & PR Procedures

## Stackit (Primary Tool)

This project uses **stackit** for stacked PR management. Always prefer stackit commands.

### Forbidden Commands

**NEVER use raw git commands for branch/commit operations.** Use stackit equivalents:

| Never Use | Use Instead |
|-----------|-------------|
| `git commit -m "..."` (new branch) | `stackit create -m "..."` |
| `git checkout -b` | `stackit create -m "..."` |
| `gh pr create` | `stackit submit` |
| `git rebase` | `stackit restack` |

**Exception:** `git commit` is allowed when adding commits to an **existing** stacked branch.

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
| Switch to branch | `stackit checkout <branch>` |
| Absorb fixes into correct commits | `stackit absorb` |
| Describe stack | `stackit describe -m "title"` |
| View stack info | `stackit info` / `stackit info --stack` |
| Flatten independent branches | `stackit flatten` |

### Skills (Preferred)

Use skills instead of manual commands when available:

| Skill | Purpose |
|-------|---------|
| `/stack-create` | Create stacked branch (handles staging + create) |
| `/stack-submit` | Submit PRs for the stack |
| `/stack-status` | Check stack health |
| `/stack-fix` | Diagnose and fix issues |
| `/stack-sync` | Sync with trunk, cleanup merged branches |
| `/stack-restack` | Rebase all branches in stack |
| `/stack-absorb` | Route working changes to correct commits |
| `/stack-merge` | Merge PRs from bottom up |
| `/stack-describe` | Add title/description to stack (AI-generated) |

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

**Critical:** `stackit create` requires staged changes. Without them, an empty branch is created.

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

**Run lint before merging.** This repo has no CI — lint locally before starting the merge loop:

```bash
stackit bottom --no-interactive
pnpm --filter @autoart/shared --filter @autoart/ui build   # Build workspace deps
pnpm typecheck                                              # Must pass
pnpm lint                                                   # Must pass
```

If either fails, fix the errors before merging. Use `/stack-fix` or `/stack-verify` to locate which branch introduced the failure.

#### The merge loop

This repo has no branch protection, so `stackit merge next` fails with "clean status" (automerge requires a gate). Use `gh pr merge` directly:

```bash
# 1. Merge the bottom-most unmerged PR
gh pr merge <PR-NUMBER> --merge

# 2. Wait ~5s for GitHub to retarget child PRs, then merge the next one
gh pr merge <NEXT-PR-NUMBER> --merge

# 3. Repeat until all PRs are merged
# Do NOT run `stackit sync` between merges — GitHub handles retargeting

# 4. After ALL PRs are merged, cleanup with stackit
stackit sync --no-interactive
```

**Never pass `--delete-branch`** — the repo's "Automatically delete head branches"
setting handles cleanup after child PRs are retargeted. Forcing early deletion
races against retargeting and can cascade-close child PRs.

#### If a PR won't merge

If `gh pr merge` fails (e.g., merge conflict after retarget):

1. **STOP.** Do not manually rebase, force push, or recreate PRs.
2. Wait a few seconds — GitHub may still be retargeting.
3. If it persists, the branch may need updating:
   ```bash
   gh pr merge <PR-NUMBER> --merge --admin   # Use admin override if you own the repo
   ```

#### Post-merge verification (REQUIRED)

After the merge loop completes, **verify content actually reached main**:

```bash
# Pull main and check that key files from the stack exist
git checkout main && git pull
# Spot-check: do files from the last PR in the stack exist?
git log --oneline -5   # Should show merge commits for each PR
```

**Why:** GitHub can mark stacked PRs as "MERGED" without their content reaching main.
This happens when merges fire faster than GitHub's retargeting (5-second gaps between
merges in a 10+ PR stack). The PRs close, the branches delete, but the merge commits
are orphaned — not ancestors of main. The only way to catch this is to verify on main
after the loop. If content is missing, the blobs survive in git's object store and can
be recovered with `git show <commit>:<path>`.

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

### Stack Descriptions

Add a title and description to a stack. Stored as stack-level metadata in `refs/stackit/stacks/` — persists across branch deletion and reparenting. Descriptions appear in `stackit info`, PR bodies, and consolidated PRs.

```bash
stackit describe                              # Opens editor
stackit describe -m "Auth Feature"            # Title only
stackit describe -m "Auth" -d "OAuth2 impl"   # Title + description
stackit describe --show                       # Display current
stackit describe --clear                      # Remove
```

For Claude, always use flags (`-m`, `-d`) — never the editor mode.

### Stack Info

Inspect branch relationships, PR status, and diffs.

```bash
stackit info                 # Current branch info
stackit info --stack         # All branches in the stack
stackit info --diff          # Diff vs parent branch
stackit info --stat          # Diffstat summary
stackit info --json          # JSON output (useful for scripting)
stackit info --body          # Include PR body
```

### Flatten

Re-parent independent branches closer to trunk. Useful after merging from the middle of a stack, or when chained branches don't actually depend on each other.

```bash
stackit flatten              # Flatten from current branch
stackit flatten --yes        # Skip confirmation
```

### Syncing and Restacking

```bash
stackit sync             # Pull main, cleanup merged branches, restack
stackit restack          # Rebase all branches in stack
```

**Note:** `stackit sync` also garbage-collects orphaned stack metadata (stacks where all branches have been merged or deleted).

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

### Parallel Stacks (Forks)

**Don't let parallel forks run long without merging.** When `stackit log` shows a fork (two branches sharing a parent), merge the shared base ASAP, then immediately handle the side fork before continuing up the main line.

```
  ◯ feat/main-work-3
  │
  ◯ feat/main-work-2      ← DON'T merge 10 PRs here while ignoring the fork
  │
  │  ◯ feat/side-work-2   ← This will diverge and conflict
  │  │
  │  ◯ feat/side-work-1
  │
  ├──┘
  ◯ feat/shared-base      ← Merge this, then IMMEDIATELY handle the fork
  │
  ◯ main
```

**If a side fork conflicts after main-line merges:**
- Close the conflicted PRs rather than fight cascading rebases
- Re-apply the changes on main with fresh commits
- Resolving 5+ conflict rounds wastes more time than starting fresh

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

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Prefixes:** `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

### Rules

- NEVER amend commits that have been pushed
- Create NEW commits for fixes, not `--amend`
- **Commit instruction file changes immediately.** Edits to `.claude/skills/`, `.claude/commands/`, `CLAUDE.md`, or any agent/skill configuration MUST be committed and pushed in the same turn they are written. These files are not code — they are session-volatile. If they aren't committed, they vanish when the session ends.

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

## Worktrees

Work on multiple stacks in parallel, each in its own directory.

### Quick Reference

| Command | Purpose |
|---------|---------|
| `stackit wt create <name>` | New worktree with fresh anchor branch |
| `stackit wt attach <branch>` | Move existing stack to a worktree |
| `stackit wt list` | List all managed worktrees |
| `stackit wt open <name>` | Navigate to a worktree |
| `stackit wt remove <name>` | Remove worktree and delete branches |
| `stackit wt detach <name>` | Remove worktree but keep branches |
| `stackit wt prune` | Clean up empty/stale worktrees |

`wt` is a short alias for `worktree`.

### When to Use

- **`wt create`** — Starting new work you want isolated from current checkout
- **`wt attach`** — Moving an in-progress stack out of the main repo

```bash
# Start isolated work
stackit wt create payments
stackit create -m "feat: payment API"
stackit create -m "feat: checkout UI"
stackit submit

# Move existing stack to worktree
stackit wt attach auth-refactor

# Finish: remove worktree, keep branches
stackit wt detach payments

# Finish: remove worktree AND branches
stackit wt remove payments
```

Worktrees are created in `../{repo}-stacks/` by default. Configure with:
```yaml
# .stackit.yaml
worktree:
  basePath: "../my-stacks"
  autoClean: true  # Auto-remove merged worktrees during sync
```

---

## Common Pitfalls

| Mistake | Fix |
|---------|-----|
| Forgetting to stage before `create` | Always `git add -A` before `stackit create` |
| Empty branch created | You forgot to stage — delete branch and retry |
| Using `git commit` for new branch | Use `stackit create` — it creates branch + commit together |
| Using `git checkout -b` | Use `stackit create` — branch name auto-generated |
| Manual rebase broke stack | Use `stackit restack` to safely rebase all children |
| Using `gh pr create` | Use `stackit submit` — it handles stacked PR dependencies |
| Amending wrong commit | Use `stackit absorb` to auto-route changes to correct commits |
| Stack out of sync after merge | Run `stackit sync` to cleanup and update trunk |
| `gh pr edit --base` throws Projects Classic error | Ignore the GraphQL error — the command still works. Verify with `gh pr view --json baseRefName` |
| Parallel fork diverged too far | Close conflicted PRs and re-apply changes on main. Don't fight cascading rebases |
| Migration file missing error | Database has migration your branch doesn't. Restore file or `DELETE FROM kysely_migration WHERE name = 'X'` |
| PRs show "MERGED" but content not on main | Rapid-fire stack merges can outrun GitHub retargeting. Always run post-merge verification. Recover with `git show <commit>:<path>` |

---

## Branch Hygiene

```bash
# Cleanup merged branches
stackit sync

# Manual cleanup if needed
git status           # Check for stale untracked files
git clean -fd        # Remove if needed
```
