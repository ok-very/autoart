# Legacy Code Audit

**Created:** 2026-01-01  
**Purpose:** Track deprecated code paths and their safe removal timeline

---

## Active Legacy Items

### 1. `hierarchy_nodes.metadata.status` (String-Based Legacy)

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

## Completed Removals

| Item | Removal Date | Commit | Notes |
|------|--------------|--------|-------|
| `/modals/` directory | 2026-01-01 | (Phase 3) | Replaced by drawer system |
| `TaskDataTable.tsx` | 2026-01-01 | - | Replaced by DataTableHierarchy |
| `RecordDataTable.tsx` | 2026-01-01 | - | Replaced by DataTableFlat |
| `IngestionDrawer.tsx` | 2026-01-01 | - | Replaced by Ingest view mode on Records page |
| `cloneProjectTemplates` | 2026-01-01 | - | Replaced by cloneProjectDefinitions |

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

*Last Updated: 2026-01-01*
