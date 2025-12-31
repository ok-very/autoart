# AutoArt Records Workspace & Ingestion Plan

## Previous Work (COMPLETED)
- ✅ Emoji display fix (migrations updated)
- ✅ CloneExcludedToggle component created
- ✅ Assets workspace basic structure (page, sidebar, grid)
- ✅ Backend bulk operations endpoints
- ✅ Navigation header with Assets link

---

## Current Tasks

### 1. Rename "Asset" → "Record" (Consistency)
Rename all asset-related components to use "record" terminology for consistency.

**Files to Rename:**
| Current | New |
|---------|-----|
| `components/assets/` | `components/records/` |
| `AssetTypeSidebar.tsx` | `RecordTypeSidebar.tsx` |
| `AssetGrid.tsx` | `RecordGrid.tsx` |
| `pages/AssetsPage.tsx` | `pages/RecordsPage.tsx` |

**References to Update:**
- `App.tsx`: Route `/assets` → `/records`, import path
- `Header.tsx`: Navigation label "Assets" → "Records", route, `isAssetsPage` → `isRecordsPage`
- `RecordsPage.tsx`: Import paths for components

**Internal Updates:**
- Component names: `AssetGrid` → `RecordGrid`, etc.
- Interface names: `AssetGridProps` → `RecordGridProps`
- Variables: `assetDefinitions` → `recordDefinitions`
- UI text: "Asset Types" → "Record Types", "No asset types" → "No record types"

---

### 2. Implement `create-definition` Drawer
**Problem:** Clicking "+" in RecordTypeSidebar calls `openDrawer('create-definition')` but drawer doesn't exist.

**New File:** `frontend/src/components/drawer/views/CreateDefinitionView.tsx`

**Features:**
- Form fields: Name, initial fields (optional), styling (color/emoji)
- Uses `useCreateDefinition()` hook
- After success: Close drawer, optionally select new definition

**Register in:** `DrawerRegistry.tsx` - add case for 'create-definition'

---

### 3. Quick Create Menu Enhancement
**Location:** `frontend/src/components/hierarchy/Sidebar.tsx`

**Current:** Shows definition buttons, opens `create-record` drawer with definitionId

**Enhancements Needed:**
1. Add context-awareness: Pass `classificationNodeId` based on current selection
2. Add hierarchy node selector in CreateRecordView:
   - Allow user to select which project/subprocess/task to classify under
   - Dropdown or search combobox for node selection
3. Link quick create visibility to a **`pinned`** flag on definitions

**New Schema Field:** Add `pinned` boolean to RecordDefinition
- New migration: `014_pinned_flag.ts`
- Update backend schema and service
- Add toggle in existing RecordInspector Schema tab (user prefers existing inspector over new drawer)

---

### 4. Records Workspace Features

**A. Filtering by Record Type**
Already implemented in sidebar - selecting a definition filters the grid.

**B. View/Edit Records**
- Clicking a record row → `inspectRecord(id)` opens right panel
- RecordInspector already handles editing

**C. Create New Blank Records**
- "New Record" button in toolbar → `create-record` drawer
- Already implemented

**D. Modify Schema (Definition Editing)**
- Use existing RecordInspector Schema tab (user confirmed preference)
- Add "Edit Schema" context action in RecordTypeSidebar for selected definition
- Opens `view-definition` drawer with definition ID

**E. Clone/Duplicate Records**
Add to RecordGrid row actions:
- "Duplicate" option → `create-record` drawer pre-filled with data

---

### 5. Hook Up Ingestion Engine

**Current State:**
- Backend fully implemented: parsers, preview, import
- IngestionDrawer exists, works for hierarchy nodes
- Opens via Header → Project dropdown → "Import CSV"

**Integration into Records Workspace:**

**Option A: Add to Records Page (Recommended)**
1. Add "Import" button to RecordGrid toolbar (next to "New Record")
2. Opens existing IngestionDrawer
3. Current ingestion creates hierarchy nodes, which is useful for importing project structures

**Option B: Create Records-specific Ingestion**
For importing records (contacts, artworks) rather than hierarchy:
1. Create new parser type for record data
2. New service function: `runRecordIngestion()`
3. Maps CSV columns to definition fields
4. Creates DataRecord entries

**Implementation Plan:**
1. Add "Import" button to RecordGrid toolbar
2. Import button must check if a parser/import script is selected before proceeding
3. Opens existing IngestionDrawer with parser validation
4. Future: Add "Import Records" as separate drawer for bulk record creation

---

### 6. Database Reset & Re-migrate

**Script:** Use existing migration utilities

**Commands:**
```bash
cd backend
npm run db:reset    # or custom script
npm run migrate
npm run seed        # if seed script exists
```

**Files to Check:**
- `backend/package.json` - look for db scripts
- `backend/src/db/migrations/` - ensure all migrations apply cleanly

---

## Implementation Order

1. **Rename Asset → Record** (consistency cleanup)
2. **Implement CreateDefinitionView** drawer
3. **Add quick create flag** to definitions
4. **Enhance CreateRecordView** with node selector
5. **Add Import button** to Records workspace
6. **Reset database** and re-migrate

---

## Critical Files

| Task | File | Action |
|------|------|--------|
| Rename | `components/assets/*` | Rename directory to `records/` |
| Rename | `AssetTypeSidebar.tsx` | Rename to `RecordTypeSidebar.tsx` |
| Rename | `AssetGrid.tsx` | Rename to `RecordGrid.tsx` |
| Rename | `AssetsPage.tsx` | Rename to `RecordsPage.tsx` |
| Rename | `App.tsx` | Update route and import |
| Rename | `Header.tsx` | Update nav labels |
| Drawer | `CreateDefinitionView.tsx` | NEW |
| Drawer | `DrawerRegistry.tsx` | Add case |
| Schema | `014_pinned_flag.ts` | NEW migration |
| Schema | `records.service.ts` | Add field support |
| Schema | `RecordInspector.tsx` | Add toggle in Schema tab |
| Import | `RecordGrid.tsx` | Add Import button |
| DB | Run reset/migrate scripts | Final step |
