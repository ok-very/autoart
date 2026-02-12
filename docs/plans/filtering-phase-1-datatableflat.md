# Phase 1: DataTableFlat Migration

**Goal:** DataTableFlat uses TanStack Table for filtering, sorting, and column visibility state. UniversalTableCore remains the renderer. Existing callers see no API change.

**Parent:** `docs/roadmap-filtering.md` Phase 1

**Status:** Implemented (commit `0147476`)

### Implementation Deviations

1. **Page reset** — Plan specified a `useEffect` to reset page on filter/sort change. Implementation uses a render-time state update (comparing a `filterSortKey` string), which is better — avoids an extra render cycle.
2. **Filtered count in footer** — Plan did not specify this. Implementation shows "12 records of 50" in the footer when filtering is active. Nice UX touch.
3. **Change detection** — `filterSortKey` uses `JSON.stringify` for TanStack state change detection. Works because TanStack state objects have stable key ordering. Minor fragility, acceptable.
4. **`visibleColumns` prop** — Backward-compat code is defensive. No current callers pass `visibleColumns`, but the guard is correct and low-cost.

---

## Current State (as-is)

### DataTableFlat (`frontend/src/ui/composites/DataTableFlat.tsx`, 710 lines)

- Builds `TableColumn[]` from `definition.schema_config.fields`
- Column visibility: `useState<Set<string>>` — ephemeral, resets on remount
- Sorting: fully delegated to UniversalTableCore's internal `useState<SortState>`
- Filtering: none
- Pagination: internal `useState(0)`, slices `records` before passing to RowModel
- Toolbar: features plugin with inline `ColumnPicker` (lines 122-162) — manual open/close via `useState(isOpen)`, no Radix
- Callers: `ProjectWorkflowView`, `RecordView`, `ProjectView`, barrel `index.ts`
- None of the callers pass sort/filter state — all state is internal

### UniversalTableCore (`frontend/src/ui/table-core/UniversalTableCore.tsx`)

- Manages `sortState` via `useState<SortState>(null)`
- Sorts rows in `useMemo` using `sortColumn.sortKey(row)` comparator
- Renders sort indicators (ChevronUp/Down) on click
- No concept of external sort — always re-sorts

### Phase 0 Deliverables (available)

| Asset | Location | API |
|-------|----------|-----|
| `useTableState` | `frontend/src/hooks/useTableState.ts` | `(opts) => Table<TData>` — wraps `useReactTable` with filtering/sorting/pagination row models |
| `filterFunctions` | `frontend/src/utils/filterFunctions.ts` | `fuzzyFilter`, `exactFilter`, `includesFilter`, `dateRangeFilter` — TanStack `FilterFn<any>` |
| `FilterBar` | `packages/ui/src/molecules/FilterBar.tsx` | `(searchQuery, onSearchChange, chips?, resultCount?, children?) => JSX` |
| `FilterChip` | `packages/ui/src/atoms/FilterChip.tsx` | `(label, value?, onRemove) => JSX` |
| `ColumnPicker` (shared) | `packages/ui/src/molecules/ColumnPicker.tsx` | `(allFields: ColumnPickerField[], visibleKeys: Set<string>, onToggle) => JSX` |

---

## Architecture Decision: TanStack Table as State Layer Only

TanStack Table manages **state** (which columns visible, what sort order, what filters). UniversalTableCore remains the **renderer**. The integration point is:

```
useTableState(data, tanstackColumns)
    ↓ table.getRowModel().rows → convert to RowModel
    ↓ table.getState().sorting → drive sort indicators
    ↓ table.getState().columnVisibility → drive column list
    ↓ table.getState().globalFilter → drive FilterBar
DataTableFlat builds CoreTableColumn[] from visible TanStack columns
    ↓
UniversalTableCore renders (with externalSort flag — skip internal sort)
```

TanStack Table does the sorting and filtering. UniversalTableCore just renders pre-sorted, pre-filtered rows and shows sort indicators based on state passed down.

---

## PRs (stacked)

### PR 1: `tableFilterStore` — Zustand persistence factory

**New file:** `frontend/src/stores/tableFilterStore.ts`

A factory function that creates per-definition-id slices for:
- `columnVisibility: Record<definitionId, VisibilityState>` — which columns shown
- `sorting: Record<definitionId, SortingState>` — active sort (session only, not persisted to localStorage)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VisibilityState, SortingState } from '@tanstack/react-table';

interface TableFilterState {
    /** Column visibility per definition ID */
    columnVisibility: Record<string, VisibilityState>;
    /** Sort state per definition ID (session only — not persisted) */
    sorting: Record<string, SortingState>;

    setColumnVisibility: (definitionId: string, visibility: VisibilityState) => void;
    setSorting: (definitionId: string, sorting: SortingState) => void;
    getColumnVisibility: (definitionId: string) => VisibilityState;
    getSorting: (definitionId: string) => SortingState;
}

export const useTableFilterStore = create<TableFilterState>()(
    persist(
        (set, get) => ({
            columnVisibility: {},
            sorting: {},

            setColumnVisibility: (definitionId, visibility) =>
                set((state) => ({
                    columnVisibility: { ...state.columnVisibility, [definitionId]: visibility },
                })),
            setSorting: (definitionId, sorting) =>
                set((state) => ({
                    sorting: { ...state.sorting, [definitionId]: sorting },
                })),
            getColumnVisibility: (definitionId) => get().columnVisibility[definitionId] ?? {},
            getSorting: (definitionId) => get().sorting[definitionId] ?? [],
        }),
        {
            name: 'table-filter-storage',
            version: 1,
            partialize: (state) => ({
                // Persist column visibility only. Sorting is session-ephemeral.
                columnVisibility: state.columnVisibility,
            }),
        }
    )
);
```

**Design notes:**
- Keyed by `definitionId` — each record definition gets its own visibility config
- Column visibility persists across sessions (localStorage)
- Sort state is session-only — persists across navigation but not browser restart
- If a persisted column key no longer exists in the schema, it's silently ignored (TanStack Table's default behavior)
- `partialize` excludes `sorting` — intentional per roadmap tier design

**Files:**
- `frontend/src/stores/tableFilterStore.ts` (new, ~45 lines)

---

### PR 2: `externalSort` flag on UniversalTableCore

**Goal:** When a wrapper provides pre-sorted rows, UniversalTableCore should skip its internal sort but still render sort indicators from external state.

**Changes to `UniversalTableCoreProps`:**

```typescript
// New props
/** When true, rows are already sorted externally. Core skips internal sort. */
externalSort?: boolean;
/** External sort state for rendering indicators when externalSort=true */
externalSortState?: SortState;
/** External sort handler — called instead of internal setSortState */
onSortChange?: (columnId: string) => void;
```

**Changes to sort logic (lines 233-275):**

```typescript
// When externalSort, use external state for indicators but skip sort
const effectiveSortState = externalSort ? (externalSortState ?? null) : sortState;

const sortedRows = useMemo(() => {
    const rows = rowModel.getRows();
    if (externalSort) return rows; // Already sorted by caller
    if (!sortState) return rows;
    // ... existing sort logic unchanged
}, [rowModel, sortState, externalSort, decoratedColumns]);

const handleSort = useCallback((columnId: string) => {
    if (onSortChange) {
        onSortChange(columnId);
        return;
    }
    setSortState(/* existing logic */);
}, [onSortChange]);
```

Sort indicator rendering (lines 372-401) uses `effectiveSortState` instead of `sortState`.

**Backward compatible:** `externalSort` defaults to `false`. All existing callers (DataTableHierarchy, ActionsTableFlat, etc.) continue using internal sort unchanged.

**Files:**
- `frontend/src/ui/table-core/UniversalTableCore.tsx` (~20 lines changed)

---

### PR 3: DataTableFlat internal refactor — TanStack Table integration

This is the main PR. DataTableFlat's internals change; its external `DataTableFlatProps` interface does not.

#### 3a. Build TanStack `ColumnDef<DataRecord>[]`

New `useMemo` that converts `allColumns` (the existing `TableColumn[]` from schema) into TanStack column definitions:

```typescript
const tanstackColumns = useMemo<ColumnDef<DataRecord, any>[]>(() => {
    return allColumns.map((col): ColumnDef<DataRecord, any> => ({
        id: col.key,
        accessorFn: (record) => {
            if (col.key === 'unique_name') return record.unique_name;
            if (col.key === 'updated_at') return record.updated_at ?? '';
            return record.data?.[col.key];
        },
        header: col.label,
        filterFn: getFilterFnForFieldType(col.field?.type),
        enableSorting: col.sortable ?? false,
        enableHiding: true,
    }));
}, [allColumns]);
```

Where `getFilterFnForFieldType` maps field types to filter functions:
- `text` → `fuzzyFilter`
- `status`, `select` → `exactFilter`
- `date` → `dateRangeFilter`
- `tags` → `includesFilter`
- default → `fuzzyFilter`

#### 3b. Initialize `useTableState` with store-backed state

```typescript
const definitionId = definition?.id ?? '';
const storedVisibility = useTableFilterStore((s) => s.getColumnVisibility(definitionId));
const storedSorting = useTableFilterStore((s) => s.getSorting(definitionId));
const setStoredVisibility = useTableFilterStore((s) => s.setColumnVisibility);
const setStoredSorting = useTableFilterStore((s) => s.setSorting);

const table = useTableState({
    data: records,  // Full dataset, not paginated
    columns: tanstackColumns,
    initialSorting: storedSorting,
    initialColumnVisibility: deriveInitialVisibility(visibleColumnsProp, allColumns, storedVisibility),
    initialGlobalFilter: '',
});
```

`deriveInitialVisibility` priority:
1. If `visibleColumnsProp` provided → convert to `VisibilityState` (prop overrides store)
2. If store has saved visibility for this definition → use it
3. Else → first 6 columns visible (current default)

#### 3c. Sync TanStack state back to store

```typescript
// Sync column visibility changes to store
const visibility = table.getState().columnVisibility;
useEffect(() => {
    if (definitionId && !visibleColumnsProp) {
        setStoredVisibility(definitionId, visibility);
    }
}, [visibility, definitionId, visibleColumnsProp, setStoredVisibility]);

// Sync sorting changes to store
const sorting = table.getState().sorting;
useEffect(() => {
    if (definitionId) {
        setStoredSorting(definitionId, sorting);
    }
}, [sorting, definitionId, setStoredSorting]);
```

#### 3d. Derive rows and columns for UniversalTableCore

Replace the current `paginatedRecords → makeFlatRowModel` pipeline with TanStack-driven output:

```typescript
// TanStack handles filtering + sorting. We handle pagination on top.
const filteredSortedRows = table.getFilteredRowModel().rows;
const totalFilteredCount = filteredSortedRows.length;

// Manual pagination (TanStack's getPaginationRowModel exists but we keep
// DataTableFlat's existing page state to avoid API change)
const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return filteredSortedRows.slice(start, start + pageSize);
}, [filteredSortedRows, page, pageSize]);

// Convert to RowModel for UniversalTableCore
const rowModel = useMemo(() => {
    const tableRows: TableRow[] = paginatedRows.map((row) => ({
        id: row.original.id,
        data: row.original,
    }));
    return {
        getRows: () => tableRows,
        capabilities: { selectable: multiSelect },
    };
}, [paginatedRows, multiSelect]);
```

#### 3e. Derive sort state for UniversalTableCore indicators

```typescript
// Convert TanStack sorting to UniversalTableCore's SortState
const coreSortState: SortState = useMemo(() => {
    const ts = table.getState().sorting;
    if (ts.length === 0) return null;
    return { columnId: ts[0].id, direction: ts[0].desc ? 'desc' : 'asc' };
}, [table.getState().sorting]);

// Handle sort clicks from UniversalTableCore headers
const handleSortChange = useCallback((columnId: string) => {
    const current = table.getState().sorting;
    if (current.length > 0 && current[0].id === columnId) {
        if (!current[0].desc) {
            table.setSorting([{ id: columnId, desc: true }]);
        } else {
            table.setSorting([]); // Clear
        }
    } else {
        table.setSorting([{ id: columnId, desc: false }]);
    }
}, [table]);
```

Pass to UniversalTableCore:
```tsx
<UniversalTableCore
    externalSort
    externalSortState={coreSortState}
    onSortChange={handleSortChange}
    // ... rest unchanged
/>
```

#### 3f. Replace internal ColumnPicker with shared

Delete the inline `ColumnPicker` (lines 116-162). Replace the feature plugin:

```typescript
import { ColumnPicker, type ColumnPickerField } from '@autoart/ui';

// In features memo:
const columnPickerFields: ColumnPickerField[] = allColumns.map((col) => ({
    fieldName: col.key,
    label: col.label,
}));

const visibleKeys = new Set(
    allColumns.filter((col) => table.getColumn(col.key)?.getIsVisible()).map((c) => c.key)
);

// Feature plugin
{
    id: 'column-picker',
    renderToolbarRight: () => (
        <ColumnPicker
            allFields={columnPickerFields}
            visibleKeys={visibleKeys}
            onToggle={(fieldName) => {
                const column = table.getColumn(fieldName);
                column?.toggleVisibility();
            }}
        />
    ),
}
```

#### 3g. Add FilterBar as toolbar feature

```typescript
import { FilterBar } from '@autoart/ui';

// New feature plugin
{
    id: 'filter-bar',
    renderToolbarLeft: () => (
        <FilterBar
            searchQuery={table.getState().globalFilter ?? ''}
            onSearchChange={(query) => table.setGlobalFilter(query)}
            resultCount={totalFilteredCount}
            placeholder={`Filter ${definition?.name || 'records'}...`}
        />
    ),
}
```

FilterBar is the left toolbar content. ColumnPicker stays right. This matches the roadmap wireframe.

**Note:** Filter chips for per-column filters are Phase 1 stretch. GlobalFilter (text search across all columns) is the Phase 1 deliverable. Column-specific filter chips come in Phase 3 when more column types need them.

#### 3h. Reset page on filter/sort change

```typescript
// Reset to page 0 when filter or sort changes
const globalFilter = table.getState().globalFilter;
const columnFilters = table.getState().columnFilters;
useEffect(() => {
    setPage(0);
}, [globalFilter, columnFilters, sorting]);
```

#### 3i. Update `visibleColumnKeys` derivation

Remove the old `internalVisibleKeys` useState. The new source of truth is TanStack Table's `columnVisibility` state:

```typescript
const displayColumns = useMemo(() => {
    return allColumns.filter((col) => {
        const tsCol = table.getColumn(col.key);
        return tsCol ? tsCol.getIsVisible() : true;
    });
}, [allColumns, table.getState().columnVisibility]);
```

#### 3j. Backward compatibility: `visibleColumnsProp`

When `visibleColumnsProp` is provided by a caller, it takes precedence over TanStack state:

```typescript
// On mount and when visibleColumnsProp changes
useEffect(() => {
    if (visibleColumnsProp) {
        const visibility: VisibilityState = {};
        allColumns.forEach((col) => {
            visibility[col.key] = visibleColumnsProp.includes(col.key);
        });
        table.setColumnVisibility(visibility);
    }
}, [visibleColumnsProp, allColumns, table]);
```

This means callers that pass `visibleColumns` still control visibility. Callers that don't get store-backed persistence.

**Files:**
- `frontend/src/ui/composites/DataTableFlat.tsx` (major refactor, net line delta ~+40)

---

### PR 4: Cleanup and type exports

- Delete `frontend/src/ui/molecules/ColumnPicker.tsx` (the old stub left after Phase 0 move — check if it still exists)
- Remove the `Columns` icon import from DataTableFlat (no longer needed — shared ColumnPicker handles it)
- Re-export `ColumnPickerField` type from composites barrel if callers need it
- Update the `TableColumn` export from DataTableFlat (no change to interface, but verify)

**Files:**
- `frontend/src/ui/molecules/ColumnPicker.tsx` (delete if still present)
- `frontend/src/ui/composites/DataTableFlat.tsx` (cleanup dead imports)

---

## What Changes for Callers

**Nothing.** The `DataTableFlatProps` interface is identical. The three callers continue passing:
- `records`, `definition`, `visibleColumns?`, `onRowSelect`, `onCellChange`, etc.

Behavioral changes they'll notice:
- Column visibility persists across navigation (was ephemeral)
- A filter bar appears in the toolbar (new, additive)
- Sorting uses TanStack's stable sort (was Array.sort in UniversalTableCore)

---

## What Does NOT Change

- `UniversalTableCore` rendering (rows, cells, resize, sticky header/footer)
- `TableRow`, `RowModel`, `CoreTableColumn` types (unchanged)
- `features.ts` TableFeature interface (unchanged)
- `EditableCell` / `DataFieldWidget` cell renderers (unchanged)
- `buildFieldViewModel` calls (unchanged)
- Selection (multi-select checkboxes) — stays in DataTableFlat, independent of TanStack
- Pagination UI and state — stays as useState in DataTableFlat
- `SelectableWrapper` collection mode wrapping (unchanged)
- Status summary footer (unchanged)

---

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| TanStack sort order differs from UniversalTableCore sort | Users see different row order after migration | Test with identical data: compare old sort output vs new. TanStack uses `sortingFns.alphanumeric` by default — verify it matches existing `localeCompare` behavior. |
| `externalSort` flag breaks existing tables | Other tables that use UniversalTableCore stop sorting | Default `false`. No existing caller passes `externalSort`. |
| `visibleColumnsProp` and store visibility conflict | Stale store state overrides prop | Prop always wins — `useEffect` syncs prop → TanStack state. Store only updates when prop is absent. |
| Store grows unbounded with many definitions | localStorage bloat | Each definition stores ~10-20 column keys. At 100 definitions = ~5KB. Not a concern. |
| FilterBar `globalFilter` performance on 1000+ rows | Typing lag | TanStack's `getFilteredRowModel` is designed for this scale. `fuzzyFilter` uses `rankItem` which is O(n). Measure after implementation. |
| `useEffect` for store sync causes extra renders | Performance regression | `useEffect` runs after render, only on state change. Zustand's `set` batches. Should be imperceptible. |

---

## Verification Checklist

After all PRs merged, verify in the running app:

1. **Records panel** — Open any project with records. Table renders as before.
2. **Sort** — Click column header. Arrow indicator appears. Rows reorder. Click again for desc. Click third time to clear. Order matches expectations for text, numbers, dates.
3. **Column picker** — Click Columns icon. Dropdown shows all schema fields. Toggle one off — column disappears. Toggle back on — column reappears. Uses Radix dropdown (not the old manual popover).
4. **Column persistence** — Toggle columns. Navigate away. Return. Columns remain as configured. Refresh browser. Columns remain.
5. **Filter bar** — Type in filter input. Rows filter in real-time (150ms debounce). Result count badge updates. Clear input — all rows return.
6. **Pagination** — With 50+ records: filter reduces to <50, pagination disappears. Clear filter — pagination returns.
7. **`visibleColumns` prop override** — ProjectWorkflowView passes `visibleColumns` for some tables. Verify those tables still respect the prop (no store override).
8. **Multi-select** — Checkboxes still work. Select all on page. Verify count.
9. **Inline editing** — Click a cell to edit. Save. Value persists. Editing unaffected by TanStack wrapper.
10. **Empty state** — Filter all rows out. Table shows header + "0 of N records" message (per DESIGN.md: no empty state illustrations).

---

## Sequence

```
PR 1: tableFilterStore (new file, no deps)
PR 2: externalSort flag (UniversalTableCore change, no deps)
PR 3: DataTableFlat refactor (depends on PR 1 + PR 2)
PR 4: Cleanup (depends on PR 3)
```

PRs 1 and 2 are independent — can be implemented in parallel on separate stacked branches. PR 3 depends on both. PR 4 is post-refactor cleanup.
