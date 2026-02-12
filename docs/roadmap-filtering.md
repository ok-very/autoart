# Filtering, Sorting, and Column Visibility Roadmap

## Executive Summary

AutoArt has 20+ surfaces that render tabular or list data. Sorting exists in one place (UniversalTableCore, client-side). Column visibility exists in two places (DataTableFlat, DataTableImport). Filtering exists in five places, each with its own ad-hoc implementation. There is no shared filtering infrastructure, no filter persistence, no server-side filtering, and no composable filter primitives.

This roadmap introduces `@tanstack/react-table` as the headless logic layer for dense data tables, a lightweight `FilterEngine` utility for sidebar/list filtering, and composable UI primitives (`FilterBar`, `FilterChip`, `SortControl`) built from the existing atom library. The goal: any surface that shows data can filter, sort, and configure columns using shared, consistent infrastructure -- without rewriting what already works.

---

## Current State Audit

### Table Rendering Architecture (Three Layers)

The frontend has three distinct table rendering approaches, each serving different purposes:

| Layer | Files | Description |
|-------|-------|-------------|
| **UniversalTableCore** | `frontend/src/ui/table-core/` | Domain-agnostic div-based engine. Handles column resize, sort state, features plugin system. Used by the major composites. |
| **Table atom** | `packages/ui/src/atoms/Table.tsx` | Compound `<table>` component. Semantic HTML, no logic. Size context via React context. Used directly by some views. |
| **TableKit** | `frontend/src/ui/table/` | Wrapper primitives (TableFrame, TableRow, TableCell). Used by import TablePreview. |

**Assessment:** UniversalTableCore is the clear center of gravity. It already has a features plugin system, RowModel adapters, and sort infrastructure. The Table atom and TableKit are presentation-only and do not need the headless logic layer -- they will consume filtered/sorted data from upstream.

### Row Model Adapters (4)

| Adapter | File | Domain |
|---------|------|--------|
| `FlatRowModelAdapter` | `adapters/FlatRowModelAdapter.ts` | DataRecord[] |
| `HierarchyRowModelAdapter` | `adapters/HierarchyRowModelAdapter.ts` | HierarchyNode[] with tree flattening |
| `ActionViewRowModelAdapter` | `adapters/ActionViewRowModelAdapter.ts` | WorkflowSurfaceNode[] |
| `ImportPlanRowModelAdapter` | `adapters/ImportPlanRowModelAdapter.ts` | ImportPlanItem[] with container hierarchy |

### Surface Inventory

#### Dense Data Tables (use UniversalTableCore)

| Surface | File | Filtering | Sorting | Col Visibility | Data Size |
|---------|------|-----------|---------|----------------|-----------|
| **DataTableFlat** | `composites/DataTableFlat.tsx` | None | sortKey per column | ColumnPicker (inline) | Paginated, 50/page |
| **DataTableHierarchy** | `composites/DataTableHierarchy.tsx` | None | sortKey per column | Field showInCollapsed | Small (tasks) |
| **ActionsTableFlat** | `composites/ActionsTableFlat.tsx` | None | sortKey per column | None | Paginated, 50/page |
| **WorkflowActionsTable** | `composites/WorkflowActionsTable.tsx` | None | sortKey per column | None | Small-medium |
| **ActionRegistryTable** | `composites/ActionRegistryTable.tsx` | Text filter (inline) | None (placeholder buttons) | None | Medium |
| **DataTableImport** | `composites/DataTableImport.tsx` | None | None | ColumnPicker molecule | Medium |

#### Standalone HTML Tables (no core, raw `<table>`)

| Surface | File | Filtering | Sorting | Notes |
|---------|------|-----------|---------|-------|
| **InvoiceListView** | `composites/InvoiceListView.tsx` | Status filter via financeStore | None | Raw `<table>`, reads from Zustand |
| **BillsListView** | `composites/BillsListView.tsx` | None | None | Raw `<table>` |
| **ExpenseListView** | `composites/ExpenseListView.tsx` | None | None | Raw `<table>` |
| **SubmissionsTable** | `workflows/intake/SubmissionsTable.tsx` | None | None | Expandable rows, raw `<table>` |
| **BfaFieldChangesTable** | `workflows/bfa/BfaFieldChangesTable.tsx` | None | None | Grid-based diff display |

#### TableKit Surfaces

| Surface | File | Filtering | Sorting | Notes |
|---------|------|-----------|---------|-------|
| **TablePreview** | `workflows/import/TablePreview.tsx` | None | None | Read-only import preview |

#### Sidebar Lists

| Surface | File | Filtering | Sorting | Notes |
|---------|------|-----------|---------|-------|
| **DefinitionListSidebar** | `sidebars/DefinitionListSidebar.tsx` | Text search + RegistryFilterBar | Name/Created sort | Most complete filter implementation |
| **RecordTypeSidebar** | `sidebars/RecordTypeSidebar.tsx` | Text search (inline) | None | Duplicates DefinitionList pattern |
| **RegistrySidebar** | `sidebars/RegistrySidebar.tsx` | Text search (inline) | None | Collapsible sections |
| **ProjectSidebar** | `sidebars/ProjectSidebar.tsx` | None | None | Tree view, no list filtering |
| **HierarchySidebar** | `sidebars/HierarchySidebar.tsx` | None | None | Nearly identical to ProjectSidebar |

#### Other Filterable Surfaces

| Surface | File | Filtering | Notes |
|---------|------|-----------|-------|
| **SearchCombobox** | `packages/ui/src/molecules/SearchCombobox.tsx` | Text filter (built-in) | Portal-based dropdown, keyboard nav |
| **ExportProjectList** | `workflows/export/ExportProjectList.tsx` | None | Checkbox list |
| **ActionsList** | `composites/ActionsList.tsx` | System event toggle | Card-based, not tabular |

### Existing Filter Components

| Component | File | What It Does |
|-----------|------|-------------|
| **RegistryFilterBar** | `ui/registry/RegistryFilterBar.tsx` | Search + kind filter + sort select + result count badge. Uses TextInput, Select, Badge atoms. |
| **ColumnPicker** | `ui/molecules/ColumnPicker.tsx` | Dropdown checklist for toggling column visibility. Uses Dropdown atom. |
| **SearchCombobox** | `packages/ui/molecules/SearchCombobox.tsx` | Portal dropdown with text search, keyboard nav, two-stage selection. |

### Existing Filter State Patterns

| Pattern | Where | How |
|---------|-------|-----|
| **Zustand persisted** | `financeStore.ts` | `filters: { status?, definitionId?, clientContactId?, dateRange? }` -- persisted via zustand/persist |
| **Component-local useState** | DefinitionListSidebar, RecordTypeSidebar, RegistrySidebar, ActionRegistryTable | `const [searchQuery, setSearchQuery] = useState('')` |
| **Props-driven** | DataTableFlat `visibleColumns` | Parent passes down, internal state as fallback |
| **Feature plugins** | UniversalTableCore features | `renderToolbarRight` for column picker |

### What's Missing

1. **No filter primitives.** Each surface builds its own search input, sort dropdown, and filter chips from scratch.
2. **No server-side filtering.** All filtering is client-side. No API endpoints accept filter parameters.
3. **No filter persistence.** Only financeStore persists filters. Every other surface resets on remount.
4. **No multi-column filtering.** ActionRegistryTable filters on text only. No "status = active AND assignee = X" anywhere.
5. **No column visibility persistence.** DataTableFlat defaults to first 6 columns, user changes are lost on remount.
6. **Sorting is client-only.** UniversalTableCore sorts in memory. No server-side sort.
7. **No filter URL synchronization.** Cannot deep-link to a filtered view.
8. **Standalone tables lack core features.** Invoice/Bill/Expense views use raw `<table>` and miss sorting, filtering, resize, and column visibility entirely.

---

## Package Recommendations

### Primary: `@tanstack/react-table` v8

**For:** Dense data tables (DataTableFlat, DataTableHierarchy, ActionsTableFlat, WorkflowActionsTable, ActionRegistryTable, DataTableImport, and the standalone invoice/bill/expense tables).

**Why this, not alternatives:**

| Package | Verdict | Reason |
|---------|---------|--------|
| `@tanstack/react-table` | **Adopt** | Headless, framework-specific React adapter. Already using `@tanstack/react-query` and `@tanstack/react-virtual`. Same mental model, same team, composable plugins. |
| `@tanstack/table-core` | Skip | Framework-agnostic core. We only need React. The react-table package wraps this automatically. |
| `ag-grid-community` | Skip | Opinionated rendering. Conflicts with UniversalTableCore's custom rendering approach and DESIGN.md's aesthetic. Would require abandoning existing table infrastructure. |
| `react-datasheet-grid` | Skip | Spreadsheet-focused. Not a fit for record/action tables with heterogeneous column types. |

**What it provides that we are building by hand today:**
- Column visibility state management (replaces inline ColumnPicker in DataTableFlat)
- Multi-column sorting with stable sort
- Column-level and global filtering with pluggable filter functions
- Row selection state
- Pagination state
- Column ordering and pinning
- All headless -- zero rendering opinions

**Integration strategy:** TanStack Table becomes the state machine. UniversalTableCore remains the renderer. The RowModel adapters evolve to bridge TanStack Table's row model to our existing rendering pipeline.

### Secondary: `match-sorter` (or inline equivalent)

**For:** Sidebar lists, dropdown filtering, SearchCombobox enhancement.

| Package | Verdict | Reason |
|---------|---------|--------|
| `match-sorter` | **Adopt (lightweight)** | 3.5KB, ranking-based fuzzy matching. Better than `.includes()` for sidebar search. Used internally by TanStack Table's default filter functions. |
| `fuse.js` | Skip | Heavier (23KB), full fuzzy search engine. Overkill for sidebar lists with <100 items. |
| `flexsearch` | Skip | Full-text search index. For large document search, not UI filtering. |
| `cmdk` | Consider later | Command palette pattern. Interesting for a global command palette feature, but out of scope for table filtering. |

**Rationale:** Sidebar lists have small item counts (5-50 definitions). They do not need a table library. They need a shared filter utility that ranks results better than `string.includes()`. `match-sorter` does this well and is already a transitive dependency of TanStack Table.

### Not Adding: Server-Side Filtering (Yet)

Current data volumes do not justify server-side filtering. The largest surface (DataTableFlat with records) paginates at 50 rows from a dataset that rarely exceeds 500. If this changes, Phase 4 addresses it.

---

## Architecture Design

### State Management Strategy

Three tiers of filter state, matched to how users think about persistence:

| Tier | Where | Survives | Examples |
|------|-------|----------|----------|
| **Ephemeral** | TanStack Table instance state | Component remount: no | Active sort direction, column resize drag |
| **Session** | Zustand store (not persisted) | Page navigation: yes. Browser close: no | Which columns are visible, active filter chips, sort column |
| **Persistent** | Zustand store (persisted) | Browser close: yes | Finance filters, preferred column sets per definition |

**Decision:** Filter state for data tables goes in Zustand stores with the `partialize` pattern already used in `financeStore`. Each domain gets its own filter slice (or the existing store gets a `filters` key). TanStack Table reads from the store; user interactions write to the store.

### Composable Architecture

```
                    ┌─────────────────┐
                    │  Zustand Store   │  Filter state owner
                    │  (per domain)    │  Persisted via partialize
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐  ┌───▼───┐  ┌──────▼──────┐
    │ FilterBar atom  │  │ Sort  │  │ ColumnPicker│  UI primitives
    │ (search + chips)│  │Control│  │  (existing) │
    └─────────┬──────┘  └───┬───┘  └──────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │  useTableState  │  Hook: reads store, creates
                    │  (custom hook)  │  TanStack Table instance
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐  ┌───▼────────┐  ┌──▼──────────┐
    │ RowModel       │  │ Filtered   │  │ Sorted      │
    │ Adapter        │  │ Rows       │  │ Columns     │
    └─────────┬──────┘  └───┬────────┘  └──┬──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │ UniversalTable  │  Existing renderer
                    │ Core            │  (no changes needed)
                    └─────────────────┘
```

### Key Design Decisions

**1. TanStack Table wraps RowModel, not replaces it.**

The existing RowModel adapter pattern stays. TanStack Table sits between the adapter output and UniversalTableCore, handling filter/sort/visibility logic. UniversalTableCore receives pre-filtered, pre-sorted rows and visible columns.

**2. FilterBar is an atom, not a composite.**

FilterBar renders search input + filter chips + result count. It does not know about domain data. It emits filter state changes. The parent passes handlers. This keeps it reusable across tables and sidebars.

**3. Filter functions are per-column-type, not per-surface.**

A `text` column always fuzzy-matches. A `status` column always exact-matches from a set. A `date` column always range-filters. These are registered once in a filter function registry, not reimplemented per table.

**4. Column visibility presets per definition.**

Users configure visible columns for "Contact" records once. That configuration persists across sessions. The store key is `{surfaceId}:{definitionId}`.

### Filter Primitives (New UI Components)

All built from existing atoms (TextInput, Badge, Select, Dropdown). All use `--ws-*` tokens.

| Primitive | Location | API |
|-----------|----------|-----|
| **FilterBar** | `packages/ui/src/molecules/FilterBar.tsx` | `searchQuery, onSearchChange, chips: FilterChip[], onChipRemove, resultCount` |
| **FilterChip** | `packages/ui/src/atoms/FilterChip.tsx` | `label, value, onRemove` -- a Badge with an X button |
| **SortControl** | `packages/ui/src/atoms/SortControl.tsx` | `columns: {id, label}[], activeSort, onSortChange` -- compact dropdown |
| **ColumnVisibilityControl** | Evolves from existing `ColumnPicker` molecule | Same API, moves to `packages/ui` |

**Visual treatment per DESIGN.md:**
- FilterBar: 1px `--ws-panel-border` bottom, `--ws-panel-bg` background, h-10 matching existing toolbar height
- FilterChip: `--ws-bg` background, `--ws-text-secondary` text, `--ws-panel-border` border, 1px, rounded-full, 24px height
- No colored filter chips. Color communicates status, not filter state.
- Result count: `Badge variant="neutral" size="sm"` (already used in RegistryFilterBar)
- Empty filter state: field exists but is blank. No "No filters applied" message. Silence is a feature.

### Integration with TanStack Query

TanStack Table and TanStack Query are complementary but independent:
- **Query** fetches data. Its cache is the source of truth for what exists.
- **Table** filters/sorts/pages what was fetched. It does not re-fetch.
- When Query re-fetches, Table re-processes. No coordination needed beyond React's render cycle.

For future server-side filtering: Query's `queryKey` would include filter params, and the server would return pre-filtered results. TanStack Table would then skip its client-side filter pass. This is a built-in capability of TanStack Table (`manualFiltering`).

---

## Phased Implementation Plan

### Phase 0: Foundation (No Visible Changes)

**Goal:** Install packages, create the `useTableState` hook, build filter primitives. Nothing changes for users.

**Tasks:**
1. Add `@tanstack/react-table` to `frontend/package.json` (and pnpm catalog if shared)
2. Add `match-sorter` to `packages/ui/package.json` (used by FilterBar's fuzzy search)
3. Create `frontend/src/hooks/useTableState.ts` -- hook that creates a TanStack Table instance from a column definition and data array, returns filtered/sorted rows and column state
4. Create `packages/ui/src/atoms/FilterChip.tsx` -- muted Badge with remove button
5. Create `packages/ui/src/molecules/FilterBar.tsx` -- search input + chips + count, matches RegistryFilterBar API
6. Move `ColumnPicker` from `frontend/src/ui/molecules/` to `packages/ui/src/molecules/` for cross-package use
7. Create filter function registry: `frontend/src/utils/filterFunctions.ts` -- maps field types to TanStack filter functions

**Files created/modified:**
- `frontend/package.json` -- add dependency
- `pnpm-workspace.yaml` -- add catalog entry
- `frontend/src/hooks/useTableState.ts` -- new
- `packages/ui/src/atoms/FilterChip.tsx` -- new
- `packages/ui/src/molecules/FilterBar.tsx` -- new
- `packages/ui/src/molecules/ColumnPicker.tsx` -- moved from frontend
- `frontend/src/utils/filterFunctions.ts` -- new
- `packages/ui/src/index.ts` -- export new components

**Verification:** Unit test for `useTableState` with mock data. FilterBar renders in Storybook equivalent.

---

### Phase 1: DataTableFlat Migration

**Goal:** DataTableFlat uses TanStack Table for filtering, sorting, and column visibility. Existing callers see no API change.

**Why this surface first:** It is the most used data table, has the most column types, already has column visibility (proving the need), and is the best test of the full pipeline.

**Tasks:**
1. Refactor DataTableFlat internals to use `useTableState` hook
2. Replace inline ColumnPicker with shared ColumnPicker from packages/ui
3. Add FilterBar to DataTableFlat's toolbar (feature plugin)
4. Wire column visibility to TanStack Table's columnVisibility state
5. Wire sort to TanStack Table's sorting state (replace UniversalTableCore's internal sort)
6. Add Zustand persistence for column visibility per definition
7. Create `useTableFilterStore.ts` -- generic Zustand slice factory for table filter state

**Files modified:**
- `frontend/src/ui/composites/DataTableFlat.tsx` -- internal refactor
- `frontend/src/stores/tableFilterStore.ts` -- new generic store
- `frontend/src/ui/table-core/UniversalTableCore.tsx` -- accept pre-sorted rows (opt-in flag `externalSort`)

**Migration notes:**
- DataTableFlat's existing `visibleColumns` prop continues to work (overrides internal state)
- Pagination remains internal -- TanStack Table handles it but DataTableFlat controls the page state
- No API changes for callers (RecordGrid, ProjectWorkflowView, etc.)

**Verification:** Open Records panel. Sort by any column -- verify sort indicator and correct order. Open column picker -- toggle columns, close and reopen panel, verify columns persisted. Type in filter bar -- verify rows filter in real time.

---

### Phase 2: Sidebar List Filtering

**Goal:** All sidebar lists use the FilterBar primitive with `match-sorter` ranking. Consistent search UX.

**Tasks:**
1. Create `useListFilter(items, searchQuery, options)` hook -- wraps match-sorter
2. Refactor DefinitionListSidebar to use `useListFilter` + shared FilterBar
3. Refactor RecordTypeSidebar to use `useListFilter` + shared FilterBar
4. Refactor RegistrySidebar to use `useListFilter` + shared FilterBar
5. Add search to ProjectSidebar project list (currently no filtering)
6. Add search to HierarchySidebar (currently no filtering)

**Files modified:**
- `frontend/src/hooks/useListFilter.ts` -- new
- `frontend/src/ui/sidebars/DefinitionListSidebar.tsx` -- simplify
- `frontend/src/ui/sidebars/RecordTypeSidebar.tsx` -- simplify
- `frontend/src/ui/sidebars/RegistrySidebar.tsx` -- simplify
- `frontend/src/ui/sidebars/ProjectSidebar.tsx` -- add search
- `frontend/src/ui/sidebars/HierarchySidebar.tsx` -- add search
- `frontend/src/ui/registry/RegistryFilterBar.tsx` -- deprecate in favor of FilterBar

**Verification:** Type in any sidebar search. Results rank by relevance (exact match first, then starts-with, then contains). Clear search restores full list. No flash or layout shift.

---

### Phase 3: Remaining Core Tables

**Goal:** ActionsTableFlat, DataTableHierarchy, WorkflowActionsTable, and ActionRegistryTable gain filtering and improved sorting.

**Tasks:**
1. Migrate ActionsTableFlat to `useTableState`
2. Migrate DataTableHierarchy to `useTableState` (tree-aware filtering: if child matches, parent stays visible)
3. Migrate WorkflowActionsTable to `useTableState`
4. Refactor ActionRegistryTable from raw `<table>` to UniversalTableCore + `useTableState`
   - This is the biggest lift: ActionRegistryTable currently builds its own HTML table with inline search, sort buttons (non-functional), and checkbox column
   - The refactor replaces all of this with the standard pipeline
5. Add FilterBar to each table's toolbar

**Files modified:**
- `frontend/src/ui/composites/ActionsTableFlat.tsx`
- `frontend/src/ui/composites/DataTableHierarchy.tsx`
- `frontend/src/ui/composites/WorkflowActionsTable.tsx`
- `frontend/src/ui/composites/ActionRegistryTable.tsx` -- major refactor
- `frontend/src/ui/table-core/adapters/HierarchyRowModelAdapter.ts` -- tree-aware filtering support

**Tree-aware filtering design:**
When filtering a hierarchy, if a leaf node matches, all its ancestors must remain visible (even if they don't match). If a parent matches, all its children remain visible. This is a standard tree-filter algorithm -- TanStack Table supports it via `filterFromLeafRows` and `subRows`.

**Verification:** For each table: type a search term, verify rows filter. Sort by each sortable column. Toggle column visibility where applicable. For hierarchy tables: filter by a child node name, verify parent chain is visible.

---

### Phase 4: Standalone Tables Migration

**Goal:** InvoiceListView, BillsListView, ExpenseListView, and SubmissionsTable migrate from raw `<table>` to UniversalTableCore.

**Why last:** These are lower-traffic surfaces with simpler data. They benefit from the established pattern but aren't urgent.

**Tasks:**
1. Migrate InvoiceListView to UniversalTableCore + `useTableState`
   - Replace financeStore's ad-hoc `filters.status` with TanStack Table filter state
   - Add FilterBar with status filter chip
   - Add sorting (by date, amount, status)
2. Migrate BillsListView to UniversalTableCore + `useTableState`
3. Migrate ExpenseListView to UniversalTableCore + `useTableState`
4. Migrate SubmissionsTable to UniversalTableCore + `useTableState`
   - Preserve expandable row behavior
5. Add column visibility to all four

**Files modified:**
- `frontend/src/ui/composites/InvoiceListView.tsx` -- refactor
- `frontend/src/ui/composites/BillsListView.tsx` -- refactor
- `frontend/src/ui/composites/ExpenseListView.tsx` -- refactor
- `frontend/src/workflows/intake/components/SubmissionsTable.tsx` -- refactor
- `frontend/src/stores/financeStore.ts` -- remove ad-hoc filter, or keep as convenience wrapper

**Verification:** Each table renders correctly with the new core. Sorting works on all columns. Filter bar filters. Column picker works. Existing functionality (e.g., CSV export in SubmissionsTable) is preserved.

---

### Phase 5: Advanced Features (Future)

These are not planned for immediate implementation but are enabled by the Phase 0-4 infrastructure:

| Feature | What | Depends On |
|---------|------|------------|
| **URL filter sync** | Encode active filters in URL params for deep-linking | Phase 1 store pattern + `useSearchParams` |
| **Saved filter views** | Named filter presets per table (e.g., "My Open Invoices") | Phase 4 store pattern + backend persistence |
| **Server-side filtering** | API accepts filter/sort params, returns pre-filtered results | TanStack Table's `manualFiltering` + backend endpoint changes |
| **Global command palette** | cmdk-style search across all entities | `match-sorter` + cross-store search index |
| **Column ordering** | Drag-to-reorder columns | TanStack Table's columnOrder + dnd-kit (already installed) |
| **Column pinning** | Freeze first N columns during horizontal scroll | TanStack Table's columnPinning |
| **Multi-column sort** | Sort by status, then by date | TanStack Table supports this natively, just needs UI |
| **Virtualized rows** | Render only visible rows for 1000+ datasets | `@tanstack/react-virtual` (already installed) + TanStack Table integration |

---

## Migration Strategy

### Incremental Adoption Rules

1. **No big-bang rewrite.** Each phase is a PR (or small stack). Each phase leaves the codebase functional.
2. **Existing props APIs do not change.** DataTableFlatProps, DataTableHierarchyProps -- callers are unaffected. Internal state management migrates to TanStack Table, but the wrapper components present the same interface.
3. **UniversalTableCore stays.** It is the renderer. TanStack Table is the state machine. They are complementary. UniversalTableCore gets an `externalSort` flag so it skips its internal sort when TanStack Table handles it.
4. **Feature plugins evolve.** The existing `TableFeature` type gains optional filter/sort integration. FilterBar becomes a standard feature plugin.
5. **Standalone tables migrate to UniversalTableCore first, then get filtering.** Do not try to add TanStack Table to a raw `<table>`. Convert to the core renderer first, then wire up filtering.

### Breaking Change Prevention

| Risk | Mitigation |
|------|------------|
| DataTableFlat callers pass `visibleColumns` prop | Prop continues to work as override. TanStack Table's columnVisibility reads from it when present. |
| Sort behavior changes | TanStack Table's sort uses same sortKey functions. Results should be identical. |
| ActionRegistryTable has custom HTML | Full rewrite to UniversalTableCore. Isolated, tested, reviewed. |
| financeStore filter pattern | Keep store; wire it to TanStack Table's state. financeStore becomes a convenience layer. |

### Testing Strategy

| Phase | Verification |
|-------|-------------|
| Phase 0 | Unit tests for `useTableState` hook. Render test for FilterBar, FilterChip. |
| Phase 1 | Integration test: DataTableFlat with 100 records, filter by text, verify correct rows. Sort ascending/descending, verify order. Toggle column, verify persistence. |
| Phase 2 | Integration test: Sidebar with 20 items, search by partial name, verify ranking. |
| Phase 3 | Integration test: Hierarchy table, filter by leaf node, verify ancestor chain visible. |
| Phase 4 | Regression test: Invoice/Bill/Expense views render same data, same row count, same click behavior. |

---

## UI/UX Patterns

### Filter Bar Appearance

Following DESIGN.md's archival aesthetic and interaction rules:

```
┌────────────────────────────────────────────────────────────────┐
│ 🔍 Filter...          [status: active ×] [assignee: J... ×]  3 │
└────────────────────────────────────────────────────────────────┘
  │                      │                                     │
  Search input           Filter chips                     Result count
  --ws-text-secondary    --ws-bg border                   Badge neutral
  h-8, pl-8             h-6, rounded-full                 text-xs
  focus: 1px oxide blue  --ws-text-secondary
```

- **Bar height:** h-10, matching existing toolbar pattern
- **Background:** `--ws-panel-bg`
- **Border:** 1px `--ws-panel-border` bottom
- **Search icon:** lucide `Search`, 14px, `--ws-muted-fg`
- **Search input:** TextInput size="sm", no visible border until focus
- **Filter chips:** `--ws-bg` background, `--ws-panel-border` border, `--ws-text-secondary` text, X icon on hover
- **Result count:** Badge variant="neutral" size="sm", right-aligned

### Sort Indicator

Already implemented in UniversalTableCore (ChevronUp/ChevronDown, 12px). No changes needed. TanStack Table will drive the state; the indicators stay the same.

### Column Visibility Control

Already implemented as ColumnPicker (Dropdown + CheckboxItems). Moves to shared package, gains persistence. Visual treatment unchanged.

### Empty Filter State

Per DESIGN.md: "There are no empty states. Fields exist but are blank."

When all rows are filtered out:
- Table header row remains visible
- Body shows a single line: "0 of N [items]" in `--ws-text-secondary`, 12px
- No illustration, no call-to-action, no "Try adjusting your filters"
- Clearing the filter bar restores all rows

### Filter Interaction Timing

- **Search input:** Filters after 150ms debounce (matches DebouncedInput pattern)
- **Filter chip add/remove:** Filters immediately
- **Sort click:** Sorts immediately
- **Column toggle:** Toggles immediately
- **No animation** on filter transitions. Rows appear/disappear instantly. Motion for expand/collapse only.

---

## Dependency Summary

### New Dependencies

| Package | Version | Where | Size |
|---------|---------|-------|------|
| `@tanstack/react-table` | ^8.x | frontend | ~53KB (tree-shakeable to ~15KB for core features) |
| `match-sorter` | ^6.x | packages/ui | ~3.5KB |

### Catalog Entry

```yaml
# pnpm-workspace.yaml catalog additions
"@tanstack/react-table": "^8.21.2"
"match-sorter": "^6.3.4"
```

### Existing Dependencies Leveraged

| Package | Already In | Used For |
|---------|------------|----------|
| `@tanstack/react-query` | frontend | Data fetching (unchanged) |
| `@tanstack/react-virtual` | frontend | Row virtualization (Phase 5) |
| `@dnd-kit/sortable` | frontend | Column reorder (Phase 5) |
| `zustand` | frontend | Filter state persistence |
| `clsx` | everywhere | Conditional classes |
| `lucide-react` | everywhere | Filter/sort icons |

---

## File Index

New files to be created:

| File | Phase | Purpose |
|------|-------|---------|
| `frontend/src/hooks/useTableState.ts` | 0 | TanStack Table instance factory hook |
| `frontend/src/hooks/useListFilter.ts` | 2 | match-sorter wrapper for list filtering |
| `frontend/src/utils/filterFunctions.ts` | 0 | Per-field-type filter function registry |
| `frontend/src/stores/tableFilterStore.ts` | 1 | Generic Zustand slice factory for table filters |
| `packages/ui/src/atoms/FilterChip.tsx` | 0 | Removable filter tag |
| `packages/ui/src/molecules/FilterBar.tsx` | 0 | Composed filter bar (search + chips + count) |

Files to be modified (by phase):

| Phase | Files |
|-------|-------|
| 0 | `frontend/package.json`, `pnpm-workspace.yaml`, `packages/ui/src/index.ts` |
| 1 | `composites/DataTableFlat.tsx`, `table-core/UniversalTableCore.tsx`, `stores/tableFilterStore.ts` |
| 2 | All 5 sidebars, `registry/RegistryFilterBar.tsx` |
| 3 | `composites/ActionsTableFlat.tsx`, `DataTableHierarchy.tsx`, `WorkflowActionsTable.tsx`, `ActionRegistryTable.tsx`, `adapters/HierarchyRowModelAdapter.ts` |
| 4 | `composites/InvoiceListView.tsx`, `BillsListView.tsx`, `ExpenseListView.tsx`, `workflows/intake/SubmissionsTable.tsx`, `stores/financeStore.ts` |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TanStack Table v8 API is verbose for simple cases | Developer friction | `useTableState` hook abstracts common patterns. Only power users touch the raw API. |
| Tree-aware filtering in hierarchy tables is complex | Correctness bugs | TanStack Table has built-in `filterFromLeafRows`. Test with deep nesting cases. |
| Filter state bloats Zustand stores | Store complexity | Generic `tableFilterStore` factory isolates per-surface state. Partialize aggressively. |
| ActionRegistryTable rewrite breaks workflow | User-facing regression | Full feature parity checklist: search, expand/collapse, status edit, row menu, import badge, checkbox. |
| Column visibility persistence conflicts across definition schema changes | Stale config | Store column visibility by key, not index. If a key no longer exists in the schema, silently drop it. |
| Performance regression from TanStack Table overhead on small tables | Perceived slowness | Benchmark Phase 1. TanStack Table is designed for headless speed -- overhead is typically <1ms for <1000 rows. |

---

## Success Criteria

When this roadmap is complete:

1. **Every table surface** has filtering, sorting, and column visibility -- using shared infrastructure, not ad-hoc code.
2. **Every sidebar list** has ranked text search using the same FilterBar primitive.
3. **Filter state persists** across page navigation (session) and browser restart (where configured).
4. **Zero API changes** for existing component consumers. Migration is internal.
5. **Visual consistency** across all filter UIs. Same FilterBar, same chips, same sort indicators, same empty state treatment.
6. **The codebase has fewer lines** than before. Ad-hoc filter implementations are replaced by shared hooks and components.
