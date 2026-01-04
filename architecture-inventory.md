# Architecture Inventory & Deprecation Plan

**Status:** Living Document
**Last Updated:** 2026-01-03

## 1. System Overview

The system is transitioning from a direct CRUD model to an **Action-Event** driven architecture, centered around the **Composer** module.

### Core Modules (New System)

| Module | Location | Purpose | Key Endpoints |
|---|---|---|---|
| **Composer** | `backend/src/modules/composer` | Single entry point for creating work items (Tasks, Bugs) via the Action+Event model. | `POST /composer`<br>`POST /composer/quick/task`<br>`POST /composer/quick/bug` |
| **Actions** | `backend/src/modules/actions` | Manages "Intents" or actions that trigger workflows. Actions are immutable. | `POST /actions`<br>`GET /actions/:id` |
| **Events** | `backend/src/modules/events` | Event stream handling side-effects of Actions. | - |
| **Drawers** | `frontend/src/components/drawer` | Unified UI for contextual views, replacing Modals. | N/A |

### Active Modules (Standard)

| Module | Location | Purpose |
|---|---|---|
| **Auth** | `backend/src/modules/auth` | Authentication & Sessions. |
| **Hierarchy** | `backend/src/modules/hierarchy` | Tree/Hierarchy visualization and management. |
| **Ingestion** | `backend/src/modules/ingestion` | Data import parsers (e.g., Airtable). |
| **Search** | `backend/src/modules/search` | Global search functionality. |
| **Links** | `backend/src/modules/links` | Record-to-record relationships. |

## 2. Legacy Inventory

Components identified as deprecated or superseded by the new system.

| Component | Location | Status | Replacement |
|---|---|---|---|
| **Modals** | `frontend/src/components/modals` | **Dead Code** | `frontend/src/components/drawer` |
| **Legacy Task Tables** | `TaskDataTable.tsx` | **Removed** | `DataTableHierarchy` / `DataTableFlat` |
| **Ingestion Drawer** | `IngestionDrawer.tsx` | **Removed** | Ingestion View Mode |
| **Project Templates** | `cloneProjectTemplates` | **Removed** | `cloneProjectDefinitions` |

---

## 3. Deprecation Proposals

### Proposal 1: Remove `frontend/src/components/modals` Directory

**Reasoning:**
The `modals` directory contains `AddFieldModal.tsx`, `ConfirmDeleteModal.tsx`, `CreateNodeModal.tsx`, and `Modal.tsx`.
- **Investigation:** A grep search for `from .*modals` in `frontend/src` returned **0 results**.
- **Conclusion:** These files are completely disconnected from the application.
- **Risk:** None. The code is unreachable.

**Action:** Delete the directory.

### Proposal 2: Enforce Composer for All Creations

**Reasoning:**
The `composer` module (`POST /composer`) is designed as the single entry point for creating task-like entities to ensure proper Action/Event generation.
- **Observation:** Direct creation endpoints might still exist in legacy modules (e.g. `records` or `tasks` old endpoints), though `Composer` is now the preferred path.
- **Recommendation:** Audit `records.routes.ts` or `hierarchy.routes.ts` for direct CREATE operations and mark them as `@deprecated`.

### Proposal 3: Clean up `clone_excluded` Logic

**Reasoning:**
Documentation mentions `project_id` on `record_definitions` as driving template library logic, and it's potentially legacy.
- **Action:** Verify if `clone_excluded` fully covers the requirement and remove the old `project_id` based logic if unused.
