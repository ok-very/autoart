Below are three detailed PRs that implement the stage-as-projection migration and the Monday CSV import system, aligned with your architectural assessment and the `ProjectionPreset` concept.

***

# PR 1: Deprecate stage containers; introduce ProjectionPreset system

**Branch:** `refactor/projection-presets`  
**Base:** `experiment/foundational-model-refactor`

## Summary
Remove `stage` as a required structural primitive in the hierarchy and introduce `ProjectionPreset` as a formal interface for deriving interpretive views over Actions/Events. This enables "stage-like" grouping without persisting stage containers or requiring `stage_id` foreign keys.

## Motivation
The current `nodeTypeSchema` treats `stage` as a first-class type alongside `project`, `process`, `subprocess`, `task`, and `subtask`.  This creates an ontological commitment: stages become containers that actions "belong to," which reintroduces task-thinking and forces structural consensus where interpretation should be flexible.[1]

By making stages projection-only, we allow multiple competing stage systems to coexist over the same event stream without schema conflicts or data mutation.[1]

## Architecture changes

### Backend: `packages/shared/src/projections.ts` (new)
```typescript
/**
 * ProjectionPreset: A named, reusable interpretation contract.
 * Projections derive view models from immutable facts (actions/events/records).
 * They do NOT create or mutate data.
 */
export interface ProjectionPreset<TInput = unknown, TOutput = unknown> {
  /** Stable identifier (e.g., 'hierarchy-projection', 'stage-projection') */
  id: string;
  
  /** Human-readable label */
  label: string;
  
  /** Optional description of what this projection emphasizes */
  description?: string;
  
  /** Applicability constraints (optional filtering) */
  applicability?: {
    contextTypes?: string[];  // e.g., ['process', 'subprocess']
    tags?: string[];
  };
  
  /** Pure derivation function: Input → Output (deterministic, no side effects) */
  derive(input: TInput): TOutput;
}

/**
 * Common projection input: actions with their event streams + metadata
 */
export interface ActionProjectionInput {
  id: string;
  type: string;
  context_type: string;
  context_id: string;
  metadata?: Record<string, unknown>;
  events?: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    payload?: Record<string, unknown>;
  }>;
}

/**
 * Stage projection output: grouped view by stage labels
 */
export interface StageProjectionOutput {
  stages: Array<{
    key: string;        // Derived stage identifier
    label: string;      // Display name
    order: number;      // Sort order
    items: ActionProjectionInput[];
  }>;
}

/**
 * Hierarchy projection output: tree structure
 */
export interface HierarchyProjectionOutput {
  nodes: Array<{
    id: string;
    type: 'project' | 'process' | 'subprocess' | 'task' | 'subtask';
    title: string;
    parentId: string | null;
    children: string[];
    metadata?: Record<string, unknown>;
  }>;
}
```

### Backend: `backend/src/modules/projections/presets/stage-projection.ts` (new)
```typescript
import type { ProjectionPreset, ActionProjectionInput, StageProjectionOutput } from '@autoart/shared';

/**
 * StageProjection: Groups actions by import.stage_name metadata.
 * Does NOT require stage_id or stage containers.
 * Future: can evolve to event-predicate-based grouping.
 */
export const StageProjection: ProjectionPreset<
  { actions: ActionProjectionInput[] },
  StageProjectionOutput
> = {
  id: 'stage-projection',
  label: 'Stage View',
  description: 'Groups work items by imported stage labels or event-derived status',
  
  applicability: {
    contextTypes: ['process', 'subprocess'],
  },

  derive({ actions }) {
    const groups = new Map<string, StageProjectionOutput['stages'][number]>();

    for (const action of actions) {
      // Derive stage from metadata (import hint) or event predicates (future)
      const stageName = deriveStageLabel(action);
      const stageOrder = (action.metadata?.['import.stage_order'] as number) ?? 999;

      if (!groups.has(stageName)) {
        groups.set(stageName, {
          key: stageName,
          label: stageName,
          order: stageOrder,
          items: [],
        });
      }

      groups.get(stageName)!.items.push(action);
    }

    return {
      stages: Array.from(groups.values()).sort((a, b) => a.order - b.order),
    };
  },
};

/**
 * Derive stage label from action metadata or event stream.
 * Initially: use import.stage_name.
 * Later: add event-predicate logic (e.g., "In Progress" if WORK_STARTED present).
 */
function deriveStageLabel(action: ActionProjectionInput): string {
  // Priority 1: Imported stage label
  if (action.metadata?.['import.stage_name']) {
    return action.metadata['import.stage_name'] as string;
  }

  // Priority 2: Event-derived status (future evolution)
  // Example:
  // const hasWorkStarted = action.events?.some(e => e.event_type === 'WORK_STARTED');
  // const hasWorkFinished = action.events?.some(e => e.event_type === 'WORK_FINISHED');
  // if (hasWorkStarted && !hasWorkFinished) return 'In Progress';
  // if (hasWorkFinished) return 'Completed';

  // Fallback
  return 'Uncategorized';
}
```

### Backend: `backend/src/modules/projections/presets/hierarchy-projection.ts` (new)
```typescript
import type { ProjectionPreset, ActionProjectionInput, HierarchyProjectionOutput } from '@autoart/shared';

/**
 * HierarchyProjection: Renders a tree of process → subprocess → task/subtask.
 * Does NOT include stage nodes.
 */
export const HierarchyProjection: ProjectionPreset<
  { actions: ActionProjectionInput[]; containers: Array<{ id: string; type: string; title: string; parent_id: string | null }> },
  HierarchyProjectionOutput
> = {
  id: 'hierarchy-projection',
  label: 'Hierarchy Tree',
  description: 'Displays records in project/process/subprocess/task structure',

  derive({ actions, containers }) {
    const nodes: HierarchyProjectionOutput['nodes'] = [];

    // Add containers (project, process, subprocess)
    for (const container of containers) {
      if (container.type !== 'stage') { // Explicitly skip stage containers
        nodes.push({
          id: container.id,
          type: container.type as any,
          title: container.title,
          parentId: container.parent_id,
          children: [],
          metadata: {},
        });
      }
    }

    // Add task-like actions
    for (const action of actions) {
      nodes.push({
        id: action.id,
        type: 'task', // or derive from action.type
        title: (action.metadata?.title as string) ?? 'Untitled',
        parentId: action.context_id,
        children: [],
        metadata: action.metadata,
      });
    }

    // Build parent-child relationships
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node.id);
      }
    }

    return { nodes };
  },
};
```

### Backend: `backend/src/modules/hierarchy/hierarchy.schemas.ts` (update)
```typescript
import { z } from 'zod';

// REMOVE 'stage' from the primary enum (soft deprecation; keep for migration compatibility only)
export const nodeTypeSchema = z.enum(['project', 'process', 'subprocess', 'task', 'subtask']);

// Legacy stage type (migration only)
export const legacyNodeTypeSchema = z.enum(['project', 'process', 'stage', 'subprocess', 'task', 'subtask']);

export const createNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: nodeTypeSchema, // No longer accepts 'stage' for new creations
  title: z.string().min(1, 'Title is required'),
  description: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

// Rest remains unchanged...
```

### Frontend: `frontend/src/stores/projectionStore.ts` (new)
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectionState {
  // Active projection per surface
  activeProjections: Record<string, string>; // surfaceId → projectionId
  
  // Set active projection for a surface
  setProjection: (surfaceId: string, projectionId: string) => void;
  
  // Get active projection for a surface
  getProjection: (surfaceId: string) => string | undefined;
}

export const useProjectionStore = create<ProjectionState>()(
  persist(
    (set, get) => ({
      activeProjections: {},
      
      setProjection: (surfaceId, projectionId) =>
        set((state) => ({
          activeProjections: {
            ...state.activeProjections,
            [surfaceId]: projectionId,
          },
        })),
      
      getProjection: (surfaceId) => get().activeProjections[surfaceId],
    }),
    {
      name: 'projection-preferences',
      partialize: (state) => ({ activeProjections: state.activeProjections }),
    }
  )
);
```

## Migration plan
1. **Database:** Add migration to mark existing `stage` nodes with `metadata.legacy = true` (do not delete).
2. **Create paths:** Composer and hierarchy creation endpoints reject `type: 'stage'` for new nodes (validation error).
3. **Read paths:** Existing stage nodes can still be queried but are filtered out of `HierarchyProjection` by default.
4. **UI:** Remove "Create Stage" affordances; add projection selector instead.

## Testing
- **Unit:** `stage-projection.test.ts` — verify grouping logic with various `import.stage_name` values.
- **Unit:** `hierarchy-projection.test.ts` — verify stage nodes are excluded from tree output.
- **Integration:** Create a process with subprocess + tasks, apply both projections, confirm outputs differ but cover same data.

## TODO
- [ ] Add `packages/shared/src/projections.ts` with `ProjectionPreset` interface
- [ ] Add `StageProjection` and `HierarchyProjection` presets
- [ ] Update `nodeTypeSchema` to remove `stage` from primary enum
- [ ] Add `useProjectionStore` with persisted preferences
- [ ] Mark existing stage nodes as legacy in migration
- [ ] Update Composer validation to reject `stage` type
- [ ] Add tests for both projection presets

***

# PR 2: Import Workbench surface (plan/inspect/execute UI)

**Branch:** `refactor/import-workbench`  
**Base:** `refactor/projection-presets` (PR 1)

## Summary
Replace the current `IngestionView` with an Import Workbench surface that is projection-driven, plan-centric, and aligned with the new import sessions API. Shows hierarchy and stage projections side-by-side without implying stages are structural containers.

## Motivation
The current `IngestionView` renders `node.type === 'stage'` and displays `stageCount` in the preview header, which reinforces the legacy stage-as-container model.  The Import Workbench surface replaces this with a projection-aware interface that treats stage grouping as one optional lens among many.

## UI Architecture

### Surface layout
```
┌─────────────────────────────────────────────────────────────┐
│ Import Workbench                                   [✕ Close]│
├──────────────┬──────────────────────────────────────────────┤
│              │ ┌────────────────────────────────────────┐   │
│  Session     │ │ Projection: [Hierarchy ▼] [Stage ▼]   │   │
│  Config      │ └────────────────────────────────────────┘   │
│              │                                              │
│  • Parser    │  ┌──────────────────────────────────────┐   │
│  • Source    │  │ Preview (selected projection)        │   │
│  • Options   │  │                                      │   │
│              │  │  Process: Vancouver Template         │   │
│  Validation  │  │    └─ Subprocess: Project Intro      │   │
│  • ✓ 0 errors│  │       └─ Task: Meeting with client   │   │
│  • ⚠ 2 warns │  │    └─ Subprocess: BFA Fee Proposal   │   │
│              │  │       └─ Task: Review City Policy    │   │
│              │  └──────────────────────────────────────┘   │
│              │                                              │
│              │  Record Inspector (click to expand)         │
│              │  ┌──────────────────────────────────────┐   │
│              │  │ Task: "Review City Policy..."        │   │
│              │  │ • Planned Action: CREATE_TASK        │   │
│              │  │ • Fields: Status, Target Date        │   │
│              │  │ • Source: import.stage_name = "..."  │   │
│              │  └──────────────────────────────────────┘   │
├──────────────┴──────────────────────────────────────────────┤
│                     [Cancel]  [Execute Import →]            │
└─────────────────────────────────────────────────────────────┘
```

### Component structure
```typescript
<ImportWorkbench>
  <SessionConfigPanel />
  <ValidationPanel />
  <ProjectionSelector />
  <ImportPreview projection={selectedProjection} />
  <RecordInspector />
  <ExecutionControls />
</ImportWorkbench>
```

## Component implementations

### `frontend/src/surfaces/ImportWorkbench.tsx` (new)
```typescript
import { useState } from 'react';
import { useProjectionStore } from '../stores/projectionStore';
import { useImportSession } from '../api/hooks/imports';

export function ImportWorkbench() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  const { activeProjections, setProjection } = useProjectionStore();
  const currentProjection = activeProjections['import-workbench'] ?? 'hierarchy-projection';
  
  const { data: session } = useImportSession(sessionId);
  const { data: plan } = useImportPlan(sessionId);
  
  return (
    <div className="flex h-screen bg-slate-50">
      <SessionConfigPanel onSessionCreated={setSessionId} />
      
      <div className="flex-1 flex flex-col">
        <ProjectionSelector
          surfaceId="import-workbench"
          activeProjectionId={currentProjection}
          availableProjections={['hierarchy-projection', 'stage-projection']}
          onChange={(id) => setProjection('import-workbench', id)}
        />
        
        <ImportPreview
          plan={plan}
          projectionId={currentProjection}
          onRecordSelect={setSelectedRecordId}
        />
        
        {selectedRecordId && (
          <RecordInspector
            recordId={selectedRecordId}
            plan={plan}
          />
        )}
        
        <ExecutionControls
          sessionId={sessionId}
          plan={plan}
        />
      </div>
    </div>
  );
}
```

### `frontend/src/surfaces/import/ProjectionSelector.tsx` (new)
```typescript
interface ProjectionSelectorProps {
  surfaceId: string;
  activeProjectionId: string;
  availableProjections: string[];
  onChange: (projectionId: string) => void;
}

export function ProjectionSelector({
  activeProjectionId,
  availableProjections,
  onChange,
}: ProjectionSelectorProps) {
  const projectionLabels: Record<string, string> = {
    'hierarchy-projection': 'Hierarchy Tree',
    'stage-projection': 'Stage Groups',
  };
  
  return (
    <div className="h-12 bg-white border-b flex items-center px-4 gap-2">
      <span className="text-xs font-bold text-slate-500">View as:</span>
      {availableProjections.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            id === activeProjectionId
              ? 'bg-blue-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {projectionLabels[id] ?? id}
        </button>
      ))}
    </div>
  );
}
```

### `frontend/src/surfaces/import/ImportPreview.tsx` (new)
```typescript
import { HierarchyPreview } from './HierarchyPreview';
import { StagePreview } from './StagePreview';

interface ImportPreviewProps {
  plan: ImportPlan | null;
  projectionId: string;
  onRecordSelect: (id: string) => void;
}

export function ImportPreview({ plan, projectionId, onRecordSelect }: ImportPreviewProps) {
  if (!plan) {
    return <EmptyState />;
  }
  
  switch (projectionId) {
    case 'hierarchy-projection':
      return <HierarchyPreview plan={plan} onSelect={onRecordSelect} />;
    case 'stage-projection':
      return <StagePreview plan={plan} onSelect={onRecordSelect} />;
    default:
      return <div>Unknown projection: {projectionId}</div>;
  }
}
```

### `frontend/src/surfaces/import/StagePreview.tsx` (new)
```typescript
/**
 * StagePreview: Renders grouped view using StageProjection.
 * Does NOT imply stages are containers or persisted.
 */
export function StagePreview({ plan, onSelect }: { plan: ImportPlan; onSelect: (id: string) => void }) {
  // Apply StageProjection client-side (or fetch from backend if preferred)
  const stageGroups = applyStageProjection(plan.items);
  
  return (
    <div className="p-6 space-y-4">
      {stageGroups.stages.map((stage) => (
        <div key={stage.key} className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">
            {stage.label}
            <span className="ml-2 text-xs text-slate-400">
              ({stage.items.length} items)
            </span>
          </h3>
          
          <div className="space-y-2">
            {stage.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="w-full text-left p-2 rounded hover:bg-slate-50 text-sm"
              >
                {item.metadata?.title ?? 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function applyStageProjection(items: ImportPlanItem[]): StageProjectionOutput {
  // Client-side projection application (matches backend logic)
  const groups = new Map<string, any>();
  
  for (const item of items) {
    const stageName = item.metadata?.['import.stage_name'] ?? 'Uncategorized';
    const stageOrder = item.metadata?.['import.stage_order'] ?? 999;
    
    if (!groups.has(stageName)) {
      groups.set(stageName, {
        key: stageName,
        label: stageName,
        order: stageOrder,
        items: [],
      });
    }
    
    groups.get(stageName).items.push(item);
  }
  
  return {
    stages: Array.from(groups.values()).sort((a, b) => a.order - b.order),
  };
}
```

### `frontend/src/surfaces/import/RecordInspector.tsx` (new)
```typescript
/**
 * RecordInspector: Shows planned actions/events for a single import record.
 */
export function RecordInspector({ recordId, plan }: { recordId: string; plan: ImportPlan }) {
  const record = plan.items.find(item => item.tempId === recordId);
  if (!record) return null;
  
  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">
        Record Inspector
      </h3>
      
      <div className="space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-400">Title</span>
          <div className="text-sm text-slate-800">{record.title}</div>
        </div>
        
        <div>
          <span className="text-xs font-bold text-slate-400">Planned Action</span>
          <div className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
            {record.plannedAction.type}
          </div>
        </div>
        
        <div>
          <span className="text-xs font-bold text-slate-400">Field Recordings</span>
          <div className="text-xs space-y-1">
            {record.fieldRecordings.map((field, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-slate-600">{field.fieldName}:</span>
                <span className="font-medium text-slate-800">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <span className="text-xs font-bold text-slate-400">Source Metadata</span>
          <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-auto">
            {JSON.stringify(record.metadata, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

## API hooks update

### `frontend/src/api/hooks/imports.ts` (new)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface ImportSession {
  id: string;
  parser_name: string;
  status: 'pending' | 'planned' | 'executing' | 'completed' | 'failed';
  created_at: string;
}

export interface ImportPlan {
  sessionId: string;
  containers: Array<{
    tempId: string;
    type: 'project' | 'process' | 'subprocess';
    title: string;
    parentTempId: string | null;
  }>;
  items: Array<{
    tempId: string;
    title: string;
    parentTempId: string;
    metadata: Record<string, unknown>;
    plannedAction: { type: string; payload: Record<string, unknown> };
    fieldRecordings: Array<{ fieldName: string; value: unknown }>;
  }>;
  validationIssues: Array<{
    severity: 'error' | 'warning';
    message: string;
    recordTempId?: string;
  }>;
}

export function useCreateImportSession() {
  return useMutation({
    mutationFn: (data: { parserName: string; rawData: string; config?: Record<string, unknown> }) =>
      api.post<ImportSession>('/imports/sessions', data),
  });
}

export function useImportSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['import-session', sessionId],
    queryFn: () => api.get<ImportSession>(`/imports/sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useImportPlan(sessionId: string | null) {
  return useQuery({
    queryKey: ['import-plan', sessionId],
    queryFn: () => api.post<ImportPlan>(`/imports/sessions/${sessionId}/plan`, {}),
    enabled: !!sessionId,
  });
}

export function useExecuteImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/imports/sessions/${sessionId}/execute`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
```

## Testing
- **Visual:** Upload Monday CSV → switch between hierarchy/stage projections → confirm both render same data differently.
- **Interaction:** Click a record → inspector shows planned action + field recordings.
- **Regression:** Ensure projection preference persists per browser profile via `useProjectionStore`.

## TODO
- [ ] Create `ImportWorkbench` surface component
- [ ] Add `ProjectionSelector` with persisted preference
- [ ] Implement `HierarchyPreview` and `StagePreview` components
- [ ] Add `RecordInspector` panel
- [ ] Create new import hooks (`useImportSession`, `useImportPlan`, `useExecuteImport`)
- [ ] Remove old `IngestionView.tsx` component
- [ ] Update navigation to route to Import Workbench surface

***

# PR 3: Import sessions + Monday CSV parser + Composer execution

**Branch:** `refactor/import-sessions-monday`  
**Base:** `refactor/import-workbench` (PR 2)

## Summary
Replace the legacy ingestion backend with an explicit "import sessions" pipeline that creates deterministic plans and executes them through Composer to ensure proper Action/Event generation. Implements a Monday CSV parser for the attached file format.

## Motivation
The current ingestion backend returns `stageCount/taskCount` and implies structural stage nodes.  The rebuild eliminates this and routes all task-like creations through Composer so they generate Actions/Events rather than silent CRUD mutations.[1]

## Backend architecture

### Database: `backend/src/db/migrations/XXX_import_sessions.ts` (new)
```sql
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parser_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'planned', 'executing', 'completed', 'failed')),
  raw_data TEXT NOT NULL,
  parser_config JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL,  -- Serialized ImportPlan
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES import_plans(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  results JSONB,  -- Created IDs, errors, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### API: `backend/src/modules/imports/imports.routes.ts` (new)
```typescript
import type { FastifyInstance } from 'fastify';
import * as importsService from './imports.service.js';

export async function importsRoutes(app: FastifyInstance) {
  /**
   * Create an import session
   */
  app.post('/sessions', async (request, reply) => {
    const { parserName, rawData, config } = request.body as {
      parserName: string;
      rawData: string;
      config?: Record<string, unknown>;
    };
    
    const userId = (request.user as { id?: string })?.id;
    
    const session = await importsService.createSession({
      parserName,
      rawData,
      config: config ?? {},
      userId,
    });
    
    return reply.status(201).send(session);
  });
  
  /**
   * Get session details
   */
  app.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await importsService.getSession(id);
    
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    
    return reply.send(session);
  });
  
  /**
   * Generate import plan
   */
  app.post('/sessions/:id/plan', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const plan = await importsService.generatePlan(id);
    return reply.send(plan);
  });
  
  /**
   * Execute import plan
   */
  app.post('/sessions/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { id?: string })?.id;
    
    const execution = await importsService.executeImport(id, userId);
    return reply.send(execution);
  });
}
```

### Service: `backend/src/modules/imports/imports.service.ts` (new)
```typescript
import { db } from '../../db/index.js';
import { MondayCSVParser } from './parsers/monday-csv-parser.js';
import { composerService } from '../composer/composer.service.js';

const PARSERS = {
  'monday-csv': new MondayCSVParser(),
};

export async function createSession(params: {
  parserName: string;
  rawData: string;
  config: Record<string, unknown>;
  userId?: string;
}) {
  const session = await db
    .insertInto('import_sessions')
    .values({
      parser_name: params.parserName,
      raw_data: params.rawData,
      parser_config: params.config,
      status: 'pending',
      created_by: params.userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  
  return session;
}

export async function getSession(id: string) {
  return db
    .selectFrom('import_sessions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function generatePlan(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  
  const parser = PARSERS[session.parser_name];
  if (!parser) throw new Error(`Parser ${session.parser_name} not found`);
  
  // Parse raw data into plan
  const plan = parser.parse(session.raw_data, session.parser_config);
  
  // Persist plan
  await db
    .insertInto('import_plans')
    .values({
      session_id: sessionId,
      plan_data: plan,
    })
    .execute();
  
  // Update session status
  await db
    .updateTable('import_sessions')
    .set({ status: 'planned', updated_at: new Date() })
    .where('id', '=', sessionId)
    .execute();
  
  return plan;
}

export async function executeImport(sessionId: string, userId?: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  
  const latestPlan = await db
    .selectFrom('import_plans')
    .select('plan_data')
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  
  if (!latestPlan) throw new Error('No plan found');
  
  const plan = latestPlan.plan_data as ImportPlan;
  
  // Start execution
  const execution = await db
    .insertInto('import_executions')
    .values({
      session_id: sessionId,
      plan_id: latestPlan.id,
      status: 'running',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  
  try {
    // Execute plan via Composer for task-like items
    const results = await executePlanViaComposer(plan, userId);
    
    await db
      .updateTable('import_executions')
      .set({
        status: 'completed',
        results,
        completed_at: new Date(),
      })
      .where('id', '=', execution.id)
      .execute();
    
    await db
      .updateTable('import_sessions')
      .set({ status: 'completed' })
      .where('id', '=', sessionId)
      .execute();
    
    return { ...execution, results };
  } catch (err) {
    await db
      .updateTable('import_executions')
      .set({
        status: 'failed',
        results: { error: (err as Error).message },
        completed_at: new Date(),
      })
      .where('id', '=', execution.id)
      .execute();
    
    throw err;
  }
}

async function executePlanViaComposer(plan: ImportPlan, userId?: string) {
  const createdIds: Record<string, string> = {};
  
  // Step 1: Create containers (process, subprocess) directly (no Actions needed for containers)
  for (const container of plan.containers) {
    const parentId = container.parentTempId ? createdIds[container.parentTempId] : null;
    
    const created = await db
      .insertInto('hierarchy_nodes')
      .values({
        parent_id: parentId,
        type: container.type,
        title: container.title,
        metadata: {},
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    
    createdIds[container.tempId] = created.id;
  }
  
  // Step 2: Create work items via Composer (ensures Action/Event generation)
  for (const item of plan.items) {
    const contextId = createdIds[item.parentTempId];
    
    // Route through Composer
    const action = await composerService.createWorkItem({
      contextType: 'subprocess', // or derive from parent type
      contextId,
      title: item.title,
      metadata: item.metadata,
      userId,
    });
    
    createdIds[item.tempId] = action.id;
    
    // Record fields as events (not direct mutations)
    for (const field of item.fieldRecordings) {
      await composerService.recordField({
        actionId: action.id,
        fieldName: field.fieldName,
        value: field.value,
        userId,
      });
    }
  }
  
  return { createdIds };
}
```

### Parser: `backend/src/modules/imports/parsers/monday-csv-parser.ts` (new)
```typescript
import { parse } from 'csv-parse/sync';

interface MondayRow {
  Name: string;
  Subitems: string;
  PM: string;
  'Task Status': string;
  'Target Date': string;
  Priority: string;
  Notes: string;
  Files: string;
  'Timeline - Start': string;
  'Timeline - End': string;
  'Key Personnel': string;
  [key: string]: string;
}

export class MondayCSVParser {
  parse(rawData: string, config: Record<string, unknown> = {}): ImportPlan {
    const rows = parse(rawData, {
      columns: true,
      skip_empty_lines: true,
    }) as MondayRow[];
    
    const containers: ImportPlan['containers'] = [];
    const items: ImportPlan['items'] = [];
    const validationIssues: ImportPlan['validationIssues'] = [];
    
    let currentStageLabel: string | null = null;
    let currentStageOrder = 0;
    let processId: string | null = null;
    
    for (const row of rows) {
      // Detect process row (first row with project-level fields)
      if (!processId && row['Developer']) {
        processId = `temp-process-1`;
        containers.push({
          tempId: processId,
          type: 'process',
          title: 'Vancouver Template', // Hardcoded from your requirement
          parentTempId: null,
        });
        continue;
      }
      
      // Detect stage headers (e.g., "Stage 1 Project Initiation - Fee Proposal...")
      if (row.Name.startsWith('Stage ')) {
        currentStageLabel = row.Name.replace(/^Stage \d+\s*[-–]\s*/, '').trim();
        currentStageOrder++;
        continue;
      }
      
      // Detect subprocess (non-empty Name, no subitems yet)
      if (row.Name && !row.Subitems) {
        const subprocessId = `temp-subprocess-${containers.length}`;
        containers.push({
          tempId: subprocessId,
          type: 'subprocess',
          title: row.Name,
          parentTempId: processId,
        });
        continue;
      }
      
      // Parse subitems (comma-delimited task names)
      if (row.Subitems) {
        const subprocessId = containers[containers.length - 1]?.tempId;
        if (!subprocessId) {
          validationIssues.push({
            severity: 'error',
            message: `Subitems found without parent subprocess: ${row.Subitems}`,
          });
          continue;
        }
        
        const taskNames = row.Subitems.split(',').map(s => s.trim()).filter(Boolean);
        
        for (const taskName of taskNames) {
          const taskId = `temp-task-${items.length}`;
          items.push({
            tempId: taskId,
            title: taskName,
            parentTempId: subprocessId,
            metadata: {
              'import.stage_name': currentStageLabel,
              'import.stage_order': currentStageOrder,
              'import.source_row': row,
            },
            plannedAction: {
              type: 'CREATE_TASK',
              payload: { title: taskName },
            },
            fieldRecordings: [
              { fieldName: 'Status', value: row['Task Status'] },
              { fieldName: 'Target Date', value: row['Target Date'] },
              { fieldName: 'Priority', value: row.Priority },
              { fieldName: 'Notes', value: row.Notes },
            ].filter(f => f.value), // Only include non-empty fields
          });
        }
      }
    }
    
    return {
      sessionId: '', // Populated by service
      containers,
      items,
      validationIssues,
    };
  }
}
```

## Testing
- **Golden file:** Parse the attached CSV → snapshot the plan structure (container count, item count, metadata presence).
- **Idempotency:** Execute same plan twice → second execution reports "already created" via sourceKey deduplication.
- **Event generation:** Execute plan → verify Actions + Events exist in the event stream (not silent CRUD).

## TODO
- [ ] Add `import_sessions`, `import_plans`, `import_executions` tables
- [ ] Create `imports.routes.ts` with session/plan/execute endpoints
- [ ] Implement `imports.service.ts` with Composer integration
- [ ] Add `MondayCSVParser` with subprocess + task + metadata extraction
- [ ] Add validation logic (missing names, duplicate sourceKeys)
- [ ] Add tests for parser (golden file snapshot)
- [ ] Add integration test: execute plan → verify events emitted
- [ ] Remove old `ingestion.routes.ts` and `ingestion.service.ts`

***

## Summary of three PRs

1. **PR 1 (Projection Presets):** Removes `stage` as a structural primitive; introduces `ProjectionPreset` interface and implements `StageProjection` + `HierarchyProjection`.
2. **PR 2 (Import Workbench):** Replaces `IngestionView` with a projection-aware Import Workbench surface that can switch between hierarchy and stage views without implying stages are containers.
3. **PR 3 (Import Sessions + Monday):** Rebuilds the ingestion backend as an explicit session/plan/execute pipeline, adds Monday CSV parser, and ensures all task-like creations route through Composer for proper Action/Event generation.

These three PRs form a coherent refactor arc: **stage demoted → UI projection-ized → import Action-ized**.
