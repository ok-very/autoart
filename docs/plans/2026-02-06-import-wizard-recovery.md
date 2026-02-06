# Import Wizard Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Monday.com import wizard so group mappings flow into the plan, column headers are human-readable, users can cancel mid-import, and the Import entry is always findable.

**Architecture:** Four stacked PRs targeting the import wizard frontend and one shared utility. PR 1 fixes a race condition where Step 2 config mutations haven't committed before plan regeneration fires, plus wires the unused `onReset` prop. PR 2 adds field name humanization. PR 3 adds cancel/back escape hatches at every wizard step. PR 4 makes the Workbench button reflect active import state.

**Tech Stack:** React, TanStack Query mutations, Zustand, Fastify backend (read-only for this stack)

**Stack order:** PR 1 (bottom) → PR 2 → PR 3 → PR 4 (top)

---

## Task 1: Fix Step 2 Race Condition (PR 1)

**Problem:** `Step2ConfigureMapping.handleNext()` calls `generatePlan.mutateAsync()` immediately. If `updateGroupConfigs` or `updateBoardConfig` mutations are still in-flight (React Query hasn't settled), the backend reads stale config from DB.

**Files:**
- Modify: `frontend/src/workflows/import/wizard/steps/Step2ConfigureMapping.tsx:1218-1234`

**Step 1: Fix handleNext to await pending mutations**

In `Step2ConfigureMapping.tsx`, replace the `handleNext` function (lines 1218-1234):

```typescript
const handleNext = async () => {
    if (!session) return;

    try {
        setIsRefreshing(true);
        setError(null);

        // Wait for any in-flight config mutations to settle before regenerating plan.
        // Without this, generatePlan reads stale board/group configs from the DB.
        await updateBoardConfig.mutateAsync && updateBoardConfig.isPending
            ? new Promise<void>((resolve) => {
                const check = () => {
                    if (!updateBoardConfig.isPending) resolve();
                    else setTimeout(check, 50);
                };
                check();
            })
            : Promise.resolve();

        await updateGroupConfigs.mutateAsync && updateGroupConfigs.isPending
            ? new Promise<void>((resolve) => {
                const check = () => {
                    if (!updateGroupConfigs.isPending) resolve();
                    else setTimeout(check, 50);
                };
                check();
            })
            : Promise.resolve();

        const newPlan = await generatePlan.mutateAsync(session.id);
        onSessionCreated(session, newPlan);
        onNext();
    } catch (err) {
        console.error('Failed to refresh plan:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate import plan';
        setError(errorMessage);
    } finally {
        setIsRefreshing(false);
    }
};
```

**Simpler alternative** — extract a helper:

```typescript
/** Wait for a TanStack mutation to finish if it's currently pending */
function awaitMutation(mutation: { isPending: boolean }): Promise<void> {
    if (!mutation.isPending) return Promise.resolve();
    return new Promise((resolve) => {
        const check = () => {
            if (!mutation.isPending) resolve();
            else setTimeout(check, 50);
        };
        check();
    });
}

const handleNext = async () => {
    if (!session) return;

    try {
        setIsRefreshing(true);
        setError(null);

        // Drain in-flight mutations before regenerating plan
        await awaitMutation(updateBoardConfig);
        await awaitMutation(updateGroupConfigs);

        const newPlan = await generatePlan.mutateAsync(session.id);
        onSessionCreated(session, newPlan);
        onNext();
    } catch (err) {
        console.error('Failed to refresh plan:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate import plan';
        setError(errorMessage);
    } finally {
        setIsRefreshing(false);
    }
};
```

Use the simpler alternative. Place `awaitMutation` in the HELPER FUNCTIONS section (after line 148).

**Step 2: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors in Step2ConfigureMapping)

**Step 3: Commit**

```bash
git add -A
stackit create -m "fix: drain pending mutations before plan regeneration in Step 2"
```

---

## Task 2: Wire onReset in MondayImportWizardView (PR 1 continued)

**Problem:** `MondayImportWizardView` receives `onReset` but aliases it to `_onReset` and never uses it. Users can't cancel the wizard.

**Files:**
- Modify: `frontend/src/workflows/import/wizard/MondayImportWizardView.tsx:36-42, 110-139`

**Step 1: Unwire `_onReset` and add cancel to wizard header**

In `MondayImportWizardView.tsx`:

1. Change the destructuring (line 42): `onReset: _onReset` → `onReset`

2. Add a "Cancel Import" button to the wizard header (inside the `Inline` at line 117-119):

```typescript
<Inline align="center" justify="between">
    <Text size="lg" weight="bold">Monday.com Import Wizard</Text>
    <Inline align="center" gap="md">
        <Text size="sm" color="muted">Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}</Text>
        <Button variant="subtle" size="sm" onClick={onReset}>
            Cancel Import
        </Button>
    </Inline>
</Inline>
```

Make sure `Button` is imported from `@autoart/ui` (it already is in the existing imports on line 3).

**Step 2: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: wire onReset in MondayImportWizardView, add Cancel Import button"
```

---

## Task 3: Humanize Column Headers (PR 2)

**Problem:** `discoverImportFields()` in `DataTableImport.tsx` sets `label: fieldName` with no transformation. Monday column names like `status_text` or `targetDate` appear as-is.

**Files:**
- Modify: `frontend/src/ui/composites/DataTableImport.tsx:77-110, 115-140`

**Step 1: Add `humanizeFieldName` utility**

Add this function before `discoverImportFields` (around line 75):

```typescript
/**
 * Convert field names from snake_case/camelCase to human-readable Title Case.
 * "status_text" → "Status Text", "targetDate" → "Target Date", "Owner ID" → "Owner ID"
 */
function humanizeFieldName(fieldName: string): string {
    return fieldName
        // Insert space before uppercase letters in camelCase
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Replace underscores and hyphens with spaces
        .replace(/[_-]/g, ' ')
        // Capitalize first letter of each word
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}
```

**Step 2: Apply to `discoverImportFields`**

Change line 108 from:
```typescript
label: fieldName,
```
to:
```typescript
label: humanizeFieldName(fieldName),
```

**Step 3: Apply to `discoverFieldsForItems`**

Find the identical `label: fieldName` line in `discoverFieldsForItems` (around line 140) and change it the same way:
```typescript
label: humanizeFieldName(fieldName),
```

**Step 4: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit and create stacked branch**

```bash
git add -A
stackit create -m "fix: humanize import column headers from snake_case/camelCase to Title Case"
```

---

## Task 4: Add Cancel to Step 1 (PR 3)

**Problem:** Step 1 has no way to go back or cancel. Once you click the Monday icon, you're committed.

**Files:**
- Modify: `frontend/src/workflows/import/wizard/steps/Step1SelectBoards.tsx:242-258`

**Step 1: Add a cancel/back button to Step 1 footer**

The `onBack` prop is already passed to Step1 but never rendered. Change the footer `Inline` (lines 242-258):

From:
```typescript
<Inline justify="end" className="pt-2">
    <Button
        onClick={handleCreateSession}
        ...
    >
```

To:
```typescript
<Inline justify="between" className="pt-2">
    <Button onClick={onBack} variant="secondary">
        Cancel
    </Button>
    <Button
        onClick={handleCreateSession}
        ...
    >
```

Note: `onBack` is already destructured in the component signature at line 24 but unused. This wires it.

**Step 2: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
stackit create -m "fix: add cancel button to Step 1 of import wizard"
```

---

## Task 5: Add Reset to ImportSidebar During Monday Session (PR 3 continued)

**Problem:** When a Monday import session is active, the sidebar shows a static "Monday.com Connected" message with no way to start over.

**Files:**
- Modify: `frontend/src/workflows/import/panels/ImportSidebar.tsx:334-344`

**Step 1: Add reset option during active Monday session**

Replace the Monday source section (lines 334-344):

From:
```typescript
{/* Monday Source - Board list managed by Wizard now */}
{sourceType === 'monday' && (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Calendar className="w-12 h-12 text-ws-muted mb-4" />
        <div className="text-sm font-medium text-ws-text-secondary mb-2">
            Monday.com Connected
        </div>
        <p className="text-xs text-ws-muted max-w-48">
            Select a board in the main window to begin import.
        </p>
    </div>
)}
```

To:
```typescript
{/* Monday Source - Board list managed by Wizard now */}
{sourceType === 'monday' && (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Calendar className="w-12 h-12 text-ws-muted mb-4" />
        <div className="text-sm font-medium text-ws-text-secondary mb-2">
            {session ? 'Import in Progress' : 'Monday.com Connected'}
        </div>
        <p className="text-xs text-ws-muted max-w-48 mb-4">
            {session
                ? 'Configure your import in the main window.'
                : 'Select a board in the main window to begin import.'}
        </p>
        {session && (
            <button
                onClick={onReset}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-ws-text-secondary bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
                <RefreshCw className="w-4 h-4" />
                New Import
            </button>
        )}
    </div>
)}
```

Note: `RefreshCw` is already imported (line 21) and `onReset` is already in the props.

**Step 2: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: show import status and reset button in sidebar during active Monday session"
```

---

## Task 6: MondayImportWizardView Step 1 Cancel Handler (PR 3 continued)

**Problem:** Step 1's `onBack` is wired in Task 4, but the wizard's `handleBack` (line 104-108) guards `currentStep > 1`. Since Step 1 is `currentStep === 1`, the back handler does nothing. We need to make Step 1 back = cancel/reset.

**Files:**
- Modify: `frontend/src/workflows/import/wizard/MondayImportWizardView.tsx:104-108`

**Step 1: Route Step 1 back to onReset**

Change `handleBack`:

From:
```typescript
const handleBack = useCallback(() => {
    if (currentStep > 1) {
        setCurrentStep((s) => s - 1);
    }
}, [currentStep]);
```

To:
```typescript
const handleBack = useCallback(() => {
    if (currentStep === 1) {
        onReset();
    } else {
        setCurrentStep((s) => s - 1);
    }
}, [currentStep, onReset]);
```

**Step 2: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: route Step 1 back to import reset"
```

---

## Task 7: Workbench Button Active Import Indicator (PR 4)

**Problem:** The Import entry is buried inside the Workbench dropdown. When an import session is active, the button should surface this.

**Files:**
- Modify: `frontend/src/ui/layout/Header.tsx:204-215`

**Step 1: Check contextStore for import session state**

First, check what's available. The `MondayImportWizardView` already syncs session to `contextStore` via `setImportSession`. We need to read it in Header.

Find how Header currently gets panel state — it uses `openPanelIds` from a store. We need to check if `contextStore` has `importSession`.

Read: `frontend/src/stores/contextStore.ts` for the import session state.

**Step 2: Add import session awareness to Workbench button**

In `Header.tsx`, import `useContextStore`:

```typescript
import { useContextStore } from '../../stores/contextStore';
```

Inside the component, read import session:

```typescript
const importSessionActive = useContextStore((s) => !!s.importSession.sessionId);
```

Then modify the Workbench button (lines 207-215):

From:
```typescript
<Button
    variant={isWorkbenchActive ? 'light' : 'subtle'}
    color={isWorkbenchActive ? 'yellow' : 'gray'}
    size="sm"
    rightSection={<ChevronDown size={14} />}
    leftSection={<Hammer size={14} />}
>
    Workbench
</Button>
```

To:
```typescript
<Button
    variant={isWorkbenchActive || importSessionActive ? 'light' : 'subtle'}
    color={isWorkbenchActive || importSessionActive ? 'yellow' : 'gray'}
    size="sm"
    rightSection={<ChevronDown size={14} />}
    leftSection={importSessionActive ? <FolderOpen size={14} /> : <Hammer size={14} />}
>
    {importSessionActive ? 'Import' : 'Workbench'}
</Button>
```

`FolderOpen` is already imported in Header.tsx (used for the Import menu item).

**Step 3: Verify — typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit and create stacked branch**

```bash
git add -A
stackit create -m "feat: surface active import session in Workbench header button"
```

---

## Task 8: Remove Debug Console.log (PR 1 — cleanup)

**Problem:** `HierarchyPreview.tsx:73-79` has a debug `console.log` that should be removed.

**Files:**
- Modify: `frontend/src/workflows/import/components/HierarchyPreview.tsx:72-79`

**Step 1: Remove the debug log**

Delete lines 72-79:
```typescript
    // DEBUG
    console.log('[HierarchyPreview] Render:', {
        viewMode,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        fieldCount: discoveredFields.length,
        visibleFieldCount: visibleFields.size,
    });
```

**Step 2: Commit (add to PR 1)**

```bash
git add -A
git commit -m "chore: remove debug console.log from HierarchyPreview"
```

---

## Task 9: Final Typecheck + Lint

**Step 1: Build workspace deps**

```bash
pnpm --filter @autoart/shared --filter @autoart/ui build
```

**Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS

**Step 3: Lint**

```bash
pnpm lint
```

Expected: PASS (or only pre-existing warnings)

---

## Task 10: Submit Stack

```bash
stackit submit --stack
```

---

## Stack Summary

| PR | Branch | Description | Files Modified |
|----|--------|-------------|----------------|
| 1 (bottom) | auto | Fix race condition + wire onReset + remove debug log | Step2ConfigureMapping.tsx, MondayImportWizardView.tsx, HierarchyPreview.tsx |
| 2 | auto | Humanize column headers | DataTableImport.tsx |
| 3 | auto | Escape hatches: cancel buttons + sidebar reset | Step1SelectBoards.tsx, ImportSidebar.tsx, MondayImportWizardView.tsx |
| 4 (top) | auto | Workbench button import indicator | Header.tsx |

## Verification Checklist

After stack lands on main:

- [ ] Start Monday import → configure groups → advance past Step 2 → verify plan has items
- [ ] Check column headers in Step 5 Preview are Title Case
- [ ] At Step 1, click Cancel → verify session resets
- [ ] At Step 3+, click "Cancel Import" in header → verify reset
- [ ] Sidebar shows "Import in Progress" with "New Import" button during session
- [ ] Workbench button says "Import" with folder icon when session active
