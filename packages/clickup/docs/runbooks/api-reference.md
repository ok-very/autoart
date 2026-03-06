# ClickUp API Reference

Complete endpoint reference for `@autoart/clickup`. All examples use the TypeScript client.

## Setup

```typescript
import { ClickUp } from '@autoart/clickup';
const cu = new ClickUp({
  token: process.env.CLICKUP_TOKEN!,
  workspaceId: '9014240887',  // needed for Docs API
});
```

---

## Tasks (`cu.tasks`)

### Get Task
```typescript
const task = await cu.tasks.get(taskId);
const taskWithSubs = await cu.tasks.get(taskId, { include_subtasks: true });
```

### List Tasks (paginated, 100/page)
```typescript
const { tasks } = await cu.tasks.list(listId, {
  page: 0,
  subtasks: true,
  include_closed: true,
  order_by: 'created',
  statuses: ['in progress'],
  assignees: [userId],
  due_date_gt: Date.now(),
});
```

### Create Task
```typescript
const task = await cu.tasks.create(listId, {
  name: 'Task Name',
  description: 'Details',
  assignees: [userId],
  tags: ['tag-name'],
  status: 'to do',
  priority: 3, // 1=urgent, 2=high, 3=normal, 4=low
  due_date: Date.now() + 7 * 86400000,
  custom_fields: [{ id: fieldId, value: optionId }],
});
```

### Update Task
```typescript
await cu.tasks.update(taskId, {
  name: 'New Name',
  status: 'complete',
  assignees: { add: [userId], rem: [oldUserId] },
  priority: 1,
});
```

### Delete Task
```typescript
await cu.tasks.delete(taskId);
```

### Create With Subtasks
```typescript
const [parent, ...subs] = await cu.tasks.createWithSubtasks(listId,
  { name: 'Parent' },
  [{ name: 'Child 1' }, { name: 'Child 2' }]
);
```

---

## Lists (`cu.lists`)

```typescript
const list = await cu.lists.get(listId);
const { lists } = await cu.lists.listInFolder(folderId);
const { lists: folderless } = await cu.lists.listInSpace(spaceId);
const newList = await cu.lists.createInFolder(folderId, { name: 'New List' });
const newList2 = await cu.lists.createInSpace(spaceId, { name: 'Folderless List' });
await cu.lists.update(listId, { name: 'Renamed' });
await cu.lists.delete(listId);
```

---

## Custom Fields (`cu.customFields`)

```typescript
const { fields } = await cu.customFields.list(listId);
await cu.customFields.set(taskId, fieldId, value);
await cu.customFields.remove(taskId, fieldId);
```

---

## Spaces (`cu.spaces`)

```typescript
const { teams } = await cu.spaces.getTeams();
const { spaces } = await cu.spaces.list(teamId);
const space = await cu.spaces.get(spaceId);
const { folders } = await cu.spaces.getFolders(spaceId);
const folder = await cu.spaces.getFolder(folderId);

// Folder CUD
const newFolder = await cu.spaces.createFolder(spaceId, { name: 'New Folder' });
await cu.spaces.updateFolder(folderId, { name: 'Renamed' });
await cu.spaces.deleteFolder(folderId);

// Cross-list task search
const { tasks } = await cu.spaces.getFilteredTeamTasks(teamId, { include_closed: false });

// Shared items
const shared = await cu.spaces.getSharedHierarchy(teamId);

// Custom roles
const { custom_roles } = await cu.spaces.getCustomRoles(teamId);
```

---

## Comments (`cu.comments`)

```typescript
const { comments } = await cu.comments.getTaskComments(taskId);
const comment = await cu.comments.createTaskComment(taskId, {
  comment_text: 'Hello!',
  notify_all: true,
});
await cu.comments.update(commentId, { comment_text: 'Edited' });
await cu.comments.delete(commentId);

// Also: getListComments, createListComment, getViewComments, createViewComment
```

---

## Attachments (`cu.attachments`)

```typescript
import { readFileSync } from 'fs';
const file = readFileSync('/path/to/document.pdf');
const attachment = await cu.attachments.upload(taskId, file, 'document.pdf');
// Returns: { id, url, title, extension, thumbnail_small, thumbnail_large }
```

---

## Checklists (`cu.checklists`)

```typescript
const { checklist } = await cu.checklists.create(taskId, { name: 'QA Checklist' });
await cu.checklists.createItem(checklist.id, { name: 'Step 1' });
await cu.checklists.updateItem(checklist.id, itemId, { resolved: true });
await cu.checklists.deleteItem(checklist.id, itemId);
await cu.checklists.update(checklist.id, { name: 'Renamed', position: 0 });
await cu.checklists.delete(checklist.id);
```

---

## Time Tracking (`cu.timeTracking`)

```typescript
const teamId = '9014240887';

// List entries
const { data: entries } = await cu.timeTracking.list(teamId, {
  start_date: Date.now() - 7 * 86400000,
  end_date: Date.now(),
  task_id: 'abc123',
});

// Create manual entry
await cu.timeTracking.create(teamId, {
  tid: taskId,
  start: Date.now() - 3600000,
  duration: 3600000,
  description: 'Design review',
});

// Timer
await cu.timeTracking.start(teamId, timerId);
const { data: running } = await cu.timeTracking.getRunning(teamId);
await cu.timeTracking.stop(teamId);
```

---

## Tags (`cu.tags`)

```typescript
const { tags } = await cu.tags.list(spaceId);
await cu.tags.create(spaceId, { tag: { name: 'urgent', tag_bg: '#ff0000', tag_fg: '#ffffff' } });
await cu.tags.addToTask(taskId, 'urgent');
await cu.tags.removeFromTask(taskId, 'urgent');
await cu.tags.delete(spaceId, 'old-tag');
```

---

## Goals (`cu.goals`)

```typescript
const { goals } = await cu.goals.list(teamId);
const { goal } = await cu.goals.create(teamId, {
  name: 'Q1 Delivery',
  due_date: Date.now() + 90 * 86400000,
  owners: [userId],
});
await cu.goals.createKeyResult(goal.id, {
  name: 'Tasks completed',
  type: 'number',
  steps_start: 0,
  steps_end: 50,
  unit: 'tasks',
});
```

---

## Webhooks (`cu.webhooks`)

```typescript
const { webhooks } = await cu.webhooks.list(teamId);
const { webhook } = await cu.webhooks.create(teamId, {
  endpoint: 'https://your-server.com/webhook',
  events: ['taskCreated', 'taskUpdated', 'taskStatusUpdated'],
  space_id: spaceId,
});
await cu.webhooks.update(webhook.id, { events: ['*'] });
await cu.webhooks.delete(webhook.id);
```

**Available events**: `*`, `taskCreated`, `taskUpdated`, `taskDeleted`, `taskPriorityUpdated`, `taskStatusUpdated`, `taskAssigneeUpdated`, `taskDueDateUpdated`, `taskTagUpdated`, `taskMoved`, `taskCommentPosted`, `taskCommentUpdated`, `taskTimeEstimateUpdated`, `taskTimeTrackedUpdated`, `listCreated/Updated/Deleted`, `folderCreated/Updated/Deleted`, `spaceCreated/Updated/Deleted`, `goalCreated/Updated/Deleted`, `keyResultCreated/Updated/Deleted`

---

## Views (`cu.views`)

```typescript
const { views } = await cu.views.getSpaceViews(spaceId);
const { view } = await cu.views.get(viewId);
const { tasks, last_page } = await cu.views.getTasks(viewId, 0);
```

---

## Members (`cu.members`)

```typescript
const { members } = await cu.members.getTaskMembers(taskId);
const { members: listMembers } = await cu.members.getListMembers(listId);
```

---

## Users (`cu.users`)

```typescript
const { user } = await cu.users.invite(teamId, { email: 'new@example.com' });
const { user: existing } = await cu.users.get(teamId, userId);
await cu.users.edit(teamId, userId, { admin: false });
await cu.users.remove(teamId, userId);
```

---

## Templates (`cu.templates`)

```typescript
const { templates } = await cu.templates.list(teamId);
const task = await cu.templates.createFromTemplate(listId, templateId, { name: 'New Project' });
```

---

## Docs (`cu.docs`) — v3 API

Requires `workspaceId` in client config.

```typescript
const docs = await cu.docs!.search('meeting notes');
const doc = await cu.docs!.create({
  name: 'Project Plan',
  parent: { id: spaceId, type: '4' }, // 4=space, 5=folder, 6=list
  visibility: 'PUBLIC',
  create_page: true,
});
const { pages } = await cu.docs!.getPages(doc.id);
const page = await cu.docs!.getPage(doc.id, pageId, 'text/md');
await cu.docs!.createPage(doc.id, { name: 'Notes', content: '# Notes\n\nContent here' });
await cu.docs!.updatePage(doc.id, pageId, { content: 'Updated', content_edit_mode: 'replace' });
```

---

## Dependencies (`cu.dependencies`)

```typescript
// Task B must complete before Task A can start
await cu.dependencies.add(taskA, { depends_on: taskB });

// Task A blocks Task B (same relationship, opposite perspective)
await cu.dependencies.add(taskA, { dependency_of: taskB });

// Remove a dependency
await cu.dependencies.remove(taskA, { depends_on: taskB });

// Link tasks (non-blocking, bidirectional)
await cu.dependencies.addLink(taskA, taskB);
await cu.dependencies.removeLink(taskA, taskB);
```

---

## Error Handling

```typescript
import { ClickUpApiError } from '@autoart/clickup';

try {
  await cu.tasks.get('invalid-id');
} catch (err) {
  if (err instanceof ClickUpApiError) {
    console.error(`Status: ${err.statusCode}, Body:`, err.body);
  }
}
```

## Rate Limits

- 100 requests/minute per token
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Client auto-retries 429s with exponential backoff (1.5s × attempt, max 3 retries)
