---
description: Shell environment, git commit formatting, and gh CLI usage rules
---

# Shell Environment & Git Commands

## Shell Environment

This project runs on **Windows** with access to:
- **Git Bash** - For bash scripts (`scripts/git/*.sh`)
- **PowerShell** - For Windows-native scripts (`scripts/*.ps1`)

Claude Code uses the `Bash` tool which runs in Git Bash on Windows.

## Git Commit Messages

Use heredoc format for clean multi-line commits:

```bash
git commit -m "$(cat <<'EOF'
feat: descriptive title here

- Detail one
- Detail two

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**For simple commits:**
```bash
git commit -m 'feat: add new feature'
```

**Conventional commit prefixes:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code restructuring
- `chore:` - Maintenance

## gh CLI Usage

### Creating Pull Requests

**Simple PR:**
```bash
gh pr create --base main --title 'feat: short description'
```

**Full PR with body:**
```bash
gh pr create --title "feat: feature name" --body "$(cat <<'EOF'
## Summary
- Change one
- Change two

## Test plan
- [ ] Verify X works

Generated with Claude Code
EOF
)"
```

### Common Commands
```bash
gh pr list                    # List open PRs
gh pr view 123                # View PR details
gh pr merge 123 --squash      # Squash merge
gh pr close 123 --comment "Superseded by #124"
gh issue list                 # List issues
gh issue view 14              # View issue
```

## Stacked PRs

Use the project's stack helpers:

```bash
pnpm git:stack                # Create new stacked branch/PR
pnpm git:merge-stack 1 2 3    # Merge PRs in order
```

See `@.agent/rules/git-procedures.md` for full workflow.
