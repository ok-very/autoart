# Blocking Tasks & Next-Step Prediction

How ClickUp dependencies can drive AutoArt's ability to predict and surface the next actionable steps for a project.

## ClickUp Dependency Model

### Two Relationship Types

**1. Dependencies (blocking/directional)**
- `depends_on`: Task A cannot complete until Task B is done
- `dependency_of`: Task A blocks Task B from completing
- Represented in task response as `dependencies[]` array
- ClickUp UI shows warning when completing a blocked task

**2. Task Links (non-blocking/bidirectional)**
- Related reference between tasks — no blocking semantics
- Useful for cross-referencing related items without enforcing order

### API Usage

```typescript
// Set up a dependency chain: Task 1 → Task 2 → Task 3
await cu.dependencies.add(task2Id, { depends_on: task1Id }); // task2 waits for task1
await cu.dependencies.add(task3Id, { depends_on: task2Id }); // task3 waits for task2
```

## BFA Template Dependency Graph

The 102-task BFA template has natural stage-based ordering (Stage 1 → 11), but currently lacks explicit dependency wiring. To enable next-step prediction, we need to add dependencies that encode:

### Stage-Gate Dependencies
Each stage has milestone tasks that gate advancement. These should block the first task of the next stage:

```
Stage 1: "Signed Fee Proposal Received" (milestone)
  └── blocks → Stage 2: "Client Project Kickoff Meeting"

Stage 2: "PPAP Approved" (milestone)
  └── blocks → Stage 3: first DPAP task

Stage 3: "DPAP Approved" (milestone)
  └── blocks → Stage 4/5 tasks
```

### Intra-Stage Dependencies
Within a stage, some tasks have natural ordering:

```
Stage 2:
  "Research PPAP" → "Write & Design PPAP" → "Submit PPAP to Client" → "PPAP Approved"
```

### Parent-Child (existing)
Subtasks already have parent_temp_id relationships. These represent containment, not blocking.

## Next-Step Prediction Algorithm

### Concept

Given a project's current ClickUp task states, AutoArt can compute:
1. **Completed tasks** — status is "complete" or "closed"
2. **Blocked tasks** — have unresolved dependencies (depends_on tasks not complete)
3. **Actionable tasks** — not complete AND all dependencies resolved
4. **Next milestone** — first incomplete milestone in stage order

### Implementation Approach

```typescript
interface ProjectState {
  completedTasks: Set<string>;
  blockedTasks: Map<string, string[]>;  // taskId → blocking taskIds
  actionableTasks: ClickUpTask[];       // ready to work on
  nextMilestone: ClickUpTask | null;
  currentStage: number;
  stageProgress: Record<number, { total: number; done: number }>;
}

async function analyzeProject(listId: string): Promise<ProjectState> {
  // 1. Fetch all tasks with subtasks
  const allTasks = await fetchAllTasks(listId);

  // 2. Build dependency graph from task metadata
  //    (dependencies[] array on each task response)
  const graph = buildDependencyGraph(allTasks);

  // 3. Classify each task
  const completed = new Set(
    allTasks.filter(t => t.status.type === 'closed' || t.status.type === 'done')
           .map(t => t.id)
  );

  const blocked = new Map<string, string[]>();
  const actionable: ClickUpTask[] = [];

  for (const task of allTasks) {
    if (completed.has(task.id)) continue;

    const blockers = graph.getDependencies(task.id)
      .filter(depId => !completed.has(depId));

    if (blockers.length > 0) {
      blocked.set(task.id, blockers);
    } else {
      actionable.push(task);
    }
  }

  // 4. Find current stage (first stage with incomplete tasks)
  // 5. Compute stage progress

  return { completedTasks: completed, blockedTasks: blocked, actionableTasks: actionable, ... };
}
```

### Surfacing Next Steps

The prediction engine should return a ranked list of **actionable tasks** ordered by:

1. **Stage order** — earlier stages first (don't jump ahead)
2. **Milestone proximity** — tasks closer to unblocking a milestone rank higher
3. **Has email template** — tasks with `email_template_key` may need outbound communication
4. **Assignment** — tasks assigned to the current user get priority
5. **Due date** — sooner deadlines rank higher

### Example Output

```
Current: Stage 2 — PPAP (7/12 tasks complete)

Next steps:
  1. ▶ "Write & Design PPAP" — ready (blocks "Submit PPAP to Client")
  2. ⏳ "Submit PPAP to Client" — blocked by "Write & Design PPAP"
  3. 🏁 "PPAP Approved" — milestone, blocked by submission

After this stage:
  4. 🔒 "Stage 3: Research DPAP" — blocked by "PPAP Approved"
```

## Wiring Dependencies into BFA Templates

### Option A: Template-Level Dependency Definitions

Extend `bfa_templates.json` to include dependency relationships:

```json
{
  "tasks": [
    { "temp_id": "dry-2-2", "name": "Research PPAP", "stage": 2, "depends_on": [] },
    { "temp_id": "dry-2-3", "name": "Write & Design PPAP", "stage": 2, "depends_on": ["dry-2-2"] },
    { "temp_id": "dry-2-4", "name": "Submit PPAP to Client", "stage": 2, "depends_on": ["dry-2-3"] }
  ]
}
```

Template sync then creates the ClickUp dependencies after task creation:

```typescript
// After all tasks created and id_map populated:
for (const tmpl of template.tasks) {
  if (tmpl.depends_on?.length) {
    for (const depTempId of tmpl.depends_on) {
      const taskId = idMap.get(tmpl.temp_id);
      const depId = idMap.get(depTempId);
      if (taskId && depId) {
        await cu.dependencies.add(taskId, { depends_on: depId });
      }
    }
  }
}
```

### Option B: Convention-Based Stage Gates

Auto-wire dependencies using conventions:
- The last milestone in each stage blocks the first task of the next stage
- Within a stage, tasks are sequential in template order unless explicitly parallel

This is simpler to maintain but less flexible.

### Recommendation

**Start with Option A** — explicit dependency definitions in the template. This gives full control and maps cleanly to the ClickUp dependency API. Option B can be layered on later as a default for stages that don't have explicit internal ordering.

## Integration with AutoHelper

### Read Path (new endpoint)

```
GET /clickup/project-status?list_id=X
```

Returns:
- Current stage number + name
- Stage completion percentages
- Actionable tasks (unblocked, incomplete)
- Next milestone
- Blocked tasks with their blockers

### Webhook-Driven Updates (future)

When a task status changes in ClickUp:
1. Webhook fires `taskStatusUpdated`
2. AutoHelper receives it
3. Recomputes project state
4. If a milestone was completed, surfaces newly unblocked tasks
5. Optionally triggers email composition for the next outbound step

### Dashboard Widget (future)

AutoHelper UI shows a "Next Steps" panel per project:
- Green: actionable tasks
- Yellow: tasks blocked by 1 dependency
- Red: tasks deep in the chain
- Progress bar per stage
