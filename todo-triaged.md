# AutoArt Todo List - Triaged & Organized

*Last Updated: 2026-01-24*

## Executive Summary

The Import Wizard feature is **fully implemented and functional**. The Dockview workspace layout system now properly respects position hints. The remaining work consists of one UX issue, some data model maintenance, and feature backlog items.

---

## 🔴 CRITICAL ISSUES

### 1. Import Step 6: Post-Import Navigation

**Status:** UX Issue
**Location:** [Step6Execute.tsx:94](frontend/src/workflows/import/wizard/steps/Step6Execute.tsx#L94)

**Problem:** After successful import, user is redirected to `/projects` page without seeing the newly imported data. They lose context and can't verify the import worked correctly.

**Current Behavior:**

```typescript
window.location.href = '/projects';  // Line 94
```

**Recommended Fix:**

- Navigate to the specific project that was imported to: `/projects/{projectId}`
- OR open the project in the current workspace context
- Use the `createdIds` from execution result to identify the target project

**Implementation Notes:**

- `executionStats.createdIds` contains the project ID
- Should use React Router navigation instead of `window.location.href`
- Could also add a "View Imported Data" button before redirecting

---

## 🟡 UX IMPROVEMENTS

### 1. Import Step 5: Unclear Purpose

**Status:** Functional but Confusing
**Location:** [Step5Preview.tsx](frontend/src/workflows/import/wizard/steps/Step5Preview.tsx)

**Problem:** "Step 5: Preview & Reconcile" shows three different projection views (Hierarchy, Process, Table), but users don't understand they need to:

- Toggle between view modes using the buttons
- Click items to inspect them
- Proceed to Step 6 to execute

**Current State:**

- All three view modes work correctly
- Item selection and inspection functional
- "Execute Import" button clearly visible

**Recommended Improvements:**

- Add onboarding tooltip: "Review your import structure in different views before executing"
- Add empty state messaging when no items are selected
- Consider adding a summary card: "Ready to import: X items across Y subprocesses"

---

### 2. ClassificationPanel Display Conditions

**Status:** Working as Designed, but Could Be Clearer
**Location:** [ImportWorkflowLayout.tsx:26-40](frontend/src/workspace/layouts/workflows/ImportWorkflowLayout.tsx#L26-L40)

**Problem:** ClassificationPanel only appears when:

- `session.status === 'needs_review'`, OR
- Plan has unresolved AMBIGUOUS/UNCLASSIFIED items

If neither condition is met, the panel is hidden. Users may expect to see it at all times.

**Recommended Improvements:**

- Add a status indicator showing "All items classified" when panel is hidden
- OR always show panel but display "No classifications needed" message
- Add toggle to show/hide resolved classifications for review

---

### 3. Step 2: Parent Status Pill Enhancement

**Status:** Feature Request
**Location:** [Step2ConfigureMapping.tsx](frontend/src/workflows/import/wizard/steps/Step2ConfigureMapping.tsx)

**Request:** When entries are hierarchically linked, show both:

- Parent's status as pill-tag ("In Progress")
- Parent's name in same format

**Use Case:** Helps users understand context when viewing child items that reference a parent.

**Priority:** Low (enhancement, not a bug)

---

## 🟢 DATA MODEL MAINTENANCE

### Field Definitions Alignment

**Status:** Technical Debt
**Priority:** Medium

**Issues:**

1. **"Custom" Field Type:** Monday.com uses `custom` as a catch-all semantic role when no strong match is found. This is non-specific and should be mapped to appropriate canonical field types.

2. **Timeline Field Mapping:** Monday.com's `timeline` column type needs explicit mapping to AutoArt's canonical types (likely `date` or a date range).

**Current State:**

- FieldType schema: `text`, `number`, `email`, `url`, `textarea`, `select`, `date`, `checkbox`, `link`, `status`, `percent`, `user`, `tags`
- Monday semantic roles include `custom` as fallback

**Recommended Actions:**

1. **Audit Monday Column Types:** Create mapping table for all Monday column types -> AutoArt field types
2. **Timeline Support:** Decide if timeline should:
   - Map to single `date` field (start date only)
   - Create two fields: `start_date` and `end_date`
   - Add new `daterange` field type to schema
3. **Reduce "Custom" Usage:** Improve semantic role inference to avoid defaulting to `custom`

---

## 🔵 BACKLOG / LOWER PRIORITY

### 1. Project Workflow View Enhancements

**Priority:** Low
**Status:** Feature Requests

1. **Action Button:** Add action button to projects center-area workflow view (similar to intake form editor)
2. **Default Empty State:** Improve empty state UI or use icon-only display
3. **Project Dropdown Refactor:**
   - New project button broken
   - Remove irrelevant selections
   - Remove template dropdown (projects exist as records)

---

### 2. Rich Text Wrapper Enhancement

**Priority:** Low
**Status:** Feature Request

Create wrapper for rich text element [EditableCell.tsx](frontend/src/ui/molecules/EditableCell.tsx) that:

- Force wraps text beyond 50 characters
- Allows styled preview on click in transient editable mode

---

### 3. Auto-Helper / File Ingestion

**Priority:** Low
**Status:** Unclear if Needed

**Issues Reported:**

- "Incremental rescan and full ingestion doesn't work"
- "Connection to helper from frontend Ingestion/Import interface fails"
- Unclear if functions are merely cosmetic

**Investigation Needed:**

- Determine if this is a separate feature from Import Wizard
- Clarify if this is active development or deprecated feature

---

### 4. Runner Script for Contact Information

**Priority:** Low
**Status:** Feature Request

Create generalized runner script for pulling:

- Contact information
- Company data
- Website metadata

---

## 🔍 NEEDS INVESTIGATION

### Fields View & Contact Groups

**Status:** Unclear

**Issues:**

1. **Contact Group Auto-Population:**
   - Contact groups populate automatically
   - Can't determine if layout is proposed or implemented
   - Categories aren't canonical

2. **Inspector Attachment:**
   - "Inspector doesn't attach to field view"

**Investigation Tasks:**

- Find FieldsView component (exists at [FieldsPanel.tsx](frontend/src/ui/panels/FieldsPanel.tsx), [FieldsPage.tsx](frontend/src/pages/FieldsPage.tsx))
- Locate contact group creation logic
- Verify inspector attachment functionality

---

### Export Context Provider

**Status:** Incomplete Note
**Original Text:** "exportcontextprovider for panels when aggregate is active or within an aggregate workflow"

**Needs Clarification:**

- What is "aggregate" mode?
- Where is ExportContextProvider needed?
- What panels require this context?

---

## Cleanup Tasks (Technical Debt)

### 1. Remove emittedEvents from Frontend Types

**Status:** Incomplete cleanup
**Location:** [frontend/src/api/hooks/operations/imports.ts:47](frontend/src/api/hooks/operations/imports.ts#L47)

The backend removed `emittedEvents` from classification types, but the frontend type definition still includes it. Remove for type consistency.

### 2. Frontend Build Errors (2026-01-24)

**Status:** In Progress
**Priority:** High (blocking build)

#### Fixed

- [x] `justified-layout` type declarations - Added [frontend/src/types/justified-layout.d.ts](frontend/src/types/justified-layout.d.ts)
- [x] `hooks/index.ts` - Changed `export { default as useJustifiedLayout }` to named export
- [x] `Stack` component - Added `align` prop to [packages/ui/src/atoms/Stack.tsx](packages/ui/src/atoms/Stack.tsx)
- [x] `TimelineWrapper.tsx` - Commented out unused `_handleViewModeChange`

#### Remaining

- [ ] `SlugEditorSection.tsx` - Unused `Stack` import
- [ ] `Step4Tearsheet.tsx` - Unused `Download` import
- [ ] `useWorkspaceTheme.ts` - Unused `useUIStore` import
- [ ] `ExportRecordsDialog.tsx` - Select component API mismatch, definition_kind property access
- [ ] `MainLayout.tsx` - Dockview component type mismatch (ComponentClass vs FunctionComponent)
- [ ] `floating.ts` - `event` possibly undefined, missing `group` property

---

## Completed (Archived)

The following items have been completed and verified:

- **Dockview Hard Constraint** - FIXED. MainLayout.tsx now respects `defaultPlacement` hints from panelRegistry. Position hints (`right`, `bottom`) correctly map to dockview directions at lines 460-478.
- **ClassificationPanel Wiring** - FIXED. Classification drawer registered in OverlayRegistry.tsx
- **Schema Type Mismatch** - FIXED. `fieldMatches` and `matchRationale` added to backend types
- **Event Architecture** - FIXED. `emittedEvents` removed from backend (frontend cleanup still needed)
- **Monday OAuth** - Working. Configuration issue resolved.
- **Import Wizard Steps 1-6** - All implemented and functional
- **Request Context Middleware** - FIXED. app.py middleware syntax error corrected (2026-01-24)
- **UX #3 (Step 4 Workspace Layout)** - Auto-resolved when Dockview constraint was fixed

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Immediate

1. Fix Step 6 post-import navigation
   - Use `createdIds` from execution result
   - Navigate to `/projects/{projectId}` instead of `/projects`
   - Use React Router `navigate()` instead of `window.location.href`

2. Clean up `emittedEvents` from frontend types (consistency)

### Phase 2: UX Polish

1. Add guidance/tooltips to Step 5
2. Improve ClassificationPanel visibility indicators
3. Implement parent status pill enhancement for Step 2
4. Test workspace presets with corrected layout behavior

### Phase 3: Data Model Alignment

1. Audit and document Monday -> AutoArt field type mappings
2. Implement timeline field support
3. Reduce reliance on "custom" semantic role

### Phase 4: Feature Backlog

1. Investigate and clarify Fields View issues
2. Implement Project Workflow View enhancements
3. Build rich text wrapper component
4. Evaluate auto-helper feature requirements

---

## 🔗 KEY FILE REFERENCES

### Import Wizard

- Main View: [MondayImportWizardView.tsx](frontend/src/workflows/import/wizard/MondayImportWizardView.tsx)
- Steps Directory: [frontend/src/workflows/import/wizard/steps/](frontend/src/workflows/import/wizard/steps/)
- Backend Service: [imports.service.ts](backend/src/modules/imports/imports.service.ts)

### Monday Integration

- Config Types: [monday-config.types.ts](backend/src/modules/imports/monday/monday-config.types.ts)
- Domain Interpreter: [monday-domain-interpreter.ts](backend/src/modules/imports/monday/monday-domain-interpreter.ts)
- OAuth Service: [monday-oauth.service.ts](backend/src/modules/imports/monday/monday-oauth.service.ts)

### Field Definitions

- Field Types: [shared/src/schemas/enums.ts](shared/src/schemas/enums.ts)
- Field Schema: [shared/src/schemas/fields.ts](shared/src/schemas/fields.ts)

### Classification

- Panel: [ClassificationPanel.tsx](frontend/src/workflows/import/panels/ClassificationPanel.tsx)
- Layout: [ImportWorkflowLayout.tsx](frontend/src/workspace/layouts/workflows/ImportWorkflowLayout.tsx)
- Schema Matcher: [schema-matcher.ts](backend/src/modules/imports/schema-matcher.ts)
- Classification Service: [import-classification.service.ts](backend/src/modules/imports/services/import-classification.service.ts)

### Dockview / Workspace Layout System

- Main Layout: [MainLayout.tsx](frontend/src/ui/layout/MainLayout.tsx) - Position hints now respected (lines 460-478)
- Panel Registry: [panelRegistry.ts](frontend/src/workspace/panelRegistry.ts) - Panel definitions with `defaultPlacement`
- Workspace Presets: [workspacePresets.ts](frontend/src/workspace/workspacePresets.ts) - Built-in workspace definitions
- Workspace Store: [workspaceStore.ts](frontend/src/stores/workspaceStore.ts) - Layout persistence
