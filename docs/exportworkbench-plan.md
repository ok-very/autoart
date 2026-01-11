# Export Workbench Implementation Plan

## Executive Summary

Build a production-ready Export Workbench that generates BFA To-Do RTF documents from database state, with Google Docs connector, context-aware backfeeding, and reminder module. The system mirrors ImportWorkbench architecture with modular export targets supporting future extensions (invoice templates, budget tables, InDesign data merge).

**Key User Requirements:** just wasn't saved
- Cherry-pick project selection + backfeeding context helper (reads existing doc headers)
- Reminder module: staleness detection (configurable threshold, default 1 week), email decay alerts
- Export-only (no inline creation)
- Table projection that infers schema from target doc when Google connector is active
- Complete interpreter coverage before building export projections

---

## Implementation Phases

### Phase 1: Complete Interpreter Coverage (Dialogue-Driven)

**Status:** Create separate tasks for each entity/event - user will make decisions on complex schema choices

#### Missing Entities (6 Record Definitions)

**1.1 Artwork Entity** ⏸️ *Requires user dialogue*
- **Fields:** artist_name, artwork_title, medium, dimensions, budget, install_location, status (shortlisted|selected|installed), selection_date, install_date
- **Styling:** `{ color: 'violet', icon: '🎨' }`
- **Critical Decisions:**
  - Link to Selection Panel via references or parent hierarchy?
  - Multi-artwork projects: separate records or array field?
  - Artwork budget vs project budget distinction

**1.2 Selection Panel Entity** ⏸️ *Requires user dialogue*
- **Fields:** panel_name (SP#1, SP#2, etc.), members, meeting_date, meeting_type (SP1|AO|SP2|CA), status, shortlisted_artists, selected_artist, alternates, notes
- **Styling:** `{ color: 'purple', icon: '👥' }`
- **Critical Decisions:**
  - Voting model: separate event type for ballots or field in panel record?
  - Panel membership: inline text or references to Contact records?
  - How to handle alternate artist replacement scenarios?

**1.3 Milestone Entity** ⏸️ *Requires user dialogue*
- **Fields:** milestone_type (PPAP|DPAP|Checklist|EOI|TOR|DD|DP|BP|RZ), scheduled_date, actual_date, status, notes, responsible_party
- **Styling:** `{ color: 'sky', icon: '🎯' }`
- **Critical Decisions:**
  - Milestone vs Phase distinction (milestone = event, phase = container?)
  - Automatic status derivation from actual_date vs scheduled_date?
  - Link to approvals/permits?

**1.4 Phase/Stage Entity** ⏸️ *Requires user dialogue*
- **Fields:** phase_name, artwork_budget, total_budget, install_date, install_status, status (planning|active|complete)
- **Styling:** `{ color: 'teal', icon: '📊' }`
- **Critical Decisions:**
  - Use existing subprocess hierarchy or create separate Phase definition?
  - How to aggregate multi-phase budgets in header projection?

**1.5 Permit/Approval Entity** ⏸️ *Requires user dialogue*
- **Fields:** permit_type (Development Permit|Building Permit|Rezoning|Other), application_date, approval_date, status, issuing_authority, permit_number, expiry_date, notes
- **Styling:** `{ color: 'rose', icon: '📋' }`
- **Critical Decisions:**
  - Link to Milestones (DP/BP/RZ)?
  - Track permit conditions/requirements as sub-items?

**1.6 Invoice Item Entity** ⏸️ *Requires user dialogue*
- **Fields:** invoice_number, description, amount, issue_date, due_date, paid_date, status (draft|sent|paid|overdue|cancelled), recipient, notes
- **Styling:** `{ color: 'green', icon: '💰' }`
- **Critical Decisions:**
  - Integration with budget tracking?
  - Phase-specific invoices vs project-level?

#### Missing Events (6 Event Types)

**1.7 ARTWORK_DECLARED Event** ⏸️ *Requires user dialogue*
- **Payload:** artwork_id, artist_name, artwork_title, declared_by, declaration_date
- **Trigger:** When artwork is first identified/shortlisted

**1.8 ARTWORK_SELECTED Event** ⏸️ *Requires user dialogue*
- **Payload:** artwork_id, selection_panel_id, selected_date, vote_outcome (optional)
- **Trigger:** When selection panel chooses final artist/artwork

**1.9 PHASE_TRANSITIONED Event** ⏸️ *Requires user dialogue*
- **Payload:** from_phase, to_phase, transition_date, trigger
- **Trigger:** When project moves between major phases (planning → selection → design → installation)

**1.10 PERMIT_ISSUED Event** ⏸️ *Requires user dialogue*
- **Payload:** permit_type, permit_number, issue_date, issuing_authority
- **Trigger:** When permit/approval is granted

**1.11 BUDGET_ALLOCATION_RECORDED Event** ⏸️ *Requires user dialogue*
- **Payload:** allocation_type (artwork|total|phase1|phase2|...), amount, currency (default CAD), recorded_date
- **Trigger:** When budget figures are confirmed

**1.12 SELECTION_BALLOT_RECORDED Event** ⏸️ *Requires user dialogue*
- **Payload:** selection_panel_id, voter_id, artist_voted_for, vote_date
- **Trigger:** When panel member votes

#### Interpreter Rules (5 New Rule Files)

**1.13 Artwork Selection Rules** ⏸️
- **File:** `backend/src/modules/interpreter/mappings/artwork-rules.ts`
- **Patterns:** "artist selected", "artwork commissioned", "shortlisted for"

**1.14 Phase Advancement Rules** ⏸️
- **File:** `backend/src/modules/interpreter/mappings/phase-rules.ts`
- **Patterns:** "move to", "advance to phase", "enter [phase] stage"

**1.15 Permit/Approval Rules** ⏸️
- **File:** `backend/src/modules/interpreter/mappings/permit-rules.ts`
- **Patterns:** "permit received", "approved", "issued"

**1.16 Budget Allocation Rules** ⏸️
- **File:** `backend/src/modules/interpreter/mappings/budget-rules.ts`
- **Patterns:** "allocated", "budget confirmed", "line item"

**1.17 Completion Tracking Rules** ⏸️
- **File:** Update `backend/src/modules/interpreter/interpreter.service.ts`
- **Logic:** Install date in past + ARTWORK_SELECTED → derive "Completed" phenotype

---

### Phase 2: Backend Export Module

**Goal:** Build export infrastructure mirroring imports module patterns

#### 2.1 Core Module Structure

**Files to Create:**
1. **`backend/src/modules/exports/exports.service.ts`**
   - Export session lifecycle: create → generate projection → format → execute
   - Pattern: Mirror [imports.service.ts](backend/src/modules/imports/imports.service.ts)

2. **`backend/src/modules/exports/exports.routes.ts`**
   - API endpoints:
     - `POST /exports/sessions` - Create export session
     - `POST /exports/sessions/:id/projection` - Generate BfaProjectExportModel
     - `GET /exports/sessions/:id/projection` - Get cached projection
     - `POST /exports/sessions/:id/execute` - Execute export

3. **`backend/src/modules/exports/types.ts`**
   - ExportSession, ExportFormat enum, ExportOptions interface
   - Mirror frontend types from [frontend/src/surfaces/export/types.ts](frontend/src/surfaces/export/types.ts)

4. **`backend/src/modules/exports/index.ts`**
   - Module exports, register routes

#### 2.2 BFA Projection Builder (Critical Core Logic)

**File:** `backend/src/modules/exports/projectors/bfa-project.projector.ts`

**Function:** `projectBfaExportModel(projectId: string): BfaProjectExportModel`

**Algorithm:**
1. Query project hierarchy node → header.projectName, header.location
2. Query Contact records (classification_node_id = projectId):
   - Filter by contactGroup = "Developer/Client" → header.clientName
   - Group by role → contactsBlock.lines
3. Query BUDGET_ALLOCATION_RECORDED events → header.budgets
4. Query Milestone records → timelineBlock.milestones (PPAP, DPAP, SP1, AO, SP2)
5. Query Selection Panel records → selectionPanelBlock
6. Query actions + events → call interpreter.deriveStatus() → statusBlock.stage
7. Query Task/Subtask (status = pending/active) → nextStepsBullets[]
8. Generate rawBlockText (serialize all blocks)
9. Detect changes vs original import (set hasChanges flag)

**Returns:** BfaProjectExportModel matching [types.ts schema](frontend/src/surfaces/export/types.ts:40-100)

#### 2.3 Format Serializers

**Files to Create:**
1. **`backend/src/modules/exports/formatters/rtf-formatter.ts`**
   - Serialize BfaProjectExportModel → RTF string
   - Apply BFA formatting: fonts, bullets, highlighting (yellow for current month)
   - Support header formatting with initials, budgets, install dates

2. **`backend/src/modules/exports/formatters/markdown-formatter.ts`**
   - Serialize to clean Markdown for documentation

3. **`backend/src/modules/exports/formatters/csv-formatter.ts`**
   - Flatten nested structure to CSV rows

4. **`backend/src/modules/exports/formatters/index.ts`**
   - Format registry with factory: `getFormatter(format: ExportFormat)`

#### 2.4 Google Docs Connector

**File:** `backend/src/modules/exports/connectors/google-docs-connector.ts`

**Features:**
- OAuth flow (Google Drive + Docs scopes) - reuse imports connector pattern
- Read existing doc content for backfeeding
- Parse project headers with regex: `\([\w/]+\)\s+([^:]+):\s+([^,]+),\s+([^\(]+)`
- Write/update project blocks via Google Docs API
- Apply formatting (bold headers, bullet lists)

**Pattern:** Mirror [monday-connector.ts](backend/src/modules/imports/connectors/monday-connector.ts)

#### 2.5 Database Schema

**Migration:** `backend/src/db/migrations/0XX_create_export_sessions.ts`

```sql
CREATE TABLE export_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format VARCHAR(50) NOT NULL,
  target_config JSONB,
  project_ids JSONB NOT NULL,
  options JSONB,
  status VARCHAR(50) DEFAULT 'configuring',
  projection_cache JSONB,
  error TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);
```

---

### Phase 3: Context Helper & Reminder Module

**Goal:** Backfeeding, staleness detection, email decay alerts

#### 3.1 Backfeeding Service

**File:** `backend/src/modules/exports/backfeeding.service.ts`

**Function:** `analyzeExistingDoc(docId: string, userId: string)`

**Algorithm:**
1. Fetch Google Doc content via API
2. Parse text for project headers (regex extraction)
3. Extract: client name, project name, location for each match
4. Query database for fuzzy matches (score 0-100)
5. Return: `{ docProjectIndex, matchedProjectId, matchScore, lastUpdatedInDoc }`

**Frontend Display:**
- Green "In Doc" badge for matched projects
- Last update date from doc
- Unmatched projects as new candidates

#### 3.2 Staleness Detection Service

**File:** `backend/src/modules/exports/staleness.service.ts`

**Function:** `detectStaleProjects(projectIds: string[], thresholdDays: number = 7)`

**Algorithm:**
1. Query most recent event/action update per project
2. Calculate: `daysSince = (now - lastEventDate) / (1000*60*60*24)`
3. If daysSince > thresholdDays → mark as stale
4. Exclude projects with status = "ON HOLD" (false positives)
5. Return: `{ projectId, lastUpdateDate, daysSinceUpdate, isStale }`

**Settings Integration:**
- Add `staleness_threshold_days` to user preferences
- UI: Settings page slider (1-30 days, default 7)

#### 3.3 Email Decay Detection Service

**File:** `backend/src/modules/exports/email-decay.service.ts`

**Function:** `detectEmailDecay(projectId: string)`

**Algorithm:**
1. Query FACT_RECORDED events with factKind = 'INFORMATION_SENT' (email tracking)
2. Find latest outbound email to project contacts
3. Check for reply event within 7 days
4. If no reply: `decayScore = daysSinceEmail / 7`
5. If decayScore > 1.0 → suggest followup
6. Return: `{ lastEmailDate, hasReply, daysSinceEmail, suggestFollowup, suggestedAction }`

**Suggested Actions:**
- "Follow up with [Contact] on [topic]"
- "Check in on pending [milestone]"

#### 3.4 Reminder Module UI

**File:** `frontend/src/surfaces/export/ReminderPanel.tsx`

**Display:**
- Collapsible panel (bottom or right sidebar)
- Sections:
  1. **Stale Projects** (red badge): Not updated in X days
  2. **Email Decay** (amber badge): No reply in 7+ days
  3. **Missing Data** (blue badge): Incomplete budget/contacts

**Actions:**
- Click project → open in ComposerPage for quick update
- "Snooze" button → hide for 3 days
- "Resolve" button → mark action item as complete

---

### Phase 4: Frontend Integration

**Goal:** Connect existing ExportWorkbench UI to backend, add routing, wire up projection data

#### 4.1 API Hooks

**File:** `frontend/src/api/hooks/exports.ts` (create new)

**Hooks to Create** (mirror [imports.ts](frontend/src/api/hooks/imports.ts)):
1. `useCreateExportSession()` - POST /exports/sessions
2. `useGenerateExportProjection()` - POST /exports/sessions/:id/projection
3. `useExportProjection(sessionId)` - GET /exports/sessions/:id/projection (for preview)
4. `useExecuteExport()` - POST /exports/sessions/:id/execute
5. `useAnalyzeExistingDoc(docId)` - Backfeeding hook
6. `useStaleProjects(projectIds)` - Staleness detection hook

#### 4.2 Route Integration

**Changes:**
1. **File:** [frontend/src/App.tsx](frontend/src/App.tsx)
   - Add route: `<Route path="/export" element={<ExportPage />} />`

2. **Create:** `frontend/src/pages/ExportPage.tsx`
   - Wrapper component (mirror WorkbenchPage pattern)
   - Render ExportWorkbench with onExportComplete/onClose callbacks

3. **File:** [frontend/src/ui/layout/Header.tsx](frontend/src/ui/layout/Header.tsx)
   - Add navigation menu item: "Export" with Download icon
   - Link to `/export`

#### 4.3 Connect ExportWorkbench to Backend

**File:** [frontend/src/surfaces/export/ExportWorkbench.tsx](frontend/src/surfaces/export/ExportWorkbench.tsx)

**Changes:**
- Replace placeholder TODO comments (lines 90-101) with actual API calls:
  1. Call `useCreateExportSession()` mutation
  2. Call `useGenerateExportProjection()` mutation
  3. Call `useExecuteExport()` mutation
  4. Trigger download or open Google Docs link

**File:** [frontend/src/surfaces/export/ExportPreview.tsx](frontend/src/surfaces/export/ExportPreview.tsx)

**Changes:**
- Replace placeholder data (line 22) with `useExportProjection` hook
- Fetch actual BfaProjectExportModel from backend

#### 4.4 Table Schema Inference (Google Doc Connector Active)

**File:** `frontend/src/surfaces/export/SchemaInferencePanel.tsx` (create new)

**Algorithm:**
1. Parse target Google Doc headers (via backfeeding)
2. Detect field patterns: budget format, milestone types, contact roles
3. Suggest missing record definitions:
   - "Doc has 'Selection Panel' section, but no Selection Panel definition exists"
   - "Doc tracks PPAP/DPAP dates, create Milestone definition?"
4. Generate CREATE_DEFINITION actions with inferred schema
5. User reviews and approves

**Integration:**
- Add to ExportWorkbench left panel when `format === 'google-doc'`
- Show after backfeeding analysis completes

---

### Phase 5: Modular Export Target System

**Goal:** Abstract export targets for future extensions (invoice templates, budget tables, InDesign)

#### 5.1 Export Target Interface

**File:** `backend/src/modules/exports/targets/export-target.interface.ts`

```typescript
export interface ExportTarget {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredScopes?: string[];

  validate(config: Record<string, unknown>): Promise<ValidationResult>;
  project(projectIds: string[], options: Record<string, unknown>): Promise<unknown>;
  execute(projection: unknown, config: Record<string, unknown>): Promise<ExportResult>;
}
```

#### 5.2 Concrete Implementations

**Files to Create:**
1. **`backend/src/modules/exports/targets/bfa-rtf-target.ts`**
   - "Jan's TODO" module (first use case)
   - Calls bfa-project.projector, rtf-formatter
   - Returns download URL

2. **`backend/src/modules/exports/targets/google-docs-target.ts`**
   - OAuth validation, doc writing via connector
   - Returns Google Docs URL

3. **Future stubs:**
   - `invoice-template-target.ts`
   - `budget-table-target.ts`
   - `indesign-data-merge-target.ts`

#### 5.3 Target Registry

**File:** `backend/src/modules/exports/targets/index.ts`

```typescript
export function getExportTarget(targetId: string): ExportTarget;
export function listExportTargets(): ExportTarget[];
```

---

## Data Flow

### Export Session Lifecycle

```
User selects projects in ExportWorkbench
    ↓
POST /exports/sessions → create export_sessions record
    ↓
POST /exports/sessions/:id/projection
    → For each projectId: query data, call interpreter, build BfaProjectExportModel
    → Cache in export_sessions.projection_cache
    ↓
GET /exports/sessions/:id/projection → return to ExportPreview
    ↓
POST /exports/sessions/:id/execute
    → Get target from registry: getExportTarget(session.format)
    → Call target.execute(projection, config)
    → For RTF: return download URL
    → For Google Docs: return doc URL
    ↓
User downloads file or opens Google Doc
```

---

## Critical Files to Create/Modify

### Backend (Create)
- `backend/src/modules/exports/exports.service.ts`
- `backend/src/modules/exports/exports.routes.ts`
- `backend/src/modules/exports/types.ts`
- `backend/src/modules/exports/projectors/bfa-project.projector.ts` ⭐ Core logic
- `backend/src/modules/exports/formatters/rtf-formatter.ts`
- `backend/src/modules/exports/connectors/google-docs-connector.ts`
- `backend/src/modules/exports/backfeeding.service.ts`
- `backend/src/modules/exports/staleness.service.ts`
- `backend/src/modules/exports/email-decay.service.ts`
- `backend/src/modules/exports/targets/export-target.interface.ts`
- `backend/src/modules/exports/targets/bfa-rtf-target.ts`
- `backend/src/modules/exports/targets/google-docs-target.ts`
- `backend/src/db/migrations/0XX_create_export_sessions.ts`

### Frontend (Create)
- `frontend/src/api/hooks/exports.ts` ⭐ API integration
- `frontend/src/pages/ExportPage.tsx`
- `frontend/src/surfaces/export/ReminderPanel.tsx`
- `frontend/src/surfaces/export/SchemaInferencePanel.tsx`

### Frontend (Modify)
- `frontend/src/surfaces/export/ExportWorkbench.tsx` - Wire up backend calls
- `frontend/src/surfaces/export/ExportPreview.tsx` - Use real projection data
- `frontend/src/App.tsx` - Add /export route
- `frontend/src/ui/layout/Header.tsx` - Add navigation menu item

### Backend Seeds (Modify after Phase 1)
- `backend/src/db/seeds/001_record_definitions.ts` - Add new entities (Artwork, Selection Panel, Milestone, Phase, Permit, Invoice Item)

### Interpreter (Create after Phase 1)
- `backend/src/modules/interpreter/mappings/artwork-rules.ts`
- `backend/src/modules/interpreter/mappings/phase-rules.ts`
- `backend/src/modules/interpreter/mappings/permit-rules.ts`
- `backend/src/modules/interpreter/mappings/budget-rules.ts`

---

## Implementation Order

1. **Phase 1** (Interpreter Coverage) - Iterative with user dialogue for each entity/event ⏸️
2. **Phase 2.1-2.3** (Backend core + BFA projector) - Foundational
3. **Phase 4.1-4.3** (Frontend hooks + routing) - Integration
4. **Phase 2.4** (Google Docs connector) - Optional advanced
5. **Phase 3** (Context helper + reminders) - Enhancement
6. **Phase 5** (Modular targets) - Future extensibility

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| BFA document variance (8 phenotypes, incomplete data) | Gracefully handle null fields, show "TBC" placeholders |
| Multi-phase budget aggregation complexity | Store phase budgets as array, calculate total in projection |
| Google Docs API rate limits (60 projects batch) | Batch processing with delays, progress bar |
| Artwork selection voting edge cases (ties, replacements) | Store vote events, allow manual override in UI |
| Staleness false positives (ON HOLD projects) | Exclude projects with status = "ON HOLD" from staleness check |
| Email decay without email integration | MVP: manual event logging; Future: Gmail API integration |
| RTF formatting fidelity | Start with plain text, incrementally improve formatting |
| Schema inference accuracy (backfeeding mismatches) | Show match score, allow user to review/correct matches |

---

## Testing Strategy

### Unit Tests
- `bfa-project.projector.test.ts` - Projection logic with mock data
- `rtf-formatter.test.ts` - Verify RTF output format
- `staleness.service.test.ts` - Staleness calculation edge cases
- `google-docs-connector.test.ts` - Mock Google API, test parsing/writing

### Integration Tests
- Export session flow: create → project → execute → verify download
- Google Docs backfeeding: mock doc → analyze → verify matches
- Staleness detection: old events → detect stale → verify threshold

### E2E Tests (Playwright)
- Complete export flow: login → /export → select → export → verify file
- Preview accuracy: verify budget, contacts, milestones display
- Reminder module: view stale → click reminder → navigate to Composer

---

## Next Steps

1. **User Dialogue for Phase 1**: Create 12 separate tasks (6 entities + 6 events) to finalize interpreter coverage
2. **Build Backend Core**: Implement exports module structure, BFA projector, RTF formatter
3. **Frontend Integration**: Create API hooks, wire up ExportWorkbench, add routing
4. **Context Helpers**: Implement backfeeding, staleness, email decay services
5. **Modular Targets**: Abstract export target interface, add future extension points
