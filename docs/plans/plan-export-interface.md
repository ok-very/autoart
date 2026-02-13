# Export Interface Implementation Plan

## Done Sentence

A user can enter collection mode from anywhere in the workspace, click on records, fields, and nodes across panels to build a named collection, then switch to the export surface where that collection drives format selection, section configuration, document preview, and export execution through the backend session pipeline.

---

## Current State

### What Exists (on main)

**Backend export pipeline (fully functional):**
- `backend/src/modules/exports/exports.service.ts` -- Session CRUD (`createExportSession`, `generateProjection`, `executeExport`), projection caching, status lifecycle (`configuring -> projecting -> ready -> executing -> completed/failed`)
- `backend/src/modules/exports/exports.routes.ts` -- REST endpoints: `POST /sessions`, `GET /sessions/:id`, `POST /sessions/:id/projection`, `POST /sessions/:id/execute`, `GET /sessions/:id/output`, `PATCH /sessions/:id`, `DELETE /sessions/:id`
- `backend/src/modules/exports/projectors/bfa-project.projector.ts` -- `projectBfaExportModels()` generates `BfaProjectExportModel[]` from database
- `backend/src/modules/exports/formatters/` -- markdown, csv, rtf, plaintext formatters (all working)
- `backend/src/modules/exports/connectors/` -- Google Docs, Sheets, Slides, OneDrive OAuth connectors
- `backend/src/modules/exports/output-store.ts` -- Disk storage for binary outputs
- Context helpers: `staleness.service.ts`, `email-decay.service.ts`, `backfeeding.service.ts`

**Shared schemas (source of truth):**
- `shared/src/schemas/exports.ts` -- `ExportFormat` (rtf, plaintext, markdown, csv, google-doc, google-sheets, google-slides, pdf, docx), `ExportOptions` (includeContacts, includeBudgets, includeMilestones, includeSelectionPanel, includeOnlyOpenNextSteps, includeStatusNotes, highlightCurrentMonth), `ExportSession`, `ExportResult`, `BfaProjectExportModel`

**Collection System (built, exported, NOT mounted in ExportContent):**

This is the existing interactive selection mechanism. It is fully functional and integrated into data surfaces but its export-facing UI components are not yet wired into the export workspace.

| Component | Location | Status |
|-----------|----------|--------|
| `collectionStore.ts` | `frontend/src/stores/` | Working. Zustand persisted store. `Collection` with `SelectionReference[]`, collection CRUD, interactive selection mode (`isCollecting`/`startCollecting`/`stopCollecting`), `templatePreset`, dedup, reorder. Persisted to localStorage as `collection-storage` v1. |
| `CollectionModeProvider.tsx` | `workflows/export/context/` | Working. React context wrapping entire app at `App.tsx` level. Provides `isCollecting`, `addToCollection`, `removeFromCollection`, `isInCollection`, `selectionCount`. Escape key exits collection mode. |
| `SelectableWrapper.tsx` | `workflows/export/components/` | Working. HOC wrapping data elements. During collection mode: amber dashed hover outline, emerald solid outline when selected, flash animation on add, checkmark badge. |
| `CollectionPanel.tsx` | `workflows/export/panels/` | Working. Left sidebar: collection list with create/delete/select. Shows name and item count. |
| `CollectionPreview.tsx` | `workflows/export/components/` | Working. Center view: items grouped by sourceId, list/cards/raw view modes via SegmentedControl, Start/Stop Collecting button, item count. |
| `CollectionItemCard.tsx` | `workflows/export/components/` | Working. Card with type icon, drag handle, label, value preview, remove button. |
| `TemplatePresetSelector.tsx` | `workflows/export/components/` | Working. Dropdown for template format: BFA Document, CSV, Google Docs, Custom. |
| `GenerationPanel.tsx` | `workflows/export/panels/` | Working but misrouted. Right sidebar: output module cards (BFA Document, CSV, Google Docs) with per-format settings fold-outs. Generate button. Currently calls `generateReport()` via AutoHelper localhost API -- needs to call backend export session pipeline instead. |
| `CollectionFlashOverlay.tsx` | `workflows/export/components/` | Working. Visual feedback animation when adding to collection. |

**Integration points already wired:**

| Surface | Integration | How |
|---------|-------------|-----|
| `DataTableFlat.tsx` | Wraps each cell in `SelectableWrapper` when `isCollecting` | `type="field"`, `sourceId=record.id`, `fieldKey=col.key` |
| `MillerColumn.tsx` | Wraps each item in `SelectableWrapper` when `isCollecting` | `type="field"`, `sourceId=item.id` |
| `Header.tsx` | "Browse/Aggregate" segmented control toggles collection mode | Switches to aggregate mode starts collecting; browse mode stops |
| `FieldsPanel.tsx` | Stops collecting when switching to instances tab | Auto-stops via `useEffect` |
| `SelectionInspector.tsx` | Inspector handles collection mode display | Shows selection details |
| `App.tsx` | `CollectionModeProvider` wraps entire app | All components can access collection context |

**Data model:**

```typescript
// Already exists in collectionStore.ts
type SelectionType = 'record' | 'field' | 'node' | 'action' | 'event' | 'artist';

interface SelectionReference {
    id: string;
    type: SelectionType;
    sourceId: string;       // Record ID, Node ID, etc.
    fieldKey?: string;      // For field-level selections
    displayLabel: string;   // Human-readable label
    value?: unknown;        // Cached value at selection time
}

type TemplatePreset = 'bfa_rtf' | 'csv' | 'google_docs' | 'custom';

interface Collection {
    id: string;
    name: string;
    templatePreset: TemplatePreset;
    selections: SelectionReference[];
    createdAt: string;
    updatedAt: string;
}
```

**Old export UI (to be replaced):**
- `ExportWorkbenchSidebar.tsx` -- Project list with checkboxes + staleness/decay dots. A standalone project BROWSER.
- `ExportWorkbenchContent.tsx` -- Session-based configure/output two-step flow
- `ExportContent.tsx` -- Thin wrapper composing sidebar + content into workspace
- `exportWorkbenchStore.ts` -- `selectedProjectIds: Set<string>`, format, options, step flow

**Frontend API hooks (existing):**
- `frontend/src/api/hooks/exports.ts` -- `useCreateExportSession`, `useGenerateExportProjection`, `useExecuteExport`, `useExportSession`, `useExportSessions`, `useDownloadExportOutput`, `useStalenessDetection`, `useEmailDecayDetection`, `useBackfeedAnalysis`, `useExportWorkflow`, etc.

**AutoHelper generate API (currently used by GenerationPanel):**
- `frontend/src/api/generate.ts` -- `generateReport()` calls AutoHelper at localhost:8100. This is the wrong execution path for the export interface -- it bypasses the backend entirely.

### What Was Closed

PR #477 (Export Package Queue Architecture) introduced `export_packages` table, package service, queue panel, resolution flows. Closed as too complex. The collection system already solves the item selection problem that #477 was trying to address at the database level.

### What the Demo Shows

`docs/demos/demo-exportcontent.tsx` renders a three-panel layout:
- Left: project list with checkboxes, health dots
- Center: pre-flight banner, format cards (5 formats), section toggles (6 sections), footer action bar
- Right: document paper mockup preview

This plan maps the demo's center panel (format + sections + action bar) onto the export surface, while using the Collection System's existing components for the left panel (collection list + item management) and adapting GenerationPanel for the right panel (output configuration + execution).

---

## Architecture: Collection-Driven Export

### The Core Insight

The Collection System already solves intake. Users enter collection mode from the header, click on records/fields/nodes across any panel in the workspace, and build named collections with `SelectionReference[]`. These collections persist in localStorage. The `templatePreset` field on each collection already maps to an output format concept.

What is missing is the bridge from collection to execution. The GenerationPanel currently calls AutoHelper's `generateReport()` directly -- a localhost-only, template-string-based generation path that cannot produce real export artifacts. The backend's export session pipeline (`createExportSession` -> `generateProjection` -> `executeExport`) is the production execution path, but nothing connects collections to it.

### The Bridge

```
Collection (collectionStore)
    |
    | Extract project IDs from selections
    | (sourceId on 'node' type selections -> root_project_id lookup)
    | (sourceId on 'record' type selections -> parent project lookup)
    |
    v
Export Session (backend)
    |
    | POST /exports/sessions { projectIds, format, options }
    | POST /exports/sessions/:id/projection
    | POST /exports/sessions/:id/execute
    |
    v
Export Result (download / cloud link / inline text)
```

The collection's `templatePreset` maps to backend `ExportFormat`:
- `bfa_rtf` -> `'rtf'`
- `csv` -> `'csv'`
- `google_docs` -> `'google-doc'`
- `custom` -> user-selected format from extended format list

The collection's `selections` are resolved to `projectIds` for the backend:

```typescript
// Resolution logic (new utility)
function resolveProjectIds(selections: SelectionReference[]): string[] {
    const projectIds = new Set<string>();
    for (const sel of selections) {
        switch (sel.type) {
            case 'node':
                // sourceId IS a hierarchy node ID -- look up root_project_id
                // Requires hierarchy store or a backend lookup
                projectIds.add(sel.sourceId); // Phase 1: assume sourceId = project ID for nodes
                break;
            case 'record':
            case 'field':
                // sourceId is a record ID -- need parent project resolution
                // Phase 1: use hierarchy store to find root_project_id
                break;
            case 'artist':
                // Artist selections don't map to projects -- handled separately
                break;
        }
    }
    return Array.from(projectIds);
}
```

### Layout

```
+-------------------+----------------------------------+---------------------+
|                   |                                  |                     |
|  LEFT SIDEBAR     |  CENTER MAIN AREA                |  RIGHT PANEL        |
|  CollectionPanel  |                                  |  Output config +    |
|                   |  Collection items display        |  execution          |
|  COLLECTIONS      |  (CollectionPreview)             |                     |
|  > Collection 1   |                                  |  Format selector    |
|    Collection 2   |  Start/Stop Collecting           |  Per-format settings|
|                   |  View mode: list/cards/raw       |  Section toggles    |
|  + New Collection |  Items grouped by source         |  Pre-flight banner  |
|                   |                                  |  Generate button    |
|                   |                                  |                     |
|                   |                                  |  Generated outputs  |
+-------------------+----------------------------------+---------------------+
```

This layout uses the three existing components:
- **Left**: `CollectionPanel` (already built)
- **Center**: `CollectionPreview` (already built)
- **Right**: `GenerationPanel` (already built, needs rewiring from AutoHelper to backend sessions)

The demo's format cards and section toggles move to the right panel (merged into GenerationPanel's output module concept). The demo's preview panel is deferred -- the center area shows collection items, not a document mockup.

---

## Data Flow: Building a Collection

```
User clicks "Aggregate" toggle in Header (existing)
  |
  v
Header: collectionMode.startCollecting()  (existing)
  |
  +-- If no active collection: collectionStore.createCollection() auto-creates one
  |
  v
User navigates to any data surface (DataTableFlat, MillerColumn, etc.)
  |
  v
SelectableWrapper renders around each cell/item  (existing)
  |
  +-- Amber dashed outline on hover
  +-- Click: collectionMode.addToCollection({type, sourceId, fieldKey, displayLabel, value})
  +-- Emerald outline + checkmark badge on selected items
  +-- Flash animation on add
  |
  v
collectionStore: selection added to activeCollection.selections[]  (existing)
  |
  v
User presses Escape or clicks "Stop Collecting"  (existing)
  |
  v
collectionMode.stopCollecting()  (existing)
  |
  v
User navigates to export surface: workspaceStore.setCenterContentType('export')
  |
  v
ExportContent renders: CollectionPanel | CollectionPreview | GenerationPanel
  |
  +-- CollectionPanel shows the collection with item count
  +-- CollectionPreview shows items in list/cards/raw view
  +-- GenerationPanel shows output format options + generate button
```

This entire flow up to the export surface navigation is ALREADY WORKING. The gap is only in `ExportContent.tsx` (which mounts the old components) and `GenerationPanel` (which calls the wrong API).

---

## Data Flow: Export Execution (The Bridge)

```
User has a collection with N selections
  |
  v
User selects output module in GenerationPanel (BFA Document / CSV / Google Docs)
  |
  +-- collectionStore.setTemplatePreset(collectionId, preset)  (existing)
  |
  v
User configures per-format settings (existing fold-out UI in GenerationPanel)
  |
  v
User clicks "Generate Output"
  |
  v
NEW: resolveProjectIds(collection.selections) -> projectIds: string[]
  |
  +-- For 'node' type: look up root_project_id via hierarchyStore or API
  +-- For 'record'/'field' type: look up parent project via record -> node -> root_project_id
  +-- Dedup across selections
  |
  v
NEW: Map templatePreset to ExportFormat
  |
  +-- bfa_rtf -> 'rtf'
  +-- csv -> 'csv'
  +-- google_docs -> 'google-doc'
  +-- custom -> use exportWorkbenchStore.format (user-selected)
  |
  v
Frontend: useExportWorkflow().startExport({format, projectIds, options})  (existing hook)
  |
  +-- POST /exports/sessions         -> createExportSession()
  +-- POST /sessions/:id/projection  -> generateProjection() -> projectBfaExportModels()
  +-- POST /sessions/:id/execute     -> executeExport() -> format-specific handler
  |
  v
Frontend: Handle result  (existing patterns)
  |
  +-- Binary (pdf/docx/rtf): GET /sessions/:id/output -> download
  +-- Text (md/csv/plaintext): ExportResult.content displayed inline
  +-- Cloud (google-*): ExportResult.externalUrl opened in new tab
```

---

## Data Flow: Pre-flight Intelligence

```
Collection has selections
  |
  v
resolveProjectIds(selections) -> projectIds
  |
  v
useStalenessDetection(projectIds, thresholdDays)  (EXISTING)
  +-- GET /exports/context/staleness?projectIds=...&thresholdDays=...
  |
useEmailDecayDetection(projectIds)  (EXISTING)
  +-- GET /exports/context/email-decay?projectIds=...
  |
  v
Display: Pre-flight section in GenerationPanel (above generate button)
  +-- "N projects haven't been updated in 14+ days"
  +-- "N projects have unanswered outreach"
```

---

## Data Flow: Live Preview (Deferred)

The demo shows a document paper mockup in the right panel. The existing `GenerationPanel` does not have a preview -- it shows output format selection and a generate button. A live preview would require:

```
Collection selections change / format changes / section toggles change
  |
  v
POST /exports/preview (NEW endpoint, no session)
  |
  +-- projectBfaExportModels(projectIds, options) -> BfaProjectExportModel[]
  |
  v
Render structured preview in a document mockup component
```

This is Phase 3 work. The center panel (`CollectionPreview`) already shows what is IN the collection. The preview of what the output LOOKS LIKE is a separate concern.

---

## Schema Changes

### ExportOptions Extension

| Demo Section | Current ExportOptions Field | Action |
|---|---|---|
| Executive Summary | `includeStatusNotes` | Rename concept; keep field name for compatibility |
| Key Contacts | `includeContacts` | Exists |
| Budget Status | `includeBudgets` | Exists |
| Milestone Timeline | `includeMilestones` | Exists |
| Risk Register | (none) | Add `includeRiskRegister: z.boolean()` |
| Artwork Imagery | (none) | Add `includeArtworkImagery: z.boolean()` |

### ExportFormat Extension

Add `'json'` to `ExportFormatSchema`. The backend gains a JSON formatter.

### TemplatePreset Alignment

The collection's `TemplatePreset` type (`'bfa_rtf' | 'csv' | 'google_docs' | 'custom'`) maps to `ExportFormat`. A mapping utility in the frontend converts between them. No schema change needed on the collection side -- the mapping is one-directional (collection preset -> backend format).

### SelectionType Extension (Possible Future)

The current `SelectionType = 'record' | 'field' | 'node' | 'action' | 'event' | 'artist'` covers existing data surfaces. If new surfaces gain `SelectableWrapper` integration (e.g., import items, log entries), new types would be added. No change needed for Phase 1.

---

## Phased Implementation

### Phase 1: Mount Collection Components + Rewire Generation

**Purpose:** Replace the old export UI with the existing collection system components. Rewire `GenerationPanel` from AutoHelper to backend export sessions. This is primarily a wiring change -- most components already exist.

**Modified files:**

1. **`frontend/src/ui/workspace/content/ExportContent.tsx`** (REWRITE)
   - Replace `ExportWorkbenchSidebar` + `ExportWorkbenchContent` with three-panel layout:
     - Left: `CollectionPanel` (existing, no changes)
     - Center: `CollectionPreview` (existing, no changes)
     - Right: `GenerationPanel` (existing, rewired)
   - Three-panel layout with resizable borders

2. **`frontend/src/workflows/export/panels/GenerationPanel.tsx`** (MODIFY)
   - Remove `generateReport()` import and AutoHelper API call
   - Import and use `useExportWorkflow` from existing API hooks
   - Add `resolveProjectIds()` utility to extract project IDs from collection selections
   - Add `mapPresetToFormat()` utility to convert `TemplatePreset` to `ExportFormat`
   - Replace `handleGenerate`:
     ```typescript
     // OLD: calls AutoHelper directly
     const result = await generateReport({...});

     // NEW: calls backend export session pipeline
     const projectIds = resolveProjectIds(activeCollection.selections);
     const format = mapPresetToFormat(activeCollection.templatePreset);
     const result = await exportWorkflow.startExport({ format, projectIds, options });
     ```
   - Add result handling: download for binary, inline display for text, external URL for cloud
   - Add section toggles from the demo (map to `ExportOptions` fields)
   - Add pre-flight intelligence section (staleness/decay counts from existing hooks)

3. **`shared/src/schemas/exports.ts`** (MODIFY)
   - Add `includeRiskRegister: z.boolean()` and `includeArtworkImagery: z.boolean()` to `ExportOptionsSchema`
   - Add `'json'` to `ExportFormatSchema` enum
   - Update `DEFAULT_EXPORT_OPTIONS` with new fields
   - Add `SECTION_DEFINITIONS` constant array for UI rendering

4. **`backend/src/modules/exports/exports.service.ts`** (MODIFY)
   - Add `exportAsJson()` function (simple JSON serializer)
   - Add `'json'` case to `executeExport()` switch

5. **`backend/src/modules/exports/exports.routes.ts`** (MODIFY)
   - Add `POST /exports/preview` endpoint (stateless, no session)
   - Request: `{ projectIds: string[], options?: Partial<ExportOptions> }`
   - Response: `{ projects: BfaProjectExportModel[] }`

6. **`backend/src/modules/exports/formatters/json-formatter.ts`** (NEW)
   - JSON export formatter

7. **`frontend/src/api/hooks/exports.ts`** (MODIFY)
   - Add `usePreviewProjection(projectIds, options)` hook (for future preview use; foundation for Phase 3)

8. **Database migration** (NEW)
   - Add `'json'` to the format CHECK constraint on `export_sessions.format`

**Verification:**
- Open workspace. Switch to Aggregate mode in header. Click on cells in DataTableFlat. Items appear in active collection.
- Navigate to export surface. CollectionPanel shows collections. CollectionPreview shows items. GenerationPanel shows output options.
- Select BFA Document format. Click Generate. Backend session is created, projection runs, export executes. File downloads.

---

### Phase 2: Project ID Resolution + Section Toggles + Polish

**Purpose:** Robust resolution of `SelectionReference` to project IDs. Full section toggle UI matching the demo. Format-capability matrix.

**Modified files:**

1. **`frontend/src/workflows/export/utils/resolveProjectIds.ts`** (NEW)
   - Centralized resolution logic
   - For `type: 'node'`: look up `root_project_id` via `useHierarchyStore`
   - For `type: 'record'`/`'field'`: traverse hierarchy to find parent project node
   - For `type: 'artist'`: separate handling (artist-specific export, not project-based)
   - Caching: memoize lookups within a render cycle
   - Fallback: if hierarchy store lacks the node, issue a backend query

2. **`frontend/src/workflows/export/panels/GenerationPanel.tsx`** (MODIFY)
   - Replace inline `resolveProjectIds` with imported utility
   - Add section toggles grid matching demo layout (use `SECTION_DEFINITIONS` from shared)
   - Add format-capability matrix: gray out inapplicable toggles per format (CSV cannot include imagery, etc.)
   - Show resolved project count alongside selection count ("12 selections across 3 projects")
   - Improve result display: inline text preview, download button, cloud link

3. **`frontend/src/workflows/export/components/CollectionPreview.tsx`** (MODIFY)
   - Add project grouping view (group selections by resolved project, not just sourceId)
   - Add drag-and-drop reorder (collectionStore.reorderSelections already exists)

4. **`frontend/src/stores/exportWorkbenchStore.ts`** (MODIFY)
   - Add `sectionConfig: Record<string, boolean>` to state
   - Add `setSectionConfig`, `toggleSection` actions
   - Remove `selectedProjectIds`, `toggleProject`, `selectAll`, `selectNone`, `previewProjectId`, `setPreviewProject` -- replaced by collection system
   - Increment version to 4

5. **`frontend/src/workflows/export/types.ts`** (MODIFY)
   - Add `'json'` to `EXPORT_FORMATS`
   - Add `group: 'document' | 'data' | 'cloud'` to `ExportFormatOption`

6. **Design token audit:**
   - All new/modified components use `--ws-*` tokens
   - No hardcoded blue/emerald/slate from the demo
   - Focus: 1px oxide blue ring, no glow
   - Motion: 120-160ms ease-out
   - Typography: Source Sans 3 for UI chrome
   - Empty states: silent (blank collection list with label, no commentary)

**Verification:**
- Collection with records from 5 different projects resolves to correct 5 project IDs
- Section toggles gray out when incompatible with selected format
- Drag-and-drop reorder works in CollectionPreview
- Format selection persists via `templatePreset` on collection

---

### Phase 3: Document Preview + Extended Selection Surfaces + Dead Code Removal

**Purpose:** Add the demo's document paper mockup as a live preview. Extend `SelectableWrapper` to new surfaces. Clean up old export UI.

**New files:**

1. **`frontend/src/workflows/export/components/ExportDocumentPreview.tsx`** (NEW)
   - Document paper mockup matching demo right panel
   - Renders from `usePreviewProjection` data (backend stateless preview)
   - Paper styling: white card, Source Serif 4 headings, Source Sans 3 body
   - Responds to section toggle changes (hides/shows sections)
   - Shows placeholder when no selections or no project IDs resolved

2. **`frontend/src/workflows/export/components/ExportResultScreen.tsx`** (NEW)
   - Success confirmation with download/open action
   - Handles binary, text, and cloud format results
   - "Start New Export" resets to collection view

**Modified files:**

3. **`frontend/src/ui/workspace/content/ExportContent.tsx`** (MODIFY)
   - Add optional preview panel (fourth panel, visible on wide screens)
   - OR: replace center CollectionPreview with tabbed view (Items / Preview)

4. **`frontend/src/workflows/export/panels/GenerationPanel.tsx`** (MODIFY)
   - Handle import-sourced selections (if `SelectionType` is extended for import items)
   - Full error handling and retry on failed exports

5. **SelectableWrapper integration into new surfaces:**
   - `frontend/src/ui/composites/ProjectView.tsx` -- wrap project-level elements for whole-project selection
   - Import workflow surfaces (if import-to-export handoff is needed)

**Dead code removal:**

6. Files to remove:
   - `frontend/src/workflows/export/panels/ExportInspector.tsx` -- Dead code, never mounted
   - `frontend/src/workflows/export/panels/ExportWorkbenchSidebar.tsx` -- Replaced by CollectionPanel
   - `frontend/src/workflows/export/views/ExportWorkbenchContent.tsx` -- Replaced by CollectionPreview + GenerationPanel
   - `frontend/src/workflows/export/generators/GeneratorService.ts` -- Artist page generator, unrelated to export pipeline
   - Evaluate `ExportPreview.tsx`, `ExportOutputPanel.tsx`, `ContextSummaryPanel.tsx` for removal or integration

7. **`frontend/src/workflows/export/index.ts`** (MODIFY)
   - Remove exports for deleted components
   - Add exports for new components

**Integration verification trace:**

8. **Full collection-to-export trace:**
   - Trigger: User toggles "Aggregate" in header
   - State: `collectionStore.isCollecting = true`, auto-creates collection if none active
   - UI: DataTableFlat cells wrapped in SelectableWrapper, amber hover outlines appear
   - Click: User clicks 3 cells across 2 records
   - State: `activeCollection.selections` has 3 entries
   - Navigate: User switches `centerContentType` to `'export'`
   - UI: ExportContent renders CollectionPanel (left) + CollectionPreview (center) + GenerationPanel (right)
   - Configure: User selects "BFA Document" in GenerationPanel
   - State: `activeCollection.templatePreset = 'bfa_rtf'`
   - Execute: User clicks "Generate Output"
   - Resolution: `resolveProjectIds(selections)` extracts 2 project IDs
   - API: `POST /exports/sessions` -> `POST /sessions/:id/projection` -> `POST /sessions/:id/execute`
   - Result: RTF file downloads

---

## What Does NOT Change

- **`export_sessions` table** -- No new tables. Sessions remain the execution layer.
- **Backend service functions** -- `createExportSession`, `generateProjection`, `executeExport` stay as-is.
- **Projector** -- `projectBfaExportModels` is the sole projection engine for project-sourced data.
- **Formatters** -- markdown, csv, rtf, plaintext untouched.
- **Connectors** -- Google/OneDrive OAuth untouched.
- **Output store** -- Disk storage untouched.
- **Context helper endpoints** -- Staleness, email decay, backfeed endpoints untouched.
- **Finance export routes** -- Invoice routes untouched.
- **CollectionModeProvider** -- No changes. Already wraps entire app.
- **SelectableWrapper** -- No changes in Phase 1/2. Phase 3 adds it to new surfaces.
- **collectionStore** -- No changes. The store already has everything needed: `Collection`, `SelectionReference`, `templatePreset`, `selections[]`, `reorderSelections`, `isCollecting` mode.
- **DataTableFlat / MillerColumn** -- No changes. Already integrate with collection mode.
- **Header "Browse/Aggregate" toggle** -- No changes. Already controls collection mode.

---

## Risks

### 1. SelectionReference to Project ID Resolution

**Risk:** The bridge from `SelectionReference.sourceId` to a project ID is non-trivial. A `sourceId` for `type: 'field'` is a record ID. A record belongs to a hierarchy node. A hierarchy node has a `root_project_id`. This requires traversing the hierarchy.

**Mitigation:** Phase 1 uses a simple heuristic (assume `sourceId` for node-type selections IS a project ID). Phase 2 adds proper resolution via `useHierarchyStore` which already maintains the node tree in memory. Worst case, add a backend endpoint `POST /exports/resolve-project-ids` that takes `sourceIds[]` and returns `projectIds[]`.

### 2. TemplatePreset to ExportFormat Mismatch

**Risk:** The collection's `TemplatePreset` has 4 values (`bfa_rtf`, `csv`, `google_docs`, `custom`). The backend's `ExportFormat` has 9 values (rtf, plaintext, markdown, csv, google-doc, google-sheets, google-slides, pdf, docx + json). The mapping is lossy -- `custom` maps to "whatever the user picks from the full list."

**Mitigation:** `GenerationPanel` already shows output modules with fold-out settings. The `custom` preset can expand to show the full format list. The mapping function defaults to `rtf` for unknown presets. Phase 2 can extend `TemplatePreset` to cover more formats if needed.

### 3. GenerationPanel Rewiring Scope

**Risk:** `GenerationPanel` currently uses `generateReport()` from AutoHelper API. The rewiring to backend sessions changes the async flow (single POST -> three sequential POSTs with intermediate states). Error handling, loading states, and result display all need updating.

**Mitigation:** The `useExportWorkflow` hook already orchestrates the three-POST sequence. `GenerationPanel` just needs to call the hook instead of the direct API. Loading states map naturally: `isLoading` covers all three steps. Error handling uses the hook's error state.

### 4. Collection Persistence vs. Export Ephemeral State

**Risk:** Collections persist in localStorage. The old plan argued staging should be ephemeral (not persisted) because stale items are misleading. But collection persistence is actually desirable -- users build collections over multiple sessions and expect them to survive page refreshes.

**Mitigation:** This is a feature, not a bug. Collections are intentionally persistent. They have names, creation dates, and explicit delete actions. They are not an anonymous staging list -- they are named working sets. The user explicitly manages them (create, rename, delete). Stale items are the user's responsibility, and the pre-flight intelligence (staleness/decay indicators) helps them identify issues.

### 5. Preview Endpoint Performance

**Risk:** `projectBfaExportModels` queries the database per project. Live preview with rapid section toggle changes could bottleneck.

**Mitigation:** 400ms debounce on frontend. TanStack Query `staleTime: 30000`. Preview is Phase 3 and only renders on wide screens. The preview endpoint is stateless (no session creation overhead).

### 6. AutoHelper API Removal from GenerationPanel

**Risk:** Removing the AutoHelper `generateReport` call breaks artist page generation for anyone using that flow.

**Mitigation:** `GeneratorService.ts` (artist page HTML/Markdown generator) is a separate module from export. If anyone needs it, it can be accessed through AutoHelper directly, not through the export surface. The export surface should only produce outputs through the backend pipeline.

### 7. Format/Section Mismatch

**Risk:** Some section toggles don't apply to all formats. CSV cannot include imagery.

**Mitigation:** Format-capabilities matrix in shared types. Frontend grays out inapplicable toggles. Backend ignores irrelevant options gracefully (already does this).

---

## File Summary

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `backend/src/modules/exports/formatters/json-formatter.ts` | 1 | JSON export formatter |
| `frontend/src/workflows/export/utils/resolveProjectIds.ts` | 2 | SelectionReference -> project ID resolution |
| `frontend/src/workflows/export/components/ExportDocumentPreview.tsx` | 3 | Live document paper mockup preview |
| `frontend/src/workflows/export/components/ExportResultScreen.tsx` | 3 | Success/download screen |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `frontend/src/ui/workspace/content/ExportContent.tsx` | 1 | Replace old components with CollectionPanel + CollectionPreview + GenerationPanel |
| `frontend/src/workflows/export/panels/GenerationPanel.tsx` | 1,2 | Rewire from AutoHelper to backend export sessions. Add section toggles, pre-flight, result handling. |
| `shared/src/schemas/exports.ts` | 1 | Add `json` format, `includeRiskRegister`, `includeArtworkImagery`, `SECTION_DEFINITIONS` |
| `backend/src/modules/exports/exports.service.ts` | 1 | Add `exportAsJson()`, add `'json'` case to switch |
| `backend/src/modules/exports/exports.routes.ts` | 1 | Add `POST /exports/preview` endpoint |
| `frontend/src/api/hooks/exports.ts` | 1 | Add `usePreviewProjection` hook |
| `frontend/src/stores/exportWorkbenchStore.ts` | 2 | Add `sectionConfig`, remove `selectedProjectIds`/`previewProjectId`, bump version |
| `frontend/src/workflows/export/types.ts` | 2 | Add JSON format, format groups |
| `frontend/src/workflows/export/components/CollectionPreview.tsx` | 2 | Project grouping, drag-and-drop |
| `frontend/src/workflows/export/index.ts` | 3 | Remove dead exports, add new exports |

### Files to Remove (Phase 3)

| File | Reason |
|------|--------|
| `frontend/src/workflows/export/panels/ExportInspector.tsx` | Dead code, never mounted |
| `frontend/src/workflows/export/panels/ExportWorkbenchSidebar.tsx` | Replaced by CollectionPanel |
| `frontend/src/workflows/export/views/ExportWorkbenchContent.tsx` | Replaced by CollectionPreview + GenerationPanel |
| `frontend/src/workflows/export/generators/GeneratorService.ts` | Artist page generator, unrelated to export pipeline |

### Database Migration

| Migration | Phase | Change |
|-----------|-------|--------|
| Add `'json'` to format CHECK constraint | 1 | `ALTER TABLE export_sessions ...` |

---

## Relationship to Closed PR #477

PR #477 tried to solve intake with a database-level `export_packages` concept. The collection system solves the same problem at the frontend level with a simpler model. Collections are named, persistent, user-managed sets of selection references. They don't need database tables, status lifecycles, or resolution flows. The backend only sees `projectIds: string[]` -- it doesn't know or care that those IDs came from a collection.

## Relationship to Design Brief

The brief describes "Select / Configure / Export / Get the File" as four beats:

1. **Select** -- Handled by the Collection System. Users enter collection mode, click on items, build named collections. This happens across the entire workspace, not inside the export surface.
2. **Configure** -- GenerationPanel's output module selection + section toggles.
3. **Export** -- Backend session pipeline: create session, project, execute.
4. **Get the File** -- Download binary, display text, or open cloud link.

The brief's "queue as deferred, not abandoned" is realized by collection persistence. Collections survive page refreshes and can be revisited later. The brief's "context intelligence" (staleness, email decay) integrates as pre-flight indicators in GenerationPanel, using existing backend endpoints.
