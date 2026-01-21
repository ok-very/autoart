---
description: PowerShell shell environment, git commit formatting, and gh CLI usage rules
---

# Shell Environment & Git Commands

## PowerShell Basics
- This project runs on **Windows PowerShell**
- Do NOT use `&&` to chain commands (use `;` instead)
- Commands are executed via the `run_command` tool

## Git Commit Messages

**CRITICAL Escaping Rules:**
1. **Use single quotes** around commit messages
2. **Keep messages on ONE LINE** - no newlines
3. **Do NOT use double quotes** inside single quotes
4. **Avoid special characters** like `[`, `]`, `(`, `)` if possible

```powershell
# ✅ CORRECT
git commit -m 'feat: add new feature'

# ❌ WRONG - Double quotes cause issues
git commit -m "feat: add feature"

# ❌ WRONG - Special characters
git commit -m 'feat: Owner -> Assignee (Issue #14)'

# ✅ CORRECT - Use simpler wording
git commit -m 'feat: rename Owner to Assignee for issue 14'
```

**For complex messages, use a file:**
```powershell
@'
feat: nomenclature alignment

- Change Owner to Assignee
- Closes #14
'@ | Out-File -FilePath commit.txt -Encoding utf8
git commit -F commit.txt
Remove-Item commit.txt
```

## gh CLI Usage

### CRITICAL: gh is a TERMINAL COMMAND
- `gh` commands are **TERMINAL COMMANDS** executed via `run_command` tool
- **NEVER** use `gh` commands with `browser_subagent` or any browser tools
- Error `'...is not a valid selector'` means you tried to use a shell command as a browser selector

### Creating Pull Requests
```powershell
# Simple PR
gh pr create --base main --title 'feat: short description'

# Full PR (use temp file for body)
@'
Closes #14

## Changes
- Update README
'@ | Out-File -FilePath pr-body.txt -Encoding utf8
gh pr create --title 'feat: update' --body-file pr-body.txt --base main
Remove-Item pr-body.txt
```

### Best Practices
- ✅ Use `--body-file` for non-trivial PR descriptions
- ✅ Keep `--title` short (50 chars or less)
- ✅ Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- ❌ Avoid inline `--body` with special characters
