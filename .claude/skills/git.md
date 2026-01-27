# Git & PR Procedures

## CRITICAL MERGE COMMAND

```bash
gh pr merge <number> --merge --delete-branch
```

**NEVER use `--squash`** - it breaks stacked PRs and orphans child branch commits.

---

## Stacked PRs

### Creating a Stack

```bash
# After completing phase work:
git commit -m "phase N: description"
pnpm git:stack  # Creates branch + PR targeting current branch
```

Result:
```
main
 └── fix/phase-1 (PR #100 → main)
      └── fix/phase-2 (PR #101 → #100)
```

### Merging a Stack

**USE THE HELPER:**
```bash
pnpm git:merge-stack 100 101 102
```

Or manually (bottom-up):
```bash
gh pr merge 100 --merge --delete-branch
# Wait for GitHub to auto-retarget #101 to main
gh pr merge 101 --merge --delete-branch
```

### Stack Rules

- If child PR shows "not mergeable" after parent merges, WAIT - GitHub is retargeting
- NEVER manually rebase to "fix" merge conflicts
- NEVER force push stacked branches
- NEVER retarget all PRs to main before merging
- NEVER amend pushed commits in a stack

### Fixing Review Comments

**Just commit and push normally. Do NOT rebase or force push.**

```bash
git checkout branch-for-100
# make fixes
git commit -m "fix: address review feedback"
git push  # normal push, not --force
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

- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code restructuring
- `docs/` - Documentation

---

## PR Creation

```bash
gh pr create --base main --title 'feat: description' --body "$(cat <<'EOF'
## Summary
- Change description

Closes #N
EOF
)"
```

**Issue keywords:**
- Auto-close: `Closes`, `Fixes`, `Resolves`
- Link only: `Refs`, `Part of`, `Addresses`

---

## Branch Hygiene

```bash
# After switching branches
git status           # Check for stale untracked files
git clean -fd        # Remove if needed

# Before deleting a branch
git log main..origin/branch-name --oneline
# If empty, safe to delete
```
