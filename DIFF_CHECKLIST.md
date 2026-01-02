# AutoArt Refactor — Diff Checklist

**Last Updated:** 2025-01-13

---

## 🔴 Priority 1: Shared Domain Convergence (Highest Leverage)

**Goal:** Stop business logic drift permanently

### 1. Create Shared Domain Layer

**ADD** ✅ Complete

- [x] `shared/src/domain/`
- [x] `shared/src/domain/types.ts`
- [x] `shared/src/domain/fieldVisibility.ts`
- [x] `shared/src/domain/completeness.ts`
- [x] `shared/src/domain/phaseProgression.ts`
- [x] `shared/src/domain/referenceResolution.ts`
- [x] `shared/src/domain/fieldViewModel.ts`
- [x] `shared/src/domain/index.ts` (barrel export)

**MOVE / EXTRACT** ✅ Complete

From frontend components / services:
- [x] field visibility conditionals
- [x] "required / optional" logic
- [x] phase blocking logic
- [x] reference dereferencing logic

**IMPLEMENT** ✅ Complete

- [x] `getFieldState(field, projectState)`
- [x] `getMissingFields(projectState)`
- [x] `canAdvancePhase(phase, projectState)`
- [x] `resolveReference(reference, projectState)`

**VERIFY** ✅ Complete

- [x] Backend imports these (no re-implementation)
- [x] Frontend wraps but never duplicates logic
- [x] No UI imports in shared/domain

---

## 🔴 Priority 2: FieldViewModel Boundary (Stops UI Entropy)

### 2. Introduce FieldViewModel as a Hard Boundary

**ADD** ✅ Complete

- [x] `shared/src/domain/fieldViewModel.ts`

**DEFINE** ✅ Complete

```typescript
FieldViewModel {
  fieldId
  label
  value
  visible
  editable
  required
  errors
  referenceState?
}
```

**CHANGE** ✅ Complete

- [x] `FieldRenderer.tsx` - accepts FieldViewModel only
- [x] `RecordInspector.tsx` - uses RecordPropertiesView composite
- [x] `DataFieldWidget.tsx` - accepts view model props

**VERIFY** ✅ Complete

- [x] No conditional visibility logic in JSX
- [x] No `if (schema.foo)` patterns in UI
- [x] Domain → ViewModel → UI only

---

## 🟠 Priority 3: UI Layering Enforcement (Atoms / Molecules / Composites)

**Goal:** Make reuse inevitable and misuse obvious

### 3. Create Explicit UI Layer Directories

**ADD** ✅ Complete

- [x] `frontend/src/ui/atoms/`
- [x] `frontend/src/ui/molecules/`
- [x] `frontend/src/ui/composites/`

### 4. Move Components (No Logic Changes Yet)

**ATOMS** (render-only) ✅ Complete

- [x] Badge
- [x] Button
- [x] ProgressBar
- [x] ResizeHandle
- [x] UserChip
- [x] EmojiPicker ⚠️ (quarantined atom)
- [x] PortalMenu ⚠️ (quarantined atom)
- [x] Label
- [x] ValueDisplay
- [x] InlineError
- [x] IconButton
- [x] ErrorBoundary

**MOLECULES** ✅ Complete

- [x] FieldRenderer
- [x] EditableCell
- [x] TagsInput
- [x] DataFieldWidget
- [x] ReferenceStatusBadge
- [x] FieldGroup
- [x] PropertySection
- [x] ReferenceBlock
- [x] MillerColumn

**COMPOSITES** ✅ Complete

- [x] RecordInspector
- [x] RecordList (formerly RecordGrid)
- [x] ProjectView (formerly ProjectWorkflowView)
- [x] DataTableFlat
- [x] DataTableHierarchy
- [x] MillerColumnsView
- [x] RecordPropertiesView
- [x] LinkFieldInput (composite - uses API)
- [x] UserMentionInput (composite - uses API)

**VERIFY** ✅ Complete

- [x] Atoms import nothing from domain or API
- [x] Molecules accept props only (no fetching)
- [x] Composites are the only orchestrators

---

## 🟠 Priority 4: Drawer Registry Contract (Prevent Hidden Controllers)

**Goal:** Drawers are views, not brains

### 5. Formalize Drawer Contracts

**ADD** ✅ Complete

- [x] `frontend/src/drawer/types.ts`
  - [x] `DrawerDefinition<Context, Result>`
  - [x] `DrawerProps<Context, Result>`
  - [x] `DrawerSize`
  - [x] `DrawerSideEffect` type

### 6. Refactor DrawerRegistry

**CHANGE** ✅ Complete

- [x] `DrawerRegistry.tsx` - supports typed context and UIContext

**ENFORCE** ✅ Complete

- [x] Typed context defined
- [x] Typed submit result defined
- [x] Declared drawer ID
- [x] All drawer views migrated to new contract

### 7. Update All Drawer Views

| Drawer | Status | Notes |
|--------|--------|-------|
| CreateRecordView | ✅ Complete | Supports both legacy and DrawerProps |
| CreateNodeView | ✅ Complete | Supports both legacy and DrawerProps |
| ConfirmDeleteView | ✅ Complete | Supports both legacy and DrawerProps |
| CreateProjectView | ✅ Complete | Supports both legacy and DrawerProps |
| CreateDefinitionView | ✅ Complete | Supports both legacy and DrawerProps |
| CreateLinkView | ✅ Complete | Supports both legacy and DrawerProps |
| AddFieldView | ✅ Complete | Supports both legacy and DrawerProps |
| ClassifyRecordsView | ✅ Complete | Supports both legacy and DrawerProps |
| CloneDefinitionView | ✅ Complete | Supports both legacy and DrawerProps |
| CloneProjectView | ✅ Complete | Supports both legacy and DrawerProps |
| ViewDefinitionDrawer | ⚠️ Deferred | Read-only drawer, low priority |
| ViewRecordDrawer | ⚠️ Deferred | Read-only drawer, low priority |
| ProjectLibraryDrawer | ⚠️ Deferred | Read-only drawer, low priority |
| IngestionDrawer | ⚠️ Deferred | Complex - needs separate analysis |

**VERIFY** ✅ Complete (for migrated drawers)

- [x] Drawers support onSubmit/onClose callbacks
- [x] No drawer mutates domain directly (uses typed results)

---

## 🟡 Priority 5: Reference State Normalization

**Goal:** Eliminate "mystery links"

### 8. Add Reference State Enum

**ADD** ✅ Complete

- [x] `shared/src/schemas/enums.ts` - `ReferenceStatusSchema`
- [x] `'unresolved' | 'dynamic' | 'static' | 'broken'`

### 9. Backend: Resolve Once

**CHANGE** ✅ Complete

- [x] `references.service.ts` - returns `status` field
- [x] `ResolvedReference` includes `{ status, value, label, reason? }`

### 10. Frontend: Display Only

**CHANGE** ✅ Complete

- [x] `ReferencesManager.tsx` - uses `status` field
- [x] `LinkFieldInput.tsx` - uses `status` field
- [x] `MentionChip.tsx` - uses `status` field
- [x] `ReferenceStatusBadge.tsx` - displays all 4 states

**VERIFY** ✅ Complete

- [x] No FE dereferencing
- [x] Broken links visible, not silent

---

## 🟡 Priority 6: UI → Backend Traceability (Low Risk, High Insight)

### 11. Add Semantic UI Tags

**ADD** ✅ Complete

- [x] `data-aa-id` - interactive elements
- [x] `data-aa-component` - composite components
- [x] `data-aa-view` - page-level views
- [x] `data-aa-action` - action buttons
- [x] `docs/ui-traceability.md` - convention documentation

### 12. Enrich API Requests

**ADD** ✅ Complete

- [x] `frontend/src/api/context.ts`
- [x] Attach `x-ui-context` header with view, component, action

### 13. Backend Logging

**CHANGE** ✅ Complete

- [x] Middleware parses `x-ui-context` (`plugins/uiContext.ts`)
- [x] Logs mutation source

---

## 🔵 Priority 7: Legacy Kill Switches (Do Last)

**Goal:** Remove code, not history

### 14. Legacy Audit Expansion

**UPDATE** ✅ Complete

- [x] `LEGACY_AUDIT.md` created with:
  - [x] last runtime hit
  - [x] replacement commit
  - [x] safe deletion date

### 15. Block New Writes

**CHANGE** ⚠️ Partial

- [ ] Validation rejects deprecated fields
- [x] Backend services use replacement APIs
- [ ] UI removes write paths to deprecated fields

### 16. Safe Deletion

**ONLY WHEN** ⚠️ Gates defined, monitoring pending

- [ ] No runtime logs (14 day monitoring required)
- [x] No imports for `/modals/`
- [x] Migration verified (015_normalize_task_statuses)
- [x] Rollback script exists

---

## Summary

| Priority | Status | Completion |
|----------|--------|------------|
| 1. Shared Domain | ✅ Complete | 100% |
| 2. FieldViewModel | ✅ Complete | 100% |
| 3. UI Layering | ✅ Complete | 100% |
| 4. Drawer Contract | ✅ Complete | 90% |
| 5. Reference States | ✅ Complete | 100% |
| 6. Traceability | ✅ Complete | 100% |
| 7. Legacy Cleanup | ⚠️ Partial | 70% |

---

## Remaining Work

### Low Priority (Priority 7 - Legacy Cleanup)

1. **Add validation to reject writes to deprecated fields**
   - Implement in relevant service layers
   - Log deprecation warnings first, then block writes

2. **Complete 14-day monitoring period**
   - Track `cloneProjectTemplates` deprecation logs
   - Confirm no production usage before removal

### Deferred (No Immediate Action Required)

3. **Read-only drawer migrations** (ViewDefinitionDrawer, ViewRecordDrawer, ProjectLibraryDrawer)
   - Lower risk, can be done incrementally

4. **IngestionDrawer analysis** - Complex drawer, may need different approach
