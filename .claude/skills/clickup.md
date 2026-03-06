# ClickUp Operations

Agent reference for ClickUp API operations, BFA project workflows, and OneDrive sync.

## Hierarchy

```
Workspace (9014240887) → Space → Folder → List → Task → Subtask
```

## BFA Workspace IDs

| Entity | ID | Notes |
|--------|-----|-------|
| Workspace | `9014240887` | BFA |
| Space | `90140886432` | Main space |
| Template Folder | `90144269771` | BFA project template folder |
| Template List | `901414366813` | 102-task BFA template list |
| Phase Field | `4abc75c1-c264-43c5-87a9-f116ad09e0fa` | Custom field for stage |

## Phase Options (Stage → Option ID)

| Stage | Name | Option ID |
|-------|------|-----------|
| 1 | Project Initiation | `eb7af0e2-174d-40e3-835e-c46cf00cb90f` |
| 2 | PPAP | `54f30092-2365-494d-8527-694b453872d9` |
| 3 | DPAP | `d915bc10-5ee9-43df-b8fd-52396d1a6674` |
| 4 | Community Engagement | `d915bc10-5ee9-43df-b8fd-52396d1a6674` |
| 5 | Artist Longlist & Panel #1 | `27ee5137-9f71-480d-a13a-cdbc7ebe0a0e` |
| 6 | Concept Proposals & Panel #2 | `7f3a0b97-425a-4ca3-a05c-3f3b35ce590e` |
| 7 | Artist Contract | `3e54fd5c-5243-49cb-9c76-a1ccee4a0d51` |
| 8 | Detailed Design | `9a54c988-2f31-4e55-a9ba-bdb246cc67b3` |
| 9 | Fabrication (50%→100%) | `3a3f7c7f-d949-4fc9-afd8-580fbffe4f64` |
| 10 | Installation | `f040f8c7-f4c3-4b75-89f1-69273bef15df` |
| 11 | Close-Out | `30c99a30-8328-4ee4-9181-01b61a80defd` |

---

## TypeScript Client (`@autoart/clickup`)

```typescript
import { ClickUp } from '@autoart/clickup';

const cu = new ClickUp({
  token: process.env.CLICKUP_TOKEN!,
  workspaceId: '9014240887', // required for docs API
});
```

### Resources

| Resource | Property | Key Methods |
|----------|----------|-------------|
| Tasks | `cu.tasks` | `get`, `list`, `create`, `update`, `delete`, `createWithSubtasks` |
| Lists | `cu.lists` | `get`, `listInFolder`, `listInSpace`, `createInFolder`, `createInSpace`, `update`, `delete` |
| Custom Fields | `cu.customFields` | `list`, `set`, `remove` |
| Spaces | `cu.spaces` | `getTeams`, `list`, `get`, `getFolders`, `getFolder`, `createFolder`, `updateFolder`, `deleteFolder`, `getFilteredTeamTasks`, `getSharedHierarchy`, `getCustomRoles` |
| Comments | `cu.comments` | `getTaskComments`, `createTaskComment`, `getListComments`, `createListComment`, `update`, `delete` |
| Attachments | `cu.attachments` | `upload` (multipart) |
| Checklists | `cu.checklists` | `create`, `update`, `delete`, `createItem`, `updateItem`, `deleteItem` |
| Time Tracking | `cu.timeTracking` | `list`, `get`, `create`, `update`, `delete`, `getRunning`, `start`, `stop` |
| Tags | `cu.tags` | `list`, `create`, `delete`, `addToTask`, `removeFromTask` |
| Goals | `cu.goals` | `list`, `get`, `create`, `update`, `delete`, `createKeyResult`, `updateKeyResult`, `deleteKeyResult` |
| Webhooks | `cu.webhooks` | `list`, `create`, `update`, `delete` |
| Views | `cu.views` | `getTeamViews`, `getSpaceViews`, `getFolderViews`, `getListViews`, `get`, `getTasks` |
| Members | `cu.members` | `getTaskMembers`, `getListMembers` |
| Users | `cu.users` | `invite`, `get`, `edit`, `remove` |
| Templates | `cu.templates` | `list`, `createFromTemplate` |
| Docs (v3) | `cu.docs` | `search`, `get`, `create`, `getPages`, `getPage`, `createPage`, `updatePage` |
| Dependencies | `cu.dependencies` | `add`, `remove`, `addLink`, `removeLink` |

---

## Common Operations

### List all tasks in a list (paginated)
```typescript
let page = 0;
const allTasks = [];
while (true) {
  const { tasks } = await cu.tasks.list(listId, { page, include_closed: true, subtasks: true });
  if (!tasks.length) break;
  allTasks.push(...tasks);
  page++;
}
```

### Create task with custom field
```typescript
const task = await cu.tasks.create(listId, {
  name: 'New Task',
  custom_fields: [{ id: PHASE_FIELD_ID, value: phaseOptionId }],
  tags: ['template_type:bfa_project'],
});
```

### Set custom field after creation
```typescript
await cu.customFields.set(task.id, fieldId, optionId);
```

### Upload attachment
```typescript
import { readFileSync } from 'fs';
const buf = readFileSync('/path/to/file.pdf');
await cu.attachments.upload(taskId, buf, 'file.pdf');
```

### Cross-list task search
```typescript
const { tasks } = await cu.spaces.getFilteredTeamTasks('9014240887', {
  assignees: [userId],
  include_closed: false,
});
```

---

## AutoHelper API (Python, port 8100)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/clickup/validate` | GET | Test token, return workspace info |
| `/clickup/execute-manifest` | POST | Create tasks from ImportManifest |
| `/clickup/template-sync?force=false` | POST | Diff template vs ClickUp; `force=true` to apply |
| `/clickup/template-sync/status` | GET | Scheduler status |
| `/clickup/compose-email?task_id=X&template_key=01.1` | POST | Create Outlook draft from task data |

---

## Sync Workflows

### Template Sync
1. Loads `bfa_templates.json` (102 tasks, 11 stages)
2. Fetches all tasks from target ClickUp list
3. Matches by name (case-insensitive)
4. Reports: creates (missing), updates (phase drift), orphans (extra tagged tasks)
5. `force=true` applies changes; roots created before children

### OneDrive Integration Points
- **Image roots**: Configured in `image_allowed_roots` (config.json)
- **BH submissions**: `E:/OneDrive - Ballard Fine Art/.../Submissions for print`
- **Artist folders**: OneDrive subfolders with renamed files
- **Email templates**: Loaded from configurable path
- Task attachments in ClickUp can reference OneDrive-synced files

---

## Dependencies & Blocking

ClickUp supports two relationship types:

**Blocking dependencies** (directional):
```typescript
// Task B must finish before Task A can start
await cu.dependencies.add(taskA, { depends_on: taskB });

// Task A blocks Task B (same relationship, opposite direction)
await cu.dependencies.add(taskA, { dependency_of: taskB });

// Remove
await cu.dependencies.remove(taskA, { depends_on: taskB });
```

**Task links** (bidirectional, non-blocking):
```typescript
await cu.dependencies.addLink(taskA, taskB);
await cu.dependencies.removeLink(taskA, taskB);
```

See `docs/runbooks/blocking-and-next-steps.md` for how dependencies enable next-step prediction.

---

## Rate Limits
- 100 requests/minute per token
- Client has built-in retry on 429 with exponential backoff (1.5s base, 3 retries)
- Check `X-RateLimit-Remaining` header for proactive throttling

## Priorities
| Value | Label |
|-------|-------|
| 1 | Urgent |
| 2 | High |
| 3 | Normal |
| 4 | Low |

## OpenAPI Reference
Full endpoint spec at `C:\Users\Neal\dev\clickup_openapi.toml`
