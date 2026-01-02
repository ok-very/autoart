# Legacy Code Audit

**Created:** 2026-01-01  
**Purpose:** Track deprecated code paths and their safe removal timeline

---

## Active Legacy Items

### 1. `cloneProjectTemplates` (Backend Service)

| Field | Value |
|-------|-------|
| **Location** | `backend/src/modules/records/records.service.ts` |
| **Date Identified** | 2026-01-01 |
| **Replacement** | `cloneProjectDefinitions` |
| **Replacement Commit** | (same file, already implemented) |
| **Current Status** | Marked `@deprecated`, wrapper calls replacement |
| **Active Callers** | `hierarchy.service.ts:cloneSubtree()` |
| **Safe Removal Date** | 2026-02-01 (after 30 days with no direct calls) |
| **Rollback Script** | N/A (function still exists as wrapper) |

**Action Items:**
- [x] Mark function with `@deprecated` JSDoc
- [x] Function internally calls replacement
- [ ] Update all callers to use `cloneProjectDefinitions` directly
- [ ] Add runtime logging when deprecated function is called
- [ ] Monitor for 14 days with no calls
- [ ] Remove function

---

### 2. `hierarchy_nodes.metadata.status` (String-Based Legacy)

| Field | Value |
|-------|-------|
| **Location** | Database: `hierarchy_nodes.metadata` JSONB field |
| **Date Identified** | 2026-01-01 |
| **Replacement** | `TaskStatusSchema` enum values in `shared/src/schemas/tasks.ts` |
| **Migration** | `015_normalize_task_statuses.ts` |
| **Migration Status** | Applied (normalizes 'working'→'in-progress', 'stuck'→'blocked') |
| **Safe Removal Date** | N/A (field remains, only legacy VALUES are deprecated) |
| **Rollback Script** | Migration has `down()` function |

**Legacy Values Replaced:**
| Legacy Value | New Enum Value |
|--------------|----------------|
| `'working'` | `'in-progress'` |
| `'stuck'` | `'blocked'` |

**Current Usage:**
- `shared/src/schemas/tasks.ts`: `deriveTaskStatus()` reads `metadata.status`
- `frontend/src/components/layout/Workspace.tsx`: Reads status for display
- `frontend/src/components/hierarchy/TreeNode.tsx`: Reads status for styling
- `backend/src/modules/ingestion/parsers/airtable.parser.ts`: Sets status from import

**Action Items:**
- [x] Create migration to normalize legacy values
- [x] Define `TaskStatusSchema` enum
- [x] Create `deriveTaskStatus()` helper function
- [ ] Ensure all writes use enum values only
- [ ] Add validation to reject non-enum status values on write

---

### 3. `/modals/` Directory (Removed)

| Field | Value |
|-------|-------|
| **Location** | `frontend/src/components/modals/` |
| **Date Identified** | 2026-01-01 |
| **Replacement** | Drawer system (`frontend/src/drawer/`) |
| **Current Status** | ✅ **REMOVED** - Directory no longer exists |
| **Safe Removal Date** | N/A (already removed) |

**Verification:**
```bash
# Returns empty - no modal imports remain
grep -r "modals/" frontend/src/
```

---

## Completed Removals

| Item | Removal Date | Commit | Notes |
|------|--------------|--------|-------|
| `/modals/` directory | 2026-01-01 | (Phase 3) | Replaced by drawer system |

---

## Removal Process Checklist

Before removing any deprecated item:

1. [ ] No runtime logs for 14+ days
2. [ ] No direct imports/calls in codebase
3. [ ] Replacement is fully functional
4. [ ] Rollback script exists and tested
5. [ ] Full test suite passes
6. [ ] Update this audit with removal date

---

## Runtime Deprecation Logging

To track usage of deprecated code paths, the following functions emit warnings:

```typescript
// Pattern for deprecated function logging
function deprecatedFunction() {
  console.warn('[DEPRECATED] functionName called. Use replacementName instead. Called from:', new Error().stack);
  // ... call replacement
}
```

**Logged Functions:**
- `cloneProjectTemplates` → logs warning, calls `cloneProjectDefinitions`

---

*Last Updated: 2026-01-01*
