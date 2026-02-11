# Phase 2: Sidebar List Filtering

**Goal:** All definition-list sidebars use the shared `FilterBar` primitive with `match-sorter` ranked search. Consistent search UX replaces three independent ad-hoc implementations.

**Parent:** `docs/roadmap-filtering.md` Phase 2

---

## Current State (as-is)

### DefinitionListSidebar (`frontend/src/ui/sidebars/DefinitionListSidebar.tsx`, ~216 lines)

- Filters definitions by `definitionKind` prop (record or action_arrangement)
- Search: `useState<string>` → `.toLowerCase().includes()` — no ranking, no debounce
- Sort: `useState<RegistrySortKey>('name')` — name/created/updated via RegistryFilterBar's `<Select>`
- Uses `RegistryFilterBar` component (search + kind filter + sort select + result count badge)
- Passes `hideKindFilter` because the panel already scopes to one kind, making the kind filter redundant
- Renders: header → RegistryFilterBar → "All" option → definition items with icon/name/count/edit button
- Callers: `RecordsPanel`, `ActionsPanel`, `RecordsPage`, `ActionsPage` (4 consumers)
- Uses `--ws-*` tokens correctly (most DESIGN.md-compliant sidebar)

### RecordTypeSidebar (`frontend/src/ui/sidebars/RecordTypeSidebar.tsx`, ~211 lines)

- Filters to `definition_kind === 'record'` (hardcoded)
- Search: `useState<string>` → `.toLowerCase().includes()` — no ranking, no debounce, no sort
- Inline `<input>` with manual search icon positioning (not using TextInput atom)
- DESIGN.md violations: `bg-blue-100`, `text-blue-800`, `hover:bg-slate-100`, `focus:ring-2 focus:ring-blue-500` — should use `--ws-*` tokens
- Empty state says "No matching types" / "Create your first type" — violates DESIGN.md ("no empty states")
- Caller: `RecordPage` (1 consumer)

### RegistrySidebar (`frontend/src/ui/sidebars/RegistrySidebar.tsx`, ~299 lines)

- Filters to `definition_kind === 'record'` (hardcoded for the records section)
- Search: `useState<string>` → `.toLowerCase().includes()` — no ranking, no debounce, no sort
- Inline `<input>` with manual search icon positioning (same pattern as RecordTypeSidebar)
- Two collapsible sections: "Data Definitions" (record definitions) and "Events & Facts" (event-catalog, fact-kinds)
- Search only applies to record definitions, not to the Events & Facts section (which has hardcoded items)
- DESIGN.md violations: same as RecordTypeSidebar — `bg-blue-100`, `text-blue-800`, `hover:bg-slate-100`, `text-blue-500`
- Caller: exported via sidebars barrel, **no direct consumers found** (may be unused or reached through barrel)

### ProjectSidebar + HierarchySidebar (tree views — **deferred**)

- Nearly identical components (~214 lines each)
- Show: project selector dropdown → process selector → tree view of stages
- No search or filtering of any kind
- Content is a hierarchy tree rendered via `<TreeNode>` components
- Item count: 5-15 nodes typically
- These are **tree views, not list views**. Adding search requires tree-aware filtering (ancestor retention when a descendant matches). This is the same problem Phase 3 solves for `DataTableHierarchy`.
- **Decision:** Defer to Phase 3. The `useListFilter` hook is for flat lists. Tree-aware search is a different utility. Low item counts mean the filtering value is minimal.

### RegistryFilterBar (`frontend/src/ui/registry/RegistryFilterBar.tsx`, 135 lines)

- Used by: DefinitionListSidebar only
- Provides: search input (TextInput + Search icon), definition kind filter (Select), sort control (Select), result count (Badge)
- Not debounced — `onSearchChange` fires on every keystroke
- Built from @autoart/ui atoms (TextInput, Select, Badge)
- Will be **replaced** by the shared `FilterBar` from packages/ui + sort control additions

### Summary of What's Duplicated

| Feature | DefinitionListSidebar | RecordTypeSidebar | RegistrySidebar |
|---------|----------------------|-------------------|-----------------|
| Search input | RegistryFilterBar (TextInput) | Raw `<input>` | Raw `<input>` |
| Search logic | `.includes()` | `.includes()` | `.includes()` |
| Debounce | None | None | None |
| Sort | name/created/updated Select | None | None |
| Result count | Badge via RegistryFilterBar | None | None |
| DESIGN.md compliant | Yes | No | No |

---

## Phase 0/1 Deliverables (available)

| Asset | Location | API |
|-------|----------|-----|
| `FilterBar` | `packages/ui/src/molecules/FilterBar.tsx` | `(searchQuery, onSearchChange, chips?, resultCount?, placeholder?, children?, className?) => JSX` — 150ms debounced, `--ws-*` tokens, h-10, search icon |
| `FilterChip` | `packages/ui/src/atoms/FilterChip.tsx` | `(label, value?, onRemove) => JSX` |
| `match-sorter` | `packages/ui/package.json` | Available as dependency — ranking-based fuzzy matching |
| `@tanstack/match-sorter-utils` | `frontend/package.json` | Available — provides `rankItem` used by TanStack Table's fuzzy filter |

---

## Architecture Decision: `useListFilter` Hook

A lightweight hook that wraps `match-sorter` for flat list filtering with ranked results:

```typescript
import { matchSorter } from 'match-sorter';

interface UseListFilterOptions<T> {
    /** Keys to match against (passed to match-sorter) */
    keys: Array<keyof T | string | { key: keyof T | string; threshold?: number }>;
    /** Sort comparator applied after filtering (default: match-sorter ranking) */
    sortFn?: (a: T, b: T) => number;
}

function useListFilter<T>(
    items: T[],
    searchQuery: string,
    options: UseListFilterOptions<T>
): T[]
```

**Why match-sorter, not `.includes()`:**
- Ranks results: exact match > starts-with > word-starts-with > contains
- Handles diacritics and case insensitivity
- Users typing "con" see "Contact" before "Reconciliation" (starts-with ranks higher than contains)
- 3.5KB, already a transitive dependency

**Why a hook, not a utility function:**
- Memoizes the filtered result (`useMemo`) to avoid re-filtering on every render
- Accepts the same parameters as the component state flows naturally
- Consistent API across all sidebars

**Interaction with sort:**
When `searchQuery` is non-empty, match-sorter's ranking determines order (best match first). When empty, the optional `sortFn` applies (e.g., alphabetical for DefinitionListSidebar). This means sort controls are disabled or dimmed during active search — ranking takes priority.

---

## PRs (stacked)

### PR 1: `useListFilter` hook

**New file:** `frontend/src/hooks/useListFilter.ts`

```typescript
import { useMemo } from 'react';
import { matchSorter, type MatchSorterOptions } from 'match-sorter';

export interface UseListFilterOptions<T> {
    /** Keys to match against. Supports nested paths and threshold overrides. */
    keys: MatchSorterOptions<T>['keys'];
    /** Sort comparator when search is empty. When searching, match-sorter ranking applies. */
    sortFn?: (a: T, b: T) => number;
}

export function useListFilter<T>(
    items: T[],
    searchQuery: string,
    options: UseListFilterOptions<T>,
): T[] {
    const { keys, sortFn } = options;

    return useMemo(() => {
        const trimmed = searchQuery.trim();

        if (!trimmed) {
            // No search: apply sort if provided, else return original order
            return sortFn ? [...items].sort(sortFn) : items;
        }

        // match-sorter returns results ranked by relevance
        return matchSorter(items, trimmed, { keys });
    }, [items, searchQuery, keys, sortFn]);
}
```

**Design notes:**
- `keys` uses match-sorter's native key format — supports strings, nested paths (`'styling.icon'`), and per-key threshold overrides
- When `searchQuery` is empty, falls through to `sortFn` — this preserves DefinitionListSidebar's sort behavior
- When `searchQuery` is active, match-sorter ranking always wins — sort dropdown becomes irrelevant
- `useMemo` dependency on `keys` means callers should stabilize the keys array (either module-level const or `useMemo`)
- No debounce here — that's FilterBar's responsibility (already 150ms debounced)

**Files:**
- `frontend/src/hooks/useListFilter.ts` (new, ~30 lines)

---

### PR 2: DefinitionListSidebar — FilterBar + useListFilter

The most complex sidebar migration. Replaces RegistryFilterBar with shared FilterBar, replaces `.includes()` with match-sorter ranking.

#### 2a. Replace RegistryFilterBar import with FilterBar

```typescript
// Remove
import { RegistryFilterBar, type RegistrySortKey } from '../registry/RegistryFilterBar';

// Add
import { FilterBar } from '@autoart/ui';
import { useListFilter } from '../../hooks/useListFilter';
```

#### 2b. Replace search + sort logic with useListFilter

Current (lines 42-77):
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [sortKey, setSortKey] = useState<RegistrySortKey>('name');

const searchedDefinitions = useMemo(() => {
    const filtered = searchQuery.trim()
        ? filteredDefinitions.filter((def) =>
            def.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : filteredDefinitions;
    return [...filtered].sort((a, b) => { /* sort switch */ });
}, [filteredDefinitions, searchQuery, sortKey]);
```

New:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [sortKey, setSortKey] = useState<'name' | 'created'>('name');

const DEFINITION_FILTER_KEYS = ['name'] as const;

const sortFn = useMemo(() => {
    switch (sortKey) {
        case 'name':
            return (a: RecordDefinition, b: RecordDefinition) => a.name.localeCompare(b.name);
        case 'created':
            return (a: RecordDefinition, b: RecordDefinition) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
            return undefined;
    }
}, [sortKey]);

const searchedDefinitions = useListFilter(filteredDefinitions, searchQuery, {
    keys: DEFINITION_FILTER_KEYS,
    sortFn,
});
```

**Notes:**
- `RegistrySortKey` had 'updated' but the handler fell through to 'created' anyway (definitions don't have `updated_at`). Drop it.
- `DEFINITION_FILTER_KEYS` is a module-level const — stable reference for `useMemo` inside the hook.
- When searching, match-sorter ranking replaces alphabetical sort automatically.

#### 2c. Replace RegistryFilterBar JSX with FilterBar

Current (lines 123-133):
```tsx
<RegistryFilterBar
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    definitionKind={null}
    onDefinitionKindChange={() => {}}
    sortKey={sortKey}
    onSortChange={setSortKey}
    resultCount={searchedDefinitions.length}
    hideKindFilter
/>
```

New:
```tsx
<FilterBar
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    resultCount={searchedDefinitions.length}
    placeholder={`Filter ${title.toLowerCase()}...`}
>
    {/* Sort control as right-side child */}
    <select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value as 'name' | 'created')}
        className="text-xs bg-transparent border border-ws-panel-border rounded px-1.5 py-0.5 text-ws-text-secondary"
        style={{ outline: 'none' }}
    >
        <option value="name">Name</option>
        <option value="created">Created</option>
    </select>
</FilterBar>
```

**Notes:**
- FilterBar's `children` slot holds the sort control. This keeps FilterBar domain-agnostic while allowing DefinitionListSidebar's sort.
- Using a native `<select>` instead of the `Select` atom for the sort control — it's a 2-option mini-control that doesn't warrant the full Select treatment. If this feels wrong, swap for `Select size="xs"`.
- The `definitionKind` filter and `hideKindFilter` prop are removed — they were always hidden (`hideKindFilter={true}`) and the `onDefinitionKindChange` was a no-op.

#### 2d. Behavioral changes

- **Search is now debounced** (150ms via FilterBar) — previously immediate on every keystroke
- **Search is now ranked** — "Con" returns "Contact" before "Reconciliation Report" (starts-with > contains)
- **Result count badge** — now displayed via FilterBar's built-in badge (was RegistryFilterBar's Badge)
- **Sort dropdown** — moved from RegistryFilterBar's `Select` to inline `<select>` in FilterBar children slot. Smaller, less prominent. When searching, sort is irrelevant (ranking wins) — consider disabling it during active search.

**Files:**
- `frontend/src/ui/sidebars/DefinitionListSidebar.tsx` (~15 lines changed)

---

### PR 3: RecordTypeSidebar — FilterBar + useListFilter + DESIGN.md cleanup

#### 3a. Replace inline search with FilterBar + useListFilter

Current search (lines 30-42 + 80-95):
```typescript
const [searchQuery, setSearchQuery] = useState('');
const filteredDefinitions = searchQuery.trim()
    ? recordDefinitions.filter((def) =>
        def.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : recordDefinitions;

// JSX: raw <input> with manual <Search> icon
```

New:
```typescript
import { FilterBar } from '@autoart/ui';
import { useListFilter } from '../../hooks/useListFilter';

const [searchQuery, setSearchQuery] = useState('');
const filteredDefinitions = useListFilter(recordDefinitions, searchQuery, {
    keys: ['name'],
    sortFn: (a, b) => a.name.localeCompare(b.name),
});

// JSX: Replace the search div (lines 80-95) with:
<FilterBar
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    resultCount={filteredDefinitions.length}
    placeholder="Filter record types..."
/>
```

#### 3b. DESIGN.md token migration

Replace Tailwind color classes with `--ws-*` token equivalents:

| Current | Replacement | Occurrences |
|---------|------------|-------------|
| `bg-blue-100` | `bg-ws-row-expanded-bg` | Selected item background |
| `text-blue-800` | `text-ws-fg` | Selected item text |
| `hover:bg-slate-100` | `hover:bg-ws-row-expanded-bg` | Hover state |
| `text-blue-600` / `hover:text-blue-600` | `text-ws-accent` / `hover:text-ws-accent` | Action buttons |
| `hover:bg-blue-50` | `hover:bg-ws-row-expanded-bg` | Action button hover |
| `focus:ring-2 focus:ring-blue-500` | Removed (FilterBar handles focus) | Search input |
| `border-slate-300 border-t-blue-500` (spinner) | `<Spinner size="sm" />` from @autoart/ui | Loading state |

#### 3c. Remove empty state violation

Current (lines 124-137):
```tsx
<div className="text-center py-8">
    <p className="text-sm text-ws-muted">
        {searchQuery ? 'No matching types' : 'No record types defined'}
    </p>
    {!searchQuery && (
        <button onClick={handleCreateDefinition} className="mt-2 text-xs text-blue-600 hover:underline">
            Create your first type
        </button>
    )}
</div>
```

Per DESIGN.md: "There are no empty states. Fields exist but are blank."

Replace with:
```tsx
<div className="py-8 px-4">
    <p className="text-xs text-ws-text-secondary">
        {searchQuery ? `0 of ${recordDefinitions.length} types` : ''}
    </p>
</div>
```

When search is active and no results match, show "0 of N types" (matches Phase 1's DataTableFlat pattern). When no search and no definitions, show nothing — the empty list speaks for itself.

**Files:**
- `frontend/src/ui/sidebars/RecordTypeSidebar.tsx` (~25 lines changed)

---

### PR 4: RegistrySidebar — FilterBar + useListFilter + DESIGN.md cleanup

#### 4a. Replace inline search with FilterBar + useListFilter

Same pattern as PR 3. The complication: RegistrySidebar has two collapsible sections. Search should filter the record definitions section but not the hardcoded Events & Facts section (which has exactly 2 items: "Event Types" and "Fact Kinds").

```typescript
import { FilterBar } from '@autoart/ui';
import { useListFilter } from '../../hooks/useListFilter';

const [searchQuery, setSearchQuery] = useState('');

// Replace filterRecordsBySearch
const filteredRecords = useListFilter(recordDefinitions, searchQuery, {
    keys: ['name'],
    sortFn: (a, b) => a.name.localeCompare(b.name),
});
```

Replace the search `<div>` (lines 85-100) with:
```tsx
<FilterBar
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    resultCount={filteredRecords.length}
    placeholder="Filter definitions..."
/>
```

**Cross-section search decision:** For Phase 2, search only applies to record definitions (same as current behavior). The Events & Facts section has 2 hardcoded items — filtering them adds complexity for zero value. If a future phase adds dynamic fact kinds, the search can be extended.

#### 4b. DESIGN.md token migration

Same token replacements as PR 3 — `bg-blue-100` → `bg-ws-row-expanded-bg`, etc. RegistrySidebar has the same violations.

Additional fixes:
- `bg-slate-100` count badges → `bg-ws-row-expanded-bg` or `Badge variant="neutral" size="sm"`
- `text-blue-500` section icons → `text-ws-accent`
- Spinner replacement: inline `border-t-blue-500` spinner → `<Spinner size="sm" />`

**Files:**
- `frontend/src/ui/sidebars/RegistrySidebar.tsx` (~25 lines changed)

---

### PR 5: Deprecate RegistryFilterBar

After PRs 2-4, RegistryFilterBar has **zero consumers**. Its only caller was DefinitionListSidebar (PR 2 removes it).

**Options:**
1. **Delete it.** It's unused. The shared `FilterBar` from packages/ui replaces it fully.
2. **Keep as deprecated.** Add `@deprecated` JSDoc, remove from barrel export.

**Recommendation:** Delete. It's 135 lines of domain-specific filter bar that duplicates what FilterBar does generically. The sort control lives inline in DefinitionListSidebar now. The kind filter was always hidden.

**Changes:**
- Delete `frontend/src/ui/registry/RegistryFilterBar.tsx`
- Remove export from `frontend/src/ui/registry/index.ts`:
  ```typescript
  // Remove these lines
  export { RegistryFilterBar } from './RegistryFilterBar';
  export type { RegistryFilterBarProps, RegistrySortKey } from './RegistryFilterBar';
  ```
- Verify no other imports reference `RegistryFilterBar` or `RegistrySortKey`

**Files:**
- `frontend/src/ui/registry/RegistryFilterBar.tsx` (delete)
- `frontend/src/ui/registry/index.ts` (remove 2 lines)

---

## Deferred: ProjectSidebar + HierarchySidebar

The roadmap lists these as Phase 2 tasks 5-6. After analysis, they are **deferred to Phase 3** because:

1. **They are tree views, not lists.** The main content is a hierarchy of stages and subprocesses rendered via `<TreeNode>`. `useListFilter` operates on flat arrays — it cannot do ancestor retention (keep parent visible when child matches).
2. **Item counts are tiny.** 5-15 tree nodes per project. Filtering adds negligible value for these counts.
3. **They are near-identical copies.** Both components share 90%+ code. The right Phase 2 investment would be deduplication (extract a shared `ProjectTreeSidebar`), not adding search to two copies of the same code.
4. **Tree-aware filtering is a Phase 3 concern.** Phase 3 introduces `filterFromLeafRows` for DataTableHierarchy. The same utility pattern can serve sidebar trees.

If desired, a quick win for these sidebars is adding a search to the project selector Menu dropdown (filtering the project list when there are 10+ projects). This is trivial and uses `useListFilter` on the projects array, but it filters the dropdown, not the sidebar tree.

---

## What Changes for Callers

**Nothing.** All sidebar props interfaces are unchanged:
- `DefinitionListSidebarProps` — `width`, `selectedDefinitionId`, `onSelectDefinition`, `definitionKind`
- `RecordTypeSidebarProps` — `width`, `selectedDefinitionId`, `onSelectDefinition`
- `RegistrySidebarProps` — `width`, `selectedDefinitionId`, `onSelectDefinition`, `activeSection`

Behavioral changes callers will notice:
- **Search is debounced** (150ms via FilterBar) — was immediate
- **Search ranks results** — best match first, not insertion order
- **FilterBar replaces inline search** — consistent h-10 bar with icon, same across all sidebars
- **DESIGN.md compliance** — RecordTypeSidebar and RegistrySidebar drop Tailwind color classes for `--ws-*` tokens
- **No "Create your first type" empty state** — silence replaces encouragement

---

## What Does NOT Change

- Sidebar layout (header → filter → list → footer pattern)
- Selection behavior (click item → `onSelectDefinition` fires)
- "All Records/Actions" option at top of list
- Definition item rendering (icon, name, count, hover edit button)
- RegistrySidebar collapsible sections and section toggle behavior
- Events & Facts section (hardcoded items, not searchable)
- Data sources (`useRecordDefinitions()`, `useRecordStats()`, `useFactKindStats()`)
- ProjectSidebar / HierarchySidebar (untouched in this phase)
- Loading states (Spinner shown while data loads)

---

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| match-sorter ranking feels wrong for very short lists (5 items) | Users expect alphabetical, get ranked | When `searchQuery` is empty, `sortFn` applies (alphabetical). Ranking only activates during active search. With 5 items, the visual difference is minimal. |
| FilterBar 150ms debounce feels sluggish for sidebar search | Perceived lag vs current instant filter | 150ms is the standard FilterBar debounce. With small lists (<50 items), the filter is so fast that the debounce is the only delay. If feedback is negative, FilterBar could accept a `debounceMs` prop override. |
| RegistryFilterBar deletion orphans `RegistrySortKey` type | Any external consumer of the type breaks | Check for imports of `RegistrySortKey` outside DefinitionListSidebar. Currently only DefinitionListSidebar uses it. The type becomes an inline union `'name' | 'created'` in PR 2. |
| DESIGN.md cleanup in RecordTypeSidebar/RegistrySidebar changes visual appearance | Subtle color shifts from Tailwind blues to `--ws-*` muted palette | This is intentional — aligning with the design system. Selected items shift from `bg-blue-100` (bright) to `bg-ws-row-expanded-bg` (muted). The change should feel more cohesive with the rest of the app. |
| RegistrySidebar may be unused (no direct callers found) | Wasted effort migrating dead code | Verify via barrel export. If truly unreachable, delete it instead of migrating. Check workspace panel registry for dynamic references. |
| `useListFilter` keys array reference instability | Re-filtering on every render if keys are inline | Document that keys should be a module-level const or `useMemo`. All three sidebars use `['name']` which can be a shared const. |

---

## Verification Checklist

After all PRs merged, verify in the running app:

1. **Records panel sidebar** — Open Records. Sidebar shows definition list with FilterBar. Type "con" — definitions with "Contact" rank above "Reconciliation" (starts-with > contains). Clear search — alphabetical order restored.
2. **Actions panel sidebar** — Open Actions. Same FilterBar. Sort dropdown present (Name/Created). Switch sort to Created — definitions reorder by creation date. Type search query — sort dropdown becomes secondary to ranking.
3. **Record type sidebar** — Navigate to a single record type view. Sidebar shows FilterBar. Search works. Selection highlights use `--ws-row-expanded-bg` (not blue-100). No "Create your first type" CTA.
4. **Registry sidebar** — If reachable: open registry. FilterBar searches record definitions. Collapsible sections still toggle. Events & Facts section unaffected by search. Search icon and styling match other sidebars.
5. **Result counts** — Each sidebar shows result count badge in FilterBar. Filters update count. Zero results: silent (no encouragement messages).
6. **Debounce** — Type quickly in any sidebar search. No jank, no flash of unfiltered content. Results appear ~150ms after typing stops.
7. **Empty search** — Clear search input. All items return. Sort order applies (alphabetical by default).
8. **No regressions** — Selection, navigation, create/edit overlays, hover buttons all work as before.

---

## Sequence

```
PR 1: useListFilter hook (new file, no deps)
PR 2: DefinitionListSidebar migration (depends on PR 1)
PR 3: RecordTypeSidebar + DESIGN.md cleanup (depends on PR 1)
PR 4: RegistrySidebar + DESIGN.md cleanup (depends on PR 1)
PR 5: RegistryFilterBar deletion (depends on PR 2)
```

PRs 2, 3, and 4 are independent of each other — they depend only on PR 1. In a stacked PR workflow, the stack order would be: PR 1 → PR 2 → PR 3 → PR 4 → PR 5 (linear for review clarity, even though 2-4 don't depend on each other).

PR 5 must come after PR 2 because PR 2 removes the last consumer of RegistryFilterBar.
