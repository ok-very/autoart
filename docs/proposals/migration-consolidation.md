# Migration Consolidation Proposal

**Status:** Draft  
**Date:** 2026-02-04

## Problem

The migration folder has accumulated 50 files with:
- Gap numbering (missing 013, 015, 017, 018, 022, 037)
- Stub migrations (036 creates nothing, 049 drops what 036 didn't create)
- Patch-style migrations (add column here, rename there)
- Create-then-drop patterns (036 → 049)

This makes fresh installs fragile and the migration history hard to reason about.

## Current State

| Category | Count | Examples |
|----------|-------|----------|
| Core schema | ~15 | 001-010 (extensions, users, hierarchy, records) |
| Stubs/no-ops | 1 | 036 (empty) |
| Create-then-drop | 2 | 036 + 049 (action_type_definitions) |
| Renames/fixes | ~8 | 026, 035, 044, 047 |
| Feature additions | ~25 | actions, events, imports, mail, polls, etc. |

## Proposal: Single Baseline + Clean Slate

### Phase 1: Generate Current Schema Snapshot

1. Dump current schema to SQL: `pg_dump --schema-only`
2. Convert to Kysely migration as `001_baseline.ts`
3. Include all tables, indexes, constraints, enums, functions

### Phase 2: Create New Migration Folder

```
migrations/
├── 001_baseline.ts        # Full schema as of 2026-02-04
├── 002_seed_definitions.ts # System definitions (Task, Subtask, etc.)
└── (future migrations here)
```

### Phase 3: Archive Old Migrations

```
migrations_archive/
├── _README.md             # "Historical only, do not run"
└── (all 50 old files)
```

### Phase 4: Update Tooling

1. `db:nuke` already drops schema — works as-is
2. `db:rebuild` runs nuke → migrate → seed — works as-is
3. Add `db:snapshot` script to regenerate baseline from live DB

## Migration Strategy for Existing Deployments

**Option A: Force nuke (dev/staging only)**
- Nuke and remigrate with new baseline
- Loses all data

**Option B: Mark baseline as already-run (production)**
- Insert baseline into `kysely_migration` table without running
- Future migrations apply normally

```sql
INSERT INTO kysely_migration (name, timestamp)
VALUES ('001_baseline', NOW())
ON CONFLICT DO NOTHING;
```

## Baseline Structure

The `001_baseline.ts` would contain:

```typescript
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Extensions
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);
  
  // 2. Enums (if any)
  
  // 3. Tables in dependency order:
  //    users → hierarchy_nodes → records → actions → events → ...
  
  // 4. Indexes
  
  // 5. Functions
}
```

## Tables to Include (current schema)

| Domain | Tables |
|--------|--------|
| Core | users, sessions |
| Hierarchy | hierarchy_nodes, workflow_surface_nodes, project_members |
| Records | record_definitions, records, record_links, record_aliases |
| Actions | actions, action_references |
| Events | events |
| Imports | import_sessions, external_source_mappings |
| Exports | export_sessions |
| Intake | intake_forms, intake_pages, intake_blocks |
| Polls | polls, poll_responses |
| Mail | mail_messages, mail_links |
| Engagements | engagements |
| AutoHelper | autohelper_instances |

## Benefits

1. **Fresh installs run 2 migrations instead of 50**
2. **No more stub/no-op cruft**
3. **Clear point-in-time schema documentation**
4. **Easier to reason about current state**

## Risks

1. **Existing deployments need manual intervention** (Option B above)
2. **Lose granular rollback history** (acceptable — we don't rollback in prod)
3. **One-time effort** (~2-4 hours)

## Verification Pass

After baseline is written, perform a diff review:

### Schema Comparison

```bash
# 1. Dump schema from current DB (built with old migrations)
pg_dump --schema-only -f schema_old.sql

# 2. Nuke and rebuild with new baseline only
pnpm db:nuke --force && pnpm migrate

# 3. Dump schema from new baseline
pg_dump --schema-only -f schema_new.sql

# 4. Diff — should be empty or cosmetic only
diff schema_old.sql schema_new.sql
```

### Checklist

- [ ] All tables present in new schema
- [ ] All columns match (name, type, nullability, defaults)
- [ ] All constraints preserved (PK, FK, UNIQUE, CHECK)
- [ ] All indexes present (unique + non-unique)
- [ ] All functions/triggers present
- [ ] Enums match
- [ ] Seed data migrations accounted for (002_seed_definitions.ts)

### Known Acceptable Differences

- Constraint/index names may differ (auto-generated vs explicit)
- Column order within tables may differ
- Comments may be missing

### Failure Recovery

If diff reveals missing schema elements:
1. Do NOT delete old migrations yet
2. Add missing elements to baseline
3. Re-run verification
4. Only archive old migrations after clean diff

## Next Steps

- [ ] Review and approve approach
- [ ] Generate schema dump from current DB
- [ ] Write 001_baseline.ts
- [ ] Write 002_seed_definitions.ts (system record definitions)
- [ ] **Run verification pass (schema diff)**
- [ ] Test on fresh nuke + migrate + seed
- [ ] Archive old migrations
- [ ] Update CLAUDE.md with new migration workflow
