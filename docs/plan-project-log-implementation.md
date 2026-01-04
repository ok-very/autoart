# Project Log Implementation Plan

## Goals
Create the new default project UI view, which is a list of events.

## Implementation

**Spec file:** docs/demo-execution-log.html (currently empty) 
consider the correct name "Project Log" instead of "Execution Log"


## Purpose (Semantics)

The Project Log is an interactive surface that explains and logs “what happened” by showing a chronological sequence of triggered events and their results. It links the events to actions and records in a legible interface that allows users to navigate and understand the events while adding new information and context

It is not a workflow surface table, not a task list, and not a status display.

**Core promise**
- Every row corresponds to a persisted event (or a projection row that is explicitly derived from events and labeled as such).

## Data Model Requirements

### Canonical event shape (minimum contract)
Every event returned to the UI must include:

- `id` (stable unique identifier)
- `occurredAt` (server timestamp)
- `type` (string enum; stable)
- `actor` (user/service identifier)
- `contextType` + `contextId` (e.g. subprocess)
- `actionId` (nullable; many events will be action-scoped)
- `payload` (JSON)
- `correlationId` + `causationId` (optional but strongly recommended)
- `sequence` (monotonic ordering key within a scope; required for deterministic pagination)

**Invariant:** ordering must be stable across pagination and refetches (cursor-based paging strongly preferred).

### Event taxonomy (what must show up)
The log should include (at minimum):
- Field facts (e.g. `FIELD_VALUE_RECORDED`)
- Workflow state transitions (started/blocked/completed, etc.)
- Assignment changes
- Action reference changes (added/removed) and bulk “set references” diff results

Rationale: your action reference API explicitly states “All mutations emit events … projector updates the snapshot table synchronously,” which makes references first-class loggable facts. [mcp_github:11]

---

## Backend API (Read-only)

### Endpoints to implement (or confirm)
1) Action-scoped log:
- `GET /actions/:actionId/events`
- Supports `cursor` + `limit`
- Optional filters: `type[]`, `since`, `until`

2) Context-scoped log (subprocess/project level):
- `GET /events?contextType=subprocess&contextId=...`
- Same pagination + filters

**Do not** build this by scraping the workflow surface projection.
The workflow surface endpoint (`/workflow/surfaces/workflow_table?...`) is a materialized affordance projection and is not an event log. [mcp_github:12]

### Payload “join” strategy
The log endpoint should return pre-joined *summaries* needed for UI readability:
- action title/type (if actionId present)
- referenced record summary for reference events (at least display label)

This avoids N+1 fetch patterns in the log UI.

---

## Frontend Implementation (React)

### Component boundary
Create:
- `ProjectLogSurface` (read-only, paginated list)
- `ProjectLogRow` (pure rendering)
- `eventFormatters` registry: `eventType -> { label, category, color/icon, summarize(payload), renderDetails(payload) }`

### Data hooks (TanStack Query)
Add:
- `useActionEvents(actionId, filters, cursor)`
- `useContextEvents(contextType, contextId, filters, cursor)`

Design it similarly to your existing patterns:
- `useActionReferences()` reads a projection snapshot for fast consistent reads (`/actions/:id/references`) [mcp_github:11]
- workflow surfaces read projection nodes from `/workflow/surfaces/workflow_table?...` [mcp_github:12]

### Required UI behaviors (demo-grade rigor)
- Infinite scroll or “Load more” (cursor-based)
- Filters:
  - by category (Fields / Workflow / References / System)
  - by actor
  - by action type
- Grouping options:
  - “Group by Action” (collapsible sections)
  - “Ungrouped chronological”
- Deterministic timestamps + stable ordering (sequence + occurredAt)
- Copy-to-clipboard for event JSON payload (debug affordance)
- Deep links:
  - clicking an event jumps to Action drawer/page
  - clicking referenced record opens record drawer (when applicable)

---

## CSS / Styling (No new fonts)

### Rule: reuse existing global primitives
You already have global `.custom-scroll` and `.fade-in` in `index.css`, and `main.tsx` imports that file once. [mcp_github:3][mcp_github:4]

Implementation guidance:
- Put project-log-specific styling in **one** place:
  - either `frontend/src/styles/project-log.css` imported once in `main.tsx`
  - or a CSS module co-located with `ProjectLogSurface`
- Do not set `font-family` anywhere (the composer module currently does; the log should not). [mcp_github:6][mcp_github:4]
- Prefer Tailwind for layout; reserve CSS for:
  - scrollbar tweaks (if not covered by `.custom-scroll`)
  - sticky filter bar
  - “diff chips” and tiny affordances that are awkward in Tailwind

---

## Validation, Invariants, and Tests

### Server-side invariants
- Event types must be validated (enum or registry).
- Payload schemas must be validated per event type (Zod/io-ts/etc).
- Cursor paging must be deterministic.

### UI invariants
- Rendering must never crash on unknown event types:
  - unknown types render as “Unknown event” with raw payload fallback
- Log must remain usable with very large streams:
  - pagination required
  - avoid loading “all events” for a context

Context-centric execution log (formal plan)
Primary route + scope
Primary UI surface: ExecutionLogSurface(contextType='subprocess', contextId=subprocessId).

The log displays all events whose context_id=contextId and context_type=contextType, regardless of which action produced them.

Actions appear as a filter/grouping dimension inside the context log, not as the page’s identity.

Why this fits your current architecture
Workflow routes are explicitly “convenience endpoints that wrap POST /events” and “emit events, they do NOT mutate state directly,” which is exactly the kind of source the execution log must reflect.

Workflow surface hooks fetch projection nodes from /workflow/surfaces/workflow_table?..., which is a materialized tree for dependencies/affordance and is not an event log.

Backend rigor: endpoints and invariants
Required read endpoints (add if missing)
Context event stream:

GET /events?contextType=subprocess&contextId=...&cursor=...&limit=...

Optional filters: types=..., actorId=..., actionId=..., since=..., until=...

Optional helper (if you prefer a workflow namespace):

GET /workflow/contexts/:contextId/events (internally forwards to the same query)

Hard requirements

Cursor-based pagination with stable ordering (e.g., (occurred_at, id) or explicit sequence).

Server-side filtering only (no “fetch everything then filter” in the UI).

Every event row must include occurred_at, type, payload, and ideally actor_id (your workflow route response schema already includes those).

Event taxonomy standardization
You’ve already committed to FIELD_VALUE_RECORDED at the workflow route level (POST /workflow/actions/:actionId/field emits that exact event). The execution log must treat this as canonical and should never depend on FIELDVALUESET naming variants.

Frontend rigor: implementation structure
Hooks (match your existing patterns)
Follow the same approach as action references and workflow surface:

useContextEvents(contextType, contextId, filters, cursor) (new)

Use TanStack Query infinite query for pagination.

This mirrors:

useActionReferences() reading projection snapshots from /actions/:id/references

useWorkflowSurfaceNodes() reading projection nodes from /workflow/surfaces/workflow_table?...

Rendering contract (don’t “invent” meaning)
Implement a formatter registry:

eventType -> { label, summarize(payload), renderDetails(payload), category }

Unknown event types render a safe fallback (“Unknown event”) + raw JSON payload.

Also: group-by options should be client-only:

“Chronological”

“Group by Action” (collapsible), but still ordered by event time.

Reference + workflow events (must appear)
Because your references mutation layer explicitly says “all mutations emit events” and provides a bulk replace endpoint (PUT /actions/:id/references) for composer usage, the execution log must display the resulting reference add/remove events in the context timeline. Likewise, dependency edits invoked via /workflow/actions/:id/dependencies/add|remove must show as dependency events in the same context log.


Use the existing persisted Zustand uiStore (which already persists UI settings under the ui-storage key) and add a boolean preference that defaults to hiding system events.

Store change (per browser profile)
Add to frontend/src/stores/uiStore.ts a persisted flag, e.g. includeSystemEventsInLog, with default false, plus a setter.

Extend UIState:

includeSystemEventsInLog: boolean;

setIncludeSystemEventsInLog: (value: boolean) => void;

Initialize it inside the persisted store initializer with includeSystemEventsInLog: false, and implement the setter with set({ includeSystemEventsInLog: value }).

Add it to partialize, because partialize currently whitelists exactly what gets persisted (so anything omitted won’t be sticky).

Query behavior (default hide system)
Drive the log query from this flag, as a server param, so pagination stays consistent.

When includeSystemEventsInLog === false, call the events read endpoint with includeSystem=false (or equivalent) so only user-meaningful events come back.

When toggled on, refetch with includeSystem=true (no client-side filtering of previously fetched pages).

UI toggle wiring
Bind the toggle UI directly to useUIStore((s) => s.includeSystemEventsInLog) and setIncludeSystemEventsInLog(...), and label it “Include system events”.

Because the workflow layer is explicitly designed around “emit events, do not mutate state,” the execution log should remain a pure read of that filtered event stream rather than a projection-specific view.

Visibility model (hard requirement)
Add visibility to events (recommended)
Right now, your workflow API is explicitly “event-emitting, no state mutation,” and returns event objects with type, payload, actor_id, occurred_at, etc. To support “default = user-meaningful, toggle = include system,” add a real column on the events table:

events.visibility TEXT NOT NULL DEFAULT 'user'

Allowed: 'user' | 'system'

This avoids fragile heuristics like “actor_id is null ⇒ system” (because your response schema already allows actor_id to be null for legitimate emits).

If a DB migration is not desired yet (fallback)
Maintain a single authoritative server-side registry:

SYSTEM_EVENT_TYPES = new Set([...])

USER_EVENT_TYPES = everything else
…and apply filtering in the events query service, not the UI.

Backend endpoint contract (context-centric + toggle)
Implement/standardize a context log read endpoint that supports the toggle:

GET /events?contextType=subprocess&contextId=...&cursor=...&limit=...&includeSystem=false

Behavior:

includeSystem=false returns only visibility='user' (or excludes types in SYSTEM_EVENT_TYPES).

includeSystem=true returns both.

Also add optional filters that compose cleanly with the toggle:

types[]=...

actorId=...

actionId=...

since/until

Define “system event” precisely
Use a policy that makes sense with your existing event sources:

User-meaningful events (default ON):

Workflow state events emitted by your workflow routes (WORK_STARTED, WORK_STOPPED, WORK_FINISHED, WORK_BLOCKED, WORK_UNBLOCKED).

Assignment events (ASSIGNMENT_OCCURRED, ASSIGNMENT_REMOVED).

Field facts (FIELD_VALUE_RECORDED) via POST /workflow/actions/:id/field.

Dependency changes (DEPENDENCY_ADDED/REMOVED) and row moves (WORKFLOW_ROW_MOVED).

Reference changes (the action references layer states mutations “emit events” and project synchronously, so these are first-class loggable facts).

System events (default OFF):

Projector/refresh/debug/admin-only events (example: “workflow surface refresh” should land here; your workflow surface tooling includes a refresh mutation intended for debug/admin use).

Frontend UX (toggle + trust boundaries)
Default view: context timeline with only user events.

Add a single toggle: “Include system events.”

Make the toggle purely a query param switch; do not re-filter already-fetched data client-side (it will break pagination determinism).

Because docs/demo-execution-log.html is currently an empty placeholder, treat it as a spec stub, not an implementation reference.

Acceptance criteria (tests/invariants)
With includeSystem=false, reference mutations (add/remove/bulk replace) still show up, since they are user-meaningful facts about inputs.

With includeSystem=false, projector refresh / debug events are hidden even if they share the same context.

Pagination remains stable when toggling on/off (cursor is scoped to the filtered stream).

Plain question: should the “Include system events” toggle be sticky per user

Sticky-per-user fits your existing UI persistence approach: you already use a persisted Zustand store (persist(..., { name: 'ui-storage', partialize: ... })) for view mode, inspector tab, layout geometry, etc. So the execution log’s “Include system events” toggle should live in that same store and be part of the persisted partialize output.

Concrete plan: sticky “includeSystemEvents”
1) Add a persisted preference to uiStore.ts
Add to UIState:

includeSystemEventsInLog: boolean

setIncludeSystemEventsInLog: (value: boolean) => void

Initialize default as false (matches “default to user-meaningful events”). Then include it in partialize, so it persists across sessions.

This is consistent with how uiStore persists viewMode, inspectorTabMode, and activeProjectId today.

2) Use it as a query param (don’t filter client-side)
In the execution log hook (context-centric):

includeSystemEvents=false is passed to the backend as a query param.

Toggle flips the param and forces a refetch.

This avoids breaking pagination determinism (cursor streams must be scoped to the filtered set). Your existing hooks already encode server parameters into the query key (e.g., useWorkflowSurfaceNodes uses ['workflowSurface', contextType, contextId] and includes context in the URL), so do the same for includeSystemEvents.

Backend alignment: event visibility
You already have workflow endpoints that emit events and explicitly reject state mutation patterns; the log should surface those emitted events and simply filter the stream. So the backend should support:

includeSystem=false → user-visible events only

includeSystem=true → user + system events

If you don’t add events.visibility yet, implement a server-side SYSTEM_EVENT_TYPES allow/deny list and apply the toggle in the query service (never in the UI).

Integration points you already have
Workflow events: emitted via /workflow/actions/:actionId/... routes (start/stop/finish/block/unblock/assign/field/dependency/move), and FIELD_VALUE_RECORDED is already canonical on the workflow “field” route.

Reference events: your action reference hooks are built around /actions/:id/references and explicitly state mutations emit events and the projection updates synchronously, which is perfect for “show user-meaningful reference changes in the log.”

“sticky per user” to mean “per browser profile” (local storage)