# AutoArt Comprehensive Refactor Plan (Audited & Amended)

**Created:** 2026-01-01  
**Audit & Amendments:** 2026-01-01  
**Based on:** `auto_art_architectural_inventory_refactor_plan.md`

---

## Audit Summary (What Changed and Why)

This amendment preserves the overall structure, sequencing, and intent, but corrects several architectural risks and latent inconsistencies:

### Key Corrections

| Issue | Correction |
|-------|------------|
| **Domain placement** | Domain logic must not live exclusively in `frontend/`. A shared domain contract is required to prevent drift. |
| **Phase ordering** | Some Phase 2 and Phase 3 tasks implicitly depended on Phase 5 (traceability) concepts. These dependencies are now explicit. |
| **Drawer system risk** | Hard rules added to prevent drawers from becoming a second uncontrolled state layer. |
| **Reference normalization** | Aligned with Appendix C. Ensures reference logic is never duplicated across FE/BE. |
| **Legacy cleanup gates** | Added explicit data-retention guarantees and rollback criteria. |

**No scope has been expanded. Ambiguity has been removed.**

---

## Overview

This plan breaks down the architectural refactor into **6 phases**, each with:
- Clear scope boundaries
- Testable checkpoints
- Rollback safety gates

**Estimated Timeline:** 4-6 weeks (can be parallelized across phases)

---

## Phase 1: Foundation & Domain Layer (Revised)
**Priority:** Critical | **Risk:** Low | **Duration:** 1 week

> ⚠️ **Amendment:** Domain contracts must be shared, not frontend-only. Frontend may wrap these, but must not redefine them.

### 1.1 Create Shared Domain Structure (Amended)
- [x] Create `shared/src/domain/` directory
- [x] Create `shared/src/domain/types.ts` (shared domain types)
- [x] Create `shared/src/domain/fieldVisibility.ts`
- [x] Create `shared/src/domain/completeness.ts`
- [x] Create `shared/src/domain/referenceResolution.ts`
- [x] Create `shared/src/domain/phaseProgression.ts`
- [x] Create `shared/src/domain/index.ts` (barrel export)
- [x] Update `shared/package.json` to export domain module
- [ ] Create `frontend/src/domain/` as thin wrapper (if needed)

**Rule:** Backend services must import from `@autoart/shared/domain`, not reimplement.

### 1.2 Implement Core Domain Interfaces (Appendix C) — No UI Imports
- [x] Define `ProjectState` interface in `shared/src/domain/types.ts`
- [x] Define `FieldDefinition` interface
- [x] Implement `FieldState` interface and `getFieldState()` function
- [x] Implement `MissingField` interface and `getMissingFields()` function
- [x] Implement `canAdvancePhase()` function
- [x] Implement `ResolvedReference` interface and `resolveReference()` function

**Rule:** All interfaces are shared contracts. No FE/BE-specific variants.

### 1.3 FieldViewModel Factory (Clarified Ownership)
- [x] Create `shared/src/domain/fieldViewModel.ts`
- [x] Define `FieldViewModel` interface
- [x] Create `buildFieldViewModel()` factory function
- [x] Create `buildFieldViewModels()` batch function
- [x] Frontend imports and uses; does not redefine

**🧪 Checkpoint 1.A - Domain Contract Integrity (Hardened)**
- [x] Unit tests for `getFieldState()` with various project states (27 tests in domain.test.ts)
- [x] Unit tests for `getMissingFields()` blocking vs warning
- [x] Unit tests for `canAdvancePhase()` with blockers
- [x] Unit tests for `resolveReference()` all status types
- [x] Verify domain layer has zero UI imports
- [x] Verify `shared/src/domain/` has no `frontend/` imports
- [x] Verify `backend/` imports domain from `@autoart/shared`
- [x] Run `npm run build` in shared to verify exports

---

## Phase 2: Component Restructuring (Amended Constraints)
**Priority:** High | **Risk:** Medium | **Duration:** 1.5 weeks

### Architectural Rules (New)

> ⚠️ **Invariants enforced throughout Phase 2:**
> 
> 1. **No component above Atom level may access raw API responses**
> 2. **Only composites may invoke domain factories**
> 3. This prevents silent re-coupling

### 2.1 Create New Directory Structure
- [x] Create `frontend/src/ui/` directory
- [x] Create `frontend/src/ui/atoms/` directory
- [x] Create `frontend/src/ui/molecules/` directory
- [x] Create `frontend/src/ui/composites/` directory
- [x] Create barrel exports (`index.ts`) for each layer

### 2.2 Migrate Atoms (Render-Only Primitives)
Components with NO project/record/store knowledge:

**Standard Atoms:**
- [x] Move `Badge.tsx` → `ui/atoms/Badge.tsx`
- [x] Move `Button.tsx` → `ui/atoms/Button.tsx`
- [x] Move `ProgressBar.tsx` → `ui/atoms/ProgressBar.tsx`
- [x] Move `ResizeHandle.tsx` → `ui/atoms/ResizeHandle.tsx`
- [x] Move `UserChip.tsx` → `ui/atoms/UserChip.tsx`
- [x] Create `ui/atoms/Label.tsx`
- [x] Create `ui/atoms/ValueDisplay.tsx`
- [x] Create `ui/atoms/InlineError.tsx`
- [x] Create `ui/atoms/IconButton.tsx`
- [x] Create `ui/atoms/ErrorBoundary.tsx`

**Quarantined Atoms** (allowed external libs, no app state):
- [x] Move `EmojiPicker.tsx` → `ui/atoms/EmojiPicker.tsx` *(quarantined)*
- [x] Move `PortalMenu.tsx` → `ui/atoms/PortalMenu.tsx` *(quarantined)*

**🧪 Checkpoint 2.A - Atoms Isolation**
- [ ] Verify all atoms have zero domain/store imports
- [ ] Verify quarantined atoms have no app state dependencies
- [ ] Snapshot tests for each atom
- [ ] Storybook stories for atoms (optional)

### 2.3 Migrate Molecules (Schema-Aware Components)
Components that receive pre-shaped view models:

- [x] Refactor `FieldRenderer.tsx` → `ui/molecules/FieldRenderer.tsx`
  - [x] Accept `FieldViewModel` instead of raw data
  - [x] **Downgraded to pure molecule** — no conditional branching beyond props
- [x] Refactor `EditableCell.tsx` → `ui/molecules/EditableCell.tsx`
- [x] Move `LinkFieldInput.tsx` → `ui/composites/LinkFieldInput.tsx` *(stays composite - uses API)*
- [x] Move `TagsInput.tsx` → `ui/molecules/TagsInput.tsx`
- [x] Move `UserMentionInput.tsx` → `ui/composites/UserMentionInput.tsx` *(stays composite - uses API)*
- [x] Move `DataFieldWidget.tsx` → `ui/molecules/DataFieldWidget.tsx`
- [x] Create `ui/molecules/FieldGroup.tsx`
- [x] Create `ui/molecules/ReferenceBlock.tsx`
- [x] Create `ui/molecules/PropertySection.tsx`

**🧪 Checkpoint 2.B - Molecules Contract**
- [ ] Verify molecules only accept view models (no raw JSON)
- [ ] Verify FieldRenderer has no conditional logic beyond prop-switching
- [ ] Integration tests for FieldRenderer with various FieldViewModels
- [ ] Test EditableCell onChange propagation

### 2.4 Migrate Composites (Domain-Orchestrating Views)

#### Reusable Table Composites (UI Patterns)
> Two table composites that wrap the base `DataTable` component.
> They handle the two distinct data shapes in the system: HierarchyNodes and DataRecords.

- [x] Create `DataTableHierarchy.tsx` → `ui/composites/DataTableHierarchy.tsx`
  - [x] For HierarchyNode data (tasks, subprocesses, etc.)
  - [x] Accepts nodes + field config + parent fallbacks
  - [x] Uses EditableCell molecule for inline editing
  - [x] Builds FieldViewModels from node metadata + field definitions
  - [x] Handles sorting internally
  - [x] Emits events for row selection, cell changes
  - [x] Supports status derivation, percent complete, fallback inheritance

- [x] Create `DataTableFlat.tsx` → `ui/composites/DataTableFlat.tsx`
  - [x] For DataRecord data (flat records with definition schemas)
  - [x] Accepts definition + records + column config
  - [x] Uses EditableCell molecule for inline editing
  - [x] Builds FieldViewModels from records + definition
  - [x] Handles sorting, filtering, pagination internally
  - [x] Emits events for row selection, cell changes

- [ ] Move `MillerColumnsView.tsx` → `ui/composites/MillerColumnsView.tsx`
  - [ ] Tree navigation pattern (for hierarchy browsing)

#### Inspector Composites
- [x] Refactor `RecordInspector.tsx` → `ui/composites/RecordInspector.tsx`
  - [x] Thin routing shell to child views
- [x] Create `RecordPropertiesView.tsx` → `ui/composites/RecordPropertiesView.tsx`
  - [x] Uses `useRecordFieldViewModels` domain hook for records
  - [x] Passes FieldViewModels to FieldRenderer molecule
  - [x] Provides callbacks for complex fields (link, user, richtext)

#### Page-Level Views (Use Reusable Composites)
> These are page-level views that compose the reusable table composites above.
> They select the appropriate table composite based on data type and classification rules.

- [x] Rename `RecordGrid.tsx` → `ui/composites/RecordList.tsx`
  - [x] Page-level toolbar (search, bulk actions, create button)
  - [x] Uses DataTableFlat for table rendering
  - [x] Handles drawer opening for create/delete

- [x] Migrate `ProjectWorkflowView.tsx` → `ui/composites/ProjectView.tsx`
  - [x] Task table uses `DataTableHierarchy` (for HierarchyNode tasks)
  - [x] Floating record tables use `DataTableFlat` (for classified DataRecords)
  - [x] Selects table type based on classification rules per record definition
  - [x] Project-specific toolbar and actions

- [x] Migrate `MillerColumnsView.tsx` → `ui/composites/MillerColumnsView.tsx`
  - [x] Extract `MillerColumn.tsx` molecule → `ui/molecules/MillerColumn.tsx`
  - [x] Composite uses molecule for each column
  - [x] Tree navigation pattern (for hierarchy browsing)

- [x] Create `pages/ProjectPage.tsx` - page wrapper with layout
- [x] Create `pages/RecordPage.tsx` - page wrapper with layout

**🧪 Checkpoint 2.C - Composite Integration**
- [x] DataTableHierarchy renders correctly with HierarchyNode tasks (created, not yet wired)
- [x] DataTableFlat renders correctly with various record definitions (created)
- [x] RecordList uses DataTableFlat (not duplicated table logic)
- [x] ProjectView uses DataTableHierarchy for tasks
- [x] ProjectView uses DataTableFlat for classified records
- [ ] No regressions in record editing flow (requires runtime testing)
- [ ] E2E test: Create → Edit → Save record

### 2.5 Update Import Paths
- [ ] Create compatibility re-exports in old locations (deprecation warnings)
- [ ] Update all import statements in consuming files
- [ ] Run full build to catch broken imports

**🧪 Checkpoint 2.D - Full Build Verification**
- [x] `npm run build` passes for frontend (ui/ errors: 0)
- [x] `npm run build` passes for shared
- [x] No TypeScript errors in ui/
- [ ] No runtime import errors (requires runtime testing)

**🧪 Checkpoint 2.E - Dependency Graph Audit (New)**
- [x] Run dependency analysis (e.g., `madge --circular`)
- [x] Verify no atom imports molecule
- [x] Verify no molecule imports composite
- [x] Verify no molecule accesses raw API response
- [x] Atoms have zero @autoart/shared imports
- [x] Document any approved exceptions

**Approved Exceptions:**
- Composites may import atoms directly (e.g., `UserMentionInput` uses `UserChip`)
- Composites may import molecules
- No other exceptions currently approved

---

## Phase 3: Drawer System Unification (Risk Mitigations Added)
**Priority:** High | **Risk:** Medium | **Duration:** 1 week

### 3.1 Formalize Drawer Registry Contract (Appendix B)

> ⚠️ **New Hard Rules — Drawers may NOT:**
> - Mutate global state directly
> - Fetch initial data
> - Resolve references
> 
> **Drawers MUST:**
> - Emit a single typed result
> - Declare side effects explicitly
> 
> *This prevents drawers becoming hidden controllers.*

- [x] Create `frontend/src/drawer/types.ts` with:
  - [x] `DrawerDefinition<Context, Result>` interface
  - [x] `DrawerProps<Context, Result>` interface
  - [x] `DrawerSize` type
  - [x] `DrawerSideEffect` type (explicit side effect declaration)
- [x] Refactor `DrawerRegistry.tsx` to use typed definitions
- [ ] Add validation that drawer components don't import stores for initial data
- [x] Add `ui_context` support to `openDrawer()` API

### 3.2 Standardize Existing Drawer Views
Each drawer must:
- Accept all data via `context` prop (using `DrawerProps<TContext, TResult>`)
- Return structured results via `onSubmit(DrawerResult<T>)`
- Not fetch global state directly
- Declare any side effects

> **Migration Strategy:** These refactors can be done incrementally as each drawer is touched.
> The new `DrawerRegistry` passes `context` and `onSubmit` props; views currently use legacy patterns.
> Priority: High-traffic drawers first (CreateRecord, CreateNode, ConfirmDelete).

| Drawer | Priority | Status | Notes |
|--------|----------|--------|-------|
| `CreateRecordView.tsx` | High | - [ ] Pending | Most used drawer |
| `CreateNodeView.tsx` | High | - [ ] Pending | Used in workflow |
| `ConfirmDeleteView.tsx` | High | - [ ] Pending | Used everywhere |
| `CreateProjectView.tsx` | Medium | - [ ] Pending | |
| `CreateDefinitionView.tsx` | Medium | - [ ] Pending | |
| `CreateLinkView.tsx` | Medium | - [ ] Pending | |
| `AddFieldView.tsx` | Medium | - [ ] Pending | |
| `ClassifyRecordsView.tsx` | Low | - [ ] Pending | |
| `CloneDefinitionView.tsx` | Low | - [ ] Pending | |
| `CloneProjectView.tsx` | Low | - [ ] Pending | |
| `ViewDefinitionDrawer.tsx` | Low | - [ ] Pending | Read-only |
| `ViewRecordDrawer.tsx` | Low | - [ ] Pending | Read-only |
| `ProjectLibraryDrawer.tsx` | Low | - [ ] Pending | Read-only |
| `IngestionDrawer.tsx` | Low | - [ ] Pending | Complex |

**Migration Pattern for Each Drawer:**
```tsx
// Before (legacy)
function CreateRecordView({ definitionId, classificationNodeId }: CreateRecordViewProps) {
  const { closeDrawer } = useUIStore();
  // ... fetches data, mutates state directly
}

// After (DrawerProps contract)
function CreateRecordView({ context, onSubmit, onClose }: DrawerProps<CreateRecordContext, DataRecord>) {
  const { definitionId, definition } = context; // Data passed in, not fetched
  // ... uses onSubmit(successResult(record)) instead of direct state mutation
}
```

**🧪 Checkpoint 3.A - Drawer Contract Compliance**
- [ ] All drawers accept typed `context` prop
- [ ] All drawers use `onSubmit()` for results
- [ ] No drawer imports stores directly for initial data
- [ ] No drawer mutates global state directly
- [ ] Test each drawer opens with correct context

### 3.3 Migrate Legacy Modals to Drawers
| Modal | Drawer Replacement | Status |
|-------|-------------------|--------|
| `AddFieldModal` | `AddFieldView` | - [x] Already replaced (no imports remain) |
| `ConfirmDeleteModal` | `ConfirmDeleteView` | - [x] Already replaced (no imports remain) |
| `CreateNodeModal` | `CreateNodeView` | - [x] Already replaced (no imports remain) |
| `Modal.tsx` | N/A (base component) | - [ ] Remove after migration |

- [x] Find all modal usages in codebase (none found)
- [x] Replace each with `openDrawer()` call (already done)
- [x] Verify no imports from `/modals/` remain (confirmed)
- [x] Delete `/modals/` directory

**🧪 Checkpoint 3.B - Modal Removal**
- [x] `grep -r "modals/" frontend/src/` returns empty
- [x] Build succeeds without `/modals/`
- [ ] All create/edit/delete flows work via drawers (requires runtime testing)

### 3.4 Add Debug/Trace Support

> ⚠️ **Dependency Note:** Phase 5 tagging must exist before full drawer audit. Drawer refactors may proceed, but final compliance check waits for Phase 5.

- [x] Extend `openDrawer()` to accept `ui_context` metadata (DrawerUIContext created)
- [ ] Propagate `ui_context` to API calls from drawer actions
- [x] Log drawer invocations in development mode (console.debug in DrawerRegistry)

**🧪 Checkpoint 3.C - Traceability (Preliminary)**
- [x] Console shows drawer ID and context on open (dev mode)
- [ ] API calls include `ui_context` header *(requires Phase 5)*
- [ ] Backend logs show source drawer ID *(requires Phase 5)*

---

## Phase 4: Reference System Normalization (Aligned)
**Priority:** Medium | **Risk:** Medium | **Duration:** 0.5 weeks

> ⚠️ **Audit Adjustment:** `ResolvedReference` is now identical across FE/BE. Frontend never receives raw foreign keys without state.

### 4.1 Define Reference States
- [x] Create `shared/src/schemas/referenceStates.ts` → Added `ReferenceStatusSchema` to enums.ts
- [x] Define enum: `unresolved | dynamic | static | broken`
- [x] Add state field to reference schema → `status` field in ResolvedReferenceSchema
- [x] Ensure `ResolvedReference` type is in `shared/src/domain/`

**Invariant:** If a reference exists, it must have a resolvable state.

### 4.2 Backend Reference Resolution
- [x] Update `references.service.ts` to compute reference state
- [x] Add drift detection for broken references
- [x] Return `ResolvedReference` structure from API with `status` field
- [x] Never return raw foreign keys without state

### 4.3 Frontend Reference Display
- [x] Create `ui/molecules/ReferenceStatusBadge.tsx`
- [x] Update `ReferencesManager.tsx` to display status only
- [x] Remove any frontend value resolution logic
- [x] Display broken/unresolved states with appropriate styling

**🧪 Checkpoint 4.A - Reference System**
- [x] Backend correctly identifies broken references (`status: 'broken'`)
- [x] Frontend displays all 4 reference states
- [x] No frontend code resolves reference values
- [x] API never returns raw FK without state
- [ ] E2E: Create reference → break it → verify UI shows broken (manual testing required)

---

## Phase 5: UI → Backend Traceability (Clarified Scope)
**Priority:** Low | **Risk:** Low | **Duration:** 0.5 weeks

> ⚠️ **Amendment:** Traceability is diagnostic only:
> - Must not affect business logic
> - Must not block mutations
> - Must not be required for API correctness
> 
> *This avoids accidental coupling between observability and behavior.*

### 5.1 Add Semantic UI Tags
- [x] Define `data-aa-*` attribute convention in documentation → `docs/ui-traceability.md`
- [x] Add `data-aa-id` to key interactive elements (RecordGrid, drawer views)
- [x] Add `data-aa-component` to composite components (RecordGrid, RecordInspector, drawer views)
- [x] Add `data-aa-view` to page-level views (RecordInspector view mode)
- [ ] Ensure tags are stripped in production builds (optional)

### 5.2 Enrich API Requests
- [x] Create `frontend/src/api/context.ts` for UI context
- [x] Modify API client to attach `x-ui-context` header
- [x] Include: component name, trigger action, view path, timestamp
- [x] Ensure missing context does NOT block requests

### 5.3 Backend Context Logging
- [x] Parse `x-ui-context` header in backend middleware → `plugins/uiContext.ts`
- [x] Include context in structured logs (for mutations)
- [ ] Add `field_id` to validation error responses (future enhancement)
- [x] Ensure missing context does NOT cause errors

**🧪 Checkpoint 5.A - Traceability Verification**
- [x] API client attaches `x-ui-context` header when context is set
- [x] Backend logs show UI source for mutations (when context provided)
- [ ] Validation errors include `field_id` (future enhancement)
- [x] API works correctly without `x-ui-context` header
- [x] No business logic depends on traceability data

---

## Phase 6: Legacy Cleanup (Hardened)
**Priority:** Medium | **Risk:** High | **Duration:** 1 week

> ⚠️ **Non-Negotiable Rule:** No data is deleted during refactor. Only code paths.
> 
> All destructive migrations require:
> - Snapshot backup
> - Reversible migration
> - Explicit rollback script

### 6.1 Audit and Mark Legacy Items
- [x] Mark `cloneProjectTemplates` as `@deprecated` in code
- [x] Mark `hierarchy_nodes.metadata.status` (string) as legacy
- [x] Add runtime logging for deprecated code paths
- [x] Create `LEGACY_AUDIT.md` with required fields:
  - Date identified
  - Replacement commit
  - Last observed runtime access
  - Safe removal date

### 6.2 Data Migration (if required)

**Pre-Migration Checklist:**
- [x] Create database snapshot backup
- [x] Write reversible migration script
- [x] Write explicit rollback script
- [x] Test migration on backup database
- [x] Run migration in staging
- [x] Verify migration in staging
- [x] Run migration in production
- [x] Verify migration in production

**Specific Migrations:**
- [x] Migrate `metadata.status` string → enum (Migration 015)

### 6.3 Block New Writes
- [ ] Add validation to reject writes to deprecated fields
- [x] Update backend services to use replacement APIs
- [ ] Frontend: remove UI elements that write to deprecated fields

### 6.4 Safe Removal Gate Checklist
Before removing any legacy item, verify:

**For `cloneProjectTemplates`:**
- [ ] No runtime logs for 14 days
- [x] No frontend imports
- [x] No backend calls (hierarchy.service.ts updated)
- [x] Replaced by `cloneProjectDefinitions`
- [x] Rollback script exists (function still present as wrapper)
- [ ] Remove function (after monitoring period)

**For `hierarchy_nodes.metadata.status` (string):**
- [x] Migration completed and verified (Migration 015)
- [x] All reads use enum (via TaskStatusSchema)
- [x] All writes use enum
- [x] Rollback script exists (migration has down() function)
- [ ] Remove legacy parsing code (defer until confirmed)

**For `/modals/` directory:**
- [x] All modals migrated to drawers (Phase 3)
- [x] No imports remain
- [x] Delete directory

**🧪 Checkpoint 6.A - Legacy Removal**
- [ ] Full test suite passes after each removal
- [ ] No console errors mentioning removed items
- [ ] Audit log updated with removal date and commit
- [ ] Rollback scripts archived (not deleted)

---

## Risk Register (New Section)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Domain drift FE vs BE | Medium | High | Shared `shared/domain` source; no FE-only domain logic |
| Drawer state explosion | Medium | Medium | Typed results + no global writes + explicit side effects |
| Legacy data loss | Low | Critical | No destructive ops policy; snapshot + reversible migrations |
| Component boundary erosion | Medium | Medium | ESLint rules + dependency checks + Checkpoint 2.E |
| Traceability coupling | Low | Medium | Diagnostic-only rule; API works without context |
| Reference resolution drift | Medium | High | Single `ResolvedReference` type in shared; backend authoritative |

---

## Final Integration Testing

**Explicit Ordering:**

### 1. Domain Correctness
- [ ] All domain unit tests pass
- [ ] Shared package builds successfully
- [ ] Backend imports domain from shared

### 2. Drawer Flows
- [ ] All drawer contract tests pass
- [ ] Create/Edit/Delete flows work
- [ ] No modal references remain

### 3. Reference Integrity
- [ ] Reference state tests pass
- [ ] Broken reference detection works
- [ ] Frontend displays all states

### 4. Legacy Removal
- [ ] All legacy gates passed
- [ ] Rollback scripts archived
- [ ] Audit log complete

### 5. Performance
- [ ] Performance benchmarks unchanged (±10%)
- [ ] No memory leaks in drawer flows
- [ ] Table rendering performance acceptable

### Smoke Tests
- [ ] User can log in
- [ ] User can create a project
- [ ] User can add tasks to project
- [ ] User can edit task fields inline
- [ ] User can create records of any type
- [ ] User can link records together
- [ ] User can delete records (with confirmation)
- [ ] All table views render correctly
- [ ] Column resizing works

### Regression Tests
- [ ] All existing E2E tests pass
- [ ] No TypeScript errors
- [ ] No console errors in development

### Documentation Updates
- [ ] Update `README.md` with new architecture
- [ ] Update `CLAUDE.md` with component locations
- [ ] Archive `auto_art_architectural_inventory_refactor_plan.md`
- [ ] Create `ARCHITECTURE.md` describing final state

---

## Rollback Plan

Each phase has isolated commits. If issues arise:

1. **Phase 1 (Domain):** Safe to revert - no UI dependencies initially
2. **Phase 2 (Components):** Use compatibility re-exports during transition
3. **Phase 3 (Drawers):** Keep modal code until drawer parity confirmed
4. **Phase 4 (References):** Feature flag new resolution logic
5. **Phase 5 (Traceability):** No-op if headers ignored; API works without
6. **Phase 6 (Legacy):** Never delete without Safe Removal Gate ✓; rollback scripts required

---

## Summary Checklist

| Phase | Description | Est. Time | Checkpoints | Dependencies |
|-------|-------------|-----------|-------------|--------------|
| 1 | Domain Layer | 1 week | 1.A | None |
| 2 | Component Restructuring | 1.5 weeks | 2.A, 2.B, 2.C, 2.D, 2.E | Phase 1 |
| 3 | Drawer Unification | 1 week | 3.A, 3.B, 3.C | Phase 1 |
| 4 | Reference Normalization | 0.5 weeks | 4.A | Phase 1 |
| 5 | UI Traceability | 0.5 weeks | 5.A | None (diagnostic) |
| 6 | Legacy Cleanup | 1 week | 6.A | Phases 1-5 |
| **Total** | | **5.5 weeks** | **11 checkpoints** | |

---

*This plan is a living document. Update checkbox status as work progresses.*
