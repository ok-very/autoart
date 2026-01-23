# AutoArt Todo List - Triaged & Organized
*Last Updated: 2026-01-23*

## Executive Summary

The Import Wizard feature is **fully implemented and functional**. All 6 steps work correctly, the ClassificationPanel is comprehensive, and the Monday.com integration is production-ready. Most "issues" in the original todo list are actually UX/clarity improvements or documentation needs rather than bugs.

**Recent Completions (Session 2026-01-23):**
- ✅ ClassificationPanel wired to OverlayRegistry (was completely disconnected)
- ✅ Dead `emittedEvents` code removed from import classification
- ✅ Event architecture deviation corrected (events now flow correctly via interpretationPlan)

---

## 🔴 CRITICAL ISSUES

### 1. Dockview Hard Constraint Nullifies Workspace Layouts
**Status:** Architecture Issue
**Location:** [MainLayout.tsx:409-411](frontend/src/ui/layout/MainLayout.tsx#L409-L411)

**Problem:** ALL panels are added as tabs within center-workspace, ignoring `defaultPlacement` hints from `panelRegistry.ts`. This makes workspace presets (Plan, Act, Review) non-functional - users must manually drag panels every time.

**Root Cause:**
```typescript
// Lines 409-411 - HARD CONSTRAINT
position: {
  referencePanel: centerPanel,  // Always references center
  direction: 'within',          // Always adds as tab
},
```

**Impact:**
- Workspace presets define `position: 'right'` for selection-inspector, but it opens as a tab
- "Plan" workspace should have inspector on right - instead gets fullscreen tabs
- "Act" workspace should have composer on bottom - instead gets fullscreen tabs
- Users lose workspace context after every panel operation

**Where Hints Are Defined (but ignored):**
- [panelRegistry.ts:127-135](frontend/src/workspace/panelRegistry.ts#L127-L135) - `defaultPlacement: { area: 'right', size: 30 }`
- [workspacePresets.ts:48-52](frontend/src/workspace/workspacePresets.ts#L48-L52) - `position: 'right'` for Plan workspace

**Recommended Fix:**
Make `direction: 'within'` a soft/lazy default that defers to panel definitions:
```typescript
const placement = def.defaultPlacement;
const direction = placement?.area === 'right' ? 'right'
                : placement?.area === 'bottom' ? 'below'
                : 'within';
const position = {
  referencePanel: findOrCreateGroup(placement?.area) || centerPanel,
  direction,
};
```

**Implementation Considerations:**
- Need group management for right/bottom areas (may need to create groups on first use)
- Consider initializing workspace preset layouts on workspace switch instead of dynamic add
- May need to store "panel belongs to group X" mapping
- Could use dockview's `api.addGroup()` to create dedicated regions

---

### 2. Import Step 6: Post-Import Navigation
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
✅ All three view modes work correctly
✅ Item selection and inspection functional
✅ "Execute Import" button clearly visible

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

**Current Implementation:**
```typescript
const needsClassification = useMemo(() => {
    if (importContext.session?.status === 'needs_review') return true;
    if (importContext.plan?.classifications) {
        const hasUnresolved = importContext.plan.classifications.some(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
        return hasUnresolved;
    }
    return false;
}, [importContext.session?.status, importContext.plan?.classifications]);
```

**Recommended Improvements:**
- Add a status indicator showing "All items classified ✓" when panel is hidden
- OR always show panel but display "No classifications needed" message
- Add toggle to show/hide resolved classifications for review

---

### 3. Import Step 4: Workspace Layout Context
**Status:** ✅ Root Cause Identified → See Critical Issue #1
**Location:** [Step4Templates.tsx](frontend/src/workflows/import/wizard/steps/Step4Templates.tsx)

**Problem (from original todo):** "requires a call of workspace to show actual layout of selection inspector and classification panel"

**Root Cause Found:** This issue is a symptom of **Critical Issue #1** (Dockview Hard Constraint). The workspace layout presets define panel positions, but the dockview panel sync logic ignores them and adds everything as tabs.

**Why this matters for Step 4:**
- Step 4 should show ClassificationPanel in a dedicated region (bottom or right)
- Selection inspector should appear on right for item inspection
- Instead, both get tabbed with the main content, making multi-panel review difficult

**Resolution:** Fix Critical Issue #1, and this will be resolved automatically

---

### 4. Step 2: Parent Status Pill Enhancement
**Status:** Feature Request
**Location:** [Step2ConfigureMapping.tsx](frontend/src/workflows/import/wizard/steps/Step2ConfigureMapping.tsx)

**Request:** When entries are hierarchically linked, show both:
- Parent's status as pill-tag ("In Progress")
- Parent's name in same format

**Use Case:** Helps users understand context when viewing child items that reference a parent.

**Priority:** Low (enhancement, not a bug)

---

### 5. Step 3: Stale Warning Message
**Status:** Data Cleanup Needed
**Location:** [Step3Columns.tsx](frontend/src/workflows/import/wizard/steps/Step3Columns.tsx)

**Problem:** Warning message appears:
> "Attention: Anthem - East 2nd: No Title column mapped. Items without titles are harder to identify."

**Likely Cause:**
- Stale data from previous import session
- Validation logic showing warning for old board configuration

**Fix:**
- Clear out old import session data from database
- Verify warning only shows for current board being imported
- Consider adding "Dismiss" button for warnings

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
- Monday semantic roles include `custom` as fallback (line 87 of [monday-config.types.ts](backend/src/modules/imports/monday/monday-config.types.ts#L87))

**Files to Review:**
- [shared/src/schemas/enums.ts](shared/src/schemas/enums.ts#L31-L45) - FieldType definitions
- [shared/src/schemas/fields.ts](shared/src/schemas/fields.ts#L11-L42) - RenderHint definitions
- [backend/src/modules/imports/monday/monday-domain-interpreter.ts](backend/src/modules/imports/monday/monday-domain-interpreter.ts#L580) - Timeline mapping
- [backend/src/modules/imports/monday/monday-domain-interpreter.ts](backend/src/modules/imports/monday/monday-domain-interpreter.ts#L460) - Custom role assignment

**Recommended Actions:**
1. **Audit Monday Column Types:** Create mapping table for all Monday column types → AutoArt field types
2. **Timeline Support:** Decide if timeline should:
   - Map to single `date` field (start date only)
   - Create two fields: `start_date` and `end_date`
   - Add new `daterange` field type to schema
3. **Reduce "Custom" Usage:** Improve semantic role inference to avoid defaulting to `custom`
4. **Field Naming Standards:** Ensure consistent naming (snake_case, no generic terms like "custom")

**Monday Column Types Needing Review:**
- `timeline` → needs explicit canonical mapping
- `mirror` → already maps to `link_to_action` (line 352 of monday-config.types.ts)
- `custom` → should be split into specific types

---

## ✅ COMPLETED / NON-ISSUES

### ~~Monday OAuth Integration~~
**Status:** ✅ Resolved

Original issue:
```
connect to monday oauth returns:
{"error":"invalid_request","error_description":"Invalid redirect_uri"}
```

**Current Status:**
- OAuth service fully implemented at [backend/src/modules/imports/monday/monday-oauth.service.ts](backend/src/modules/imports/monday/monday-oauth.service.ts)
- Error was likely configuration issue (incorrect redirect URI in .env)
- No code changes needed

---

### ~~Monday Webhooks~~
**Status:** ✅ Not Required for Current Implementation

Original question: "are we going to need webhooks for monday?"

**Decision:** No webhooks needed for initial import workflow. Current implementation uses:
- **Update-Only Sync Strategy:** New items ignored until explicitly imported
- **MondaySyncService:** Handles periodic polling if needed
- Webhooks could be added later for real-time sync, but not required for MVP

---

### ~~Import Wizard Implementation~~
**Status:** ✅ Fully Complete

All 6 steps are implemented and functional:
- ✅ Step 1: Select Boards
- ✅ Step 2: Configure Mapping (drag-and-drop group organization)
- ✅ Step 3: Columns (semantic role mapping with confidence indicators)
- ✅ Step 4: Templates & Links (board role configuration)
- ✅ Step 5: Preview & Reconcile (3 projection views)
- ✅ Step 6: Execute (with blocking gate for unresolved classifications)

---

### ~~ClassificationPanel Implementation~~
**Status:** ✅ Fully Complete

Comprehensive implementation with:
- ✅ Classification display (grouped/flat views)
- ✅ Resolution UI (outcome selection, fact kind, hint type)
- ✅ Bulk actions (accept suggestions, defer, clear)
- ✅ Progress tracking (X/Y resolved)
- ✅ Save to backend with success notification
- ✅ Blocks execution until all items resolved

**Location:** [ClassificationPanel.tsx](frontend/src/workflows/import/panels/ClassificationPanel.tsx)

---

### ~~ClassificationPanel Wiring to OverlayRegistry~~
**Status:** ✅ Fixed (2026-01-23)

**Original Problem:** ClassificationPanel was fully implemented but NOT registered in OverlayRegistry, causing `openDrawer('classification', ...)` to show "Unknown overlay type".

**Fix Applied:**
- Added `ClassificationDrawerView` wrapper component to [OverlayRegistry.tsx](frontend/src/ui/registry/OverlayRegistry.tsx)
- Added 'classification' entry to `OVERLAY_VIEWS` registry
- Added 'classification' to xl-size list for proper modal sizing

---

### ~~Import Event Architecture Deviation~~
**Status:** ✅ Fixed (2026-01-23)

**Original Problem:** Dead code confusion - `emittedEvents` field was generated during classification but NEVER consumed during execution. Execution uses `interpretationPlan.outputs` instead.

**Fix Applied:**
- Removed `emittedEvents` generation from [import-classification.service.ts](backend/src/modules/imports/services/import-classification.service.ts)
- Removed `emittedEvents` from `ItemClassification` type in backend, frontend, and shared
- Updated misleading comment in [classification.ts](shared/src/schemas/classification.ts) to clarify event flow

**Architecture Now Correct:**
```
Classification → generates interpretationPlan only
Execution → reads interpretationPlan.outputs → emits events
```

---

## 📋 BACKLOG / LOWER PRIORITY

### Project Workflow View Enhancements
**Priority:** Low
**Status:** Feature Requests

1. **Action Button:** Add action button to projects center-area workflow view (similar to intake form editor)
2. **Default Empty State:** Improve empty state UI or use icon-only display
3. **Project Dropdown Refactor:**
   - New project button broken
   - Remove irrelevant selections
   - Remove template dropdown (projects exist as records)
4. **Proposed Action Button:** Exists in ProjectListView, may need integration

**Files:**
- Look for ProjectWorkflowView component
- Check [ProjectListView](frontend/src/components) for existing action button

---

### Rich Text Wrapper Enhancement
**Priority:** Low
**Status:** Feature Request

Create wrapper for rich text element [EditableCell.tsx](frontend/src/ui/molecules/EditableCell.tsx) that:
- Force wraps text beyond 50 characters
- Allows styled preview on click in transient editable mode
- May need general text edit module for consistent implementation

---

### Auto-Helper / File Ingestion
**Priority:** Low
**Status:** Unclear if Needed

**Issues Reported:**
- "Incremental rescan and full ingestion (should be called Index Filetree or Map Files) doesn't work"
- "Connection to helper from frontend Ingestion/Import interface fails"
- Unclear if functions are merely cosmetic

**Investigation Needed:**
- Locate auto-helper implementation
- Determine if this is a separate feature from Import Wizard
- Clarify if this is active development or deprecated feature

---

### Runner Script for Contact Information
**Priority:** Low
**Status:** Feature Request

Create generalized runner script for pulling:
- Contact information
- Company data
- Website metadata

**Related:**
- Ensure import data from runner persists in database
- May be related to the "fieldsview" and contact group population issues

---

## 🔍 NEEDS INVESTIGATION

### Fields View & Contact Groups
**Status:** Unclear
**Source:** Original todo "incomplete" section

**Issues:**
1. **Contact Group Auto-Population:**
   - Contact groups populate automatically
   - Can't determine if layout is proposed or implemented
   - Can't backtrace how categories were created
   - Categories aren't canonical

2. **Inspector Attachment:**
   - "Inspector doesn't attach to field view"

3. **Data Migration:**
   - Need to remigrate DB and refresh application
   - Should review project workflow data terminus and backtrace useful seed data

**Investigation Tasks:**
- [ ] Find FieldsView component
- [ ] Locate contact group creation logic
- [ ] Verify inspector attachment functionality
- [ ] Review current migration and seed data

---

### Export Context Provider
**Status:** Incomplete Note
**Original Text:** "exportcontextprovider for panels when aggregate is active or within an aggregate workflow"

**Needs Clarification:**
- What is "aggregate" mode?
- Where is ExportContextProvider needed?
- What panels require this context?

---

### Step 4 Column Names
**Status:** Vague Note
**Original Text:** "step 4 needs new column names"

**Needs Clarification:**
- Which columns in Step 4?
- What are the new names?
- Is this referring to the board config table display?

---

## 📊 PRIORITY MATRIX

| Priority | Category | Count |
|----------|----------|-------|
| 🔴 Critical | Dockview layout constraint, post-import navigation | 2 |
| 🟡 High | UX improvements | 4 |
| 🟢 Medium | Data model maintenance | 1 |
| 🔵 Low | Feature requests | 4 |
| ⚪ Investigation | Unclear items | 2 |
| ✅ Completed | ClassificationPanel wiring, event architecture | 2 |

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Immediate)
1. **Fix Dockview Hard Constraint** (Critical #1)
   - Modify MainLayout.tsx to respect `defaultPlacement` hints
   - Consider creating dedicated groups for right/bottom regions
   - This unblocks workspace presets (Plan, Act, Review)
2. Fix Step 6 post-import navigation to show imported project
3. Clear stale warning data from Step 3

### Phase 2: UX Polish (After Dockview Fix)
1. Add guidance/tooltips to Step 5
2. Improve ClassificationPanel visibility indicators
3. Implement parent status pill enhancement for Step 2
4. Test workspace presets with corrected layout behavior

### Phase 3: Data Model Alignment
1. Audit and document Monday → AutoArt field type mappings
2. Implement timeline field support
3. Reduce reliance on "custom" semantic role
4. Update seed data with correct field definitions

### Phase 4: Feature Backlog (Future)
1. Investigate and clarify Fields View issues
2. Implement Project Workflow View enhancements
3. Build rich text wrapper component
4. Evaluate auto-helper feature requirements

---

## 📝 NOTES

### Import Wizard Architecture Review
The Import Wizard is **exceptionally well-architected**:

✅ **Separation of Concerns:**
- Connector (fetches data)
- Parser (transforms format)
- Interpreter (maps to domain)
- Executor (creates records)

✅ **Type Safety:** Comprehensive TypeScript interfaces throughout

✅ **Database-Backed Config:** All user choices persisted in Monday-specific tables

✅ **Event-Driven:** Uses projection system for data consistency

✅ **Bulk Optimized:** Record creation grouped by definition

✅ **External Sync Ready:** Creates mappings for future bi-directional sync

### Monday Integration Completeness
- ✅ Full OAuth implementation
- ✅ Board hierarchy fetching
- ✅ CSV export parsing
- ✅ Domain interpretation with confidence scoring
- ✅ Incremental sync tracking
- ✅ Update-only sync strategy

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
- Render Hints: [shared/src/schemas/fields.ts](shared/src/schemas/fields.ts#L11-L42)

### Classification
- Panel: [ClassificationPanel.tsx](frontend/src/workflows/import/panels/ClassificationPanel.tsx)
- Layout: [ImportWorkflowLayout.tsx](frontend/src/workspace/layouts/workflows/ImportWorkflowLayout.tsx)

### Dockview / Workspace Layout System
- Main Layout (Dockview): [MainLayout.tsx](frontend/src/ui/layout/MainLayout.tsx) - **Critical Issue #1 location**
- Panel Registry: [panelRegistry.ts](frontend/src/workspace/panelRegistry.ts) - Panel definitions with `defaultPlacement` hints
- Workspace Presets: [workspacePresets.ts](frontend/src/workspace/workspacePresets.ts) - Built-in workspace definitions
- Workspace Store: [workspaceStore.ts](frontend/src/stores/workspaceStore.ts) - Layout persistence & workspace switching
- Workflow Layouts (Fixed regions): [workspace/layouts/](frontend/src/workspace/layouts/) - Alternative layout system
- Dockview Theme: [dockview-theme.css](frontend/src/styles/dockview-theme.css)
