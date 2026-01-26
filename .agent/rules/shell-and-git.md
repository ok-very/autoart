# Shell & Git

## Environment

- **Git Bash** for scripts (`scripts/git/*.sh`)
- Claude Code uses Bash tool (Git Bash on Windows)

## Commit Messages

```bash
# Simple
git commit -m 'feat: add feature'

# Multi-line
git commit -m "$(cat <<'EOF'
feat: title

- Detail one
- Detail two

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Prefixes:** `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

## gh CLI

```bash
# PRs
gh pr create --base main --title 'feat: description'
gh pr list
gh pr view 123
gh pr merge 123 --merge --delete-branch

# Issues
gh issue list
gh issue view 14
```

**PR with body:**
```bash
gh pr create --title "feat: name" --body "$(cat <<'EOF'
## Summary
- Change

Closes #N
EOF
)"
```

## Stacked PRs

```bash
pnpm git:stack              # Create stacked branch/PR
pnpm git:merge-stack 1 2 3  # Merge in order
```

See `git-procedures.md` for full workflow.
