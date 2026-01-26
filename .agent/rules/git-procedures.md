# Git Workflow Procedures

## ⛔ MERGE COMMAND - MEMORIZE THIS

```bash
gh pr merge <number> --merge --delete-branch
```

**NEVER use `--squash`.** This breaks stacked PRs and causes merge hell.

---

## Stacked PRs

### When to Use
- Multi-phase plans (each phase = one PR)
- Features requiring incremental review

### Creating a Stack
```bash
# Complete phase work, commit, then:
pnpm git:stack  # Creates branch + PR targeting current branch
```

Result:
```
main
 └── fix/phase-1 (PR #100 → main)
      └── fix/phase-2 (PR #101 → #100)
           └── fix/phase-3 (PR #102 → #101)
```

### Fixing Review Comments

**DO NOT rebase. DO NOT force push. Just commit and push normally.**

```bash
git checkout branch-for-100
# make fixes
git commit -m "fix: address review feedback"
git push  # normal push
```

Do NOT merge fixes into child branches - leave them alone.

### Merging a Stack

**CRITICAL: Use `--merge`, not `--squash`**

Squash merges break stacked PRs because they replace commit SHAs, causing child branches to have "orphaned" commits that conflict with main.

```bash
# Merge bottom-up with regular merge
gh pr merge 100 --merge --delete-branch
# Wait for GitHub to auto-retarget #101 to main
gh pr merge 101 --merge --delete-branch
gh pr merge 102 --merge --delete-branch
```

Or use the helper:
```bash
pnpm git:merge-stack 100 101 102
```

### If You Must Squash

If squash is required, you must rebase each child after merging its parent:

```bash
gh pr merge 100 --squash --delete-branch

# Now rebase #101 onto main (its commits are orphaned)
git checkout branch-for-101
git fetch origin
git rebase origin/main  # Skip "already applied" commits
git push --force-with-lease

# Repeat for each child up the stack
```

This is messy - prefer `--merge` for stacks.

---

## Branch Hygiene

### Naming
- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code restructuring
- `docs/` - Documentation

### After Switching Branches
```bash
git status           # Check for stale untracked files
git clean -fd        # Remove if needed
```

### Before Deleting a Branch
```bash
git log main..origin/branch-name --oneline
# If empty, safe to delete
```

---

## PR Requirements

### Link to Issues
```bash
gh pr create --title "feat: add feature" --body "Closes #87"
```

Keywords that auto-close: `Closes`, `Fixes`, `Resolves`
Keywords that link only: `Refs`, `Part of`, `Addresses`

### Commit Messages
```bash
git commit -m "$(cat <<'EOF'
feat: descriptive title

- Detail one
- Detail two

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|--------------|-----|
| `--squash` on stacked PRs | Orphans child branch commits | Use `--merge` |
| Rebasing to fix review comments | Forces divergence, requires force-push | Just commit + push |
| Merging parent fixes into children | Unnecessary, creates merge commits | Leave children alone |
| Force-pushing base of a stack | Invalidates/closes dependent PRs | Don't do it |
| `git add .` for deletions | May miss deletions in parent dirs | Use `git add -A` |
