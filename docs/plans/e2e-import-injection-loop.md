# E2E Import → Injection Loop: Test Plan & Garden Path Architecture

## Done Sentence

An agent (human or MCP bot) can walk the import→injection trunk — CSV upload → session → plan → classify → execute → sync → inject to GDocs — in an automated E2E test, and every decision point along that path is named, observable, and branchable for future workflow composition.

---

## Philosophy: Garden Paths, Not Tunnels

This is the **first trodden path** for MCP/bot agent workflows. The design rules:

| Principle | Implication |
|-----------|-------------|
| **Golden path = trunk** | The import→inject loop is the most-walked route. It must be fast, well-named, and zero-friction to navigate. |
| **Branch at decision points** | Every user/agent choice (which parser? accept all? inject where?) is a named fork, not an implicit conditional buried in handler code. |
| **Depth ≠ complexity** | Layer 0 (trunk) uses short generic names. Layer 1 branches add context. Layer 2+ branches get fully explicit naming. |
| **Breadcrumb everything** | Each step emits an observable trace (status, result shape, timing) that an MCP server can consume to queue next steps. |
| **No siloed tunnels** | The CSV import path and the BFA sync path share the same trunk up to the "source acquired" waypoint, then branch. Don't build two separate test suites. |

### Decision Tree Shape

```
                          ┌─ trunk: authenticate
                          │
                     [WAYPOINT: session-ready]
                          │
               ┌──────────┼──────────┐
               │          │          │
          csv-upload   monday-sync   (future: api-push)
               │          │
          [WAYPOINT: source-acquired]
               │          │
               └──────┬───┘
                      │
                 parse / interpret
                      │
              [WAYPOINT: plan-ready]
                      │
               ┌──────┼──────┐
               │      │      │
           classify  auto-  skip
           manually  accept (trusted)
               │      │      │
               └──────┼──────┘
                      │
              [WAYPOINT: decisions-resolved]
                      │
                   execute / apply
                      │
              [WAYPOINT: applied]
                      │
               ┌──────┼──────┐
               │      │      │
          inject-    export   import-to-
          gdocs      package  hierarchy
               │      │      │
              [WAYPOINT: delivered]
```

Each `[WAYPOINT]` is a **named, assertable state** in the E2E test. An MCP agent can checkpoint here, branch, retry, or hand off to another agent.

---

## Current State: What Exists

### Backend Pipeline (BFA Sync Path)

| Step | Route | Service | Status |
|------|-------|---------|--------|
| 1. Trigger sync | `POST /sync` | `bfaSyncService.computeDiff()` | ✅ Built |
| 2. Get diff | `GET /sync/:id` | `bfaSyncService.getDiffReport()` | ✅ Built |
| 3. Submit decisions | `POST /sync/:id/decisions` | `bfaSyncService.submitDecisions()` | ✅ Built |
| 4. Apply decisions | `POST /sync/:id/apply` | `bfaSyncService.applyDecisions()` | ✅ Built |
| 5. Inject to GDocs | `POST /sync/:id/inject` | `bfaSyncService.injectToGoogleDoc()` | ✅ Built |
| 6. Import to hierarchy | `POST /sync/:id/import` | `bfaImportService.importToAutoArt()` | ✅ Built |

### Backend Pipeline (Generic CSV Import Path)

| Step | Route | Service | Status |
|------|-------|---------|--------|
| 1. Create session | `POST /imports/sessions` | `import-sessions.service` | ✅ Built |
| 2. Generate plan | `POST /imports/sessions/:id/plan` | `import-plan.service` | ✅ Built |
| 3. Classify items | `POST /imports/sessions/:id/classify` | `import-classification.service` | ✅ Built |
| 4. Execute import | `POST /imports/sessions/:id/execute` | `import-execution.service` | ✅ Built |

### Frontend

| Component | Purpose | Status |
|-----------|---------|--------|
| `BfaSyncView` | Sync → Decide → Apply → Inject → Import | ✅ Built |
| `ImportWorkbenchView` | CSV upload → preview → classify → execute | ✅ Built |
| `ImportPage` | Routing shell for import workflow | ✅ Built |

### Existing E2E Tests

| File | Coverage |
|------|----------|
| [login.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/login.spec.ts) | Login with demo creds, error on invalid |
| [layout.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/layout.spec.ts) | Main layout renders after login |

### Test Data

| File | Purpose |
|------|---------|
| `_test-data/Avisina_-_Broadview_Village_-_P1_1765493434.csv` | Real BFA project CSV (25KB) |
| `_test-data/1_CURRENT_PROJECTS_OVERVIEW_1770431208.xlsx` | Monday board export |

---

## Proposed Test Architecture

### File Structure

```
frontend/e2e/
├── fixtures/
│   ├── auth.ts                          # Shared login helper (trunk: authenticate)
│   ├── test-csv-small.csv               # Minimal 3-row CSV for fast tests
│   └── test-csv-bfa.csv                 # Subset of real BFA data (5 projects)
├── helpers/
│   ├── waypoints.ts                     # WAYPOINT assertion helpers
│   ├── api-shortcuts.ts                 # Direct API calls for setup/teardown
│   └── breadcrumbs.ts                   # MCP-style trace emitter (step log)
├── trunk/
│   ├── csv-import-golden-path.spec.ts   # Layer 0: full trunk, happy path
│   └── sync-inject-golden-path.spec.ts  # Layer 0: BFA sync trunk, happy path
├── branch/
│   ├── csv-import-classify.spec.ts      # Layer 1: classification edge cases
│   ├── csv-import-error-handling.spec.ts # Layer 1: malformed CSV, empty rows
│   ├── sync-decisions-merge.spec.ts     # Layer 1: merge-authority decision flow
│   └── inject-gdocs-matching.spec.ts    # Layer 1: project header matching
└── deep/
    ├── import-to-hierarchy.spec.ts      # Layer 2: hierarchy creation verification
    └── inject-formatting.spec.ts        # Layer 2: bold labels, section boundaries
```

> [!IMPORTANT]
> The `trunk/` tests must always pass. They are the CI gate. `branch/` tests run on PR. `deep/` tests run nightly or on-demand.

### Naming Convention (Decision Tree Layers)

| Layer | Pattern | Example |
|-------|---------|---------|
| 0 — Trunk | `{workflow}-golden-path` | `csv-import-golden-path.spec.ts` |
| 1 — Branch | `{workflow}-{decision-point}` | `csv-import-classify.spec.ts` |
| 2 — Deep | `{step}-{specific-behavior}` | `inject-formatting.spec.ts` |

---

## Proposed Changes

### Shared Auth Fixture

#### [NEW] [auth.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/fixtures/auth.ts)

Reusable login fixture extracted from the repeated pattern in `login.spec.ts` and `layout.spec.ts`:

```typescript
// Logs in with demo creds, navigates to target page
// Usage: test.use({ storageState: '.auth/user.json' });
// Or: await loginAndNavigate(page, '/import');
```

This becomes the **trunk: authenticate** waypoint — shared by every test.

---

### Waypoint Assertion Helpers

#### [NEW] [waypoints.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/helpers/waypoints.ts)

Named assertion functions for each decision-tree node:

```typescript
export async function assertSessionReady(page: Page): Promise<void>
export async function assertSourceAcquired(page: Page, opts: { itemCount: number }): Promise<void>
export async function assertPlanReady(page: Page): Promise<void>
export async function assertDecisionsResolved(page: Page): Promise<void>
export async function assertApplied(page: Page, opts: { applied: number }): Promise<void>
export async function assertDelivered(page: Page, target: 'gdocs' | 'hierarchy' | 'package'): Promise<void>
```

Each waypoint logs a breadcrumb with timestamp + step name for MCP consumption.

---

### Breadcrumb Trace System

#### [NEW] [breadcrumbs.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/helpers/breadcrumbs.ts)

Lightweight step logger that writes a JSON trace file per test run:

```typescript
export class TestBreadcrumbs {
  log(step: string, data?: Record<string, unknown>): void
  checkpoint(waypoint: string): void
  flush(outputPath: string): void
}
```

Output format (designed for future MCP server consumption):

```json
{
  "testId": "csv-import-golden-path",
  "steps": [
    { "t": 0, "step": "authenticate", "waypoint": "session-ready" },
    { "t": 1200, "step": "upload-csv", "data": { "rows": 3 } },
    { "t": 1800, "step": "parse", "waypoint": "source-acquired" },
    { "t": 2400, "step": "classify", "waypoint": "plan-ready" }
  ]
}
```

---

### API Shortcut Helpers

#### [NEW] [api-shortcuts.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/helpers/api-shortcuts.ts)

Direct API calls for fast test setup/teardown (skip UI for non-tested steps):

```typescript
export async function createImportSessionViaAPI(
    request: APIRequestContext, csvData: string
): Promise<{ sessionId: string }>

export async function triggerSyncViaAPI(
    request: APIRequestContext, boardConfigId: string
): Promise<BfaSyncDiffReport>

export async function cleanupSession(
    request: APIRequestContext, sessionId: string
): Promise<void>
```

---

### Test Data Fixtures

#### [NEW] [test-csv-small.csv](file:///c:/Users/nealm/dev/autoart/frontend/e2e/fixtures/test-csv-small.csv)

Minimal 3-row CSV for fast golden-path tests:

```csv
Name,Status,Phase,Due Date,Description
"Alpha Project",Active,Design,2026-03-15,"Initial design phase"
"Beta Project",On Hold,Review,2026-04-01,"Pending client approval"
"Gamma Project",Completed,Delivery,2026-02-28,"Final delivery complete"
```

#### [NEW] [test-csv-bfa.csv](file:///c:/Users/nealm/dev/autoart/frontend/e2e/fixtures/test-csv-bfa.csv)

Subset of real BFA data (5 projects), extracted from `_test-data/Avisina_-_Broadview_Village_-_P1_1765493434.csv`.

---

### Trunk Tests

#### [NEW] [csv-import-golden-path.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/trunk/csv-import-golden-path.spec.ts)

The **golden path** — the most-walked route through the system:

```
1. Login                          → WAYPOINT: session-ready
2. Navigate to Import page        → UI: "Upload a file..."
3. Upload test-csv-small.csv      → WAYPOINT: source-acquired (3 items)
4. Verify plan preview renders    → WAYPOINT: plan-ready
5. Check classification badges    → Items classified
6. Click Execute                  → WAYPOINT: decisions-resolved → applied
7. Verify success counts          → WAYPOINT: delivered
```

This test covers the generic CSV import path end-to-end through the UI.

#### [NEW] [sync-inject-golden-path.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/trunk/sync-inject-golden-path.spec.ts)

The **BFA sync trunk** — sync → decide → apply → inject:

```
1. Login                          → WAYPOINT: session-ready
2. Navigate to BFA Sync view      → UI: "Select a board..."
3. Select board config            → Board selected
4. Click "Sync Now"               → WAYPOINT: source-acquired
5. Verify diff report renders     → WAYPOINT: plan-ready
6. Set decisions (accept all)     → Decisions set
7. Click "Submit Decisions"       → Decisions saved
8. Click "Apply"                  → WAYPOINT: decisions-resolved → applied
9. Enter Google Doc ID            → Doc ID set
10. Click "Inject to Doc"        → WAYPOINT: delivered (gdocs)
11. Verify injection badges      → counts visible
```

> [!WARNING]
> The BFA sync golden path depends on a live Monday API connection and a Google Doc. For CI, this test needs either:
> - **Option A**: Mock server (MSW) intercepting `/sync` and `/inject` routes
> - **Option B**: Seed the DB directly and skip steps 4 + 10
> - **Option C**: Mark as `test.skip` in CI, run manually or in staging
>
> Recommend **Option B** for CI + Option C for full integration validation.

---

### Branch Tests (Layer 1)

#### [NEW] [csv-import-classify.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/branch/csv-import-classify.spec.ts)

Branch from `plan-ready` waypoint — exercises classification variations:

- Items auto-classified as FACT_EMITTED, DERIVED_STATE
- AMBIGUOUS items block execution until resolved
- Reclassification via drawer changes outcome
- "Needs Review" badge appears for unresolved items

#### [NEW] [csv-import-error-handling.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/branch/csv-import-error-handling.spec.ts)

Branch from `source-acquired` waypoint — error resilience:

- Empty CSV shows validation error
- CSV with no title column falls back to first column
- Rows with missing titles skipped with warning
- Upload of non-CSV file shows appropriate error

#### [NEW] [sync-decisions-merge.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/branch/sync-decisions-merge.spec.ts)

Branch from `plan-ready` waypoint — decision flow complexity:

- Mix of accept/reject/defer decisions
- Dirty count badge updates
- Reject prevents field from being applied
- Deferred items appear as warnings

#### [NEW] [inject-gdocs-matching.spec.ts](file:///c:/Users/nealm/dev/autoart/frontend/e2e/branch/inject-gdocs-matching.spec.ts)

Branch from `applied` waypoint — GDocs injection specifics:

- Project matched by client+project name
- Unmatched projects reported as skipped
- Document URL extracted from full Google Docs URL input

---

## MCP / Bot Agent Breadcrumbing

Each test step is designed to be **replayable as an MCP tool call**. The mapping:

| Test Step | Future MCP Tool | Input |
|-----------|----------------|-------|
| Login | `autoart.authenticate` | `{ email, password }` |
| Upload CSV | `autoart.import.uploadCSV` | `{ filePath }` |
| Trigger Sync | `autoart.sync.trigger` | `{ boardConfigId }` |
| Submit Decisions | `autoart.sync.submitDecisions` | `{ decisions[] }` |
| Apply | `autoart.sync.apply` | `{ boardConfigId }` |
| Inject | `autoart.sync.inject` | `{ boardConfigId, documentId }` |

The breadcrumb trace from E2E tests becomes the **template** for MCP workflow definitions. When we build the MCP server, each waypoint becomes a tool boundary, and each breadcrumb log becomes the expected response schema.

---

## Verification Plan

### Automated Tests

Run the Playwright E2E suite from the `frontend/` directory:

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run only trunk tests (golden path, CI gate)
npx playwright test --project=chromium e2e/trunk/

# Run trunk + branch tests (PR gate)
npx playwright test --project=chromium e2e/trunk/ e2e/branch/

# Run all tests including deep (nightly)
npx playwright test --project=chromium

# Run a specific test file
npx playwright test --project=chromium e2e/trunk/csv-import-golden-path.spec.ts

# Run in headed mode for debugging
npx playwright test --headed e2e/trunk/csv-import-golden-path.spec.ts

# View test report
npx playwright show-report
```

> [!NOTE]
> These commands assume both the frontend dev server (`npm run dev` on port 5173)
> and backend server are running locally. The Playwright config at
> [playwright.config.ts](file:///c:/Users/nealm/dev/autoart/frontend/playwright.config.ts)
> has `baseURL: 'http://localhost:5173'`.

### Manual Verification

1. **Breadcrumb output**: After running trunk tests, verify `test-results/breadcrumbs/` contains JSON trace files with correct waypoint progression
2. **Screenshot on failure**: Playwright's `trace: 'on-first-retry'` config captures full trace on failure — open with `npx playwright show-trace`
3. **CI gate logic**: Trunk tests must pass for merge. Branch tests warn but don't block.

---

## Implementation Order

| # | What | Why First |
|---|------|-----------|
| 1 | `fixtures/auth.ts` | Every other test depends on it |
| 2 | `helpers/breadcrumbs.ts` + `helpers/waypoints.ts` | Infrastructure for all tests |
| 3 | `fixtures/test-csv-small.csv` | Test data for trunk |
| 4 | `trunk/csv-import-golden-path.spec.ts` | The golden path, proves the trunk |
| 5 | `helpers/api-shortcuts.ts` | Setup helpers for BFA sync tests |
| 6 | `trunk/sync-inject-golden-path.spec.ts` | Second trunk, uses API shortcuts |
| 7 | Branch tests | Layer 1 complexity |
| 8 | Deep tests | Layer 2 specificity |

---

## What Does NOT Change

- Backend routes, services, or injector logic (tests consume, don't modify)
- Existing `login.spec.ts` and `layout.spec.ts` (remain as-is)
- `playwright.config.ts` (may add `testDir` patterns for trunk/branch/deep, but base config stable)
- Frontend components (tests exercise existing UI, don't require new `data-testid` attributes unless discovery during implementation reveals gaps)
