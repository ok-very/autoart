# Architecture Inventory & Deprecation Plan

**Status:** Living Document
**Last Updated:** 2026-01-29

## 1. System Overview

The system uses an **Action-Event** driven architecture, centered around the **Composer** module. All mutations flow through Composer → Actions → Events.

### Core Modules

| Module | Location | Purpose | Key Endpoints |
|---|---|---|---|
| **Composer** | `backend/src/modules/composer` | Single entry point for creating work items via the Action+Event model. See [Composer Guide](./composer/composer-guide.md). | `POST /composer` |
| **Actions** | `backend/src/modules/actions` | Manages "Intents" or actions that trigger workflows. Actions are immutable. | `POST /actions`<br>`GET /actions/:id` |
| **Events** | `backend/src/modules/events` | Event stream handling side-effects of Actions. | - |
| **Overlays** | `frontend/src/ui/overlay/` + `ui/registry/OverlayRegistry.tsx` | Global transient workflow host (create/confirm/picker flows). 20 registered overlay types. | N/A |
| **Workspace** | `frontend/src/workspace/` | Panel registry, workspace presets (7), theme system (5 presets), content routing. | N/A |

### Active Backend Modules

| Module | Location | Purpose |
|---|---|---|
| **Actions** | `backend/src/modules/actions` | Intent declarations (immutable). |
| **Auth** | `backend/src/modules/auth` | Authentication & sessions. |
| **Composer** | `backend/src/modules/composer` | Action composition (creates actions + events). |
| **Definitions** | `backend/src/modules/definitions` | Record definition CRUD. |
| **Events** | `backend/src/modules/events` | Event querying & workflow surfaces. |
| **Exports** | `backend/src/modules/exports` | Export session orchestration (projectors/, targets/, formatters/, connectors/). |
| **GC** | `backend/src/modules/gc` | Garbage collection. |
| **Hierarchy** | `backend/src/modules/hierarchy` | Tree/hierarchy visualization and management. |
| **Imports** | `backend/src/modules/imports` | CSV/Monday import, classification, webhooks. |
| **Intake** | `backend/src/modules/intake` | Public intake forms. |
| **Interpreter** | `backend/src/modules/interpreter` | Data interpretation + 11 domain-specific mapping rule files. |
| **Links** | `backend/src/modules/links` | Record-to-record relationships. |
| **Polls** | `backend/src/modules/polls` | Scheduling polls. |
| **Projections** | `backend/src/modules/projections` | Workflow surface projectors (derived state). |
| **Records** | `backend/src/modules/records` | Records + fact-kinds (context containers). |
| **References** | `backend/src/modules/references` | Action/task references. |
| **Runner** | `backend/src/modules/runner` | AutoHelper runner connector. |
| **Search** | `backend/src/modules/search` | Full-text search. |

## 2. Legacy Inventory

Components identified as deprecated or superseded by the new system.

| Component | Location | Status | Replacement |
|---|---|---|---|
| **Modals** | `frontend/src/components/modals` | **Removed** | `frontend/src/ui/overlay/` + `OverlayRegistry` |
| **Drawers / DrawerRegistry** | `frontend/src/components/drawer` | **Removed** | `frontend/src/ui/overlay/` + `OverlayRegistry` |
| **Legacy Task Tables** | `TaskDataTable.tsx` | **Removed** | `DataTableHierarchy` / `DataTableFlat` |
| **Ingestion Drawer** | `IngestionDrawer.tsx` | **Removed** | Imports module (`backend/src/modules/imports`) |
| **Project Templates** | `cloneProjectTemplates` | **Removed** | `cloneProjectDefinitions` |
| **Ingestion module** | `backend/src/modules/ingestion` | **Removed** | Renamed to `imports/` |

---

## 3. Deprecation Proposals

### Proposal 1: Remove `frontend/src/components/modals` Directory

**Status: DONE** — directory deleted. The overlay system (`OverlayRegistry`) fully replaces modal-based workflows.

### Proposal 2: Enforce Composer for All Creations

**Status: Open**

The `composer` module (`POST /composer`) is designed as the single entry point for creating task-like entities to ensure proper Action/Event generation.
- **Recommendation:** Audit `records.routes.ts` or `hierarchy.routes.ts` for direct CREATE operations and mark them as `@deprecated`.

### Proposal 3: Clean up `clone_excluded` Logic

**Status: Open**

Documentation mentions `project_id` on `record_definitions` as driving template library logic, and it's potentially legacy.
- **Action:** Verify if `clone_excluded` fully covers the requirement and remove the old `project_id` based logic if unused.

## Flags

- **Composer Usage:** Some API routes in `backend/src/modules/records` still expose direct creation endpoints that bypass the Composer; these should be flagged for deprecation.
- **Missing Header Comments – Backend Modules:** `backend/src/modules/composer/composer.routes.ts`, `composer.service.ts`, `actions.routes.ts`, `events.routes.ts` lack file‑level comment headers.
- **Out‑of‑Date API Documentation:** README lists `npm run dev` for Windows, but the correct command is `npm run dev:win`.
- **Undocumented Environment Variables:** `.env.example` contains `SMTP_HOST` and `SMTP_PORT` not referenced in docs.
- **Missing Tests for New Modules:** No test files for `backend/src/modules/composer`.
- **Stale Documentation Links:** Demo URLs in README point to outdated paths.
- **Missing Export Statements:** Module index files (e.g., `backend/src/modules/records/index.ts`) do not re‑export sub‑modules.
