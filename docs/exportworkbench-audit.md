# Export Workbench Audit & Revised Plan

Independent evaluation of P2-P5 remaining work. Supersedes `exportworkbench-plan-p2-p5.md` where findings differ.

Date: 2026-02-10

---

## Critical Discovery: Two Disconnected Export UIs

The app renders the wrong component.

| Component | Location | Backend? | What it does |
|-----------|----------|----------|--------------|
| `ExportWorkbench` | `workflows/export/views/ExportWorkbench.tsx` | NO | Collection-based. Uses `collectionStore`. Generates client-side HTML/text blobs. Downloads via `Blob` + `URL.createObjectURL`. |
| `ExportWorkbenchContent` | `workflows/export/views/ExportWorkbenchContent.tsx` | YES | Session-based. Uses `exportWorkbenchStore`. Calls `useCreateExportSession`, `useGenerateExportProjection`, `useExecuteExport`. Full lifecycle. |

**What the app actually renders:**
- `CenterContentRouter` maps `contentType: 'export'` to `ExportContent`
- `ExportContent` renders `<ExportWorkbench />` (the collection-based one)
- `ExportWorkbenchContent` is exported from `index.ts` but **never mounted**
- `ExportWorkbenchSidebar` (project selection for backend flow) is also **never mounted**

The entire backend export pipeline (sessions, projections, formatters, targets, 15 TanStack hooks) is unreachable from the running application.

**Decision needed:** Are these two separate export modes, or should `ExportWorkbenchContent` replace `ExportWorkbench`?

---

## Critical Discovery: BFA GDocs Injection Pipeline

Neither the original nor revised plan adequately covers the BFA-specific Google Docs injection path. This is the path that replicates BFA-todo's purpose: injecting project data into a live Google Doc.

### The Two Google Docs Paths

**Path 1: Export Target (generic)**
```
ExportWorkbench → GoogleDocsTarget → GoogleDocsConnector
Creates/updates a NEW Google Doc with all selected projects.
```

**Path 2: BFA Injection (specific, BFA-todo equivalent)**
```
Monday.com sync → diff report → user decisions → projectBfaExportModels()
    → bfa-gdocs-injector.ts → GoogleDocsConnector + GoogleDocsClient
Matches projects to existing doc headers, replaces content IN-PLACE.
```

Path 2 is the one that matters. It lives in:
- `backend/src/modules/programs/bfa-sync.service.ts` — orchestration (`injectToGoogleDoc()`)
- `backend/src/modules/programs/bfa-gdocs-injector.ts` — matching + replacement + formatting
- Route: `POST /sync/:id/inject`

### What the BFA Injector Does

1. Loads diff report from Monday.com reconciliation
2. Gets user-approved decisions (which changes to apply)
3. Resolves entity IDs → project node IDs
4. Calls `projectBfaExportModels()` to build `BfaProjectExportModel[]` for affected projects
5. Builds `changedFields` map from decisions
6. Analyzes target Google Doc for existing project headers
7. Matches projects to headers (exact name match, then fuzzy substring)
8. For each match: deletes content between header and next section, inserts fresh content
9. Applies formatting: bold labels, yellow highlights for changed fields

### Gap in Injector: No Stage/Phase in Output

`formatProjectContent()` in `bfa-gdocs-injector.ts` renders contacts, milestones, selection panel, status text, and next steps — but **does not render `statusBlock.stage`**. The canonical phase name is available in the export model but is not injected into the Google Doc.

This may be intentional (the header line is preserved, and BFA headers typically contain phase info). Needs user decision.

### Highlight Generation — REMOVED

The injector previously generated yellow highlights for changed field values (`FIELD_LABEL_MAP`, `highlightGenericChanges`). This was removed — highlighting is maintained through the reinjection loop instead. The `changedFields` parameter was stripped from `injectProjects`, `buildProjectReplacement`, and `buildFormattingRequests`. The caller in `bfa-sync.service.ts` no longer builds the changedFields map.

---

## Phase 2: Projector ↔ Interpreter Alignment

### P2.1 Stage Schema — DONE

`statusBlock.stage` is already `z.string().optional()`. `deriveCurrentStage()` already returns canonical phase names directly from `stageName` payload field. Both changes are on this branch.

### P2.2 RTF Formatter — NO WORK NEEDED

The RTF formatter has zero conditional logic based on stage names. It renders projects by category (`public`/`corporate`/`private_corporate`) and iterates over structured blocks. `statusBlock.stage` is never read by any formatter (RTF, Markdown, Plaintext). They render `projectStatusText` and `bfaProjectStatusText` as text.

### P2.3 Event Query Alignment — WIRED CORRECTLY, ONE GAP

The interpreter → events → projector chain:
1. `stage-rules.ts` emits `factKind: 'STAGE_ENTERED'` with `payload.stageName` (canonical phase)
2. `budget-rules.ts` emits `factKind: 'BUDGET_ALLOCATED'` with `payload.allocationType` + `amount`
3. Import execution writes to `events` as `type: 'FACT_RECORDED'` with payload.factKind preserved
4. Projector queries filter `type = 'FACT_RECORDED'` then `payload.factKind`

**Stage pipeline:** Aligned. `normalizeStage()` maps all inputs (including old 4-stage names) to 12 canonical phases. `deriveCurrentStage()` reads `payload.stageName` — match confirmed.

**Budget pipeline:** Aligned for `artwork` and `total`. Gap:
- `extractAllocationType()` returns `'budget'` as default fallback
- `buildBudgets()` only checks for `allocationType === 'artwork'` or `'total'`
- Budget events with generic `allocationType: 'budget'` (e.g., "budget allocated $500K" without specifying art/total) are persisted but invisible in exports
- **Decision needed:** Should generic `'budget'` events slot into `total`? Currently silent.

### P2.4 Projector Tests — NOT DONE

- No test directory: `exports/projectors/__tests__/` does not exist
- No test files matching `bfa-project.projector*test*`
- Interpreter mapping tests exist and are solid (covers all 12 canonical phases, alias mapping, budget parsing)
- **Needed:** Unit tests for `buildBudgets()`, `deriveCurrentStage()`, `buildSelectionPanelBlock()`, `formatMilestones()`, `formatNextSteps()`

### P2.5 Frontend Mock Cleanup — NOT DONE

In `ExportPreview.tsx`:
- Line 71: `stage: 'planning' as const` — stale 4-stage name, should be canonical phase
- Lines 73-75: `ownerHint: 'BFA'` — schema says `assigneeHint`

### P2.6 ExportOptions Schema Divergence

**Shared schema** (`shared/src/schemas/exports.ts`):
```
includeContacts, includeBudgets, includeMilestones, includeSelectionPanel, includeOnlyOpenNextSteps, includeStatusNotes
```

**Routes schema** (`backend/src/modules/exports/exports.routes.ts`):
```
includeContacts, includeMilestones, includeStatusNotes, includeSelectionPanel, includeOnlyOpenNextSteps, highlightCurrentMonth
```

Differences:
- Routes has `highlightCurrentMonth` — shared does not
- Shared has `includeBudgets` — routes does not
- `ExportWorkbenchContent` sends options from `DEFAULT_EXPORT_OPTIONS` (shared), so `includeBudgets` is sent but silently stripped by routes schema

---

## Phase 3: Context Helper & Reminder Module

### Backend — DONE

All three services exist with real logic:

| Service | File | Functions |
|---------|------|-----------|
| Backfeeding | `exports/backfeeding.service.ts` | `analyzeExistingDoc()`, `fuzzyMatch()`, `matchHeadersToProjects()` |
| Staleness | `exports/staleness.service.ts` | `detectStaleProjects()`, `getStalenessSummary()` |
| Email Decay | `exports/email-decay.service.ts` | `detectEmailDecay()`, `detectEmailDecayBatch()` |

Routes wired at:
- `POST /context/backfeed/:docId`
- `GET /context/staleness`
- `GET /context/email-decay`
- `GET /context/email-decay/:projectId`

### Frontend — NOT DONE

- No `ReminderPanel` component exists
- No hooks for staleness/email-decay/backfeed analysis
- No "In Doc" badges in project selection
- No staleness threshold in settings UI

Missing hooks:
- `useStaleProjects(projectIds, thresholdDays)` — for `GET /context/staleness`
- `useEmailDecay(projectIds)` — for `GET /context/email-decay`
- `useBackfeedAnalysis(docId)` — for `POST /context/backfeed/:docId`

**Depends on:** Priority 0 (render wiring) — `ExportWorkbenchSidebar` with project selection needs to be mounted for backfeed badges to have a home.

---

## Phase 4: Frontend Polish & Integration

### ExportPreview — FUNCTIONAL BUT ORPHANED

Well-built. Fetches real projection data via `useExportProjection(sessionId)` when a session exists. Falls back to hardcoded placeholder. Renders `BfaProjectExportModel` correctly. Two-column original/regenerated comparison.

Issues: placeholder cleanup (P2.5), and it's only reachable through `ExportWorkbenchContent` which is never mounted.

### Collection Mode — EXISTS, UNRELATED TO BACKEND

`SelectableWrapper`, `CollectionFlashOverlay`, `CollectionModeProvider` are functional. They serve the client-side `ExportWorkbench`, not the backend session flow. Complete but in a parallel universe from the export session pipeline.

### Route — NOT REGISTERED

`/export` not in `App.tsx`. `ExportPage` exists but is unreachable. Navigation goes through DockviewWorkspace → "Deliver" preset → `ExportContent` → `ExportWorkbench` (the wrong one).

---

## Phase 5: Modular Target System

### Target Registry — EXISTS BUT DEAD CODE

`ExportTargetRegistryImpl` with 3 registered targets (`BfaRtfTarget`, `GoogleDocsTarget`, `PdfTarget`). The registry, interface, and concrete implementations exist but `executeExport()` in `exports.service.ts` uses a hardcoded `switch` on `session.format` (9 cases). Adding a new target requires modifying the switch.

DOCX is hardcoded (`exportAsDocx()`), not in the registry. Finance exports are a completely separate path.

---

## Naming Audit: Stage/Phase Lattice

### Clean Boundaries

**"Stage"** — event system term:
- Event `factKind`: `STAGE_ENTERED`
- Payload: `stageName` (carries canonical phase string like "6. Detailed Design")
- Projector: `deriveCurrentStage()` → returns the string as-is
- Schema: `statusBlock.stage: z.string().optional()`

**"Phase"** — container/budget term:
- `BfaPhaseBudget.phaseLabel` — budget per phase
- `header.budgets.phases` — array of phase-level budgets
- 12 canonical phases: "1. Project Initiation" through "11. Photo" + "On Hold" + "TBC"

**"Milestone"** — concrete dated events:
- `BfaMilestoneSchema` — `kind`, `dateText`, `normalizedDate`, `status`
- Kinds: PPAP, DPAP, SP1, AO, SP2, etc.

**"Step"** — UI navigation only:
- `ExportWorkbenchStore.step`: `'configure' | 'output'`

### Muddy Boundaries

1. **Google Slides connector** (line 380): `Stage: ${project.statusBlock.stage}` — displays "Stage: 6. Detailed Design". Label says "Stage", value is a canonical phase name.

2. **ExportPreview** (line 184): `<Text>Stage</Text><Badge variant="phase">` — label says "Stage", badge variant says "phase", field name is `stage`, value is a canonical phase.

3. **The core tension:** The event system says "stage" (`STAGE_ENTERED`, `stageName`) but the values are canonical phase names. The schema field is `stage` but holds phase values. Renaming requires updating every consumer. Keeping it requires documentation.

4. **`stage-rules.ts` regex** (line 227): `(?:stage|phase)` pattern matches both words in text input. Correct for parsing but blurs the boundary at the source.

### Risk Assessment

**Low-to-medium.** No code branches on specific stage string values except the interpreter's alias normalization. The risk is not bugs but developer confusion. A JSDoc comment on `statusBlock.stage` clarifying it holds canonical phase names would close the gap.

---

## Revised Priority Order

```
P0  Fix render wiring                      IMMEDIATE    Unblocks: all backend work visible to user
    - Decision: replace ExportWorkbench with ExportWorkbenchContent, or support both?
    - Wire ExportWorkbenchSidebar into the mounted UI

P0.5 Reconcile ExportOptions schemas       SAME PR      Unblocks: options actually reach projector
    - Routes schema and shared schema need alignment
    - highlightCurrentMonth vs includeBudgets

P1  BFA GDocs injector alignment           NEXT         Unblocks: accurate live doc injection
    - Add stage/phase line to formatProjectContent (if desired)
    - Fix Phase: highlight rule (currently dead)
    - Verify injector works with canonical phase names in export model
    - Add test coverage for injection pipeline

P2  Projector tests + cleanup              NEXT         Validates: everything above
    - Unit tests for projector pure functions
    - Fix ExportPreview placeholder data
    - JSDoc on statusBlock.stage

P3  Context helper frontend                AFTER P0     New feature
    - 3 hooks + ReminderPanel + settings slider
    - Backfeed → project selection "In Doc" badges
    - Depends on ExportWorkbenchSidebar being mounted (P0)

P4  E2E verification                       AFTER P3     Quality pass
    - Full flow: select → session → projection → preview → export → download
    - Each format works
    - Finance exports unbroken

P5  Target registry wiring (optional)      AFTER P4     Architecture cleanup
    - Decide: use registry or keep switch? Registry adds no value until
      someone adds a target without modifying the service.
    - If registry: migrate switch cases to target implementations
    - If switch: delete dead target registry code
```

---

## What's Real vs Theatrical

### Theatrical (renders but disconnected)
- `ExportWorkbench` (collection-based) — renders, generates blobs, never touches backend
- `ExportPage` — exists, no route registered
- Target registry — 3 implementations, never called by service
- `ExportWorkbenchSidebar` — exported from index, never mounted

### Real but Orphaned (functional, nothing renders it)
- `ExportWorkbenchContent` — fully wired to backend lifecycle
- `ExportPreview` — displays real projection data
- All 15 TanStack hooks — functional, never called by running app
- `ExportWorkbenchSidebar` — project selection with filter/toggle

### Real and Working
- Backend session lifecycle (create → project → execute)
- BFA projector (canonical phases, budgets, milestones)
- All formatters (RTF, Markdown, Plaintext, CSV)
- Google connectors (Docs, Sheets, Slides, Drive)
- BFA GDocs injector (in-place doc injection via `POST /sync/:id/inject`)
- Finance exports (invoice PDF/DOCX, budget CSV)
- Context helper backends (backfeeding, staleness, email decay)
- Interpreter rules (12 canonical phases, budget parsing, artwork/permit/stage rules)
