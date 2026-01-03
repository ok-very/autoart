# AutoArt Architectural Inventory & Refactor Plan

**Status:** Living document (compiled incrementally)
**Last updated:** 2026-01-01

---

## Part I — Architectural Inventory (Descriptive)

### 1. Frontend Components (`frontend/src/components/`)

#### Common (`/common`)
Reusable, generic UI components.

- Badge.tsx
- Button.tsx
- CloneExcludedToggle.tsx
- DataFieldWidget.tsx
- EmojiPicker.tsx
- ErrorBoundary.tsx
- MentionableInput.tsx
- PortalMenu.tsx
- ProgressBar.tsx
- RecordSearchCombobox.tsx
- ResizeHandle.tsx
- UserChip.tsx

#### Drawer (`/drawer`)
Sliding side panel management and views.

- **Registry:** DrawerRegistry.tsx
- **Container:** BottomDrawer.tsx
- **Views:**
  - Creation: CreateDefinitionView.tsx, CreateLinkView.tsx, CreateNodeView.tsx, CreateProjectView.tsx, CreateRecordView.tsx, AddFieldView.tsx
  - Management: ClassifyRecordsView.tsx, CloneDefinitionView.tsx, CloneProjectView.tsx
  - Deletion: ConfirmDeleteView.tsx
  - Viewing: IngestionDrawer.tsx, ProjectLibraryDrawer.tsx, ViewDefinitionDrawer.tsx, ViewRecordDrawer.tsx

#### Editor (`/editor`)
Rich text editing (TipTap).

- RichTextEditor.tsx
- RichTextInput.tsx
- Mentions: MentionChip.tsx, MentionExtension.ts, MentionSuggestion.tsx

#### Hierarchy (`/hierarchy`)
Tree visualization.

- Sidebar.tsx
- TreeNode.tsx

#### Inspector (`/inspector`)
Record detail editing panel.

- Container: RecordInspector.tsx
- Fields: LinkFieldInput.tsx, FieldRenderer.tsx, TagsInput.tsx, UserMentionInput.tsx
- Views: LinksView.tsx, RecordPropertiesView.tsx, ReferencesManager.tsx, SchemaEditorView.tsx

#### Layout (`/layout`)
Main application structure.

- Header.tsx
- MainLayout.tsx
- Workspace.tsx
- Views: CalendarView.tsx, MillerColumn.tsx, MillerColumnsView.tsx, ProjectWorkflowView.tsx

#### Modals (`/modals`) — **Deprecated**
Dialog components superseded by drawer system.

- Modal.tsx
- AddFieldModal.tsx
- ConfirmDeleteModal.tsx
- CreateNodeModal.tsx

#### Records (`/records`)
Record listing and categorization.

- RecordGrid.tsx
- RecordTypeSidebar.tsx

#### Tables (`/tables`)
Data grid representations.

- DataTable.tsx
- RecordDataTable.tsx
- TaskDataTable.tsx
- UniversalTableView.tsx
- Cells: EditableCell.tsx

---

### 2. Backend Services (`backend/src/modules/`)

| Module | Purpose | Key Files |
|---|---|---|
| Auth | Authentication & sessions | auth.routes.ts, auth.service.ts |
| Hierarchy | Tree management | hierarchy.routes.ts, hierarchy.service.ts |
| Ingestion | Data import/parsing | ingestion.routes.ts, ingestion.service.ts |
| Links | Record-to-record relationships | links.routes.ts, links.service.ts |
| Records | Record CRUD & definitions | records.routes.ts, records.service.ts |
| References | Task-to-record references | references.routes.ts, references.service.ts |
| Search | Global search | search.routes.ts, search.service.ts |

---

### 3. Data Entry Points

**Shared Schemas (`shared/src/schemas/`)** — single source of truth for validation types:

- auth.ts
- enums.ts
- hierarchy.ts
- links.ts
- records.ts
- references.ts
- search.ts
- tasks.ts

---

### 4. Legacy / Experimental Fields

**Backend:**
- `records.service.ts`: `cloneProjectTemplates` marked `@deprecated` (use `cloneProjectDefinitions`).
- `hierarchy_nodes.metadata.status`: legacy string-based logic; migrated to enum (Migration 015).

**Potential legacy:**
- `project_id` on `record_definitions` driving template library logic; `clone_excluded` added to address prior cloning nuances.

**UI:**
- `modals/` deprecated; functionality handled via `BottomDrawer` / `DrawerRegistry`. Target is a unified, collapsible drawer system.

---

## Part II — Architectural Refactor Plan (Prescriptive)

### 5. Frontend Layering

**Target layers:**

```
ui/
  atoms/
  molecules/
  composites/
```

- **Atoms:** render-only primitives (e.g., Badge, Button, ProgressBar, ResizeHandle, UserChip).
- **Molecules:** schema-aware field components (e.g., FieldRenderer, EditableCell, LinkFieldInput, TagsInput).
- **Composites:** domain-orchestrating views (e.g., RecordInspector, ProjectWorkflowView, RecordGrid).

Rules:
- Atoms have no project/record knowledge.
- Molecules receive pre-shaped view models.
- Composites assemble molecules using domain outputs.

---

### 6. Drawer System Unification

- Freeze creation of new modals.
- Migrate modal logic into drawer views.
- Route all flows through `DrawerRegistry` and `BottomDrawer`.
- Remove `/modals` after parity is achieved.

Planned enhancement: drawer modes (`modal | panel | inline`).

---

### 7. Domain Logic Extraction

Introduce a domain layer (frontend + backend aligned):

```
/domain
  fieldVisibility
  completeness
  referenceResolution
```

- Centralize field visibility, requiredness, and editability.
- Compute missing fields in one place.
- Backend and frontend consume the same rule set conceptually.

---

### 8. Reference System Normalization

- Define reference states: `unresolved | dynamic | static | broken`.
- Backend resolves and detects drift.
- Frontend displays state only; no value resolution.

---

### 9. Legacy Data Policy

- Mark deprecated fields explicitly in schema.
- Block new writes to deprecated fields.
- Migrate or archive legacy data before removal.

---

### 10. UI → Backend Traceability

- Add semantic UI tags: `data-aa-id`, `data-aa-component`, `data-aa-view`.
- Enrich API requests with `ui_context`.
- Backend logs and errors reference `field_id` for round-tripping.

---

## Part III — Appendices (In Progress)

### Appendix A — FieldViewModel (Draft)

```ts
interface FieldViewModel {
  fieldId: string
  label: string
  value: any
  visible: boolean
  editable: boolean
  required: boolean
  error?: string
}
```

Source of truth:
- Field IDs from shared schemas
- Visibility/editability from domain logic

---

*Next appendices will formalize drawer registry contracts, domain rule interfaces, and a component teardown example.*

---

## Appendix C — Domain Rule Interfaces (Canonical)

### Purpose

Define explicit, UI-agnostic interfaces for project rules so frontend and backend share the same conceptual model. These interfaces describe **inputs and outputs only**; implementations may differ by layer.

---

### C.1 Field State Resolution

Determines whether a field should be visible, editable, or required given the current project state.

```ts
interface FieldState {
  fieldId: string
  visible: boolean
  editable: boolean
  required: boolean
  reason?: string
}

function getFieldState(
  fieldId: string,
  projectState: ProjectState
): FieldState
```

Rules:
- No UI components compute field rules
- Backend uses this for validation and error reporting
- `reason` is human-readable (used for tooltips / logs)

---

### C.2 Missing Field Detection

Computes incomplete or blocking data.

```ts
interface MissingField {
  fieldId: string
  phase: number
  severity: 'blocking' | 'warning'
}

function getMissingFields(
  projectState: ProjectState
): MissingField[]
```

Used by:
- UI progress indicators
- Notifications / reminders
- Export readiness checks

---

### C.3 Phase Progression Rules

```ts
function canAdvancePhase(
  currentPhase: number,
  projectState: ProjectState
): { allowed: boolean; blockers: MissingField[] }
```

No UI element infers phase readiness implicitly.

---

### C.4 Reference Resolution

```ts
interface ResolvedReference {
  referenceId: string
  status: 'dynamic' | 'static' | 'broken' | 'unresolved'
  value?: any
  sourceField?: string
}

function resolveReference(
  reference: Reference,
  projectState: ProjectState
): ResolvedReference
```

Rules:
- Frontend never resolves values directly
- Backend is authoritative

---

## Appendix D — Component Teardown Example (`RecordInspector.tsx`)

### D.1 Current Responsibilities (Observed)

`RecordInspector.tsx` currently:
- Fetches record data
- Determines which fields to show
- Renders layout
- Handles references
- Performs side effects

This makes it non-reusable and difficult to test.

---

### D.2 Target Decomposition

#### Composite: `RecordInspector`
- Requests domain view models
- Handles drawer invocations
- Coordinates subcomponents

#### Molecules:
- `FieldGroup`
- `ReferenceBlock`
- `PropertySection`

#### Atoms:
- `Label`
- `ValueDisplay`
- `InlineError`

---

### D.3 Data Flow (After Refactor)

```
ProjectState
   ↓ (domain rules)
FieldViewModels[]
   ↓
RecordInspector (composite)
   ↓
FieldGroup (molecule)
   ↓
Atoms
```

No component below the composite layer reads raw project JSON.

---

### D.4 Benefits

- Inspector logic is declarative
- Fields render consistently everywhere
- Debugging occurs at the domain boundary

---

## Appendix E — Legacy Migration Checklist

### Purpose

Provide explicit criteria for removing deprecated fields and logic safely.

---

### E.1 Identification

For each legacy field or path:
- Field ID
- Location (frontend / backend)
- Replacement (if any)

---

### E.2 Migration Steps

1. Mark field as `deprecated: true` in schema
2. Log all runtime access
3. Migrate stored data (if required)
4. Block new writes
5. Remove UI rendering
6. Remove backend handling

---

### E.3 Safe Removal Gate

A legacy element may be deleted only when:
- No runtime logs for N days
- No frontend references
- No backend writes
- Migration script executed (if applicable)

---

### E.4 Initial Candidates

- `cloneProjectTemplates` (backend)
- `hierarchy_nodes.metadata.status`
- `/modals/*`

---

---

## Appendix B — Drawer Registry Contract (Proposed)

### Purpose

Define a single, explicit contract for all drawer-based UI flows, replacing legacy modal logic and preventing future divergence.

This appendix formalizes how drawers are:
- Registered
- Invoked
- Passed context
- Closed or transitioned

---

### B.1 Current State Summary

- `DrawerRegistry.tsx` acts as an implicit lookup table
- `BottomDrawer.tsx` manages rendering and animation
- Drawer views rely on ad-hoc props and implicit assumptions
- Legacy modal flows duplicate logic now handled by drawers

This creates:
- Inconsistent invocation patterns
- Hidden coupling between callers and drawer views
- Difficulty tracing UI intent to backend operations

---

### B.2 Target Abstraction

A drawer is treated as a **stateful UI operation**, not a component.

Each drawer:
- Declares what context it requires
- Declares what actions it can emit
- Is addressable by a stable ID

---

### B.3 Drawer Definition Interface

```ts
interface DrawerDefinition<Context = unknown, Result = unknown> {
  id: string
  component: React.ComponentType<DrawerProps<Context, Result>>
  size?: 'sm' | 'md' | 'lg'
  collapsible?: boolean
}

interface DrawerProps<Context, Result> {
  context: Context
  close: () => void
  submit: (result: Result) => void
}
```

Rules:
- Drawer components **do not fetch global state directly**
- All required data must arrive via `context`
- Side effects (API calls) occur in the caller or via submitted results

---

### B.4 Drawer Registry Structure

```ts
const DrawerRegistry: Record<string, DrawerDefinition> = {
  'create-record': {
    id: 'create-record',
    component: CreateRecordView,
    size: 'md'
  },
  'confirm-delete': {
    id: 'confirm-delete',
    component: ConfirmDeleteView,
    size: 'sm'
  }
}
```

Constraints:
- IDs are stable and semantic
- No anonymous or inline drawer definitions
- Registry is the only source of drawer truth

---

### B.5 Opening a Drawer

All drawer invocations use a single API:

```ts
openDrawer('create-record', {
  recordType: 'contact',
  projectId
})
```

This ensures:
- Call sites are grep-able
- Context shape is explicit
- UI intent is traceable

---

### B.6 Result Handling

Drawers return structured results:

```ts
submit({
  createdRecordId: 'uuid'
})
```

Caller decides:
- Whether to persist
- Whether to open another drawer
- Whether to close silently

No drawer performs navigation implicitly.

---

### B.7 Migration of Modals

Mapping examples:

| Legacy Modal | Drawer Replacement |
|-------------|-------------------|
| AddFieldModal | AddFieldView |
| ConfirmDeleteModal | ConfirmDeleteView |
| CreateNodeModal | CreateNodeView |

Migration steps:
1. Wrap modal logic into drawer-compatible views
2. Route all calls through `openDrawer`
3. Remove direct modal imports

---

### B.8 Debug and Trace Support

Each drawer invocation attaches UI context:

```ts
openDrawer('create-record', context, {
  ui_context: {
    source: 'RecordInspector',
    trigger: 'AddRecordButton'
  }
})
```

This context is propagated to API calls initiated by drawer actions.

---

### B.9 End State

After migration:
- `/modals` directory is removed
- Drawer behavior is predictable and inspectable
- UI flows are addressable operations
- Backend logs can reference drawer IDs


---

## Appendix C — Domain Rule Interfaces

### Purpose

This appendix defines **canonical, UI-agnostic domain interfaces** that describe how AutoArt reasons about:

* field visibility and editability
* data completeness
* phase progression
* references between entities

These interfaces are contracts, not implementations. They must be stable across frontend and backend layers.

---

### C.1 Core Domain Types

```ts
interface ProjectState {
  projectId: string
  phase: number
  records: Record<string, any>
  metadata: Record<string, any>
}

interface FieldDefinition {
  fieldId: string
  phase: number
  deprecated?: boolean
}
```

---

### C.2 Field Visibility and Editability

Determines whether a field should be shown, edited, or required given current project state.

```ts
interface FieldState {
  fieldId: string
  visible: boolean
  editable: boolean
  required: boolean
  reason?: string
}

function getFieldState(
  field: FieldDefinition,
  projectState: ProjectState
): FieldState
```

Rules:

* No UI component computes visibility or requiredness
* Backend validation errors must be derived from this logic
* `reason` must be human-readable and stable (used for logs and UI tooltips)

---

### C.3 Completeness and Missing Fields

Computes which fields are incomplete and whether they block progression.

```ts
interface MissingField {
  fieldId: string
  phase: number
  severity: 'blocking' | 'warning'
}

function getMissingFields(
  projectState: ProjectState
): MissingField[]
```

Usage:

* UI progress indicators
* Reminder and notification generation
* Export readiness checks

No other mechanism may independently determine “completeness.”

---

### C.4 Phase Gating

Determines whether a project may advance to the next phase.

```ts
function canAdvancePhase(
  currentPhase: number,
  projectState: ProjectState
): {
  allowed: boolean
  blockers: MissingField[]
}
```

Rules:

* Phase advancement is never inferred implicitly by UI state
* Backend must enforce this rule for any phase mutation

---

### C.5 Reference Resolution

Defines how references between tasks, records, and fields are resolved.

```ts
interface Reference {
  referenceId: string
  sourceField: string
  targetId: string
  mode: 'dynamic' | 'static'
}

interface ResolvedReference {
  referenceId: string
  status: 'dynamic' | 'static' | 'broken' | 'unresolved'
  value?: any
  reason?: string
}

function resolveReference(
  reference: Reference,
  projectState: ProjectState
): ResolvedReference
```

Rules:

* Backend is authoritative for resolution
* Frontend never dereferences values on its own
* Broken and unresolved states must be explicit

---

## Appendix D — Component Teardown Example (`RecordInspector.tsx`)

### D.1 Current Observed Responsibilities

`RecordInspector.tsx` currently performs the following roles:

* Fetches and interprets record data
* Determines field visibility and requiredness
* Handles reference logic
* Manages layout and rendering
* Initiates side effects (API calls, navigation)

This violates separation of concerns and prevents reuse.

---

### D.2 Target Responsibility Split

#### Composite: `RecordInspector`

Responsibilities:

* Request domain-level view models
* Coordinate layout sections
* Open drawers and handle results

Does NOT:

* Inspect raw project JSON
* Compute field rules

---

#### Molecules

* `FieldGroup`
* `ReferenceBlock`
* `PropertySection`

Responsibilities:

* Render groups of fields
* Display reference state
* Forward user intent upward

---

#### Atoms

* `Label`
* `ValueDisplay`
* `InlineError`
* `IconButton`

Responsibilities:

* Render-only
* No domain knowledge

---

### D.3 Refactored Data Flow

```
ProjectState
   ↓ (Appendix C domain rules)
FieldViewModels[]
   ↓
RecordInspector (composite)
   ↓
FieldGroup (molecule)
   ↓
Atoms
```

No component below the composite layer reads or mutates raw project data.

---

### D.4 Practical Refactor Steps

1. Extract field logic into domain functions
2. Introduce `FieldViewModel` as sole input to field rendering
3. Replace conditional JSX with declarative mapping
4. Move side effects to explicit handlers

---

### D.5 Outcomes

* Inspector becomes declarative and testable
* Fields render consistently across views
* Debugging occurs at the domain boundary, not in JSX

---

## Appendix E — Legacy Migration Checklist

### Purpose

Provide an **auditable, non-destructive process** for removing legacy fields, services, and UI paths without risking data loss.

---

### E.1 Legacy Item Identification

Each legacy item must be documented with:

* Identifier (field, function, component)
* Location (frontend / backend)
* Reason for deprecation
* Replacement (if any)

---

### E.2 Migration Procedure

For each legacy item:

1. Mark as deprecated in schema or code
2. Add runtime logging for access
3. Migrate stored data if required
4. Block new writes
5. Remove from UI rendering
6. Remove backend handling

No step may be skipped.

---

### E.3 Safe Removal Gate

A legacy element may be deleted only when all conditions are met:

* No runtime access logs for a defined period
* No frontend imports or references
* No backend write paths
* Migration scripts executed and verified

---

### E.4 Initial Legacy Candidates

* `cloneProjectTemplates` (backend service method)
* `hierarchy_nodes.metadata.status` (string-based logic)
* `/modals/*` directory

---

### E.5 Audit Record

Each removal must record:

* Date removed
* Commit hash
* Migration notes

This ensures future maintainers understand why the code is gone.

---

**End of Appendices C–E**
