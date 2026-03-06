# BFA Project Lifecycle

How BFA public art projects are managed in ClickUp via the 102-task template.

## Template Location

- **File**: `apps/autohelper/autohelper/data/bfa_templates.json`
- **ClickUp List**: `901414366813` (folder `90144269771`, space `90140886432`)
- **Tag**: `template_type:bfa_project`

## 11 Stages

| # | Stage | Phase Option ID |
|---|-------|-----------------|
| 1 | Project Initiation | `eb7af0e2-174d-40e3-835e-c46cf00cb90f` |
| 2 | Preliminary Public Art Plan (PPAP) | `54f30092-2365-494d-8527-694b453872d9` |
| 3 | Detailed Public Art Plan (DPAP) | `d915bc10-5ee9-43df-b8fd-52396d1a6674` |
| 4 | Community Engagement | `d915bc10-5ee9-43df-b8fd-52396d1a6674` |
| 5 | Artist Longlist & Selection Panel #1 | `27ee5137-9f71-480d-a13a-cdbc7ebe0a0e` |
| 6 | Concept Proposals & Selection Panel #2 | `7f3a0b97-425a-4ca3-a05c-3f3b35ce590e` |
| 7 | Artist Contract | `3e54fd5c-5243-49cb-9c76-a1ccee4a0d51` |
| 8 | Detailed Design | `9a54c988-2f31-4e55-a9ba-bdb246cc67b3` |
| 9 | Fabrication (50% → 100%) | `3a3f7c7f-d949-4fc9-afd8-580fbffe4f64` |
| 10 | Installation | `f040f8c7-f4c3-4b75-89f1-69273bef15df` |
| 11 | Close-Out | `30c99a30-8328-4ee4-9181-01b61a80defd` |

## Creating a Project from Template

### Via AutoHelper API (recommended)
```bash
# Dry-run first
curl -X POST http://localhost:8100/clickup/template-sync?force=false

# Apply
curl -X POST http://localhost:8100/clickup/template-sync?force=true
```

### Via Manifest Execution
```bash
curl -X POST http://localhost:8100/clickup/execute-manifest \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "manual-2026-03",
    "target": { "list_id": "901414366813" },
    "tasks": [
      { "temp_id": "t1", "name": "Task Name", "status": "to do", "tags": ["template_type:bfa_project"] }
    ]
  }'
```

### Via TypeScript Client
```typescript
import { ClickUp } from '@autoart/clickup';

const cu = new ClickUp({ token: process.env.CLICKUP_TOKEN! });
const LIST_ID = '901414366813';
const PHASE_FIELD = '4abc75c1-c264-43c5-87a9-f116ad09e0fa';

// Create a stage-1 task with phase field
const task = await cu.tasks.create(LIST_ID, {
  name: 'Project Introduction Meeting (client)',
  tags: ['template_type:bfa_project'],
  custom_fields: [{ id: PHASE_FIELD, value: 'eb7af0e2-174d-40e3-835e-c46cf00cb90f' }],
});
```

## Email Composition

Tasks with `email_template_key` values link to email templates:

```bash
curl -X POST "http://localhost:8100/clickup/compose-email?task_id=abc123&template_key=01.1"
```

This fetches the task from ClickUp, extracts custom field values (project_name, developer, etc.), merges them into the email template, and creates an Outlook draft.

### Email Template Keys by Stage

| Key | Task | Stage |
|-----|------|-------|
| 01.1 | Project Introduction Meeting | 1 |
| 01.2 | Submit BFA Fee Proposal | 1 |
| 01.3 | Draft & Submit Development Checklist | 1 |
| 01.4 | City Kickoff Meeting | 2 |
| 02.1 | Client Project Kickoff Meeting | 2 |
| 02.2 | Submit PPAP to Client | 2 |

(Full mapping in `bfa_templates.json` → each task's `email_template_key`)

## Milestones

Tasks with `is_milestone: true` mark stage gates. Key milestones:
- **Signed Fee Proposal Received** (Stage 1)
- **PPAP Approved** (Stage 2)
- **DPAP Approved** (Stage 3)

## Stage Progression

Advancing a project through stages:
1. Complete all tasks in current stage
2. Milestone task resolved triggers advancement
3. Phase custom field updated to next stage option ID
4. Template sync detects phase drift and reports updates needed
