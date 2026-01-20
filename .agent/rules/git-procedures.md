---
description: Standard git procedures for branch management, file cleanup, and common operations
---

# Git Workflow Procedures

This workflow defines standard procedures to avoid common pitfalls like orphaned files, stale branches, and incomplete cleanups.

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
