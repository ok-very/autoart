# Export Workbench P1: Interpreter Coverage (Realigned)

Realigned against 177 BFA-todo project YAML files, `config.py` phase definitions, and the current state of the AutoArt codebase. This replaces the P1 section of `exportworkbench-plan.md`. P2-P5 are unchanged.

---

## What's Already Done

These items from the original P1 are complete. They do not appear in the work plan below.

| Original Item | Status | Evidence |
|---------------|--------|----------|
| 1.2 Selection Panel Entity | DONE | Seeded in `001_record_definitions.ts` with `meeting_type` (SP#1/SP#2/AO/CA), `members`, `shortlisted_artists`, `alternates`, `selected_artist`, `artwork_title` |
| 1.4 Phase/Stage Entity | DONE | Seeded as `Phase` container with `phase_kind` (General/Milestone/Stage/Gate), `target_date`, `actual_date`, `milestone_type`, `status` |
| 1.6 Invoice Item Entity | DONE | `Invoice` and `Invoice Line Item` both seeded with full financial schema |
| 1.12 SELECTION_BALLOT_RECORDED Event | DROPPED | BFA data shows no individual ballot/vote records. Panels record a collective decision ("Selected Artist: X") not per-voter ballots. If voting ever needs tracking, it can be added as events on Selection Panel records. |

---

## What BFA-todo Data Tells Us (Dialogue Gates Resolved)

The original plan marked most items as "Requires user dialogue." The BFA-todo corpus (177 project YAMLs) answers most of these questions with real data. Below is the evidence that resolves each gate.

### Multi-Artwork Projects Are Normal

NSPH Phase 1 Exterior (`e106d8df`) has 10+ sub-opportunities, each with its own selected artist, artwork title, budget, fabricator, and phase status. Edgar Portwood (`e605a398`) has 4 opportunities. UBC Gateway (`5d4c9f38`) has 6 sites with 6 selected artists, 6 artwork titles, and fabricators. These are NOT edge cases -- they are the standard pattern for large projects.

**Decision resolved:** Multi-artwork = separate Artwork records per project. Not an array field. Each Artwork record is a child of the project hierarchy node and can have its own Selection Panel, Budget, and Phase records attached.

### Artwork-Budget Distinction Is Clear

BFA data consistently separates `art_budget` (per-artwork allocation) from `total_budget` (project total including consultant fees, admin, contingency). The header format `(Art: $265,000 | Total: $375,402.06)` appears across nearly all projects. Per-opportunity budgets also exist: `(Art: $1,630,500)`, `(Art: $120,000)`.

**Decision resolved:** Artwork records carry their own `artwork_budget` field. The existing Budget entity handles project-level and phase-level allocations. No new budget entity needed.

### Milestone Types Are Enumerated

From BFA contacts sections and config.py, the milestone sequence is:

1. **Checklist** -- initial checklist meeting (e.g., "Checklist: Jan 21 2022")
2. **PPAP** -- Pre-Public Art Plan (e.g., "PPAP: April 2022")
3. **DPAP** -- Design Public Art Plan (e.g., "DPAP: June 13 2022")
4. **SP#1** -- Selection Panel 1 (e.g., "SP#1: October 12, 2022")
5. **AO** -- Artist Orientation (e.g., "AO: Nov 23, 2023")
6. **CA** -- Community Advisory meeting (e.g., "CA Mtg: Jan 13, 2022")
7. **SP#2** -- Selection Panel 2 (e.g., "SP2: Feb 15, 2023")
8. **Fabrication milestones** -- 25%, 50%, 100% (e.g., "25% Fabrication - August 1 2026")
9. **Install** -- installation date (e.g., "Install: Spring 2026")

These always appear with dates (or TBC). They are discrete events, not containers.

### Permit Types Are Enumerated

From municipal guideline sections and project notes:

- **DP** -- Development Permit (e.g., "DP Issuance Date", "DPAP Due Prior to DP Issuance")
- **BP** -- Building Permit (e.g., "LOC due prior to BP Issuance")
- **RZ** -- Rezoning (e.g., "public art process begins with the Rezoning Process")
- **Occupancy** -- Building Occupancy (e.g., "Building occupancy December")

These appear as dates in Excel columns (`dp_issuance_date`) and as milestones in project notes.

### Selection Panel Membership Is Inline Text

Panel members are always recorded as comma-separated names: "Rob Elliot, Joseph Fry, Germaine Koh, Jeanette Lee, Michael Nicoll Yahgulanaas". No email addresses, no roles beyond presence. The existing Selection Panel entity correctly uses `textarea` for members.

**Decision resolved:** No change needed. The existing `members: textarea` field matches the data.

### Artwork-to-Selection-Panel Link

Each artwork/opportunity within a project has its own selection panel with its own members and SP#1/AO/SP#2 dates. The NSPH project shows this clearly: Opportunity 1 has one panel, Opportunity 2C has a different panel, Opportunity 4A has yet another. The link is through the project hierarchy: Artwork record and Selection Panel record both belong to the same project node (or sub-opportunity node).

**Decision resolved:** Link via hierarchy (both attached to the same project/sub-opportunity node), not via explicit foreign key references.

---

## Work Items (Ordered by P2 Unblocking Priority)

### W1. Wire Dead Rule Files into Interpreter (IMMEDIATE)

**Why first:** These four files are fully written and tested. Wiring them in takes 10 minutes and immediately gives the interpreter coverage for artwork lifecycle, budget allocation, permit milestones, and stage transitions. The BFA projector (P2) needs all of these to derive project status from events.

**File to modify:** `backend/src/modules/interpreter/mappings/index.ts`

**Changes:**

1. Add imports:
```typescript
import { artworkMappingRules } from './artwork-rules.js';
import { budgetMappingRules } from './budget-rules.js';
import { permitMappingRules } from './permit-rules.js';
import { stageMappingRules } from './stage-rules.js';
```

2. Add to `defaultMappingRules` array (maintaining priority order):
```typescript
export const defaultMappingRules: MappingRule[] = [
    ...intentMappingRules,        // Highest priority - action_hint rules
    ...artworkMappingRules,       // Artwork lifecycle (initiated/selected/designed/fabricated/installed)
    ...permitMappingRules,        // Permits + milestone achievements (PPAP/DPAP/SP/Install)
    ...stageMappingRules,         // Stage transitions (Planning/Selection/Design/Installation/Complete)
    ...decisionMappingRules,      // Milestones, approvals
    ...meetingMappingRules,       // Meeting scheduling/held
    ...processMappingRules,       // Process initiation/completion
    ...documentMappingRules,      // Document prep/submission
    ...communicationMappingRules, // Requests, submissions, follow-ups
    ...budgetMappingRules,        // Budget allocations (lower priority - context-dependent)
    ...invoiceMappingRules,       // Invoices, contracts
].sort((a, b) => (b.priority || 0) - (a.priority || 0));
```

3. Add named exports:
```typescript
export { artworkMappingRules } from './artwork-rules.js';
export { budgetMappingRules } from './budget-rules.js';
export { permitMappingRules } from './permit-rules.js';
export { stageMappingRules } from './stage-rules.js';
```

4. Update the JSDoc comment to include the new rule families.

**Verification:** Run existing interpreter tests. The new rules should not break existing interpretations (they target patterns the existing rules do not match). Then add a smoke test that verifies each new rule file has at least one rule that matches a real BFA text snippet.

**No user dialogue needed.**

---

### W2. Add Artwork Entity to Seeds

**Why second:** The BFA projector needs to query Artwork records to populate the artist/artwork/fabrication sections of the export model. Without this entity, the projector cannot distinguish artwork-level data from project-level data.

**File to modify:** `backend/src/db/seeds/001_record_definitions.ts`

**New definition** (add to the `definitions` array, in the BFA PROGRAM DEFINITIONS section after Selection Panel):

```typescript
{
  name: 'Artwork',
  schema_config: JSON.stringify({
    fields: [
      { key: 'artwork_title', type: 'text', label: 'Artwork Title' },
      { key: 'artist_name', type: 'text', label: 'Artist Name', required: true },
      { key: 'medium', type: 'text', label: 'Medium' },
      { key: 'dimensions', type: 'text', label: 'Dimensions' },
      { key: 'fabricator', type: 'text', label: 'Fabricator' },
      { key: 'artwork_budget', type: 'currency', label: 'Artwork Budget', currencyDefault: 'CAD' },
      { key: 'install_date', type: 'text', label: 'Install Date' },
      {
        key: 'status', type: 'status', label: 'Status',
        options: ['Shortlisted', 'Selected', 'Contracted', 'In Design', 'In Fabrication', 'Installed', 'Complete'],
        statusConfig: {
          Shortlisted: { label: 'Shortlisted', colorClass: 'bg-amber-100 text-amber-700' },
          Selected: { label: 'Selected', colorClass: 'bg-blue-100 text-blue-700' },
          Contracted: { label: 'Contracted', colorClass: 'bg-indigo-100 text-indigo-700' },
          'In Design': { label: 'In Design', colorClass: 'bg-purple-100 text-purple-700' },
          'In Fabrication': { label: 'In Fabrication', colorClass: 'bg-orange-100 text-orange-700' },
          Installed: { label: 'Installed', colorClass: 'bg-green-100 text-green-700' },
          Complete: { label: 'Complete', colorClass: 'bg-slate-100 text-slate-700' },
        },
      },
      { key: 'selection_process', type: 'text', label: 'Selection Process' },
      { key: 'notes', type: 'textarea', label: 'Notes' },
    ],
  }),
  styling: JSON.stringify({ color: 'violet', icon: '🎨' }),
},
```

**Field evidence from BFA-todo data:**

| Field | Source | Example |
|-------|--------|---------|
| `artwork_title` | `sections.artwork_title.text` | "Gather", "Fenhaven", "Eyes of the Fraser" |
| `artist_name` | `sections.artists.text` ("Selected Artist: X") | "Rebecca Bayer", "Kelly Cannell" |
| `medium` | Not explicitly tracked in BFA-todo (free text in notes) | Keep for AutoArt flexibility |
| `fabricator` | `sections.contacts` / `sections.artists` ("Fabricator: Area 58") | "Area 58", "Knight Signs" |
| `artwork_budget` | Per-opportunity budgets in `sections.bfa_phase` | "$1,630,500", "$120,000", "$115,000" |
| `install_date` | Per-opportunity install dates | "April 2026", "Spring 2025", "January 2026" |
| `status` | Derived from `bfa_phase_canonical` + events | "Selected", "In Fabrication", "Installed" |
| `selection_process` | `sections.contacts` / `sections.bfa_phase` | "EOI - Concept Proposal Presentation", "EOI - Interview" |

**Status options evidence:** The lifecycle visible in BFA data:
- **Shortlisted:** "Shortlisted Artists: Angie Quintanilla-Coates, Mustaali Raj, Annie Briard"
- **Selected:** "Selected Artist: Rebecca Bayer"
- **Contracted:** "Artist Contract signed"
- **In Design:** "Detailed Design" phase, "Preliminary concept submitted"
- **In Fabrication:** "25% Fabrication", "50% fabrication", "100% fabrication"
- **Installed:** "Artwork installed", "Installation complete"
- **Complete:** "Final Docs", "Closeout"

**No user dialogue needed.**

---

### W3. Add Milestone Entity to Seeds

**Why third:** The BFA projector needs standalone Milestone records to populate timeline blocks (PPAP date, DPAP date, SP#1 date, etc.). The existing Phase container has a `milestone_type` field, but milestones in BFA are discrete dated events, not containers that hold child records.

**User guidance:** "The records system doesn't exclude them having those things attached, which is why we chose PostgreSQL. These are the baseline needed."

**File to modify:** `backend/src/db/seeds/001_record_definitions.ts`

**New definition** (add to the `definitions` array):

```typescript
{
  name: 'Milestone',
  schema_config: JSON.stringify({
    fields: [
      { key: 'milestone_name', type: 'text', label: 'Milestone Name', required: true },
      {
        key: 'milestone_type', type: 'select', label: 'Type',
        options: [
          'Checklist', 'PPAP', 'DPAP', 'SP#1', 'AO', 'CA', 'SP#2',
          'EOI', 'TOR', 'Artist Contract',
          'Fabrication 25%', 'Fabrication 50%', 'Fabrication 100%',
          'Install', 'Final Documents', 'Photo', 'Other',
        ],
      },
      { key: 'scheduled_date', type: 'date', label: 'Scheduled Date' },
      { key: 'actual_date', type: 'date', label: 'Actual Date' },
      {
        key: 'status', type: 'status', label: 'Status',
        options: ['Scheduled', 'Completed', 'Overdue', 'TBC'],
        statusConfig: {
          Scheduled: { label: 'Scheduled', colorClass: 'bg-blue-100 text-blue-700' },
          Completed: { label: 'Completed', colorClass: 'bg-green-100 text-green-700' },
          Overdue: { label: 'Overdue', colorClass: 'bg-amber-100 text-amber-700' },
          TBC: { label: 'TBC', colorClass: 'bg-slate-100 text-slate-700' },
        },
      },
      { key: 'responsible_party', type: 'text', label: 'Responsible Party' },
      { key: 'notes', type: 'textarea', label: 'Notes' },
    ],
  }),
  styling: JSON.stringify({ color: 'sky', icon: '🎯' }),
},
```

**Milestone type evidence from BFA-todo data:**

| Type | Frequency | Example Text |
|------|-----------|--------------|
| Checklist | Common | "Checklist: Jan 21 2022", "Checklist: August 2nd, 2024" |
| PPAP | ~100+ projects | "PPAP: April 2022", "PPAP: October 2021" |
| DPAP | ~100+ projects | "DPAP: June 13 2022", "DPAP: April 2022" |
| SP#1 | ~80+ projects | "SP#1: October 12, 2022", "SP#1: May 2022" |
| AO | ~70+ projects | "AO: Nov 23, 2023", "AO: September 2023" |
| CA | ~20+ projects | "CA Mtg: Jan 13, 2022", "Community Advisory: January 24, 2023" |
| SP#2 | ~70+ projects | "SP2: Feb 15, 2023", "SP#2: September 2022" |
| EOI | Some | "EOI Deadline: August 16 2023" |
| TOR | Rare | Referenced in municipal guidelines |
| Artist Contract | ~30+ projects | "Artist Contract signed" |
| Fabrication 25%/50%/100% | ~20 projects | "25% Fabrication - August 1 2026", "50% Fabrication | November 2026" |
| Install | Most projects | "Install: Spring 2026", "Installation | January 2026" |
| Final Documents | ~10 projects | "Final Docs", "Final Art Report" |
| Photo | Rare | "Photo" phase in config.py |

**Relationship to Phase container:** Phase containers represent the 12-step canonical lifecycle ("1. Project Initiation" through "11. Photo"). Milestones are discrete events within those phases. A project in "4.1. Artist Selection SP#1" phase will have milestones for SP#1 date, AO date, etc. They complement each other; they do not replace each other.

**No user dialogue needed.**

---

### W4. Add Permit Entity to Seeds

**Why fourth:** Permit dates (DP issuance, BP issuance) are tracked as Excel columns and appear in project notes as milestone gates. The existing Document entity has `type: 'Permit'` as an option, but permits have lifecycle fields (application date, approval date, expiry, issuing authority) that don't fit the Document schema.

**File to modify:** `backend/src/db/seeds/001_record_definitions.ts`

**New definition** (add to the `definitions` array):

```typescript
{
  name: 'Permit',
  schema_config: JSON.stringify({
    fields: [
      {
        key: 'permit_type', type: 'select', label: 'Permit Type', required: true,
        options: ['Development Permit', 'Building Permit', 'Rezoning', 'Occupancy Permit', 'Electrical Permit', 'Other'],
      },
      { key: 'permit_number', type: 'text', label: 'Permit Number' },
      { key: 'application_date', type: 'date', label: 'Application Date' },
      { key: 'approval_date', type: 'date', label: 'Approval Date' },
      { key: 'expiry_date', type: 'date', label: 'Expiry Date' },
      { key: 'issuing_authority', type: 'text', label: 'Issuing Authority' },
      {
        key: 'status', type: 'status', label: 'Status',
        options: ['Pending', 'Submitted', 'Approved', 'Expired', 'Rejected'],
        statusConfig: {
          Pending: { label: 'Pending', colorClass: 'bg-slate-100 text-slate-700' },
          Submitted: { label: 'Submitted', colorClass: 'bg-blue-100 text-blue-700' },
          Approved: { label: 'Approved', colorClass: 'bg-green-100 text-green-700' },
          Expired: { label: 'Expired', colorClass: 'bg-amber-100 text-amber-700' },
          Rejected: { label: 'Rejected', colorClass: 'bg-red-100 text-red-700' },
        },
      },
      { key: 'notes', type: 'textarea', label: 'Notes' },
    ],
  }),
  styling: JSON.stringify({ color: 'rose', icon: '📋' }),
},
```

**Permit evidence from BFA-todo data:**

| Type | Source | Example |
|------|--------|---------|
| Development Permit | Excel column `dp_issuance_date`, municipal guidelines | "DP Issuance Date", "DPAP Due Prior to DP Issuance" |
| Building Permit | Municipal guidelines | "LOC (90% of public art budget) Due prior to BP Issuance" |
| Rezoning | Municipal guidelines | "The public art process begins with the Rezoning Process" |
| Occupancy | Project notes, Excel column `building_occupancy` | "Building occupancy December" |

**Relationship to Milestones:** Permit issuance is a milestone event. The `permit-rules.ts` file already emits both `PERMIT_ISSUED` and `MILESTONE_ACHIEVED` fact candidates when a permit is received. The Permit entity stores the permit document/lifecycle; the Milestone records the date it was achieved.

**No user dialogue needed.**

---

### W5. Augment Existing Interpreter Rules with BFA-Specific Patterns

**Why fifth:** The four dead rule files were written speculatively. Now that we have real BFA-todo data, we can verify which patterns actually appear and add missing ones. This is a review-and-patch pass, not a rewrite.

#### W5a. Artwork Rules (`artwork-rules.ts`) -- Review Against Real Data

The existing rules match:
- "artwork commissioned" / "commission started" -> ARTWORK_INITIATED
- "artist selected" / "selection panel selected" -> ARTWORK_SELECTED
- "design complete" / "detailed design complete" -> ARTWORK_DESIGNED
- "fabrication complete" / "ready for install" -> ARTWORK_FABRICATED
- "artwork installed" / "installation complete" -> ARTWORK_INSTALLED

**Missing patterns found in BFA data:**
- `"Selected Artist: [Name]"` -- the most common selection pattern (88 projects). Current rule matches "artist selected" but not "Selected Artist:" as a prefix. **Add rule.**
- `"Shortlisted Artists: [names]"` -- should emit ARTWORK_INITIATED or a SHORTLIST_RECORDED fact. **Add rule.**
- `"fabrication has started"` / `"confirmed fabrication has started"` -- not exactly "fabrication complete". Needs a FABRICATION_STARTED fact kind. **Add rule.**
- `"25% Fabrication"` / `"50% Fabrication"` / `"100% Fabrication"` -- milestone-style fabrication progress. The permit rules already handle some of this, but artwork rules should also recognize these. **Add rules** emitting ARTWORK_FABRICATED with a `progress` payload field.

#### W5b. Budget Rules (`budget-rules.ts`) -- Review Against Real Data

The existing rules handle `$amount` extraction and allocation type detection well. BFA header format uses:
- `(Art: $265,000 | Total: $375,402.06)` -- not matched by any current pattern
- `(Budget: $115,000)` -- would match "budget" keyword but not cleanly

**Missing patterns:**
- Header budget extraction: `Art:\s*\$[\d,]+` and `Total:\s*\$[\d,]+` patterns. **Add rules.**
- `"consultant fee"` / `"BFA fee"` -- allocation types present in BFA data but not in the type extraction. **Already handled** by `extractAllocationType` checking for "consultant". Add "bfa_fee" mapping.

#### W5c. Permit Rules (`permit-rules.ts`) -- Review Against Real Data

The existing rules are well-aligned. PPAP/DPAP/SP/AO milestones are already handled. The file already emits both PERMIT_ISSUED and MILESTONE_ACHIEVED.

**Missing patterns:**
- `"LOC"` (Letter of Credit) -- mentioned as "LOC due prior to BP Issuance". Not a permit per se, but a financial gate tied to permits. **Consider adding** as a low-priority action_hint.
- `"PAC presentation"` / `"PAC meeting"` -- Public Art Committee meetings are a municipal milestone. **Add rule** emitting MILESTONE_ACHIEVED with milestoneType "PAC".

#### W5d. Stage Rules (`stage-rules.ts`) -- Review Against Real Data

The stage aliases need alignment with BFA's 12-phase system. Current aliases map to 5 stages (Planning, Selection, Design, Installation, Complete). BFA uses 12 canonical phases from config.py.

**Required changes:**
- Seed the 12 BFA canonical phases as the internal phase model (1:1 with `config.py`):
  - "1. Project Initiation"
  - "2. PPAP"
  - "3. DPAP"
  - "4.1. Artist Selection SP#1"
  - "4.2. Artist Selection SP#2"
  - "5. Artist Contract"
  - "6. Detailed Design"
  - "7. Fabrication Start"
  - "8. 50% Fabrication"
  - "9. 100% Fabrication/Install"
  - "10. Final Documents"
  - "11. Photo"
- Stage rules emit the canonical phase name directly (no collapsing to 5 stages)
- Individual phases can be pared down, swapped to milestones, or promoted to explicit gates later by design — the 12-phase list is the baseline, not a ceiling
- Add "on hold" as a status that pauses phase progression
- Add BFA status phrases: "on schedule", "behind schedule", "ahead of schedule", "on track"

**Decision resolved:** The internal "stage" model has been replaced by the more flexible "phase" model. Seed all 12 BFA canonical phases. The projector emits them directly — no mapping layer needed.

---

### W6. Verify Event Type Coverage for BFA Projector

The BFA projector (P2, item 2.2) needs to query these event types to build the export model. Below is the mapping from projector needs to interpreter rule coverage.

| Projector Need | Event Type | Rule File | Status |
|----------------|-----------|-----------|--------|
| Artist/artwork section | ARTWORK_SELECTED, ARTWORK_INITIATED | `artwork-rules.ts` | Wiring needed (W1) |
| Phase/status section | STAGE_ENTERED | `stage-rules.ts` | Wiring needed (W1) |
| Milestone timeline | MILESTONE_ACHIEVED | `permit-rules.ts` | Wiring needed (W1) |
| Budget header | BUDGET_ALLOCATED | `budget-rules.ts` | Wiring needed (W1) |
| Permit dates | PERMIT_ISSUED | `permit-rules.ts` | Wiring needed (W1) |
| Fabrication progress | ARTWORK_FABRICATED | `artwork-rules.ts` | Wiring needed (W1), pattern additions (W5a) |
| Next steps | action_hint outputs | `intent-mapping-rules.ts` | Already wired |
| Communication events | FACT_RECORDED (INFORMATION_SENT etc.) | `communication-rules.ts` | Already wired |
| Meeting events | MEETING_SCHEDULED, MEETING_HELD | `meeting-rules.ts` | Already wired |
| Document events | DOCUMENT_PREPARED, DOCUMENT_SUBMITTED | `document-rules.ts` | Already wired |
| Invoice events | INVOICE_CREATED etc. | `invoice-rules.ts` | Already wired |
| Decision events | DECISION_RECORDED | `decision-rules.ts` | Already wired |

**All event types the projector needs are covered by existing rule files.** The only gap is wiring (W1) and pattern augmentation (W5).

---

## Execution Order

```
W1  Wire dead rule files into index.ts          ~30 min    Unblocks: everything
W2  Add Artwork entity to seeds                 ~30 min    Unblocks: P2 projector artist/artwork queries
W3  Add Milestone entity to seeds               ~30 min    Unblocks: P2 projector timeline block
W4  Add Permit entity to seeds                  ~20 min    Unblocks: P2 projector permit date queries
W5  Augment rules with BFA-specific patterns    ~2 hr      Improves: projector accuracy
W6  Verify event coverage (testing pass)        ~1 hr      Validates: P1 completeness
```

W1 through W4 can be done in a single stacked PR (they're all seed/config changes). W5 is a separate PR because it modifies rule logic and needs testing. W6 is a verification pass, not code.

After W4, the BFA projector (P2 item 2.2) can begin work. It will query Artwork, Milestone, and Permit records and interpret events from the newly-wired rule families.

---

## Remaining User Dialogue

None. All dialogue gates resolved by BFA-todo data and user decisions.

- Entities: Artwork, Milestone, Permit schemas grounded in BFA field evidence
- Events: All 6 types exist in rule files, just need wiring
- Phase system: Seed 12 BFA canonical phases internally (resolved Feb 2026)

---

## Files Modified (Summary)

| File | Work Item | Change |
|------|-----------|--------|
| `backend/src/modules/interpreter/mappings/index.ts` | W1 | Import + wire 4 rule files |
| `backend/src/db/seeds/001_record_definitions.ts` | W2, W3, W4 | Add Artwork, Milestone, Permit definitions |
| `backend/src/modules/interpreter/mappings/artwork-rules.ts` | W5a | Add "Selected Artist:" and fabrication progress patterns |
| `backend/src/modules/interpreter/mappings/budget-rules.ts` | W5b | Add BFA header budget pattern |
| `backend/src/modules/interpreter/mappings/permit-rules.ts` | W5c | Add PAC meeting milestone |
| `backend/src/modules/interpreter/mappings/stage-rules.ts` | W5d | Add BFA 12-phase aliases (pending user decision) |

---

## Removed from Original Plan

| Original Item | Reason Removed |
|---------------|----------------|
| 1.2 Selection Panel Entity | Already seeded |
| 1.4 Phase/Stage Entity | Already seeded as container |
| 1.6 Invoice Item Entity | Already seeded (Invoice + Invoice Line Item) |
| 1.7 ARTWORK_DECLARED Event | Merged into ARTWORK_INITIATED (existing in artwork-rules.ts) |
| 1.8 ARTWORK_SELECTED Event | Already exists in artwork-rules.ts (just needs wiring) |
| 1.9 PHASE_TRANSITIONED Event | Already exists as STAGE_ENTERED in stage-rules.ts (just needs wiring) |
| 1.10 PERMIT_ISSUED Event | Already exists in permit-rules.ts (just needs wiring) |
| 1.11 BUDGET_ALLOCATION_RECORDED Event | Already exists as BUDGET_ALLOCATED in budget-rules.ts (just needs wiring) |
| 1.12 SELECTION_BALLOT_RECORDED Event | No evidence in BFA data. Dropped. |
| 1.13-1.16 Interpreter Rule Files | Files already exist. Renamed to W1 (wiring) + W5 (augmentation) |
| 1.17 Completion Tracking Rules | Subsumed by stage-rules.ts "Complete" stage + artwork-rules.ts ARTWORK_INSTALLED |
