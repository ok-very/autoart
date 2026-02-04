# Archived Migrations

**DO NOT RUN THESE MIGRATIONS.**

These 50 incremental migrations were consolidated into a single baseline migration on 2026-02-04.

The active migrations are in `../migrations/`.

## Why archived?

1. **Gap numbering** - Missing 013, 015, 017, 018, 022, 037
2. **Stub migrations** - 036 was emptied after 049 dropped its table
3. **Create-then-drop patterns** - 036 + 049 (action_type_definitions)
4. **Patch-style migrations** - Renames, fixes, column additions scattered across files

## If you need to reference old logic

The original migration logic is preserved here for reference. Do not attempt to run them against a database that was created with the consolidated baseline.

## Consolidated baseline

See `../migrations/001_baseline.ts` for the single migration that replaces all of these.
