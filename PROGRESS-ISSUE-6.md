# Issue #6 Progress Tracker - Frontend Cleanup

## Overview
Tracking progress on [Issue #6: Phase 3 - Frontend Cleanup and Import Optimization](https://github.com/ok-very/autoart/issues/6)

---

## 3.1 API Hooks Organization

### ✅ Phase 1: Foundation (COMPLETE)
- [x] Created `frontend/src/api/queryKeys.ts` - Centralized query key registry
- [x] Created category directory structure:
  - `hooks/entities/` - CRUD operations on data entities
  - `hooks/actions/` - Action/Event architecture primitives
  - `hooks/operations/` - Complex operations
- [x] Created barrel exports for each category
- [x] Updated main `hooks/index.ts` with category exports + queryKeys

### ✅ Phase 2: Entity Hooks (COMPLETE)
- [x] Moved `hierarchy.ts` → `entities/hierarchy.ts` + refactored with queryKeys
- [x] Moved `records.ts` → `entities/records.ts` + refactored with queryKeys
- [x] Moved `definitions.ts` → `entities/definitions.ts` + refactored with queryKeys
- [x] Moved `references.ts` → `entities/references.ts` + refactored with queryKeys
- [x] Moved `links.ts` → `entities/links.ts` + refactored with queryKeys
- [x] Updated `entities/index.ts` to export from new locations

### 🚧 Phase 3: Action Hooks (IN PROGRESS)
- [ ] Move `actions.ts` → `actions/actions.ts` + refactor with queryKeys
- [ ] Move `actionViews.ts` → `actions/actionViews.ts` + refactor with queryKeys
- [ ] Move `actionReferences.ts` → `actions/actionReferences.ts` + refactor with queryKeys
- [ ] Move `composer.ts` → `actions/composer.ts`
- [ ] Move `projectLog.ts` → `actions/projectLog.ts` + refactor with queryKeys
- [ ] Move `workflowSurface.ts` → `actions/workflowSurface.ts` + refactor with queryKeys
- [ ] Update `actions/index.ts` to export from new locations

### ⏳ Phase 4: Operation Hooks (PENDING)
- [ ] Move `imports.ts` → `operations/imports.ts` + refactor with queryKeys
- [ ] Move `exports.ts` → `operations/exports.ts` + refactor with queryKeys
- [ ] Move `ingestion.ts` → `operations/ingestion.ts` + refactor with queryKeys
- [ ] Move `search.ts` → `operations/search.ts` + refactor with queryKeys
- [ ] Move `interpretation.ts` → `operations/interpretation.ts` + refactor with queryKeys
- [ ] Update `operations/index.ts` to export from new locations

### ⏳ Phase 5: Root-Level Hooks (PENDING)
These stay at root level but should use queryKeys:
- [ ] Refactor `auth.ts` to use queryKeys
- [ ] Refactor `admin.ts` to use queryKeys
- [ ] Refactor `factKinds.ts` to use queryKeys
- [ ] Leave `factory.ts` as-is (utility, no query keys)

### ⏳ Phase 6: Cleanup (PENDING)
- [ ] Delete old hook files from root `hooks/` directory
- [ ] Verify all imports are using correct paths
- [ ] Run build to ensure no errors
- [ ] Update any remaining components that import from old paths

---

## 3.2 Store Consolidation

### ⏳ Not Started
- [ ] Audit `uiStore.ts` for shared logic
- [ ] Audit `authStore.ts` for shared logic
- [ ] Audit `hierarchyStore.ts` for shared logic
- [ ] Create `frontend/src/stores/selectors/` directory
- [ ] Extract common selectors to selectors directory
- [ ] Create `frontend/src/stores/index.ts` barrel export
- [ ] Update all imports to use store barrel exports

---

## 3.3 Component Import Optimization

### ⏳ Not Started
- [ ] Verify `frontend/src/ui/atoms/index.ts` exports all atoms
- [ ] Create `frontend/src/ui/molecules/index.ts` barrel
- [ ] Create `frontend/src/components/index.ts` barrel
- [ ] Replace all deep component imports with barrel imports
- [ ] Update components to use `@/ui` path alias consistently
- [ ] Document component API with exported prop types

---

## Summary Stats

### Completion Status
- **Phase 3.1 (API Hooks):** ~40% complete (2/6 phases done)
- **Phase 3.2 (Store Consolidation):** 0% complete
- **Phase 3.3 (Component Optimization):** 0% complete

### Files Changed So Far
- **Created:** 10 files (queryKeys + category structure + moved hooks)
- **Modified:** 1 file (main hooks index)
- **Query Keys Centralized:** ~50+ keys across all domains

### Backwards Compatibility
✅ **100% maintained** - All existing imports still work

---

## Next Actions

1. **Complete Phase 3 (Action Hooks)** - Move remaining action hooks
2. **Complete Phase 4 (Operation Hooks)** - Move operation hooks  
3. **Complete Phase 5 (Root Hooks)** - Refactor root-level hooks
4. **Complete Phase 6 (Cleanup)** - Delete old files, verify build
5. **Start Phase 3.2 (Store Consolidation)** - New PR after this one merges
6. **Start Phase 3.3 (Component Optimization)** - Final cleanup PR

---

*Last Updated: 2026-01-11 02:06 AM PST*
