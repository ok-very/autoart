---
description: Standard git procedures for branch management, file cleanup, and common operations
---

# Git Workflow Procedures

This workflow defines standard procedures to avoid common pitfalls like orphaned files, stale branches, and incomplete cleanups.

## CRITICAL: Stacked PRs for Multi-Phase Plans

**When executing a plan with multiple phases or breakpoints, you MUST use stacked PRs.**

This is NOT optional. Each phase/breakpoint in a plan = one stacked PR.

### Why This Matters
- Enables incremental review at each logical checkpoint
- Allows reverting individual phases without losing all work
- Makes progress visible and trackable
- Prevents monolithic PRs that are hard to review

### Procedure for Plan Execution

1. **At each plan breakpoint/phase completion:**
   ```bash
   # Commit current phase work
   git add <files>
   git commit -m "phase N: description"

   # Create stacked PR using the wizard
   pnpm git:stack
   ```

2. **Continue to next phase** on the new branch created by the wizard

3. **Result:** Each phase has its own PR targeting the previous phase's branch

### Example: 3-Phase Plan

```
Plan: "Reduce mypy errors from 195 to 50"
- Phase 1: Fix adapter files (195 → 150)
- Phase 2: Fix core modules (150 → 100)
- Phase 3: Fix remaining (100 → 50)

Execution:
main
 └── fix/mypy-phase-1 (PR #100 → main)
      └── fix/mypy-phase-2 (PR #101 → #100)
           └── fix/mypy-phase-3 (PR #102 → #101)
```

### Consequences of NOT Following This

- ❌ Single large PR is hard to review
- ❌ Can't checkpoint progress
- ❌ Can't partially merge/revert
- ❌ Loses logical separation of work

## After Switching Branches

When switching to a new branch or pulling changes that delete/rename files:

// turbo
1. Check for untracked files that may be stale:
```powershell
git status
```

2. If you see untracked files that should have been deleted:
```powershell
# Preview what would be removed (dry run)
git clean -n

# Remove untracked files (be careful!)
git clean -f

# Also remove untracked directories
git clean -fd
```

## After Refactoring/Reorganizing Files

When moving or deleting files during a refactor:

// turbo
1. Stage the deletion explicitly:
```powershell
git add -A
```

// turbo
2. Verify the deletions are staged:
```powershell
git status
```

// turbo
3. Commit with a clear message:
```powershell
git commit -m 'refactor: move DrawerRegistry to src/drawer'
```

4. Clean up any build artifacts:
```powershell
git clean -fd
```

## Before Starting Work on a Branch

// turbo
1. Fetch latest from remote:
```powershell
git fetch origin
```

// turbo
2. Checkout the branch (if it exists remotely):
```powershell
git checkout branch-name
```

// turbo
3. Clean up untracked files:
```powershell
git clean -fd
```

## Recovering from Duplicate File Issues

If files keep reappearing after being removed:

// turbo
1. Check if file is tracked:
```powershell
git ls-files | Select-String "FileName"
```

2. If tracked, remove and commit:
```powershell
git rm path/to/duplicate-file
git commit -m 'chore: remove duplicate file'
```

3. If untracked, just delete:
```powershell
git clean -f path/to/duplicate-file
```

## Common Gotchas

### File Deletions Not Taking Effect
- **Cause**: `git add .` was used but didn't stage deletions in parent directories
- **Fix**: Use `git add -A` which stages all changes including deletions

### Stale Files Reappearing
- **Cause**: Build artifacts or editor-generated files not in `.gitignore`
- **Fix**: Add to `.gitignore` and clean: `git clean -fd`

### Wrong Branch State After Switch
- **Cause**: Untracked files from previous branch persist
- **Fix**: `git clean -fd` after switching branches

---

## Branch Hygiene

### Delete Branches Immediately After Merging

Stale branches accumulate and cause confusion. Delete them right away:

```powershell
# When creating a PR, auto-delete after merge
gh pr create --delete-branch

# Or configure GitHub repo settings to auto-delete merged branches
```

### Use Consistent Branch Prefixes

Standard prefixes make auditing easier:

- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code restructuring
- `chore/` - Maintenance tasks

```powershell
# Easy to audit by type
git branch -r | Select-String 'origin/feature/'
```

### Rebase Feature Branches Regularly

If a feature branch sits for more than a few days, keep it current:

```powershell
git fetch origin
git rebase origin/main
```

This prevents branch drift where parallel implementations supersede your work.

### Periodic Branch Audit

Run weekly (or before starting new work):

```powershell
# Prune deleted remote branches
git fetch --prune

# Find local branches whose remote was deleted
git branch -vv | Select-String ': gone]'

# List branches merged into main (safe to delete)
git branch --merged main
```

**Shortcut**: Add this alias to your git config:

```powershell
git config --global alias.audit "!git fetch --prune && git branch -vv | grep ': gone]' && git branch --merged main"
```

Then just run `git audit` before starting new work.

### Keep PRs Small

- One logical change per PR
- Easier to review, less likely to be superseded
- Shorter-lived branches = fewer merge conflicts

### Checking Branch Status Before Deletion

Before deleting a branch, verify it's fully merged:

```powershell
# Check if branch has commits not in main
git log main..origin/branch-name --oneline

# If empty output, safe to delete
git push origin --delete branch-name
```

---

## Stacked PRs Workflow

Stacked PRs allow you to build features incrementally, with each PR targeting the previous one instead of main. This keeps PRs small and reviewable while maintaining a logical progression.

### When to Use Stacked PRs

- Feature requires multiple logical steps
- You want early review on foundational changes
- Breaking a large change into reviewable chunks

### Creating a Stacked PR

**Prerequisites:** Requires bash (Git Bash on Windows) and `gh` CLI authenticated.

// turbo
1. Complete and commit work on your current branch (this becomes the base)

2. Run the stack wizard:
```bash
pnpm git:stack
```

3. The wizard will:
   - Prompt for new branch name
   - Create branch from current HEAD
   - Push to origin
   - Prompt for PR title and body
   - Create PR targeting the current branch (not main)

### Example Stack

```
main
 └── fix/autohelper-adapters (PR #120 → main)
      └── upgrade/styling-hotzones (PR #119 → #120)
           └── feature/desk-workspace (PR #122 → #119)
                └── refactor/center-content (PR #121 → #122)
```

Each PR only shows its own changes, making review easier.

### Merging a Stack

Merge PRs in order from bottom to top:

```bash
# Merge all in order (merge commits, deletes branches)
pnpm git:merge-stack 120 119 122 121
```

Or merge individually:
```bash
gh pr merge 120 --merge --delete-branch
gh pr merge 119 --merge --delete-branch
# ... and so on
```

**Important:** Merge in order. Each PR's base branch must be merged first.

### Rebasing a Stack onto Updated Main

If main receives changes you need:

// turbo
1. Rebase the bottom branch onto main:
```bash
git checkout fix/autohelper-adapters
git fetch origin
git rebase origin/main
git push --force-with-lease
```

2. Rebase each subsequent branch onto its parent:
```bash
git checkout upgrade/styling-hotzones
git rebase fix/autohelper-adapters
git push --force-with-lease
```

3. Repeat up the stack.

### Collapsing a Stack (Squash All to Main)

If you want to merge all stacked changes as a single commit to main:

// turbo
1. Ensure the top branch has all changes:
```bash
git checkout refactor/center-content
git rebase origin/main
```

2. Close superseded PRs:
```bash
gh pr close 120 --comment "Superseded by #121"
gh pr close 119 --comment "Superseded by #121"
gh pr close 122 --comment "Superseded by #121"
```

3. Retarget and merge the top PR:
```bash
gh pr edit 121 --base main
gh pr merge 121 --squash --delete-branch
```

### Common Stack Issues

**Base branch has conflicts after parent merged:**
- GitHub auto-retargets PRs when their base is merged
- If conflicts appear, rebase locally and force-push

**Accidentally targeted main instead of parent:**
```bash
gh pr edit <number> --base correct-parent-branch
```

**Need to add commits to middle of stack:**
- Checkout that branch, commit, push
- Rebase all child branches onto updated parent
