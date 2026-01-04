# Unified Composer Surface Plan (Schema-first, Recipe-driven)

**Status:** Proposed (ready to implement)  
**Last Updated:** 2026-01-04  
**Branch:** `experiment/foundational-model-refactor` [mcp_github:2]

## Goals

- Merge `ComposerPage.tsx` and `ActionComposer.tsx` into a single UI surface (one source of truth for action declaration). [file:3][mcp_github:5]
- Enforce “schema-first” without letting record definitions become action types (avoid action type suggestions like “Location”). [file:3]
- Treat Action Types as **Action Recipes** stored as definitions, globally available, filtered by context (subprocess). [file:3]
- Make “Referenced Records” first-class and projection-backed (inputs), using the newly introduced action-references infrastructure. [mcp_github:2]
- Keep Composer semantics clean: the composer declares intent and emits immutable facts; derived status/progress happens downstream. [file:3]

## Non-goals

- Do not introduce new fonts or load external font CDNs as part of this refactor. [mcp_github:4][mcp_github:6]
- Do not turn the composer UI into a workflow engine (templates/rules are interpreted downstream). [file:3]
- Do not preserve “quickTask/quickBug” special-case logic in the UI layer; if it remains, it must be behind a unified API/hook. [file:1][file:3]

---

## Core Architecture

### 1) Action = intent; Event = fact; References = inputs

- **Action** is the declared intent (immutable). [file:1]
- **Events** capture immutable facts (field values set, work started/blocked, assigned, etc.). [file:3]
- **Action References** represent semantic inputs: “this action operates against these records,” with named slots. [file:2]

### 2) Action Recipes are stored as Definitions (schema-first)

**Decision:** Action recipes live in the existing definitions system (records/definitions). [file:3]

To prevent “record definitions == action types,” introduce a discriminator:
- `definition.kind = 'record' | 'action_recipe'` (or equivalent). [file:3]

Composer UI rule:
- The Action Type picker MUST list only definitions where `kind === 'action_recipe'`. [file:3]

Recipe definition responsibilities:
- Defines the action classifier (`action.type`) and the **inputs** (fields/slots) that matter for this action. [file:3]
- Provides applicability metadata for filtering by context/subprocess. [file:3]

Minimum recipe definition shape (conceptual; map into your actual columns like `schemaConfig`, `styling`, `metadata`):
- `id` / `name` (used as `action.type`) [file:3]
- `description` (human meaning) [file:3]
- `schemaConfig.fields[]` (input field configs: key, type, label, required) [file:3]
- `referenceSlots[]` (named slots like `developer`, `site`, `client`; used as `targetFieldKey`) [file:2]
- `applicability` (context filter rules/tags) [file:3]
- Optional: `outputs.templates[]` (email template definitions, etc.) [file:3]

---

## UI Refactor Plan (Merge)

### A) Create one component: `ComposerSurface`

Create:
- `frontend/src/components/composer/ComposerSurface.tsx` (new canonical UI). [mcp_github:5]

`ComposerPage.tsx` becomes a route wrapper that renders `ComposerSurface` in “page mode” (no duplication of logic). [file:3]

`ActionComposer.tsx` becomes either:
- removed, or
- a thin wrapper that renders `ComposerSurface` in “drawer mode” (header X/Cancel/Save styling). [file:2]

### B) ComposerSurface sections (retain demo layout, enforce semantics)

**Section 1 — Project Context**
- Select Project → Subprocess context (`selectedSubprocessId`, `contextType=subprocess`). [file:3]

**Section 2 — Action Definition**
- Select Action Recipe (definition kind = `action_recipe`) filtered by selected context. [file:3]
- Title + Description are standard inputs (emit field value events). [file:3]

**Section 3 — Referenced Records**
- Link records into named slots (`targetFieldKey`) defined by the recipe’s `referenceSlots`. [file:2]
- References are “inputs” (semantic bindings), persisted via action references routes + projection. [mcp_github:2]

**Section 4 — Action Inputs (schema-driven)**
- Render input fields from the selected recipe definition’s `schemaConfig.fields`. [file:3]
- Clarify semantics:
  - Declaring fields = `fieldBindings` (what inputs exist for this action instance). [file:2]
  - Setting values = field value events (immutable facts). [file:3]

**Advanced (optional) — Events Preview**
- Keep `ComposerPage.tsx` “Events to Emit” preview as an Advanced panel, so default UI stays demo-clean but still debuggable. [file:3]

---

## Submission Pipeline (Enforce One Way)

### Canonical 3-step write model (UI-level)

ComposerSurface submit must do:

1) **Create Action (intent)**
- Create action with `contextId`, `contextType`, `type=recipeId`, and `fieldBindings` (declared input keys). [file:2]

2) **Emit Events (facts)**
- Emit field value events for any filled inputs, plus workflow events (e.g., started/blocked), plus assignment. [file:2][file:3]

3) **Set References (inputs)**
- Bulk replace references in one call (no per-reference loop). [file:2]
- References must use named slots from the recipe definition. [file:2]

### Backend enforcement (hard rules)

On the backend (single entry point recommended via Composer module):
- Validate `action.type` exists as an `action_recipe` definition. [file:1][file:3]
- Validate field keys in `fieldBindings`/events are allowed by recipe schema. [file:3]
- Validate reference `targetFieldKey` is allowed by recipe `referenceSlots`. [file:2]
- Standardize on one event name for field value writes (currently UI uses both `FIELDVALUESET` and `FIELDVALUERECORDED`; must converge). [file:3][file:2]

---

## Endpoint & Projection Linking (Target Contract)

### Existing “single entry point” intent
Composer is intended to be the single entry point for creating work-like entities and generating Action/Event correctly. [file:1]

Known endpoints from the inventory doc:
- `POST /composer` [file:1]
- `POST /composer/quick/task` [file:1]
- `POST /composer/quick/bug` [file:1]
- Actions: `POST /actions`, `GET /actions/:id` [file:1]

### New primitives introduced in latest work
Recent changes add action references infrastructure + projections and workflow-surface projections. [mcp_github:2]

Target linking requirements:
- **References write**: one endpoint that supports bulk replace (UI submits all references at once). [mcp_github:2]
- **References read**: projection-backed read so UI loads the current snapshot cleanly. [mcp_github:2]
- **Context surface read**: projection-backed “workflow surface” (or equivalent) to drive filtering by subprocess/context. [mcp_github:2]

> TODO (implementation): confirm exact route paths in `backend/src/modules/actions/action-references.routes.ts` and `backend/src/modules/projections/*.routes.ts` and standardize them in `frontend/src/api/hooks/*`. [mcp_github:2]

---

## CSS Integration Plan (No new fonts)

### Current state
- Global CSS is already imported once in `frontend/src/main.tsx` (`import './index.css'`). [mcp_github:3]
- `frontend/src/index.css` currently sets `font-family: 'Inter'` and defines `.mono` for JetBrains Mono, plus `.custom-scroll` and `.fade-in`. [mcp_github:4]
- `ActionComposer.module.css` duplicates demo styles and also sets fonts/background in `.composerContainer` and `.mono`. [mcp_github:6]

### CSS decision: keep parity styles global, avoid font rules
**Goal:** Use demo classnames (`custom-scroll`, `input-group`, `record-card`, `fade-in`) without importing CSS modules everywhere, and without enforcing fonts. [mcp_github:4][mcp_github:6]

Steps:
1) Create `frontend/src/styles/composer.css` (global).  
2) Move the following from the CSS module into `composer.css` using demo-compatible classnames:
   - `.input-group:focus-within ...` [mcp_github:6]
   - `.record-card ...` hover styles [mcp_github:6]
   - `.slotSelector` behavior can stay component-scoped or be converted to `.record-card:hover .slot-selector`. [mcp_github:6]
3) Keep scrollbar and fade-in definitions in ONE place:
   - If they already exist in `index.css` (`.custom-scroll`, `.fade-in`), do not duplicate. [mcp_github:4]
4) Remove font rules:
   - Delete or neutralize `font-family` declarations in both `index.css` and composer styles (or replace with system font stack). [mcp_github:4][mcp_github:6]
5) Import composer CSS once:
   - In `frontend/src/main.tsx`, add `import './styles/composer.css'` after `import './index.css'`. [mcp_github:3]

Notes:
- This approach avoids adding font files or font CDNs, and it avoids CSS-module class mapping friction. [mcp_github:4][mcp_github:6]

---

## Acceptance Criteria

- There is exactly one canonical composer UI implementation (ComposerSurface) used for both page and drawer usage. [file:2][file:3]
- Action Type options are sourced only from `action_recipe` definitions, not from record/entity definitions. [file:3]
- Fields shown in Section 4 come from the selected recipe’s `schemaConfig.fields`, not from hardcoded templates. [file:3]
- References are created/updated via the action references endpoint in bulk and are projection-readable. [mcp_github:2]
- Field value event naming is consistent across UI preview + emitted events. [file:3][file:2]
- No new fonts are introduced or loaded; composer does not enforce fonts. [mcp_github:4][mcp_github:6]

---

## Open Questions (must be answered before final polish)

1) ~~Where does `definition.kind` live today (field name / enum / metadata)?~~

**✅ RESOLVED** — Implemented in [024_definition_kind.ts](file:///e:/autoart_v02/backend/src/db/migrations/024_definition_kind.ts)

The `kind` column is now a first-class column on `record_definitions`:
- Default value: `'record'`
- Task and Subtask are promoted to `'action_recipe'`
- Index created: `idx_record_definitions_kind`

2) What is the canonical field value event type name (`FIELDVALUESET` vs `FIELDVALUERECORDED`) in the backend interpreter?
Recommended answer (strong)

Canonical event: FIELD_VALUE_RECORDED

Reasons:

Matches your interpreter language

Aligns with “facts, not mutations”

Avoids UI developers thinking “this overwrites something”

Plays well with event replay semantics

Required cleanup

Pick one name:

FIELD_VALUE_RECORDED


Update:

composer submit logic

workflow routes (if any emit field events)

interpreter switch cases

If you must support legacy events:

map FIELDVALUESET → FIELD_VALUE_RECORDED internally

but do not emit it anymore

3) What exact endpoints exist for:
   - bulk replace references
   - reading the action references projection
   - reading the workflow/context surface projection ?
   A) Bulk replace references (write model)

You want one call, not N calls.

Shape (conceptual)
PUT /actions/:actionId/references


Body:

{
  "references": [
    {
      "targetFieldKey": "client",
      "recordId": "uuid",
      "recordType": "contact"
    },
    {
      "targetFieldKey": "site",
      "recordId": "uuid",
      "recordType": "location"
    }
  ]
}


Rules:

This replaces all references for the action

Validation:

targetFieldKey must exist in recipe.referenceSlots

record must exist

Idempotent

Why replace instead of patch:

UI simplicity

no orphan cleanup bugs

no order-dependent semantics

B) Read references (projection)

This must be projection-backed so the UI doesn’t reconstruct meaning.

Shape
GET /actions/:actionId/references


Returns:

{
  "actionId": "...",
  "references": {
    "client": [ { record summary } ],
    "site":   [ { record summary } ]
  }
}


This lets ComposerSurface:

load a clean snapshot

render slots declaratively

not care about join logic

C) Workflow / context surface read

This is not a projection of truth — it’s a projection of affordance.

You likely already have this under something like:

GET /workflow/context/:subprocessId


or

GET /projections/workflow?contextId=...


What it should return:

action rows

in a shape consumable by the UI

derived from interpreter output

not writable

This endpoint should:

read from interpreter or a future projector

never accept mutations
4) How is subprocess/context metadata represented today for filtering recipes (tags, IDs, paths)? [file:3]

Applicability is declarative and tag-based, not ID-based.

In recipe definitions:

{
  "applicability": {
    "contextTypes": ["subprocess"],
    "tags": ["surface-prep", "fabrication"],
    "excludeTags": ["admin"]
  }
}


Then:

Subprocesses themselves have tags
Composer filters recipes where:
contextType matches
tag intersection exists
This gives you:
reuse across projects
no hard coupling
ability to retag without migrations
If you also want ID-based filtering later:
add it as an override
never as the primary mechanism

Finally, migrate the database  as necessary to support this model.