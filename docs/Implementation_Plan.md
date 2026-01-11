# Action Inspector Implementation Plan

## Overview

Implement the Action Inspector drawer and refactor registry views to use the table-core wrapper pattern.

---

## Pre-requisites: Table-Core Wrapper Refactoring

Before implementing the Action Inspector, refactor registry views to use `ui/table-core/` pattern:

> [!IMPORTANT]
> **Actions are first-class entities.** Ensure clear separation of views between action types. Each action type should have its own distinct presentation in the registry.

### Files to Refactor

| Current Component | Refactored To |
|-------------------|---------------|
| `components/tables/ActionInstancesView.tsx` | Use `ui/table-core/UniversalTableCore.tsx` |
| `components/tables/UniversalTableView.tsx` | Use `ui/table-core/UniversalTableCore.tsx` |

### Pattern Reference
See `ui/composites/DataTableFlat.tsx` for wrapper implementation pattern.

---

## Architecture

**Location:** Registry → Actions section  
**Trigger:** Click action row → opens `ActionInspector` drawer (right panel)  
**Scope:** Context-scoped (shows actions for selected action type)

---

## Component Structure

### 1. Main List: `ActionsList.tsx`
**Path:** `frontend/src/ui/composites/ActionsList.tsx`

Scrollable area showing action cards with:
- Collapsed overview with quick mutation buttons
- Top half: Mutable intent (field bindings + affordances)
- Bottom half: Immutable events

> [!TIP]
> **Human-readable styling:** Field bindings and actions must be displayed with clear labels, proper formatting (dates, users, references), and contextual icons. Avoid raw IDs or technical jargon.

### 2. Action Card: `ActionCard.tsx`
**Path:** `frontend/src/ui/composites/ActionCard.tsx`

Split card layout:
- **Top (Mutable):** ACTION badge, field bindings, Retract/Amend buttons
- **Divider**
- **Bottom (Immutable):** Events emitted list

### 3. Event Row: `EventRow.tsx`
**Path:** `frontend/src/ui/primitives/EventRow.tsx`

Displays single event with system event distinction.

### 4. Inspector Drawer: `ActionInspectorDrawer.tsx`
**Path:** `frontend/src/components/drawer/views/ActionInspectorDrawer.tsx`

Detailed view sections:
- Declared Intent (editable field bindings)
- Interpreted As (events - read-only)
- Current Projections (read-only)
- Mutation Actions (Retract/Amend buttons)

---

## API Additions

### Hooks
```typescript
useRetractAction()  // POST /actions/:id/retract
useAmendAction()    // POST /actions/:id/amend
```

### Backend Endpoints
- `POST /api/actions/:id/retract` → emits `ACTION_RETRACTED`
- `POST /api/actions/:id/amend` → emits `ACTION_MODIFIED`

---

## UIStore Additions

```typescript
includeSystemEventsInActionInspector: boolean  // persisted preference
```

---

## CSS Styles

Add to `frontend/src/index.css`:
- `.inspector-card` - Card container with hover states
- `.card-intent` / `.card-events` - Top/bottom sections
- `.event-row` / `.system-event` - Event display
- `.badge-action` / `.badge-event` - Type badges

---

## Implementation Checklist

### Phase 1: Table-Core Refactor ✅
- [x] Refactor `ActionInstancesView.tsx` to use `UniversalTableCore`
- [x] Create `ActionsTableFlat.tsx` wrapper composite

### Phase 2: UI Components ✅
- [x] Create `ActionsList.tsx` (scrollable card list)
- [x] Create `ActionCard.tsx` (split top/bottom card)
- [x] Create `EventRow.tsx` (immutable event display)

### Phase 3: Inspector Drawer ✅
- [x] Create `ActionInspectorDrawer.tsx`
- [x] Register in `DrawerRegistry.tsx`
- [x] Add drawer collapse toggle (`drawerCollapsed` in UIStore)

### Phase 4: Backend + API ✅
- [x] `POST /actions/:id/retract` endpoint
- [x] `POST /actions/:id/amend` endpoint
- [x] Add `useRetractAction` hook
- [x] Add `useAmendAction` hook

### Phase 5: Integration
- [ ] Wire up retract/amend hooks to ActionCard/Drawer
- [ ] Add `includeSystemEventsInActionInspector` to UIStore
- [ ] Test full flow: list → select → inspect → mutate

---

## Phase 6: UI Projection Presets

> [!IMPORTANT]
> **Projections are UI-level, not domain-level.** No persistence authority, no mutation power, no implied ontology. A projection can suggest meaning but never enforce it.

### Philosophy

The Action Inspector is effectively a **local projection debugger**:
- **Actions** = intent
- **Events** = interpretation  
- **Projections** = current meaning

Decision rule: *"Would this belong in the Action Inspector?"*
- If yes → projection
- If no → persistence
- If unclear → event

### ProjectionPreset Interface

**Path:** `frontend/src/ui/projections/types.ts`

```typescript
export interface ProjectionPreset<TRecord = any> {
  id: string
  label: string
  description?: string

  /** Determines applicability to current dataset/context */
  appliesTo: (context: ProjectionContext) => boolean

  /** Maps records into grouped, ordered, or flattened structures */
  project: (records: TRecord[], context: ProjectionContext) => ProjectionResult<TRecord>

  /** Optional affordances (must not mutate records) */
  affordances?: ProjectionAffordance[]

  /** UI hints only, not logic */
  ui?: {
    icon?: string
    defaultCollapsed?: boolean
  }
}

export interface ProjectionContext {
  workspaceId: string
  userId: string
  preferences: Record<string, unknown>
}

export interface ProjectionResult<T> {
  groups?: ProjectionGroup<T>[]
  flat?: T[]
}

export interface ProjectionGroup<T> {
  id: string
  label: string
  items: T[]
  meta?: Record<string, unknown>
}

export interface ProjectionAffordance {
  id: string
  label: string
  icon?: string
  intent: 'navigate' | 'filter' | 'annotate'
}
```

### Example: StageProjection (Non-Primitive)

**Path:** `frontend/src/ui/projections/presets/StageProjection.ts`

Stages survive only as **labels derived from imported metadata**:

```typescript
export const StageProjection: ProjectionPreset = {
  id: 'stage-projection',
  label: 'Group by Imported Stage',
  description: 'Groups work by stage metadata imported from external sources.',

  appliesTo: ({ preferences }) =>
    preferences.enableStageLikeViews === true,

  project: (records) => {
    const groups = new Map<string, any[]>()
    records.forEach(record => {
      const stageName = record.metadata?.import?.stage_name ?? 'Unlabeled'
      if (!groups.has(stageName)) groups.set(stageName, [])
      groups.get(stageName)!.push(record)
    })
    return {
      groups: Array.from(groups.entries()).map(([label, items]) => ({
        id: label, label, items, meta: { derived: true }
      }))
    }
  },

  ui: { icon: 'layers', defaultCollapsed: false }
}
```

**What this explicitly does NOT do:**
- ❌ No `stage_id`
- ❌ No container mutation
- ❌ No ordering guarantees
- ❌ No lifecycle semantics

### Phase 6 Checklist

- [ ] Create `frontend/src/ui/projections/types.ts` with interfaces
- [ ] Create `frontend/src/ui/projections/presets/` directory
- [ ] Implement `StageProjection` preset
- [ ] Add projection selector to workflow views
- [ ] Integrate with Action Inspector (show current projections)
