# Export Workbench P2-P5: Revised Plan

Revised against actual codebase state (Feb 2026). The original `exportworkbench-plan.md` assumed most P2-P5 infrastructure needed creation. In reality, the exports module is substantially built — routes, services, projectors, formatters, connectors, frontend workbench, API hooks all exist. This plan focuses on **what's broken, misaligned, or missing**, not what needs to be created from scratch.

---

## Current State Summary

### What's Built and Working
- Export session lifecycle (create → project → execute) — backend + frontend
- 9 export formats (RTF, plaintext, markdown, CSV, DOCX, PDF, Google Docs/Sheets/Slides)
- BFA projector: queries contacts, budgets, milestones, selection panels, tasks, stage events
- Finance exports: invoice PDF/DOCX, budget CSV, invoice list CSV
- Google integration: Docs, Sheets, Slides, Drive connectors
- Backfeeding service: parses existing Google Doc headers, fuzzy matches to projects
- Staleness + email decay detection services with routes
- Frontend: full export workbench with collection mode, preview, template presets, font selection
- 15 TanStack Query hooks for the export API
- Export modules registry (7 modules)

### What's Broken or Misaligned
See details in each phase below.

---

## Phase 2: Fix Projector ↔ Interpreter Alignment

**Problem:** P1 replaced the 5-stage model with 12 BFA canonical phases. Three things are now misaligned:

### P2.1: Update `statusBlock.stage` schema to accept canonical phases

**Files:**
| File | Change |
|------|--------|
| `shared/src/schemas/exports.ts` | Replace `z.enum(['planning', 'selection', 'design', 'installation'])` with string type or full 12-phase enum |
| `backend/src/modules/exports/projectors/bfa-project.projector.ts` | Update `deriveCurrentStage()` to return canonical phase names |

**Current `deriveCurrentStage()` (line 448-462):**
```typescript
function deriveCurrentStage(
    stageEvents: Array<{ payload: Record<string, unknown> }>
): 'planning' | 'selection' | 'design' | 'installation' | undefined {
    // Collapses everything to 4 stages via string matching
}
```

**New behavior:** Return the canonical phase name directly from the latest STAGE_ENTERED event's `stageName` payload field. No collapsing. The 12-phase names from `stage-rules.ts` flow through unchanged.

**Schema change options:**
- **Option A (recommended):** Change `stage` to `z.string().optional()` — flexible, no enum maintenance
- **Option B:** Full 12-phase enum + "On Hold" + "TBC" — type-safe but brittle to future phase additions

**Downstream impact:** Check all consumers of `statusBlock.stage`:
- `formatters/rtf-formatter.ts` — `formatProjectRtf()` may use stage for section headers
- `formatters/markdown-formatter.ts` — likely uses stage text
- Frontend `ExportPreview.tsx` — displays stage in preview

### P2.2: Update RTF formatter for 12-phase stage names

**File:** `backend/src/modules/exports/formatters/rtf-formatter.ts`

Current `formatProjectRtf()` likely expects the old 4-stage names. Verify and update any conditional formatting based on stage value (e.g., highlighting "installation" differently).

### P2.3: Verify projector event queries work with new interpreter rules

**Issue:** `getBudgetEvents()` and `getStageEvents()` query events by `factKind`. The newly-wired rules emit facts with these exact factKind values, so the queries should work. But verify:
1. That imported data actually creates `FACT_RECORDED` events with correct payloads
2. That `BUDGET_ALLOCATED` events from the BFA header pattern `(Art: $X | Total: $Y)` include `allocationType` and `amount` fields the projector expects
3. That `buildBudgets()` in the projector correctly maps the `allocationType` values to the `artwork`/`total` budget slots

### P2.4: Add projector unit tests

**File:** `backend/src/modules/exports/projectors/__tests__/bfa-project.projector.test.ts`

Test with mock data:
- `deriveCurrentStage` returns canonical phase names
- `buildBudgets` handles BFA header budget events
- `extractInstallInfo` returns fuzzy dates
- `formatMilestones` handles all 17 milestone types
- `buildSelectionPanelBlock` maps panel records correctly

**Verify PR2:**
- `pnpm --filter autoart-backend build`
- `pnpm --filter autoart-backend test`
- `pnpm typecheck` (shared schema change propagates to frontend)

---

## Phase 3: Context Helper & Reminder UI

### P3.1: Wire Reminder Panel in frontend

**Backend:** Routes already exist at `GET /context/staleness`, `GET /context/email-decay`, `POST /context/backfeed/:docId`. Services are implemented.

**Frontend gap:** No dedicated `ReminderPanel` component. The hooks exist (`useCloudConnectionStatus`) but there's no UI surface that aggregates staleness + email decay + backfeed data.

**File to create:** `frontend/src/workflows/export/panels/ReminderPanel.tsx`

**Design:**
- Collapsible panel in ExportWorkbench sidebar or inspector area
- Three sections with badge counts:
  1. **Stale Projects** — projects not updated in N days (configurable threshold)
  2. **Email Decay** — projects with unanswered outbound emails > 7 days
  3. **Missing Data** — projects with empty budget/contacts/milestones fields
- Each item links to project in ComposerPage
- Snooze (3 days) and Resolve actions

**Hooks to use/create:**
- `useStaleProjects(projectIds, thresholdDays)` — may need new hook or reuse from exports.ts
- `useEmailDecay(projectIds)` — may need new hook
- Backfeed data already accessible via existing hooks

### P3.2: Staleness threshold setting

**Backend:** Add `staleness_threshold_days` to user_settings schema (default: 7).
**Frontend:** Settings page slider (1-30 days).

### P3.3: Connect backfeed analysis to project selection UI

The backfeed service parses Google Doc headers and returns matched projects. Connect this to the ExportWorkbench project selection step:
- Show "In Doc" badge for already-exported projects
- Show last update date from doc
- Pre-select matched projects
- Surface unmatched projects as candidates

---

## Phase 4: Frontend Polish & Missing Integration

### P4.1: Verify ExportWorkbench end-to-end flow

The workbench UI exists but may have broken connections after P2 schema changes. Verify:
1. Project selection → session creation → projection generation → preview → export execution
2. Each format works: RTF download, plaintext display, markdown display, CSV download, Google Docs export
3. Finance exports: invoice PDF/DOCX, budget CSV work from the finance routes

### P4.2: Export preview uses real projection data

Check `ExportPreview.tsx` — verify it renders `BfaProjectExportModel` fields including:
- Header with canonical phase name (not old 4-stage name)
- Budget display with `(Art: $X | Total: $Y)` format
- All 17 milestone types in timeline block
- Selection panel block with members, shortlist, selected artist

### P4.3: Collection mode integration

Verify the collection mode flow (SelectableWrapper, CollectionFlashOverlay, CollectionModeProvider) works for cherry-picking projects for export.

---

## Phase 5: Modular Target System Refinement

### P5.1: Verify ExportTarget implementations

Three targets exist: `bfa-rtf-target.ts`, `google-docs-target.ts`, `pdf-target.ts`. Verify:
1. Each implements the `ExportTarget` interface correctly
2. The target registry (`targets/index.ts`) registers all targets
3. `exports.service.ts` dispatches to the correct target based on format

### P5.2: Add DOCX target (if missing)

The service has `exportAsDocx()` but check if it uses the target interface or is hardcoded. If hardcoded, refactor to use target pattern for consistency.

### P5.3: Future target stubs

The plan mentions invoice-template, budget-table, and InDesign data merge targets. These are not needed now but the interface should accommodate them. Verify `ExportTarget.project()` return type is flexible enough.

---

## PR Structure

### Stack 1: P2 (Projector alignment) — 2-3 PRs
```
PR1: feat: update stage schema to accept canonical phase names
     - shared/src/schemas/exports.ts — stage field change
     - bfa-project.projector.ts — deriveCurrentStage returns canonical names
     - rtf-formatter.ts — update any stage-conditional formatting

PR2: feat: add BFA projector tests
     - bfa-project.projector.test.ts
```

### Stack 2: P3 (Reminder UI) — 2 PRs
```
PR3: feat: add ReminderPanel with staleness + email decay display
     - ReminderPanel.tsx
     - New/updated hooks

PR4: feat: connect backfeed analysis to project selection
     - ExportWorkbench project selection changes
     - Badge display for matched projects
```

### Stack 3: P4-P5 (Polish) — 1-2 PRs
```
PR5: fix: verify and fix end-to-end export flow
     - Any broken connections from schema changes
     - Preview rendering fixes

PR6: refactor: ensure all formats use ExportTarget interface
     - Only if needed after P5.1 audit
```

---

## Risk Notes

1. **Schema change propagation** — Changing `stage` type in shared schema triggers rebuild of frontend + backend. Run `pnpm typecheck` across monorepo after change.
2. **Google integration testing** — Google Docs/Sheets/Slides connectors require OAuth. Manual testing or mock-based unit tests.
3. **Finance exports coupling** — Finance export routes share the same service. Changes to `exports.service.ts` must not break invoice/budget exports.
4. **Projector test data** — Need realistic mock data for projector tests. Can derive from BFA-todo sample YAMLs but may need to construct hierarchy_nodes + events fixtures manually.

---

## Execution Priority

P2 (projector alignment) unblocks everything else. The schema mismatch between 12-phase interpreter output and 4-stage projector input means exported documents currently show collapsed/incorrect phase information.

```
P2.1  Stage schema + deriveCurrentStage update    IMMEDIATE   Unblocks: all exports show correct phase
P2.2  RTF formatter update                        SAME PR     Unblocks: RTF export accuracy
P2.3  Verify event query alignment                SAME PR     Validates: interpreter → projector pipeline
P2.4  Projector tests                             NEXT PR     Validates: P2 correctness
P3    Reminder panel + backfeed                    AFTER P2    New feature
P4    E2E verification + polish                   AFTER P3    Quality pass
P5    Target system audit                         AFTER P4    Architecture cleanup
```
