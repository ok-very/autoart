# Template Sync

How `bfa_templates.json` stays in sync with the live ClickUp list.

## Overview

Template sync loads the ground-truth template (102 tasks) and diffs it against the current state of a ClickUp list. It produces a report of creates, updates, and orphans, and optionally applies changes.

**Source**: `apps/autohelper/autohelper/modules/clickup/template_sync.py`

## How It Works

1. **Load template** from `apps/autohelper/autohelper/data/bfa_templates.json`
2. **Fetch all tasks** from the target ClickUp list (paginated, includes closed)
3. **Match by name** (case-insensitive, trimmed)
4. **Diff**:
   - **Creates**: Template tasks not found in ClickUp
   - **Updates**: Matched tasks with wrong phase custom field value
   - **Orphans**: ClickUp tasks tagged `template_type:bfa_project` not in template
5. **Apply** (if `force=true`): Creates roots first, then children (parent ID resolution)

## Running a Sync

### Dry-Run (default)
```bash
curl -X POST http://localhost:8100/clickup/template-sync
```

Returns a SyncReport JSON:
```json
{
  "total_template": 102,
  "total_clickup": 95,
  "creates": [{ "action": "create", "temp_id": "dry-1-0", "name": "...", "details": {...} }],
  "updates": [{ "action": "update", "temp_id": "dry-2-3", "name": "...", "details": {"phase": {...}} }],
  "orphans": [{ "action": "orphan", "name": "Old Task", "details": {"clickup_id": "abc"} }],
  "errors": [],
  "applied": false
}
```

### Force Apply
```bash
curl -X POST "http://localhost:8100/clickup/template-sync?force=true"
```

### Override List ID
```bash
curl -X POST "http://localhost:8100/clickup/template-sync?list_id=DIFFERENT_LIST&force=false"
```

## Parent-Child Resolution

Template tasks can have `parent_temp_id` pointing to another task's `temp_id`. During creation:
1. Roots (no parent) are created first
2. Children are created after their parents
3. `temp_id → clickup_id` map resolves parent references

## Orphan Detection

Tasks in ClickUp with the tag `template_type:bfa_project` that don't match any template task by name are flagged as orphans. These are NOT deleted automatically — they're reported for manual review.

## Phase Field Drift

The sync checks each matched task's phase custom field value against the expected option ID for its stage. If they differ, an update action is generated.

## Scheduler

Template sync can run on a schedule:
- **Enable**: Set `clickup_sync_enabled: true` in Settings
- **Interval**: `clickup_sync_interval_hours` (default 6, range 1-168)
- **Check status**: `GET /clickup/template-sync/status`

Source: `apps/autohelper/autohelper/modules/clickup/scheduler.py` (APScheduler)

## Configuration

All settings via autohelper config (`/config` API or Settings UI):

| Setting | Description |
|---------|-------------|
| `clickup_token` | Personal API token (`pk_...`) |
| `clickup_workspace_id` | Workspace ID (`9014240887`) |
| `clickup_space_id` | Space ID (`90140886432`) |
| `clickup_list_id` | Target list ID (`901414366813`) |
| `clickup_sync_enabled` | Enable scheduled sync |
| `clickup_sync_interval_hours` | Sync interval (1-168) |
