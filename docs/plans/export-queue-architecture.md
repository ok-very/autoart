# Export Package Queue Architecture

## Done Sentence

A user can submit export packages from multiple sources (collection builder, import parser output, ad-hoc record selections, filtered views) into a persistent queue, then process, configure, and execute them from a unified export workbench — instead of being forced through collection assembly first.

---

## Current State

Two export paths exist and compete:

- **Path A (Legacy):** Collection-based, entirely client-side. Collections in localStorage, export via Blob download. Already marked deprecated in `frontend/src/workflows/export/index.ts`.
- **Path B (Session-based):** `export_sessions` table, backend projection (`projectBfaExportModels`), formatter pipeline (RTF, Markdown, CSV, etc.). Partially built via `ExportWorkbenchContent` + `ExportWorkbenchSidebar`, not yet the default surface.

The package queue subsumes Path B. Sessions become the execution layer; packages become the intake/queue layer.

### Key Files (Current)

**Backend:**
- `backend/src/modules/exports/exports.service.ts` — Session CRUD, projection, execution
- `backend/src/modules/exports/exports.routes.ts` — REST endpoints
- `backend/src/modules/exports/projectors/bfa-project.projector.ts` — BFA-specific projection
- `backend/src/modules/exports/output-store.ts` — Disk storage for outputs
- `backend/src/modules/exports/formatters/` — markdown, csv, rtf, plaintext
- `backend/src/modules/exports/targets/` — google-docs, pdf, bfa-rtf
- `backend/src/modules/exports/connectors/` — Google/OneDrive OAuth

**Frontend:**
- `frontend/src/workflows/export/views/ExportWorkbench.tsx` — Legacy monolithic view
- `frontend/src/workflows/export/views/ExportWorkbenchContent.tsx` — Session-based view (Path B)
- `frontend/src/workflows/export/panels/ExportWorkbenchSidebar.tsx` — Project list
- `frontend/src/workflows/export/panels/ExportInspector.tsx` — Options panel
- `frontend/src/stores/collectionStore.ts` — Client-side collections (localStorage)
- `frontend/src/stores/exportWorkbenchStore.ts` — Session-based UI state

**Shared:**
- `shared/src/schemas/exports.ts` — ExportFormat, ExportSession, ExportOptions, ExportResult schemas

**Import (resolution-relevant):**
- `backend/src/modules/imports/types.ts` — ImportPlan, ImportPlanItem, ItemClassification
- `frontend/src/workflows/import/panels/ClassificationPanel.tsx` — Resolution UI
- `frontend/src/workflows/import/components/ClassificationRow.tsx` — Single item row

---

## Architecture

### Package Model

```typescript
type PackageSourceType =
    | 'project_selection'    // Selected project IDs
    | 'collection'           // Snapshot from collection builder
    | 'import_handoff'       // Parsed import data with deferred resolution
    | 'record_set'           // Ad-hoc record selection (future)
    | 'filtered_view'        // Saved view criteria (future)

type PackageStatus =
    | 'pending'              // Submitted, awaiting user action
    | 'needs_resolution'     // Has unresolved items (import handoff)
    | 'configuring'          // User configuring export options
    | 'ready'                // Fully configured, can execute
    | 'projecting'           // Generating projection
    | 'executing'            // Export running
    | 'completed'            // Done
    | 'failed'               // Error
```

Packages are **snapshots** — editing the source after submission doesn't change the queued job (print queue model).

### Database: `export_packages`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | Package identifier |
| label | text | User-visible name |
| source_type | text | Discriminator for payload shape |
| source_payload | jsonb | Polymorphic: project IDs, collection data, import plan |
| resolution_state | jsonb | For import_handoff: totalItems, resolvedItems, classifications |
| format | text | Export format (rtf, markdown, csv, etc.) |
| options | jsonb | Export options |
| target_config | jsonb | Cloud target configuration |
| status | text | Lifecycle status |
| projection_cache | jsonb | Cached projection data |
| output_path | text | Disk path for output |
| output_mime_type | text | MIME type |
| error | text | Error message if failed |
| export_session_id | uuid FK | Link to underlying execution session |
| submitted_by | uuid FK | User |
| position | integer | Queue ordering |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| executed_at | timestamptz | |

### API Surface: `/api/exports/packages`

```
POST   /packages                    — Submit new package
GET    /packages                    — List queue (status filter, ordering)
GET    /packages/:id                — Get single package
PATCH  /packages/:id                — Update config (format, options, label, position)
DELETE /packages/:id                — Remove from queue
PATCH  /packages/:id/resolutions    — Resolve items (import_handoff only)
POST   /packages/:id/projection     — Generate projection
POST   /packages/:id/execute        — Execute export
GET    /packages/:id/output         — Download output
POST   /packages/reorder            — Reorder queue positions
POST   /packages/batch-execute      — Execute multiple ready packages
DELETE /packages/stale              — Clean up old completed/failed
```

### Projector Registry

Each source type registers a projector function that transforms `source_payload` into format-agnostic projection data:

```
project_selection  → projectBfaExportModels() (existing)
collection         → projectFromCollectionSelections() (new)
import_handoff     → projectFromImportItems() (new)
record_set         → projectFromRecordIds() (future)
```

Packages delegate to `export_sessions` for actual formatting/output. Sessions are the execution engine; packages are the intake layer.

### Frontend Layout

```
+------------------+-----------------------------------+-------------------+
|  Queue Panel     |       Active Package View         |  Export Inspector  |
|  (left sidebar)  |      (center content area)        |  (right sidebar)  |
|                  |                                   |                   |
|  [Pkg 1] active  |  Source: Import Handoff           |  Format: RTF      |
|  [Pkg 2]         |  Items: 12 (3 need resolution)    |  Options:         |
|  [Pkg 3]         |  Status: needs_resolution         |    [x] Contacts   |
|  ---             |                                   |    [x] Milestones |
|  [+ Add]         |  +---------------------------+    |                   |
|                  |  | Resolution panel (inline)  |    |  [Execute Export] |
|  Filters:        |  +---------------------------+    |                   |
|  [ ] Pending     |                                   |                   |
|  [ ] Ready       |  Preview area                     |                   |
+------------------+-----------------------------------+-------------------+
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Packages wrap sessions (not replace) | Sessions are a proven execution engine. No rewrite of formatters/targets/connectors. |
| Snapshot-on-submit | Decouples package from source lifecycle. Self-contained, no orphaning risk. |
| Projector registry | Each source type has different data structures. Registry is simplest polymorphism. |
| Resolution in export (not import) | User resolves in context of what they're exporting, not what they imported. |
| Queue panel replaces collection panel | Queue IS the collection surface. Collections become one submission type. |
| Server-side queue | Must survive across devices, sessions, users. localStorage was a limitation. |

---

## Phase 1: Queue Foundation (`project_selection` only)

Proves the queue model end-to-end with a single source type. No projection changes, no resolution flows.

### Step 1.1 — Shared schemas
**Delegate: backend-dev**

Create `shared/src/schemas/export-packages.ts`:
- `PackageSourceTypeSchema` (enum: project_selection only for now, but define all)
- `PackageStatusSchema` (enum: all statuses)
- `ExportPackageSchema` (full package shape)
- `SubmitProjectSelectionSchema` (sourceType: 'project_selection', projectIds, label?, format?, options?)
- `SubmitPackageBodySchema` (discriminated union, starting with project_selection only)
- Derived TypeScript types

Re-export from `shared/src/schemas/exports.ts` for convenience.

### Step 1.2 — Database migration
**Delegate: backend-dev**

Create `backend/src/db/migrations/NNN_export_packages.ts`:
- `export_packages` table with all columns from the schema above
- Indexes: status, submitted_by, position, created_at DESC
- CHECK constraints on source_type and status enums

Update `backend/src/db/schema.ts`:
- Add `ExportPackagesTable` interface
- Add `export_packages: ExportPackagesTable` to Database interface

### Step 1.3 — Projector registry
**Delegate: backend-dev**

Create `backend/src/modules/exports/projectors/registry.ts`:
- `ProjectorFn` type: `(sourcePayload, options) => Promise<unknown>`
- `Map<PackageSourceType, ProjectorFn>` registry
- `registerProjector()` and `getProjector()` functions
- Register `project_selection` projector that delegates to existing `projectBfaExportModels()`

### Step 1.4 — Package service
**Delegate: backend-dev**

Create `backend/src/modules/exports/packages.service.ts`:
- `submitPackage(body, userId)` — handles `project_selection` case, inserts row, returns ExportPackage
- `getPackage(id)` — single package fetch
- `listPackages(filter?)` — list with status filter, ordered by position/created_at
- `updatePackage(id, updates)` — update config, handle status transitions
- `deletePackage(id)` — remove from queue
- `generatePackageProjection(id)` — delegate to projector registry, cache result
- `executePackageExport(id)` — create underlying export_session, copy projection cache, delegate to `executeExport()`, copy output back
- `reorderPackages(orderedIds)` — update position column
- `mapDbToPackage()` — DB row to API shape (snake_case → camelCase)

### Step 1.5 — Package routes
**Delegate: backend-dev**

Create `backend/src/modules/exports/packages.routes.ts`:
- All endpoints from the API surface above
- Zod validation on request bodies
- Register in `backend/src/modules/exports/index.ts`

### Step 1.6 — Frontend store
**Delegate: frontend-dev**

Create `frontend/src/stores/exportQueueStore.ts`:
- `activePackageId: string | null`
- `filterStatus: PackageStatus | 'all'`
- `queueViewMode: 'list' | 'compact'`
- Persisted (filterStatus, queueViewMode only)
- Version 1

### Step 1.7 — API hooks
**Delegate: frontend-dev**

Create `frontend/src/api/hooks/export-packages.ts`:
- `useExportPackages(filter?)` — query with `['export-packages', filter]` key
- `useExportPackage(id)` — single package query
- `useSubmitExportPackage()` — mutation, invalidates list
- `useUpdateExportPackage()` — mutation, invalidates package + list
- `useDeleteExportPackage()` — mutation, invalidates list
- `useGeneratePackageProjection()` — mutation
- `useExecutePackageExport()` — mutation, invalidates package + list
- `useReorderPackages()` — mutation

### Step 1.8 — Queue panel (sidebar)
**Delegate: frontend-dev**

Create `frontend/src/workflows/export/panels/ExportQueuePanel.tsx`:
- Status filter chips (all | pending | needs_resolution | ready | completed | failed)
- Package list with `PackageListItem` components
- Drag handles for reorder (via `useReorderPackages`)
- "Add" button with `AddPackageMenu` dropdown

Create `frontend/src/workflows/export/components/PackageListItem.tsx`:
- Status badge (color-coded per DESIGN.md feedback colors)
- Source type icon
- Label, timestamp
- Click selects → sets `activePackageId` in store

Create `frontend/src/workflows/export/components/AddPackageMenu.tsx`:
- Dropdown: "From projects" (Phase 1), "From collection" (Phase 2), "From import" (Phase 2)
- "From projects" opens project selection sub-view (reuse `ExportWorkbenchSidebar` project list)

### Step 1.9 — Package detail view (center)
**Delegate: frontend-dev**

Create `frontend/src/workflows/export/views/PackageDetailView.tsx`:
- Reads `activePackageId` from store, fetches with `useExportPackage(id)`
- Renders `PackageHeader` (label, source type badge, status, timestamps)
- Status-dependent content:
  - `pending`/`configuring`/`ready`: `PackagePreview` (project list, selection summary)
  - `completed`: `PackageOutputView` (reuse `ExportOutputPanel`)
  - `failed`: error display
  - `needs_resolution`: reserved for Phase 2

Create `frontend/src/workflows/export/components/PackageHeader.tsx`
Create `frontend/src/workflows/export/components/PackagePreview.tsx`
Create `frontend/src/workflows/export/components/PackageOutputView.tsx`

### Step 1.10 — Queue content wrapper
**Delegate: frontend-dev**

Create `frontend/src/workflows/export/views/ExportQueueContent.tsx`:
- Three-panel layout: `ExportQueuePanel` | `PackageDetailView` | `ExportInspector`
- ExportInspector reused as-is, but reads format/options from active package (via hook) instead of store
- Execute button wired to `useExecutePackageExport`

Update `frontend/src/workflows/export/index.ts`:
- Export new queue components
- Update deprecation comments

### Step 1.11 — Verification
**Delegate: integrator**

Verify end-to-end:
- Submit project_selection package via API → appears in queue panel
- Configure format/options → status transitions correctly
- Execute → creates session, runs projection, runs formatter, stores output
- Download output → file matches existing session-based export
- Reorder packages → positions persist
- Delete package → removed from queue
- Error case → status=failed with message

---

## Phase 2: Collection + Import Handoff

### Step 2.1 — Collection submission schema
**Delegate: backend-dev**

Add to `shared/src/schemas/export-packages.ts`:
- `SubmitCollectionSchema` (sourceType: 'collection', collectionId, collectionName, templatePreset, selections)
- Add to `SubmitPackageBodySchema` discriminated union

### Step 2.2 — Collection projector + service case
**Delegate: backend-dev**

- Add `collection` case to `submitPackage()` — snapshots selections into source_payload
- Register `collection` projector in registry — builds export models from `SelectionReference[]`
- Create `backend/src/modules/exports/projectors/collection.projector.ts` if complex enough to warrant its own file

### Step 2.3 — Collection UI integration
**Delegate: frontend-dev**

- Add "Send to Export Queue" button in `CollectionPanel` header
- Add `submitToExportQueue(collectionId)` action to `useCollectionStore` — calls `useSubmitExportPackage` with collection data snapshot
- Update `AddPackageMenu` — enable "From collection" option, opens collection picker
- Update `PackagePreview` — render collection selections when sourceType is 'collection'

### Step 2.4 — Import handoff schema
**Delegate: backend-dev**

Add to `shared/src/schemas/export-packages.ts`:
- `SubmitImportHandoffSchema` (sourceType: 'import_handoff', importSessionId, label?)
- Add to `SubmitPackageBodySchema` discriminated union

### Step 2.5 — Import handoff service
**Delegate: backend-dev**

- Add `import_handoff` case to `submitPackage()`:
  - Fetch import plan via `getImportPlan(importSessionId)`
  - Copy items[], classifications[], containers[] into source_payload
  - Count unresolved (AMBIGUOUS/UNCLASSIFIED without resolution)
  - Set `resolution_state = { totalItems, resolvedItems, classifications }`
  - Status = `needs_resolution` if unresolved items exist, else `pending`
- Add `resolvePackageItems(packageId, resolutions)`:
  - FOR UPDATE lock on package row
  - Apply resolutions to `resolution_state.classifications`
  - Recalculate `resolvedItems`
  - Transition status when all resolved
- Add `PATCH /packages/:id/resolutions` route
- Register `import_handoff` projector — builds export models from resolved items

### Step 2.6 — Resolution UI in export workbench
**Delegate: frontend-dev**

- Decouple `ClassificationRow` from import context (ensure it takes all data as props, no `useImportContext()` dependency)
- Create `frontend/src/workflows/export/components/PackageResolutionPanel.tsx`:
  - Progress bar: "X of Y resolved"
  - List of unresolved `ClassificationRow` components
  - Outcome picker per item
  - Save button → `useResolvePackageItems()`
- Update `PackageDetailView` — render `PackageResolutionPanel` when status is `needs_resolution`

### Step 2.7 — Import workbench handoff button
**Delegate: frontend-dev**

- Add "Send to Export" button in `ClassificationPanel` header
- On click: call `useSubmitExportPackage` with `sourceType: 'import_handoff'`
- Navigate to export workbench queue view
- Add `useResolvePackageItems` hook to `frontend/src/api/hooks/export-packages.ts`

### Step 2.8 — Verification
**Delegate: integrator**

Verify:
- Collection snapshot: submit → modify original collection → package unchanged
- Collection export: submit → configure → execute → output contains selection data
- Import handoff (fully resolved): send to export → status=pending → execute → correct output
- Import handoff (partially resolved): send → status=needs_resolution → resolve inline → status transitions → execute
- Resolution decoupling: send items to export → delete import session → package still works
- Import workbench unchanged: can still resolve and execute entirely within import

---

## Phase 3: Cleanup + Future Sources

### Step 3.1 — Switch default surfaces
**Delegate: frontend-dev**

- `ExportPage.tsx` → render `ExportQueueContent` instead of `ExportWorkbench`
- `ExportPanel.tsx` → use queue-based component
- `ExportContent.tsx` → use queue-based component
- Absorb `useExportWorkbenchStore` into `useExportQueueStore`
- Mark legacy `ExportWorkbench` as removed

### Step 3.2 — Record set source type
**Delegate: backend-dev (schema + projector), frontend-dev (bulk action UI)**

- `SubmitRecordSetSchema` (sourceType: 'record_set', recordIds, definitionId?)
- `record_set` projector (queries records by ID, builds export models)
- "Export" action in table bulk selection toolbar

### Step 3.3 — Batch execution
**Delegate: backend-dev (endpoint), frontend-dev (UI)**

- `POST /packages/batch-execute` — sequential execution of all ready packages
- "Execute All Ready" button in queue panel header
- Progress tracking across batch

### Step 3.4 — Stale cleanup
**Delegate: backend-dev**

- `DELETE /packages/stale?older_than_days=30`
- Optional "Clean Up" button in queue panel

### Step 3.5 — Final verification
**Delegate: integrator**

- All three entry points render queue UI
- No references to legacy ExportWorkbench in active code paths
- Record-level export works from table selection
- Batch execution processes multiple packages
- Stale cleanup works

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Polymorphic projection complexity | High | Phase 1 only uses `project_selection` with existing projector. Build incrementally. |
| ClassificationRow coupled to import context | Medium | Audit props vs context dependency before Phase 2. Extract if needed. |
| Collection snapshot divergence | Low | Intentional by design. Packages are snapshots, not references. |
| Three competing export paths during migration | Medium | Phase 1 adds queue alongside existing. Phase 3 removes legacy. No overlap period longer than one phase. |
| Large projection_cache in JSONB | Low | Only loaded on single-package fetch, not list queries. Stale cleanup for old packages. |
| Concurrent execution | Low | FOR UPDATE row lock. Second executor sees completed/executing status. |

---

## What Does NOT Change

- `export_sessions` table and all session-level service code
- All formatters (RTF, Markdown, CSV, plaintext)
- All targets (Google Docs, PDF, BFA RTF)
- All connectors (Google, OneDrive OAuth)
- `ExportMenu` component (invoice-level shortcuts)
- Import workbench execution flow (resolve + execute within import still works)
- `output-store.ts` disk storage
